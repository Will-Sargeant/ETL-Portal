"""remove_conversion_transformations_from_existing_jobs

Revision ID: e1d64e46e1d0
Revises: 24b3a937dfdd
Create Date: 2025-12-30 09:48:40.024271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1d64e46e1d0'
down_revision: Union[str, None] = '24b3a937dfdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Remove type conversion transformations from existing column mappings.
    These transformations (TO_STRING, TO_INT, TO_FLOAT, TO_DATE, TO_BOOLEAN)
    are now handled automatically by the column type mapping system.
    """
    # List of conversion transformations to remove
    conversion_transformations = ['TO_STRING', 'TO_INT', 'TO_FLOAT', 'TO_DATE', 'TO_BOOLEAN']

    # Get database connection
    conn = op.get_bind()

    # Fetch all column mappings that have transformations
    result = conn.execute(
        sa.text("""
            SELECT id, transformations
            FROM column_mappings
            WHERE transformations IS NOT NULL
            AND transformations::text != 'null'
            AND transformations::text != '[]'
        """)
    )

    # Process each mapping
    for row in result:
        mapping_id = row[0]
        transformations = row[1]  # This is already a Python list (JSONB is auto-deserialized)

        if not transformations or not isinstance(transformations, list):
            continue

        # Filter out conversion transformations
        cleaned_transformations = [
            t for t in transformations
            if t not in conversion_transformations
        ]

        # Update only if we removed something
        if len(cleaned_transformations) != len(transformations):
            # Convert to JSON string for SQL
            import json
            cleaned_json = json.dumps(cleaned_transformations)

            conn.execute(
                sa.text("""
                    UPDATE column_mappings
                    SET transformations = :transformations::jsonb
                    WHERE id = :id
                """),
                {"transformations": cleaned_json, "id": mapping_id}
            )


def downgrade() -> None:
    """
    No downgrade - we cannot restore removed transformations
    as we don't know which columns had them.
    """
    pass
