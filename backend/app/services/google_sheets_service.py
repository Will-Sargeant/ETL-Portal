"""
Google Sheets Service.

Provides functionality to interact with Google Sheets API.
"""

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import pandas as pd
import structlog

logger = structlog.get_logger()


class GoogleSheetsService:
    """Service for interacting with Google Sheets API."""

    def _get_credentials(self, credentials_dict: dict) -> Credentials:
        """
        Convert credentials dictionary to Credentials object.

        Args:
            credentials_dict: Dictionary containing OAuth credentials

        Returns:
            Google Credentials object
        """
        return Credentials(
            token=credentials_dict['token'],
            refresh_token=credentials_dict.get('refresh_token'),
            token_uri=credentials_dict['token_uri'],
            client_id=credentials_dict['client_id'],
            client_secret=credentials_dict['client_secret'],
            scopes=credentials_dict['scopes'],
        )

    async def list_spreadsheets(
        self,
        credentials_dict: dict,
        limit: int = 50,
        order_by: str = 'modifiedTime desc'
    ) -> list:
        """
        List user's spreadsheets from Google Drive.

        Args:
            credentials_dict: Decrypted Google OAuth credentials
            limit: Maximum number of spreadsheets to return (default: 50)
            order_by: Sort order (default: 'modifiedTime desc')

        Returns:
            List of spreadsheets with id, name, and modified time

        Raises:
            Exception: If listing spreadsheets fails
        """
        credentials = self._get_credentials(credentials_dict)

        try:
            service = build('drive', 'v3', credentials=credentials)
            results = service.files().list(
                q="mimeType='application/vnd.google-apps.spreadsheet'",
                pageSize=min(limit, 1000),  # Google Drive API max is 1000
                fields="files(id, name, modifiedTime)",
                orderBy=order_by
            ).execute()

            files = results.get('files', [])

            spreadsheets = [
                {
                    'id': file['id'],
                    'name': file['name'],
                    'modified': file.get('modifiedTime')
                }
                for file in files
            ]

            logger.info(
                "spreadsheets_listed",
                count=len(spreadsheets),
                limit=limit,
                order_by=order_by
            )

            return spreadsheets

        except Exception as e:
            logger.error("failed_to_list_spreadsheets", error=str(e))
            raise

    async def list_sheets(self, spreadsheet_id: str, credentials_dict: dict) -> list:
        """
        List sheets within a spreadsheet.

        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            credentials_dict: Decrypted Google OAuth credentials

        Returns:
            List of sheets with id, name, and index

        Raises:
            Exception: If listing sheets fails
        """
        credentials = self._get_credentials(credentials_dict)

        try:
            service = build('sheets', 'v4', credentials=credentials)
            spreadsheet = service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()

            sheets = spreadsheet.get('sheets', [])

            sheet_list = [
                {
                    'id': sheet['properties']['sheetId'],
                    'name': sheet['properties']['title'],
                    'index': sheet['properties']['index']
                }
                for sheet in sheets
            ]

            logger.info(
                "sheets_listed",
                spreadsheet_id=spreadsheet_id,
                count=len(sheet_list)
            )

            return sheet_list

        except Exception as e:
            logger.error(
                "failed_to_list_sheets",
                spreadsheet_id=spreadsheet_id,
                error=str(e)
            )
            raise

    async def get_sheet_data(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        credentials_dict: dict,
        max_rows: int = None,
        start_row: int = 1,
        header_row: int = None,
        end_row: int = None,
        start_column: str = 'A',
        end_column: str = None
    ) -> pd.DataFrame:
        """
        Fetch data from a specific sheet with custom range support.

        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            sheet_name: Name of the sheet to fetch
            credentials_dict: Decrypted Google OAuth credentials
            max_rows: Optional limit on number of rows to fetch (for preview)
            start_row: First row to read (1-indexed, defaults to 1)
            header_row: Row containing headers (1-indexed, defaults to start_row)
            end_row: Last row to read (optional, defaults to all rows)
            start_column: First column (A, B, C, etc., defaults to A)
            end_column: Last column (optional, defaults to all columns)

        Returns:
            DataFrame containing sheet data with specified headers

        Raises:
            Exception: If fetching sheet data fails
        """
        credentials = self._get_credentials(credentials_dict)

        # Default header_row to start_row if not specified
        if header_row is None:
            header_row = start_row

        # Validate range configuration
        if end_row is not None and start_row > end_row:
            raise ValueError(
                f"Invalid row range: Start row ({start_row}) cannot be greater than end row ({end_row})"
            )

        if end_column is not None:
            # Convert column letters to indices for comparison
            def column_to_index(letter: str) -> int:
                """Convert column letter to 0-based index (A=0, B=1, Z=25, AA=26)"""
                index = 0
                for char in letter.upper():
                    index = index * 26 + (ord(char) - ord('A') + 1)
                return index - 1

            start_col_idx = column_to_index(start_column)
            end_col_idx = column_to_index(end_column)

            if start_col_idx > end_col_idx:
                raise ValueError(
                    f"Invalid column range: Start column ({start_column}) cannot be after end column ({end_column})"
                )

        try:
            service = build('sheets', 'v4', credentials=credentials)

            # Check if we need to fetch the header separately (when header_row < start_row)
            headers = None
            if header_row < start_row:
                # Fetch header row separately
                header_range = f"'{sheet_name}'!{start_column}{header_row}:{end_column if end_column else ''}{header_row}"
                header_result = service.spreadsheets().values().get(
                    spreadsheetId=spreadsheet_id,
                    range=header_range
                ).execute()
                header_values = header_result.get('values', [])
                if header_values:
                    headers = header_values[0]
                else:
                    raise ValueError(
                        f"Header row {header_row} is empty or not found. "
                        f"Please verify the header row number is correct."
                    )

                logger.debug(
                    "fetched_separate_header",
                    header_row=header_row,
                    headers=headers
                )

            # Build range string for data
            # Note: Google Sheets API behaves inconsistently with open-ended ranges like "Sheet1!A1"
            # It may only return the first column. Using just the sheet name returns all data reliably.
            if end_column or end_row:
                # Specific range specified
                end_col = end_column if end_column else ""
                end_row_num = end_row if end_row else ""
                range_name = f"'{sheet_name}'!{start_column}{start_row}:{end_col}{end_row_num}"
            elif start_column == 'A' and start_row == 1:
                # Reading from A1 with no end - just use sheet name to get all data
                range_name = f"'{sheet_name}'"
            else:
                # Custom start position with no end - use large range to ensure all columns
                range_name = f"'{sheet_name}'!{start_column}{start_row}:ZZZ"

            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()

            values = result.get('values', [])

            logger.debug(
                "raw_api_response",
                spreadsheet_id=spreadsheet_id,
                range=range_name,
                value_count=len(values),
                first_row=values[0] if values else None,
                all_values=values
            )

            if not values:
                logger.warning(
                    "empty_sheet_range",
                    spreadsheet_id=spreadsheet_id,
                    sheet_name=sheet_name,
                    range=range_name
                )
                return pd.DataFrame()

            # If we haven't fetched headers separately, extract them from the data
            if headers is None:
                # Calculate header row index relative to fetched data
                header_idx = header_row - start_row

                # Ensure header_idx is within bounds
                if header_idx < 0 or header_idx >= len(values):
                    raise ValueError(
                        f"Header row {header_row} not found in the fetched data range (rows {start_row} to {start_row + len(values) - 1}). "
                        f"The sheet may have fewer rows than expected, or your End Row setting is too restrictive."
                    )

                # Extract headers from specified row
                headers = values[header_idx]

                # Get data rows (all rows after header row)
                data_start_idx = header_idx + 1
                all_data_rows = values[data_start_idx:]
            else:
                # Headers were fetched separately, so all values are data
                all_data_rows = values

            # Apply max_rows limit if specified (for preview)
            data_rows = all_data_rows[:max_rows] if max_rows else all_data_rows

            # Pad rows to match header length (handle jagged arrays)
            padded_rows = []
            for row in data_rows:
                padded_row = row + [''] * (len(headers) - len(row))
                padded_rows.append(padded_row)

            df = pd.DataFrame(padded_rows, columns=headers)

            logger.info(
                "sheet_data_fetched",
                spreadsheet_id=spreadsheet_id,
                sheet_name=sheet_name,
                range=range_name,
                header_row=header_row,
                rows=len(df),
                columns=len(df.columns)
            )

            return df

        except ValueError as e:
            # Re-raise validation errors with original message
            logger.error(
                "failed_to_fetch_sheet_data",
                spreadsheet_id=spreadsheet_id,
                sheet_name=sheet_name,
                range=range_name if 'range_name' in locals() else 'unknown',
                error=str(e)
            )
            raise
        except Exception as e:
            # Handle Google API errors with user-friendly messages
            error_message = str(e).lower()
            logger.error(
                "failed_to_fetch_sheet_data",
                spreadsheet_id=spreadsheet_id,
                sheet_name=sheet_name,
                range=range_name if 'range_name' in locals() else 'unknown',
                error=str(e)
            )

            # Provide helpful error messages based on common Google API errors
            if '404' in error_message or 'not found' in error_message:
                raise ValueError(
                    f"Sheet '{sheet_name}' not found in the spreadsheet. "
                    f"Please verify the sheet name is correct (names are case-sensitive)."
                )
            elif '403' in error_message or 'permission denied' in error_message:
                raise ValueError(
                    "Permission denied. Please ensure:\n"
                    "1. The spreadsheet is shared with your Google account\n"
                    "2. You have at least 'Viewer' access to the spreadsheet\n"
                    "3. Your OAuth credentials are still valid (try re-authenticating)"
                )
            elif 'invalid' in error_message and 'range' in error_message:
                raise ValueError(
                    f"Invalid range specification. Please check that:\n"
                    f"- Column letters are valid (A-Z, AA-ZZ, etc.)\n"
                    f"- Row numbers are positive integers\n"
                    f"- End row/column comes after start row/column"
                )
            elif 'quota' in error_message or 'rate limit' in error_message:
                raise ValueError(
                    "Google Sheets API quota exceeded. Please wait a moment and try again. "
                    "If this persists, consider reducing the frequency of requests."
                )
            else:
                # Re-raise original exception if not a recognized error
                raise


# Singleton instance
google_sheets_service = GoogleSheetsService()
