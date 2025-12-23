from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ColumnMapping(Base):
    """Column mapping model for ETL jobs."""

    __tablename__ = "column_mappings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("etl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Source column
    source_column = Column(String(255), nullable=False)
    source_data_type = Column(String(100), nullable=True)

    # Destination column
    dest_column = Column(String(255), nullable=False)
    dest_data_type = Column(String(100), nullable=False)

    # Transformations applied to this column
    transformations = Column(JSON, nullable=True)  # List of transformation rules

    # Column properties
    is_nullable = Column(Boolean, default=True, nullable=False)
    default_value = Column(String(255), nullable=True)
    exclude = Column(Boolean, default=False, nullable=False)
    column_order = Column(Integer, default=0, nullable=False)
    is_primary_key = Column(Boolean, default=False, nullable=False)

    # Is this a calculated/derived column?
    is_calculated = Column(Boolean, default=False, nullable=False)
    calculation_expression = Column(String(1000), nullable=True)

    # Relationship
    job = relationship("ETLJob", back_populates="column_mappings")
