"""seed_test_users

Revision ID: de0b2e9b9dad
Revises: efc8c4b95541
Create Date: 2025-12-30 19:50:06.981772

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de0b2e9b9dad'
down_revision: Union[str, None] = 'efc8c4b95541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed test users for development."""
    # Pre-hashed passwords (bcrypt)
    # admin123 -> $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpJLm5eDC
    # user123  -> $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36zRzI7d.sHdR4WW6dGZH6C

    now = datetime.utcnow().isoformat()

    op.execute(f"""
        INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active, created_at, updated_at)
        VALUES (
            'admin@test.com',
            'Admin User',
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpJLm5eDC',
            'admin',
            'local',
            true,
            '{now}',
            '{now}'
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    op.execute(f"""
        INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active, created_at, updated_at)
        VALUES (
            'user@test.com',
            'Test User',
            '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36zRzI7d.sHdR4WW6dGZH6C',
            'user',
            'local',
            true,
            '{now}',
            '{now}'
        )
        ON CONFLICT (email) DO NOTHING;
    """)


def downgrade() -> None:
    """Remove test users."""
    op.execute("DELETE FROM users WHERE email IN ('admin@test.com', 'user@test.com')")
