from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ColumnInfo(BaseModel):
    """Column information schema."""
    name: str
    data_type: str  # text, number, date, boolean
    sample_values: List[Any] = Field(default_factory=list)
    null_count: int = 0
    unique_count: Optional[int] = None
    is_nullable: bool = True


class DataPreview(BaseModel):
    """Data preview schema."""
    columns: List[ColumnInfo]
    rows: List[Dict[str, Any]]
    total_rows: int
    preview_rows: int


class UploadResponse(BaseModel):
    """CSV upload response schema."""
    file_id: str
    filename: str
    file_size: int
    row_count: int
    column_count: int
    columns: List[ColumnInfo]
    preview: DataPreview
    uploaded_at: datetime


class FileMetadata(BaseModel):
    """Stored file metadata."""
    file_id: str
    filename: str
    file_path: str
    file_size: int
    row_count: int
    column_count: int
    uploaded_at: datetime
    columns: List[ColumnInfo]