from typing import Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class DatabaseType(str, Enum):
    """Database type enumeration."""
    POSTGRESQL = "postgresql"
    REDSHIFT = "redshift"


class CredentialCreate(BaseModel):
    """Schema for creating a credential."""
    name: str = Field(..., min_length=1, max_length=255, description="Credential name")
    db_type: DatabaseType
    host: str = Field(..., min_length=1, description="Database host")
    port: int = Field(..., ge=1, le=65535, description="Database port")
    database: str = Field(..., min_length=1, description="Database name")
    username: str = Field(..., min_length=1, description="Database username")
    password: str = Field(..., min_length=1, description="Database password")
    ssl_mode: Optional[str] = Field(default="prefer", description="SSL mode (prefer, require, disable)")
    user_id: Optional[int] = Field(default=None, description="Owner user ID (admin only)")

    @validator('port', pre=True)
    def set_default_port(cls, v, values):
        if v is None and 'db_type' in values:
            if values['db_type'] == DatabaseType.POSTGRESQL:
                return 5432
            elif values['db_type'] == DatabaseType.REDSHIFT:
                return 5439
        return v


class CredentialUpdate(BaseModel):
    """Schema for updating a credential."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    host: Optional[str] = None
    port: Optional[int] = Field(None, ge=1, le=65535)
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_mode: Optional[str] = None


class CredentialResponse(BaseModel):
    """Schema for credential response (without password)."""
    id: int
    name: str
    db_type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    ssl_mode: Optional[str]
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConnectionTestRequest(BaseModel):
    """Schema for testing a database connection."""
    db_type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl_mode: Optional[str] = "prefer"


class ConnectionTestResponse(BaseModel):
    """Schema for connection test result."""
    success: bool
    message: str
    server_version: Optional[str] = None
    connection_time_ms: Optional[float] = None


class TableInfo(BaseModel):
    """Schema for database table information."""
    schema_name: str = Field(..., alias="schema", serialization_alias="schema_name")
    name: str
    row_count: Optional[int] = None
    column_count: int
    columns: list[dict]  # List of column info dicts

    class Config:
        populate_by_name = True


class TableListResponse(BaseModel):
    """Schema for list of tables."""
    tables: list[TableInfo]
