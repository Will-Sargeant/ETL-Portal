from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.crud import credential as credential_crud
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
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new database credential.

    The password will be encrypted and stored securely.
    """
    logger.info("Creating credential", name=credential.name, db_type=credential.db_type)
    db_credential = await credential_crud.create_credential(db, credential)
    return db_credential


@router.get("/", response_model=List[CredentialResponse])
async def list_credentials(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get list of all credentials."""
    credentials = await credential_crud.get_credentials(db, skip=skip, limit=limit)
    return credentials


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific credential by ID."""
    credential = await credential_crud.get_credential(db, credential_id)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: int,
    credential_update: CredentialUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a credential."""
    credential = await credential_crud.update_credential(db, credential_id, credential_update)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    logger.info("Updated credential", credential_id=credential_id)
    return credential


@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a credential."""
    success = await credential_crud.delete_credential(db, credential_id)

    if not success:
        raise HTTPException(status_code=404, detail="Credential not found")

    logger.info("Deleted credential", credential_id=credential_id)
    return {"message": "Credential deleted successfully"}
