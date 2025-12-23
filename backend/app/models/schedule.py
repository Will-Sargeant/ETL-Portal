from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Schedule(Base):
    """Schedule model for ETL jobs."""

    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("etl_jobs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Schedule configuration
    cron_expression = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True, index=True)

    # Schedule tracking
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)

    # Airflow DAG ID
    airflow_dag_id = Column(String(255), nullable=True, unique=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    job = relationship("ETLJob", back_populates="schedule")
