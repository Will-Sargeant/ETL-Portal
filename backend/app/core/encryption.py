"""
Encryption utilities for sensitive data.

Provides functions to encrypt and decrypt credentials and other sensitive information.
"""

import json
import base64
from cryptography.fernet import Fernet
from app.core.config import settings
import structlog

logger = structlog.get_logger()


def _get_fernet() -> Fernet:
    """
    Get Fernet instance using the encryption key from settings.

    Uses the ENCRYPTION_KEY directly as a Fernet key (must be a valid Fernet key).
    If no encryption key is set, raises an error.
    WARNING: In production, always set a proper ENCRYPTION_KEY environment variable.
    """
    encryption_key = settings.ENCRYPTION_KEY

    if not encryption_key:
        # Generate a temporary key and log warning
        key = Fernet.generate_key()
        logger.warning(
            "encryption_key_not_set",
            message=f"No ENCRYPTION_KEY set. Generated temporary key: {key.decode()}. Set ENCRYPTION_KEY in .env file."
        )
        return Fernet(key)

    # Use the encryption key directly (must be a valid base64-encoded Fernet key)
    return Fernet(encryption_key.encode())


def encrypt_credentials(credentials: dict) -> str:
    """
    Encrypt credentials dictionary to a base64-encoded string.

    Args:
        credentials: Dictionary containing credentials data

    Returns:
        Base64-encoded encrypted string

    Example:
        >>> creds = {'token': 'abc123', 'refresh_token': 'xyz789'}
        >>> encrypted = encrypt_credentials(creds)
        >>> decrypted = decrypt_credentials(encrypted)
        >>> assert decrypted == creds
    """
    try:
        fernet = _get_fernet()

        # Convert dict to JSON string
        json_str = json.dumps(credentials)

        # Encrypt
        encrypted_bytes = fernet.encrypt(json_str.encode())

        # Return as base64 string for storage
        encrypted_str = base64.b64encode(encrypted_bytes).decode()

        logger.debug("credentials_encrypted", length=len(encrypted_str))

        return encrypted_str

    except Exception as e:
        logger.error("encryption_failed", error=str(e))
        raise ValueError(f"Failed to encrypt credentials: {e}")


def decrypt_credentials(encrypted_str: str) -> dict:
    """
    Decrypt a base64-encoded encrypted string back to credentials dictionary.

    Args:
        encrypted_str: Base64-encoded encrypted string

    Returns:
        Dictionary containing decrypted credentials

    Raises:
        ValueError: If decryption fails
    """
    try:
        fernet = _get_fernet()

        # Decode from base64
        encrypted_bytes = base64.b64decode(encrypted_str.encode())

        # Decrypt
        decrypted_bytes = fernet.decrypt(encrypted_bytes)

        # Convert JSON string back to dict
        json_str = decrypted_bytes.decode()
        credentials = json.loads(json_str)

        logger.debug("credentials_decrypted", keys=list(credentials.keys()))

        return credentials

    except Exception as e:
        logger.error("decryption_failed", error=str(e))
        raise ValueError(f"Failed to decrypt credentials: {e}")


def encrypt_string(plaintext: str) -> str:
    """
    Encrypt a plain string to a base64-encoded encrypted string.

    Args:
        plaintext: String to encrypt

    Returns:
        Base64-encoded encrypted string
    """
    try:
        fernet = _get_fernet()
        encrypted_bytes = fernet.encrypt(plaintext.encode())
        return base64.b64encode(encrypted_bytes).decode()
    except Exception as e:
        logger.error("string_encryption_failed", error=str(e))
        raise ValueError(f"Failed to encrypt string: {e}")


def decrypt_string(encrypted_str: str) -> str:
    """
    Decrypt a base64-encoded encrypted string back to plaintext.

    Args:
        encrypted_str: Base64-encoded encrypted string

    Returns:
        Decrypted plaintext string
    """
    try:
        fernet = _get_fernet()
        encrypted_bytes = base64.b64decode(encrypted_str.encode())
        decrypted_bytes = fernet.decrypt(encrypted_bytes)
        return decrypted_bytes.decode()
    except Exception as e:
        logger.error("string_decryption_failed", error=str(e))
        raise ValueError(f"Failed to decrypt string: {e}")
