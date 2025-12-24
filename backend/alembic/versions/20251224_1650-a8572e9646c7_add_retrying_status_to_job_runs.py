"""add_retrying_status_to_job_runs

Revision ID: a8572e9646c7
Revises: 07bcf9999199
Create Date: 2025-12-24 16:50:53.659657

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8572e9646c7'
down_revision: Union[str, None] = '07bcf9999199'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'retrying' to the RunStatus enum
    op.execute("ALTER TYPE runstatus ADD VALUE IF NOT EXISTS 'retrying'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave the enum value in place
    pass
