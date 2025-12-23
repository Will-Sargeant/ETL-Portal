"""add_table_creation_and_column_fields

Revision ID: 8914484203ce
Revises: 9a33420ca36f
Create Date: 2025-12-22 22:41:32.592626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8914484203ce'
down_revision: Union[str, None] = '9a33420ca36f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to etl_jobs table
    op.add_column('etl_jobs', sa.Column('create_new_table', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('etl_jobs', sa.Column('new_table_ddl', sa.Text(), nullable=True))

    # Add new columns to column_mappings table
    op.add_column('column_mappings', sa.Column('is_nullable', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('column_mappings', sa.Column('default_value', sa.String(255), nullable=True))
    op.add_column('column_mappings', sa.Column('exclude', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('column_mappings', sa.Column('column_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('column_mappings', sa.Column('is_primary_key', sa.Boolean(), nullable=False, server_default='false'))

    # Update is_calculated column from String to Boolean
    op.alter_column('column_mappings', 'is_calculated',
                    existing_type=sa.String(10),
                    type_=sa.Boolean(),
                    existing_nullable=True,
                    nullable=False,
                    server_default='false',
                    postgresql_using='is_calculated::boolean')


def downgrade() -> None:
    # Remove columns from etl_jobs table
    op.drop_column('etl_jobs', 'new_table_ddl')
    op.drop_column('etl_jobs', 'create_new_table')

    # Remove columns from column_mappings table
    op.drop_column('column_mappings', 'is_primary_key')
    op.drop_column('column_mappings', 'column_order')
    op.drop_column('column_mappings', 'exclude')
    op.drop_column('column_mappings', 'default_value')
    op.drop_column('column_mappings', 'is_nullable')

    # Revert is_calculated column from Boolean to String
    op.alter_column('column_mappings', 'is_calculated',
                    existing_type=sa.Boolean(),
                    type_=sa.String(10),
                    existing_nullable=False,
                    nullable=True,
                    server_default='false',
                    postgresql_using="is_calculated::text")
