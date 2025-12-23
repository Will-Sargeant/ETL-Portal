import os
import uuid
import pandas as pd
import chardet
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.source import ColumnInfo, DataPreview, UploadResponse, FileMetadata

logger = get_logger(__name__)


class CSVService:
    """Service for handling CSV file operations."""

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload_csv(self, file: UploadFile) -> UploadResponse:
        """
        Upload and process a CSV file.

        Args:
            file: Uploaded CSV file

        Returns:
            UploadResponse with file metadata and preview
        """
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")

        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(
                status_code=400,
                detail="Only CSV files are supported"
            )

        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_path = self.upload_dir / f"{file_id}.csv"

        # Read and save file
        try:
            content = await file.read()
            file_size = len(content)

            # Check file size
            if file_size > settings.MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE} bytes"
                )

            # Detect encoding
            encoding = self._detect_encoding(content)

            # Save file
            with open(file_path, 'wb') as f:
                f.write(content)

            logger.info(
                "CSV file uploaded",
                file_id=file_id,
                filename=file.filename,
                size=file_size,
                encoding=encoding
            )

            # Parse and analyze CSV
            df, row_count, column_count = self._parse_csv(file_path, encoding)
            columns = self._analyze_columns(df)
            preview = self._generate_preview(df, columns)

            return UploadResponse(
                file_id=file_id,
                filename=file.filename,
                file_size=file_size,
                row_count=row_count,
                column_count=column_count,
                columns=columns,
                preview=preview,
                uploaded_at=datetime.utcnow()
            )

        except pd.errors.EmptyDataError:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        except pd.errors.ParserError as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")
        except Exception as e:
            logger.error("Error uploading CSV", error=str(e), file_id=file_id)
            # Clean up file if it was created
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")

    def _detect_encoding(self, content: bytes) -> str:
        """Detect file encoding."""
        result = chardet.detect(content[:10000])  # Check first 10KB
        encoding = result['encoding']

        if encoding is None:
            encoding = 'utf-8'

        logger.debug("Detected encoding", encoding=encoding, confidence=result['confidence'])
        return encoding

    def _parse_csv(self, file_path: Path, encoding: str) -> Tuple[pd.DataFrame, int, int]:
        """
        Parse CSV file.

        Returns:
            Tuple of (DataFrame, row_count, column_count)
        """
        # Read CSV with pandas
        df = pd.read_csv(
            file_path,
            encoding=encoding,
            low_memory=False,
            keep_default_na=True
        )

        row_count = len(df)
        column_count = len(df.columns)

        logger.info(
            "CSV parsed successfully",
            rows=row_count,
            columns=column_count
        )

        return df, row_count, column_count

    def _analyze_columns(self, df: pd.DataFrame) -> List[ColumnInfo]:
        """Analyze DataFrame columns and infer data types."""
        columns = []

        for col in df.columns:
            series = df[col]

            # Count nulls
            null_count = series.isna().sum()

            # Get unique count
            unique_count = series.nunique()

            # Infer data type
            data_type = self._infer_data_type(series)

            # Get sample values (non-null)
            sample_values = series.dropna().head(5).tolist()

            columns.append(ColumnInfo(
                name=col,
                data_type=data_type,
                sample_values=sample_values,
                null_count=int(null_count),
                unique_count=int(unique_count),
                is_nullable=null_count > 0
            ))

        return columns

    def _infer_data_type(self, series: pd.Series) -> str:
        """
        Infer data type from pandas Series.

        Returns:
            One of: text, number, date, boolean
        """
        # Drop nulls for type inference
        non_null = series.dropna()

        if len(non_null) == 0:
            return "text"

        # Check for boolean
        unique_values = non_null.unique()
        if len(unique_values) <= 2:
            lower_values = [str(v).lower() for v in unique_values]
            if all(v in ['true', 'false', '1', '0', 'yes', 'no', 't', 'f', 'y', 'n'] for v in lower_values):
                return "boolean"

        # Check for numeric
        if pd.api.types.is_numeric_dtype(series):
            return "number"

        # Try to parse as datetime
        try:
            pd.to_datetime(non_null.head(100), errors='raise')
            return "date"
        except (ValueError, TypeError):
            pass

        # Default to text
        return "text"

    def _generate_preview(self, df: pd.DataFrame, columns: List[ColumnInfo]) -> DataPreview:
        """Generate data preview from DataFrame."""
        preview_rows = min(settings.MAX_PREVIEW_ROWS, len(df))
        preview_df = df.head(preview_rows)

        # Convert to list of dicts, handling NaN values
        # Replace NaN/NaT with None for JSON serialization
        rows = preview_df.where(pd.notna(preview_df), None).to_dict('records')

        return DataPreview(
            columns=columns,
            rows=rows,
            total_rows=len(df),
            preview_rows=preview_rows
        )

    def get_file_metadata(self, file_id: str) -> Optional[FileMetadata]:
        """Get metadata for an uploaded file."""
        file_path = self.upload_dir / f"{file_id}.csv"

        if not file_path.exists():
            return None

        try:
            # Re-parse the file to get metadata
            content = file_path.read_bytes()
            encoding = self._detect_encoding(content)
            df, row_count, column_count = self._parse_csv(file_path, encoding)
            columns = self._analyze_columns(df)

            return FileMetadata(
                file_id=file_id,
                filename=file_path.name,
                file_path=str(file_path),
                file_size=file_path.stat().st_size,
                row_count=row_count,
                column_count=column_count,
                uploaded_at=datetime.fromtimestamp(file_path.stat().st_mtime),
                columns=columns
            )
        except Exception as e:
            logger.error("Error getting file metadata", file_id=file_id, error=str(e))
            return None

    def delete_file(self, file_id: str) -> bool:
        """Delete an uploaded file."""
        file_path = self.upload_dir / f"{file_id}.csv"

        if file_path.exists():
            try:
                file_path.unlink()
                logger.info("File deleted", file_id=file_id)
                return True
            except Exception as e:
                logger.error("Error deleting file", file_id=file_id, error=str(e))
                return False

        return False

    async def get_preview(self, file_id: str, limit: int = None) -> Optional[DataPreview]:
        """Get preview data for an uploaded file."""
        metadata = self.get_file_metadata(file_id)

        if not metadata:
            return None

        try:
            file_path = self.upload_dir / f"{file_id}.csv"
            content = file_path.read_bytes()
            encoding = self._detect_encoding(content)
            df, _, _ = self._parse_csv(file_path, encoding)

            preview_limit = limit if limit else settings.MAX_PREVIEW_ROWS
            return self._generate_preview(df, metadata.columns)
        except Exception as e:
            logger.error("Error generating preview", file_id=file_id, error=str(e))
            return None


# Global service instance
csv_service = CSVService()