from typing import Optional, List
from pydantic import BaseModel


class TableColumn(BaseModel):
    """Schema for table column metadata."""
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None


class TableSchema(BaseModel):
    """Schema for database table structure."""
    schema_name: str
    table_name: str
    columns: List[TableColumn]
