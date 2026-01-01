from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class AuthProvider(str, enum.Enum):
    LOCAL = "local"  # Username/password
    GOOGLE = "google"
    SAML = "saml"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)  # Only for local auth
    role = Column(String(50), nullable=False, default=UserRole.USER.value)
    auth_provider = Column(String(50), nullable=False)
    provider_user_id = Column(String(255), nullable=True)
    profile_picture_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
