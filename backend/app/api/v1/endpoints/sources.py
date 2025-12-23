from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional

from app.schemas.source import UploadResponse, DataPreview, FileMetadata
from app.services.csv_service import csv_service
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/csv/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(..., description="CSV file to upload")
):
    """
    Upload a CSV file for processing.

    - **file**: CSV file (max size configured in settings)

    Returns file metadata, column analysis, and preview data.
    """
    logger.info("CSV upload request", filename=file.filename)
    return await csv_service.upload_csv(file)


@router.get("/csv/{file_id}/preview", response_model=DataPreview)
async def get_csv_preview(
    file_id: str,
    limit: Optional[int] = Query(None, description="Number of rows to preview", ge=1, le=1000)
):
    """
    Get preview data for an uploaded CSV file.

    - **file_id**: ID of the uploaded file
    - **limit**: Optional limit for number of preview rows
    """
    preview = await csv_service.get_preview(file_id, limit)

    if not preview:
        raise HTTPException(status_code=404, detail="File not found")

    return preview


@router.get("/csv/{file_id}/metadata", response_model=FileMetadata)
async def get_csv_metadata(file_id: str):
    """
    Get metadata for an uploaded CSV file.

    - **file_id**: ID of the uploaded file
    """
    metadata = csv_service.get_file_metadata(file_id)

    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")

    return metadata


@router.delete("/csv/{file_id}")
async def delete_csv(file_id: str):
    """
    Delete an uploaded CSV file.

    - **file_id**: ID of the uploaded file
    """
    success = csv_service.delete_file(file_id)

    if not success:
        raise HTTPException(status_code=404, detail="File not found")

    return {"message": "File deleted successfully", "file_id": file_id}