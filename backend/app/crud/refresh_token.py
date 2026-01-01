from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.refresh_token import RefreshToken


async def create_refresh_token(
    db: AsyncSession,
    user_id: int,
    token: str,
    expires_at: datetime,
    device_info: str = None
) -> RefreshToken:
    """Create a new refresh token."""
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
        device_info=device_info
    )
    db.add(refresh_token)
    await db.commit()
    await db.refresh(refresh_token)
    return refresh_token


async def get_refresh_token(db: AsyncSession, token: str) -> RefreshToken:
    """Get a refresh token by token string."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            RefreshToken.is_revoked == False
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: str):
    """Revoke a refresh token."""
    db_token = await get_refresh_token(db, token)
    if db_token:
        db_token.is_revoked = True
        await db.commit()
