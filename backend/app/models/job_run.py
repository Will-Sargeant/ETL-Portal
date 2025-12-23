from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, Text, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class RunStatus(str, enum.Enum):
    """Job run status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class JobRun(Base):
    """Job run history model."""

    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("etl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Run status
    status = Column(Enum(RunStatus), default=RunStatus.PENDING, index=True)

    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Progress tracking
    rows_processed = Column(BigInteger, default=0)
    rows_total = Column(BigInteger, nullable=True)
    progress_percentage = Column(Integer, default=0)

    # Error tracking
    error_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    rows_failed = Column(BigInteger, default=0)

    # Status message (general message for job completion, warnings, etc.)
    message = Column(Text, nullable=True)

    # Logs (stored as JSON array of log entries)
    logs = Column(Text, nullable=True)

    # Metadata
    triggered_by = Column(String(100), nullable=True)  # "manual", "schedule", "user_id"
    airflow_dag_run_id = Column(String(255), nullable=True)  # Airflow DAG run ID for tracking
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    job = relationship("ETLJob", back_populates="job_runs")
