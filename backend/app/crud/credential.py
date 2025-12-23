from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credential import Credential
from app.schemas.credential import CredentialCreate, CredentialUpdate
from app.core.security import encrypt_connection_string, decrypt_connection_string


def build_connection_string(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    ssl_mode: Optional[str] = None
) -> str:
    """Build a database connection string."""
    if db_type == "postgresql":
        base = f"postgresql://{username}:{password}@{host}:{port}/{database}"
        if ssl_mode and ssl_mode != "disable":
            base += f"?sslmode={ssl_mode}"
        return base
    elif db_type == "redshift":
        base = f"redshift+redshift_connector://{username}:{password}@{host}:{port}/{database}"
        if ssl_mode and ssl_mode != "disable":
            base += f"?sslmode={ssl_mode}"
        return base
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


async def create_credential(
    db: AsyncSession,
    credential: CredentialCreate
) -> Credential:
    """Create a new credential."""
    # Build connection string
    connection_string = build_connection_string(
        db_type=credential.db_type.value,
        host=credential.host,
        port=credential.port,
        database=credential.database,
        username=credential.username,
        password=credential.password,
        ssl_mode=credential.ssl_mode
    )

    # Encrypt connection string
    encrypted_string = encrypt_connection_string(connection_string)

    # Create credential
    db_credential = Credential(
        name=credential.name,
        db_type=credential.db_type,
        encrypted_connection_string=encrypted_string,
        host=credential.host,
        port=credential.port,
        database=credential.database,
        username=credential.username,
        ssl_mode=credential.ssl_mode,
    )

    db.add(db_credential)
    await db.commit()
    await db.refresh(db_credential)

    return db_credential


async def get_credential(db: AsyncSession, credential_id: int) -> Optional[Credential]:
    """Get a credential by ID."""
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    return result.scalar_one_or_none()


async def get_credentials(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100
) -> List[Credential]:
    """Get all credentials."""
    result = await db.execute(
        select(Credential).offset(skip).limit(limit).order_by(Credential.created_at.desc())
    )
    return list(result.scalars().all())


async def update_credential(
    db: AsyncSession,
    credential_id: int,
    credential_update: CredentialUpdate
) -> Optional[Credential]:
    """Update a credential."""
    db_credential = await get_credential(db, credential_id)

    if not db_credential:
        return None

    update_data = credential_update.dict(exclude_unset=True)

    # If any connection details changed, rebuild and re-encrypt connection string
    if any(key in update_data for key in ['host', 'port', 'database', 'username', 'password', 'ssl_mode']):
        # Get current decrypted connection string
        current_string = decrypt_connection_string(db_credential.encrypted_connection_string)

        # Update values
        host = update_data.get('host', db_credential.host)
        port = update_data.get('port', db_credential.port)
        database = update_data.get('database', db_credential.database)
        username = update_data.get('username', db_credential.username)

        # For password, if not provided, extract from current connection string
        if 'password' in update_data:
            password = update_data['password']
        else:
            # Extract password from current connection string
            # Format: protocol://username:password@host:port/database
            parts = current_string.split('@')[0].split('//')[-1]
            password = parts.split(':')[-1]

        ssl_mode = update_data.get('ssl_mode')

        # Build new connection string
        new_connection_string = build_connection_string(
            db_type=db_credential.db_type.value,
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            ssl_mode=ssl_mode
        )

        # Encrypt and update
        update_data['encrypted_connection_string'] = encrypt_connection_string(new_connection_string)

    # Update fields
    for field, value in update_data.items():
        setattr(db_credential, field, value)

    await db.commit()
    await db.refresh(db_credential)

    return db_credential


async def delete_credential(db: AsyncSession, credential_id: int) -> bool:
    """Delete a credential."""
    db_credential = await get_credential(db, credential_id)

    if not db_credential:
        return False

    await db.delete(db_credential)
    await db.commit()

    return True


def get_connection_string(credential: Credential) -> str:
    """Get decrypted connection string from credential."""
    return decrypt_connection_string(credential.encrypted_connection_string)
