from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole, AuthProvider
from app.core.auth import hash_password


async def get_user(db: AsyncSession, user_id: int) -> User:
    """Get a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User:
    """Get a user by email address."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    auth_provider: str,
    provider_user_id: str = None,
    role: str = UserRole.USER.value,
    profile_picture_url: str = None,
    password: str = None  # For local auth
) -> User:
    """Create a new user."""
    user_data = {
        "email": email,
        "full_name": full_name,
        "auth_provider": auth_provider,
        "provider_user_id": provider_user_id,
        "role": role,
        "profile_picture_url": profile_picture_url
    }

    # Hash password if provided (for local auth)
    if password:
        user_data["password_hash"] = hash_password(password)

    user = User(**user_data)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_last_login(db: AsyncSession, user_id: int):
    """Update the last login timestamp for a user."""
    user = await get_user(db, user_id)
    if user:
        user.last_login_at = datetime.utcnow()
        await db.commit()


async def list_users(db: AsyncSession):
    """List all active users."""
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.email))
    return result.scalars().all()


async def list_all_users(db: AsyncSession):
    """List all users (including inactive)."""
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


async def update_user_role(db: AsyncSession, user_id: int, role: str) -> User:
    """Update a user's role."""
    user = await get_user(db, user_id)
    if user:
        user.role = role
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user_id: int) -> User:
    """Deactivate a user (soft delete)."""
    user = await get_user(db, user_id)
    if user:
        user.is_active = False
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
    return user


async def update_user(
    db: AsyncSession,
    user_id: int,
    full_name: str = None,
    password: str = None,
    is_active: bool = None
) -> User:
    """Update user information."""
    user = await get_user(db, user_id)
    if user:
        if full_name is not None:
            user.full_name = full_name
        if password is not None:
            user.password_hash = hash_password(password)
        if is_active is not None:
            user.is_active = is_active
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
    return user
