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
        max_rows: int = None
    ) -> pd.DataFrame:
        """
        Fetch data from a specific sheet.

        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            sheet_name: Name of the sheet to fetch
            credentials_dict: Decrypted Google OAuth credentials
            max_rows: Optional limit on number of rows to fetch

        Returns:
            DataFrame containing sheet data (first row as headers)

        Raises:
            Exception: If fetching sheet data fails
        """
        credentials = self._get_credentials(credentials_dict)

        try:
            service = build('sheets', 'v4', credentials=credentials)

            # Get sheet data
            range_name = f"'{sheet_name}'"
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()

            values = result.get('values', [])

            if not values:
                logger.warning(
                    "empty_sheet",
                    spreadsheet_id=spreadsheet_id,
                    sheet_name=sheet_name
                )
                return pd.DataFrame()

            # First row as headers
            headers = values[0]
            data_rows = values[1:max_rows+1] if max_rows else values[1:]

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
                rows=len(df),
                columns=len(df.columns)
            )

            return df

        except Exception as e:
            logger.error(
                "failed_to_fetch_sheet_data",
                spreadsheet_id=spreadsheet_id,
                sheet_name=sheet_name,
                error=str(e)
            )
            raise


# Singleton instance
google_sheets_service = GoogleSheetsService()
