"""
Google Sheets API endpoints.

Provides endpoints for listing spreadsheets, sheets, and previewing data.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.google_sheets_service import google_sheets_service
from app.core.encryption import decrypt_credentials
import structlog

router = APIRouter()
logger = structlog.get_logger()


class ListSpreadsheetsRequest(BaseModel):
    """Request model for listing spreadsheets."""
    encrypted_credentials: str
    limit: int = 50  # Number of spreadsheets to return
    order_by: str = 'modifiedTime desc'  # Sort order


class ListSheetsRequest(BaseModel):
    """Request model for listing sheets."""
    encrypted_credentials: str


class PreviewSheetRequest(BaseModel):
    """Request model for previewing sheet data."""
    spreadsheet_id: str
    sheet_name: str
    encrypted_credentials: str


@router.post("/spreadsheets")
async def list_spreadsheets(request: ListSpreadsheetsRequest):
    """
    List user's Google Spreadsheets.

    Args:
        request: Contains encrypted Google OAuth credentials

    Returns:
        dict: Contains list of spreadsheets
            - spreadsheets: List of {id, name, modified}

    Raises:
        HTTPException: 500 if listing fails
    """
    try:
        credentials = decrypt_credentials(request.encrypted_credentials)
        spreadsheets = await google_sheets_service.list_spreadsheets(
            credentials,
            limit=request.limit,
            order_by=request.order_by
        )

        return {"spreadsheets": spreadsheets}

    except ValueError as e:
        logger.error("failed_to_list_spreadsheets", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("failed_to_list_spreadsheets", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list spreadsheets")


@router.post("/spreadsheets/{spreadsheet_id}/sheets")
async def list_sheets(spreadsheet_id: str, request: ListSheetsRequest):
    """
    List sheets within a spreadsheet.

    Args:
        spreadsheet_id: Google Sheets spreadsheet ID
        request: Contains encrypted Google OAuth credentials

    Returns:
        dict: Contains list of sheets
            - sheets: List of {id, name, index}

    Raises:
        HTTPException: 500 if listing fails
    """
    try:
        credentials = decrypt_credentials(request.encrypted_credentials)
        sheets = await google_sheets_service.list_sheets(spreadsheet_id, credentials)

        return {"sheets": sheets}

    except ValueError as e:
        logger.error("failed_to_list_sheets", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("failed_to_list_sheets", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list sheets")


@router.post("/preview")
async def preview_sheet_data(request: PreviewSheetRequest):
    """
    Preview first 100 rows of sheet data.

    Args:
        request: Contains spreadsheet_id, sheet_name, and encrypted credentials

    Returns:
        dict: Contains preview data
            - columns: List of column names
            - data: First 10 rows as list of dicts
            - total_rows: Total number of rows in preview

    Raises:
        HTTPException: 500 if preview fails
    """
    try:
        credentials = decrypt_credentials(request.encrypted_credentials)

        df = await google_sheets_service.get_sheet_data(
            spreadsheet_id=request.spreadsheet_id,
            sheet_name=request.sheet_name,
            credentials_dict=credentials,
            max_rows=100
        )

        return {
            "columns": list(df.columns),
            "data": df.head(10).to_dict('records'),
            "total_rows": len(df)
        }

    except ValueError as e:
        logger.error("failed_to_preview_sheet", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("failed_to_preview_sheet", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to preview sheet data")
