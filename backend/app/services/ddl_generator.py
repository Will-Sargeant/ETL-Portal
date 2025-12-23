"""
DDL Generation Service

Generates CREATE TABLE DDL statements from column mappings.
Automatically adds created_at and updated_at timestamp columns.
"""
import re
from typing import List
from app.schemas.etl_job import ColumnMappingCreate


class DDLGenerator:
    """Generate CREATE TABLE DDL from column mappings."""

    # SQL type mapping for common CSV types
    TYPE_MAPPING = {
        # Text types
        "TEXT": "TEXT",
        "VARCHAR": "VARCHAR(255)",
        "text": "TEXT",
        "string": "TEXT",

        # Numeric types
        "INTEGER": "INTEGER",
        "BIGINT": "BIGINT",
        "NUMERIC": "NUMERIC",
        "DECIMAL": "DECIMAL(18,2)",
        "number": "NUMERIC",
        "int": "INTEGER",
        "float": "NUMERIC",

        # Date/time types
        "TIMESTAMP": "TIMESTAMP",
        "TIMESTAMPTZ": "TIMESTAMP WITH TIME ZONE",
        "DATE": "DATE",
        "TIME": "TIME",
        "date": "TIMESTAMP",
        "datetime": "TIMESTAMP",

        # Boolean
        "BOOLEAN": "BOOLEAN",
        "boolean": "BOOLEAN",
        "bool": "BOOLEAN",

        # JSON
        "JSON": "JSON",
        "JSONB": "JSONB",
    }

    @classmethod
    def generate(
        cls,
        schema: str,
        table: str,
        columns: List[ColumnMappingCreate],
        db_type: str
    ) -> str:
        """
        Generate CREATE TABLE DDL.

        Args:
            schema: Schema name
            table: Table name
            columns: List of column mappings
            db_type: Database type ('postgresql' or 'redshift')

        Returns:
            CREATE TABLE DDL string
        """
        # Validate table and schema names
        cls._validate_identifier(schema, "schema")
        cls._validate_identifier(table, "table")

        # Filter out excluded columns
        active_columns = [c for c in columns if not c.exclude]

        # Sort by column_order
        active_columns.sort(key=lambda c: c.column_order)

        # Build column definitions
        column_defs = []
        for col in active_columns:
            column_def = cls._build_column_definition(col, db_type)
            column_defs.append(column_def)

        # Add timestamp columns
        column_defs.append(
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"
        )

        if db_type == "postgresql":
            # PostgreSQL doesn't support ON UPDATE CURRENT_TIMESTAMP
            # Use trigger or application-level update instead
            column_defs.append(
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"
            )
        elif db_type == "redshift":
            # Redshift doesn't support ON UPDATE either
            # Use application-level update
            column_defs.append(
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"
            )

        # Add primary key constraint if any columns are marked as primary key
        primary_key_cols = [c.destination_column for c in active_columns if c.is_primary_key]
        if primary_key_cols:
            pk_constraint = f"PRIMARY KEY ({', '.join(primary_key_cols)})"
            column_defs.append(pk_constraint)

        # Build full DDL
        column_lines = ",\n    ".join(column_defs)
        ddl = f"""CREATE TABLE {schema}.{table} (
    {column_lines}
);"""

        return ddl

    @classmethod
    def _build_column_definition(
        cls,
        column: ColumnMappingCreate,
        db_type: str
    ) -> str:
        """Build column definition string."""
        col_name = column.destination_column
        col_type = cls._map_type(column.destination_type, db_type)

        # Start with name and type
        definition = f"{col_name} {col_type}"

        # Add NULL/NOT NULL
        if not column.is_nullable:
            definition += " NOT NULL"

        # Add DEFAULT if specified
        if column.default_value:
            # Quote string values
            if col_type.startswith(("TEXT", "VARCHAR", "CHAR")):
                definition += f" DEFAULT '{column.default_value}'"
            else:
                definition += f" DEFAULT {column.default_value}"

        return definition

    @classmethod
    def _map_type(cls, source_type: str, db_type: str) -> str:
        """
        Map source type to SQL type.

        Args:
            source_type: Source column type
            db_type: Database type

        Returns:
            SQL type string
        """
        # Direct lookup
        if source_type in cls.TYPE_MAPPING:
            return cls.TYPE_MAPPING[source_type]

        # Case-insensitive lookup
        source_upper = source_type.upper()
        if source_upper in cls.TYPE_MAPPING:
            return cls.TYPE_MAPPING[source_upper]

        # Handle VARCHAR with size
        if source_type.upper().startswith("VARCHAR"):
            return source_type.upper()

        # Handle DECIMAL with precision
        if source_type.upper().startswith("DECIMAL"):
            return source_type.upper()

        # Default to TEXT for unknown types
        return "TEXT"

    @classmethod
    def _validate_identifier(cls, identifier: str, name: str) -> None:
        """
        Validate SQL identifier (table/schema/column name).

        Args:
            identifier: Identifier to validate
            name: Name of the identifier type (for error messages)

        Raises:
            ValueError: If identifier is invalid
        """
        if not identifier:
            raise ValueError(f"{name} name cannot be empty")

        # Allow alphanumeric, underscore, and hyphen
        # Must start with letter or underscore
        pattern = r'^[a-zA-Z_][a-zA-Z0-9_-]*$'
        if not re.match(pattern, identifier):
            raise ValueError(
                f"{name} name must start with letter/underscore and contain only "
                f"alphanumeric characters, underscores, and hyphens: {identifier}"
            )

        # Check length
        if len(identifier) > 63:  # PostgreSQL limit
            raise ValueError(f"{name} name too long (max 63 characters): {identifier}")

        # Reserved words check (basic list)
        reserved = {
            "user", "table", "column", "index", "view", "select", "insert",
            "update", "delete", "create", "drop", "alter", "grant", "revoke"
        }
        if identifier.lower() in reserved:
            raise ValueError(
                f"{name} name '{identifier}' is a SQL reserved word. "
                f"Please use a different name."
            )
