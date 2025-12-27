"""remove_calculated_columns

Revision ID: a7fe05298b8a
Revises: 9ede9cb0ea73
Create Date: 2025-12-27 00:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7fe05298b8a'
down_revision: Union[str, None] = '9ede9cb0ea73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove is_calculated and calculation_expression columns from column_mappings table
    op.drop_column('column_mappings', 'is_calculated')
    op.drop_column('column_mappings', 'calculation_expression')


def downgrade() -> None:
    # Re-add the columns if we need to roll back
    op.add_column('column_mappings', sa.Column('calculation_expression', sa.String(length=1000), nullable=True))
    op.add_column('column_mappings', sa.Column('is_calculated', sa.Boolean(), nullable=False, server_default='false'))
