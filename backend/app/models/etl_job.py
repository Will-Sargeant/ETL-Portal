from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Enum, Boolean, Text
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class JobStatus(str, enum.Enum):
    """ETL Job status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class SourceType(str, enum.Enum):
    """Data source type enumeration."""
    CSV = "csv"
    GOOGLE_SHEETS = "google_sheets"


class DestinationType(str, enum.Enum):
    """Destination database type enumeration."""
    POSTGRESQL = "postgresql"
    REDSHIFT = "redshift"


class ETLJob(Base):
    """ETL Job model."""

    __tablename__ = "etl_jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=True)

    # Source configuration
    source_type = Column(Enum(SourceType), nullable=False)
    source_config = Column(JSON, nullable=False)  # File path, sheet ID, etc.

    # Destination configuration
    destination_type = Column(Enum(DestinationType), nullable=False)
    destination_config = Column(JSON, nullable=False)  # Table name, credential ID, etc.

    # Load strategy
    load_strategy = Column(String(50), nullable=False, default="insert")  # insert, upsert
    upsert_keys = Column(JSON, nullable=True)  # Columns for upsert detection

    # Transformation rules
    transformation_rules = Column(JSON, nullable=True)

    # Batch configuration
    batch_size = Column(Integer, default=10000)

    # New table creation
    create_new_table = Column(Boolean, default=False, nullable=False)
    new_table_ddl = Column(Text, nullable=True)

    # Status
    status = Column(Enum(JobStatus), default=JobStatus.DRAFT, index=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    column_mappings = relationship("ColumnMapping", back_populates="job", cascade="all, delete-orphan")
    job_runs = relationship("JobRun", back_populates="job", cascade="all, delete-orphan")
    schedule = relationship("Schedule", back_populates="job", uselist=False, cascade="all, delete-orphan")
