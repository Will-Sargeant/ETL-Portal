from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    """ETL Job status enumeration."""
    DRAFT = "draft"
    LIVE = "live"
    ACTIVE = "active"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class RunStatus(str, Enum):
    """Job run status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class SourceType(str, Enum):
    """Data source type enumeration."""
    CSV = "csv"
    GOOGLE_SHEETS = "google_sheets"


class DestinationType(str, Enum):
    """Destination database type enumeration."""
    POSTGRESQL = "postgresql"
    REDSHIFT = "redshift"


class LoadStrategy(str, Enum):
    """Load strategy enumeration."""
    INSERT = "insert"
    UPSERT = "upsert"
    TRUNCATE_INSERT = "truncate_insert"


class ColumnMappingCreate(BaseModel):
    """Schema for creating a column mapping."""
    source_column: str = Field(..., description="Source column name")
    destination_column: str = Field(..., description="Destination column name")
    source_type: str = Field(..., description="Source data type")
    destination_type: str = Field(..., description="Destination data type")
    transformation: Optional[str] = Field(None, description="Single transformation function (deprecated)")
    transformations: Optional[List[str]] = Field(None, description="List of transformation functions to apply in order")
    is_nullable: bool = Field(default=True, description="Whether the column is nullable")
    default_value: Optional[str] = Field(None, description="Default value if source is null")
    exclude: bool = Field(default=False, description="Skip this column in the load")
    column_order: int = Field(default=0, description="Order in destination table")
    is_primary_key: bool = Field(default=False, description="Whether this column is part of the primary key")


class ColumnMappingResponse(BaseModel):
    """Schema for column mapping response."""
    id: int
    job_id: int
    source_column: str = Field(..., validation_alias="source_column")
    destination_column: str = Field(..., validation_alias="dest_column")
    source_type: str = Field(..., validation_alias="source_data_type")
    destination_type: str = Field(..., validation_alias="dest_data_type")
    transformation: Optional[str] = Field(None, description="Single transformation (deprecated)")
    transformations: Optional[List[str]] = Field(None, description="List of transformations")
    is_nullable: bool = Field(default=True)
    default_value: Optional[str] = Field(None)
    exclude: bool = Field(default=False)
    column_order: int = Field(default=0)
    is_primary_key: bool = Field(default=False)

    class Config:
        from_attributes = True
        populate_by_name = True


class ScheduleCreate(BaseModel):
    """Schema for creating a schedule."""
    cron_expression: str = Field(..., min_length=1, max_length=100, description="Cron expression")
    enabled: bool = Field(default=True, description="Whether the schedule is enabled")


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""
    cron_expression: Optional[str] = Field(None, min_length=1, max_length=100, description="Cron expression")
    enabled: Optional[bool] = Field(None, description="Whether the schedule is enabled")


class ScheduleResponse(BaseModel):
    """Schema for schedule response."""
    id: int
    job_id: int
    cron_expression: str
    enabled: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    airflow_dag_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ETLJobCreate(BaseModel):
    """Schema for creating an ETL job."""
    name: str = Field(..., min_length=1, max_length=255, description="Job name")
    description: Optional[str] = Field(None, max_length=1000, description="Job description")

    # Source configuration
    source_type: SourceType
    source_config: Dict[str, Any] = Field(..., description="Source configuration (file_path, etc.)")

    # Destination configuration
    destination_type: DestinationType
    destination_config: Dict[str, Any] = Field(..., description="Destination config (credential_id, table, schema)")

    # Load strategy
    load_strategy: LoadStrategy = Field(default=LoadStrategy.INSERT)
    upsert_keys: Optional[List[str]] = Field(None, description="Columns for upsert detection")

    # Transformation rules
    transformation_rules: Optional[Dict[str, Any]] = None

    # Batch configuration
    batch_size: int = Field(default=10000, ge=100, le=100000)

    # Column mappings
    column_mappings: List[ColumnMappingCreate] = Field(..., min_items=1, description="Column mappings")

    # Optional schedule
    schedule: Optional[ScheduleCreate] = Field(None, description="Optional job schedule")

    # New table creation
    create_new_table: bool = Field(default=False, description="Create new destination table")
    new_table_ddl: Optional[str] = Field(None, description="DDL for creating new table")


class ETLJobUpdate(BaseModel):
    """Schema for updating an ETL job."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    source_config: Optional[Dict[str, Any]] = None
    destination_config: Optional[Dict[str, Any]] = None
    load_strategy: Optional[LoadStrategy] = None
    upsert_keys: Optional[List[str]] = None
    transformation_rules: Optional[Dict[str, Any]] = None
    batch_size: Optional[int] = Field(None, ge=100, le=100000)
    status: Optional[JobStatus] = None

    # Column mappings
    column_mappings: Optional[List[ColumnMappingCreate]] = Field(None, description="Column mappings")

    # Optional schedule
    schedule: Optional[ScheduleCreate] = Field(None, description="Optional job schedule")

    # New table creation
    create_new_table: Optional[bool] = Field(None, description="Create new destination table")
    new_table_ddl: Optional[str] = Field(None, description="DDL for creating new table")


class ETLJobResponse(BaseModel):
    """Schema for ETL job response."""
    id: int
    name: str
    description: Optional[str]
    source_type: SourceType
    source_config: Dict[str, Any]
    destination_type: DestinationType
    destination_config: Dict[str, Any]
    load_strategy: str
    upsert_keys: Optional[List[str]]
    transformation_rules: Optional[Dict[str, Any]]
    batch_size: int
    status: JobStatus
    is_paused: bool = False
    created_at: datetime
    updated_at: datetime
    column_mappings: List[ColumnMappingResponse] = []

    class Config:
        from_attributes = True


class ETLJobListResponse(BaseModel):
    """Schema for ETL job list item."""
    id: int
    name: str
    description: Optional[str]
    source_type: SourceType
    destination_type: DestinationType
    destination_config: Dict[str, Any]
    status: JobStatus
    is_paused: bool = False
    created_at: datetime
    updated_at: datetime
    last_executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobRunResponse(BaseModel):
    """Schema for job run response."""
    id: int
    job_id: int
    status: RunStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    message: Optional[str] = None
    rows_processed: Optional[int] = None
    rows_failed: Optional[int] = None

    class Config:
        from_attributes = True
