"""
User management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging

from app.core.database import get_db
from app.core.deps import require_admin
from app.crud import user as user_crud
from app.models.user import User, UserRole, AuthProvider
from app.schemas.user import UserCreate, UserResponse, UserRoleUpdate, UserUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[UserResponse])
async def list_users(
    include_inactive: bool = False,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users. Admin only."""
    if include_inactive:
        users = await user_crud.list_all_users(db)
    else:
        users = await user_crud.list_users(db)
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user. Admin only."""
    # Check if user already exists
    existing_user = await user_crud.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {user_data.email} already exists"
        )

    # Create user with local auth provider
    user = await user_crud.create_user(
        db,
        email=user_data.email,
        full_name=user_data.full_name,
        auth_provider=AuthProvider.LOCAL.value,
        role=user_data.role.value,
        password=user_data.password
    )

    logger.info(f"Admin {current_admin.email} created new user {user.email} with role {user.role}")
    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a user's role. Admin only."""
    user = await user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    # Prevent admin from demoting themselves
    if user.id == current_admin.id and role_update.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot demote yourself from admin role"
        )

    updated_user = await user_crud.update_user_role(db, user_id, role_update.role.value)
    logger.info(f"Admin {current_admin.email} updated user {user.email} role to {role_update.role.value}")
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate a user (soft delete). Admin only."""
    user = await user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    # Prevent admin from deleting themselves
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself"
        )

    await user_crud.deactivate_user(db, user_id)
    logger.info(f"Admin {current_admin.email} deactivated user {user.email}")
    return None
