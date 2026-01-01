from typing import Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    USER = "user"


class AuthProvider(str, Enum):
    """Authentication provider enumeration."""
    LOCAL = "local"
    GOOGLE = "google"
    SAML = "saml"


class UserCreate(BaseModel):
    """Schema for creating a user."""
    email: str = Field(..., min_length=1, max_length=255, description="User email address")
    full_name: str = Field(..., min_length=1, max_length=255, description="User full name")
    password: str = Field(..., min_length=8, description="User password (minimum 8 characters)")
    role: UserRole = Field(default=UserRole.USER, description="User role")

    @validator('email')
    def validate_email(cls, v):
        """Validate email format."""
        if '@' not in v:
            raise ValueError('Invalid email address')
        return v.lower()


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = Field(None, min_length=8, description="New password (minimum 8 characters)")
    is_active: Optional[bool] = None


class UserRoleUpdate(BaseModel):
    """Schema for updating a user's role."""
    role: UserRole = Field(..., description="New user role")


class UserResponse(BaseModel):
    """Schema for user response (without sensitive data)."""
    id: int
    email: str
    full_name: str
    role: str
    auth_provider: str
    profile_picture_url: Optional[str] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
