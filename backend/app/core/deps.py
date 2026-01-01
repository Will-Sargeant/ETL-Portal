from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import decode_token
from app.models.user import User, UserRole
from app.crud import user as user_crud

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate JWT token, return current user."""
    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        print(f"[AUTH DEBUG] Token decode failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token - decode failed"
        )

    if payload.get("type") != "access":
        print(f"[AUTH DEBUG] Wrong token type: {payload.get('type')}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token - wrong type: {payload.get('type')}"
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        print(f"[AUTH DEBUG] No user_id in payload: {payload}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload - no user_id"
        )

    # Convert user_id from string to int (JWT spec requires sub to be string)
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        print(f"[AUTH DEBUG] Invalid user_id format: {user_id_str}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user_id format"
        )

    print(f"[AUTH DEBUG] Looking up user_id: {user_id}")
    user = await user_crud.get_user(db, user_id)

    if not user:
        print(f"[AUTH DEBUG] User {user_id} not found in database")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User {user_id} not found"
        )

    if not user.is_active:
        print(f"[AUTH DEBUG] User {user_id} is inactive")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive"
        )

    print(f"[AUTH DEBUG] Auth successful for user {user.email} (id={user.id})")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user."""
    return current_user


async def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require admin role for the current user."""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
