from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
import enum

from app.core.database import Base


class DatabaseType(str, enum.Enum):
    """Database type enumeration."""
    POSTGRESQL = "postgresql"
    REDSHIFT = "redshift"


class Credential(Base):
    """Credential model for storing encrypted database credentials."""

    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # User-friendly name

    # Database type
    db_type = Column(Enum(DatabaseType), nullable=False)

    # Encrypted connection string
    encrypted_connection_string = Column(String(1000), nullable=False)

    # Connection details (non-sensitive, for display)
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    ssl_mode = Column(String(50), nullable=True, default="prefer")

    # User ownership
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
