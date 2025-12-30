"""seed_test_db_credential

Revision ID: 24b3a937dfdd
Revises: a7fe05298b8a
Create Date: 2025-12-29 10:21:58.770704

"""
from typing import Sequence, Union
import os
from datetime import datetime

from alembic import op
import sqlalchemy as sa

# Import encryption utilities
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from app.core.encryption import encrypt_string


# revision identifiers, used by Alembic.
revision: str = '24b3a937dfdd'
down_revision: Union[str, None] = 'a7fe05298b8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed the test database credential."""
    # Get test DB credentials from environment variables
    test_db_host = os.getenv('TEST_DB_HOST', 'test-db')
    test_db_port = int(os.getenv('TEST_DB_PORT', '5432'))
    test_db_user = os.getenv('TEST_DB_USER', 'test_user')
    test_db_password = os.getenv('TEST_DB_PASSWORD', 'test_password')
    test_db_name = os.getenv('TEST_DB_NAME', 'test_db')

    # Build connection string
    connection_string = f"postgresql://{test_db_user}:{test_db_password}@{test_db_host}:{test_db_port}/{test_db_name}"

    # Encrypt the connection string
    encrypted_connection_string = encrypt_string(connection_string)

    # Check if credential already exists
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT COUNT(*) FROM credentials WHERE name = 'Test Database'")
    ).scalar()

    # Only insert if it doesn't exist
    if result == 0:
        # Use op.execute with raw SQL, escaping single quotes in the encrypted string
        now = datetime.utcnow().isoformat()
        escaped_encrypted = encrypted_connection_string.replace("'", "''")
        
        # Note: ENUM values are uppercase (POSTGRESQL, REDSHIFT)
        op.execute(f"""
            INSERT INTO credentials
            (name, db_type, encrypted_connection_string, host, port, database, username, ssl_mode, created_at, updated_at)
            VALUES
            ('Test Database', 'POSTGRESQL'::databasetype, '{escaped_encrypted}', '{test_db_host}', {test_db_port}, '{test_db_name}', '{test_db_user}', 'prefer', '{now}', '{now}')
        """)


def downgrade() -> None:
    """Remove the test database credential."""
    op.execute("DELETE FROM credentials WHERE name = 'Test Database'")
