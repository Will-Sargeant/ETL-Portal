from cryptography.fernet import Fernet
from app.core.config import settings
import base64


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self):
        # Use encryption key from settings or generate a new one
        if settings.ENCRYPTION_KEY:
            self.fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        else:
            # Generate a key for development
            key = Fernet.generate_key()
            self.fernet = Fernet(key)
            print(f"WARNING: No ENCRYPTION_KEY set. Using generated key: {key.decode()}")
            print("Set this in your .env file: ENCRYPTION_KEY=" + key.decode())

    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result."""
        encrypted = self.fernet.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded encrypted string."""
        decoded = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = self.fernet.decrypt(decoded)
        return decrypted.decode()


# Global encryption service instance
encryption_service = EncryptionService()


def encrypt_connection_string(connection_string: str) -> str:
    """Encrypt a database connection string."""
    return encryption_service.encrypt(connection_string)


def decrypt_connection_string(encrypted_string: str) -> str:
    """Decrypt a database connection string."""
    return encryption_service.decrypt(encrypted_string)
