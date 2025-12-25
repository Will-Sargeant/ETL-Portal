"""add_is_paused_to_etl_jobs

Revision ID: 9ede9cb0ea73
Revises: a8572e9646c7
Create Date: 2025-12-25 10:13:33.583502

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ede9cb0ea73'
down_revision: Union[str, None] = 'a8572e9646c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_paused column to etl_jobs table
    op.add_column('etl_jobs', sa.Column('is_paused', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index(op.f('ix_etl_jobs_is_paused'), 'etl_jobs', ['is_paused'], unique=False)


def downgrade() -> None:
    # Remove is_paused column and index
    op.drop_index(op.f('ix_etl_jobs_is_paused'), table_name='etl_jobs')
    op.drop_column('etl_jobs', 'is_paused')
