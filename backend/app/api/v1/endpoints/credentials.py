from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.user import User, UserRole
from app.crud import credential as credential_crud
from app.crud import user as user_crud
from app.schemas.credential import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse
)
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=CredentialResponse, status_code=201)
async def create_credential(
    credential: CredentialCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new database credential.

    The password will be encrypted and stored securely.
    Admins can optionally assign credentials to other users via user_id.
    """
    # Determine the owner of the credential
    owner_id = current_user.id  # Default to current user

    # If admin provided a user_id, validate and use it
    if credential.user_id is not None:
        if current_user.role == UserRole.ADMIN.value:
            # Validate that the specified user exists and is active
            target_user = await user_crud.get_user(db, credential.user_id)
            if not target_user:
                raise HTTPException(
                    status_code=400,
                    detail=f"User with ID {credential.user_id} not found"
                )
            if not target_user.is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot assign credential to inactive user"
                )
            owner_id = credential.user_id
            logger.info(f"Admin {current_user.email} assigning credential to user {target_user.email}")
        else:
            # Non-admin users cannot specify user_id (security)
            logger.warning(f"Non-admin user {current_user.email} attempted to specify user_id, ignoring")

    logger.info("Creating credential", name=credential.name, db_type=credential.db_type, user_id=owner_id)
    db_credential = await credential_crud.create_credential(db, credential, user_id=owner_id)
    return db_credential


@router.get("/", response_model=List[CredentialResponse])
async def list_credentials(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of credentials. Admins see all, regular users see only their own."""
    if current_user.role == UserRole.ADMIN.value:
        if user_id:
            credentials = await credential_crud.get_user_credentials(db, user_id, skip=skip, limit=limit)
        else:
            credentials = await credential_crud.get_credentials(db, skip=skip, limit=limit)
    else:
        credentials = await credential_crud.get_user_credentials(db, current_user.id, skip=skip, limit=limit)

    # Fetch user emails for each credential
    from app.crud import user as user_crud
    result = []
    for cred in credentials:
        cred_dict = {
            "id": cred.id,
            "name": cred.name,
            "db_type": cred.db_type,
            "host": cred.host,
            "port": cred.port,
            "database": cred.database,
            "username": cred.username,
            "ssl_mode": cred.ssl_mode,
            "user_id": cred.user_id,
            "created_at": cred.created_at,
            "updated_at": cred.updated_at,
            "user_email": None
        }
        if cred.user_id:
            user = await user_crud.get_user(db, cred.user_id)
            if user:
                cred_dict["user_email"] = user.email
        result.append(cred_dict)

    return result


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific credential by ID."""
    credential = await credential_crud.get_credential(db, credential_id)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Check ownership or admin
    if current_user.role != UserRole.ADMIN.value and credential.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this credential")

    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: int,
    credential_update: CredentialUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a credential."""
    # Check if credential exists and user has access
    credential = await credential_crud.get_credential(db, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Check ownership or admin
    if current_user.role != UserRole.ADMIN.value and credential.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this credential")

    credential = await credential_crud.update_credential(db, credential_id, credential_update)
    logger.info("Updated credential", credential_id=credential_id, user_id=current_user.id)
    return credential


@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a credential."""
    # Check if credential exists and user has access
    credential = await credential_crud.get_credential(db, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Check ownership or admin
    if current_user.role != UserRole.ADMIN.value and credential.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this credential")

    success = await credential_crud.delete_credential(db, credential_id)
    logger.info("Deleted credential", credential_id=credential_id, user_id=current_user.id)
    return {"message": "Credential deleted successfully"}
