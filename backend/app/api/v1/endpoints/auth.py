"""
Authentication endpoints for user login, logout, and token management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import create_access_token, create_refresh_token, decode_token, verify_password
from app.core.deps import get_current_user
from app.crud import user as user_crud
from app.crud import refresh_token as token_crud
from app.services.auth_service import google_auth_service
from app.models.user import User, UserRole, AuthProvider

router = APIRouter()


class LocalLoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    code: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    profile_picture_url: Optional[str] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


@router.post("/local/login", response_model=AuthResponse)
async def local_login(
    request: LocalLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with username (email) and password."""
    # Get user by email
    user = await user_crud.get_user_by_email(db, request.email)

    if not user or user.auth_provider != AuthProvider.LOCAL.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Verify password
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Update last login
    await user_crud.update_last_login(db, user.id)

    # Create JWT tokens
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})

    await token_crud.create_refresh_token(
        db,
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


@router.post("/google/login", response_model=AuthResponse)
async def google_login(
    request: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with Google OAuth."""
    try:
        # Exchange code for tokens
        tokens = await google_auth_service.exchange_code_for_tokens(request.code)
        user_info = await google_auth_service.verify_id_token(tokens["id_token"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google authentication failed: {str(e)}"
        )

    # Check if user exists
    user = await user_crud.get_user_by_email(db, user_info["email"])

    if not user:
        # Create new user
        user = await user_crud.create_user(
            db,
            email=user_info["email"],
            full_name=user_info["name"],
            auth_provider=AuthProvider.GOOGLE.value,
            provider_user_id=user_info["provider_user_id"],
            profile_picture_url=user_info.get("picture"),
            role=UserRole.USER.value
        )
    else:
        # Update last login
        await user_crud.update_last_login(db, user.id)

    # Create JWT tokens
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})

    await token_crud.create_refresh_token(
        db,
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


@router.post("/refresh")
async def refresh_access_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh the access token using a refresh token."""
    payload = decode_token(request.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Check if refresh token exists and is not revoked
    db_token = await token_crud.get_refresh_token(db, request.refresh_token)

    if not db_token or db_token.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token"
        )

    # Check if token is expired
    if db_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )

    # Get user
    user = await user_crud.get_user(db, db_token.user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Create new access token
    access_token = create_access_token({"sub": user.id, "role": user.role})

    return {
        "access_token": access_token,
        "refresh_token": request.refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout(
    request: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout by revoking the refresh token."""
    await token_crud.revoke_refresh_token(db, request.refresh_token)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get the current user's information."""
    return UserResponse.from_orm(current_user)
