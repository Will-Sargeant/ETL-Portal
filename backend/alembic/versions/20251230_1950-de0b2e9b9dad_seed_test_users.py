"""seed_test_users

Revision ID: de0b2e9b9dad
Revises: efc8c4b95541
Create Date: 2025-12-30 19:50:06.981772

"""
from typing import Sequence, Union
from datetime import datetime
import bcrypt

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de0b2e9b9dad'
down_revision: Union[str, None] = 'efc8c4b95541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed test users for development."""
    # Generate password hashes dynamically to ensure correctness
    admin_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_hash = bcrypt.hashpw('user123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    now = datetime.utcnow().isoformat()

    # Delete existing users first (in case they have wrong password hashes)
    op.execute("DELETE FROM users WHERE email IN ('admin@test.com', 'user@test.com')")

    op.execute(f"""
        INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active, created_at, updated_at)
        VALUES (
            'admin@test.com',
            'Admin User',
            '{admin_hash}',
            'admin',
            'local',
            true,
            '{now}',
            '{now}'
        );
    """)

    op.execute(f"""
        INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active, created_at, updated_at)
        VALUES (
            'user@test.com',
            'Test User',
            '{user_hash}',
            'user',
            'local',
            true,
            '{now}',
            '{now}'
        );
    """)


def downgrade() -> None:
    """Remove test users."""
    op.execute("DELETE FROM users WHERE email IN ('admin@test.com', 'user@test.com')")
