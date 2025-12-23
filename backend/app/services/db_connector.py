import time
from typing import Optional, List, Dict, Any
import asyncpg
import asyncio
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.core.security import decrypt_connection_string
from app.models.credential import Credential
from app.schemas.credential import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    TableInfo
)

logger = get_logger(__name__)


def get_connection_string(credential: Credential) -> str:
    """
    Decrypt and return connection string from credential.

    Args:
        credential: Credential model instance

    Returns:
        Decrypted connection string
    """
    return decrypt_connection_string(credential.encrypted_connection_string)


class PostgreSQLConnector:
    """PostgreSQL database connector."""

    @staticmethod
    async def test_connection(request: ConnectionTestRequest) -> ConnectionTestResponse:
        """Test PostgreSQL connection."""
        start_time = time.time()

        try:
            # Build connection string
            conn_string = f"postgresql://{request.username}:{request.password}@{request.host}:{request.port}/{request.database}"

            # Add SSL mode if specified
            if request.ssl_mode and request.ssl_mode != "disable":
                conn_string += f"?sslmode={request.ssl_mode}"

            # Test connection with asyncpg
            conn = await asyncio.wait_for(
                asyncpg.connect(conn_string),
                timeout=10.0
            )

            # Get server version
            version = await conn.fetchval('SELECT version()')
            server_version = version.split(',')[0] if version else None

            await conn.close()

            connection_time = (time.time() - start_time) * 1000

            logger.info(
                "PostgreSQL connection test successful",
                host=request.host,
                database=request.database,
                time_ms=connection_time
            )

            return ConnectionTestResponse(
                success=True,
                message="Connection successful",
                server_version=server_version,
                connection_time_ms=round(connection_time, 2)
            )

        except asyncio.TimeoutError:
            logger.error("PostgreSQL connection timeout", host=request.host)
            return ConnectionTestResponse(
                success=False,
                message="Connection timeout after 10 seconds"
            )
        except asyncpg.InvalidPasswordError:
            logger.error("PostgreSQL authentication failed", host=request.host, username=request.username)
            return ConnectionTestResponse(
                success=False,
                message="Authentication failed: Invalid username or password"
            )
        except asyncpg.InvalidCatalogNameError:
            logger.error("PostgreSQL database not found", host=request.host, database=request.database)
            return ConnectionTestResponse(
                success=False,
                message=f"Database '{request.database}' does not exist"
            )
        except Exception as e:
            logger.error("PostgreSQL connection test failed", error=str(e), host=request.host)
            return ConnectionTestResponse(
                success=False,
                message=f"Connection failed: {str(e)}"
            )

    @staticmethod
    def get_tables(connection_string: str) -> List[TableInfo]:
        """Get list of tables from PostgreSQL database."""
        try:
            # Create synchronous engine for introspection
            engine = create_engine(connection_string)
            inspector = inspect(engine)

            tables = []

            for schema in inspector.get_schema_names():
                # Skip system schemas
                if schema in ['information_schema', 'pg_catalog', 'pg_toast']:
                    continue

                for table_name in inspector.get_table_names(schema=schema):
                    columns = inspector.get_columns(table_name, schema=schema)

                    tables.append(TableInfo(
                        schema=schema,
                        name=table_name,
                        column_count=len(columns),
                        columns=[{
                            'name': col['name'],
                            'type': str(col['type']),
                            'nullable': col.get('nullable', True),
                            'default': col.get('default')
                        } for col in columns]
                    ))

            engine.dispose()

            logger.info("Retrieved PostgreSQL tables", count=len(tables))
            return tables

        except Exception as e:
            logger.error("Error getting PostgreSQL tables", error=str(e))
            raise

    @staticmethod
    def create_table(connection_string: str, schema: str, table_name: str, columns: List[Dict[str, Any]]) -> bool:
        """Create a new table in PostgreSQL."""
        try:
            engine = create_engine(connection_string)

            # Build CREATE TABLE SQL
            column_defs = []
            for col in columns:
                col_def = f'"{col["name"]}" {col["type"]}'
                if not col.get('nullable', True):
                    col_def += ' NOT NULL'
                if col.get('primary_key'):
                    col_def += ' PRIMARY KEY'
                column_defs.append(col_def)

            create_sql = f'CREATE TABLE {schema}."{table_name}" ({", ".join(column_defs)})'

            with engine.connect() as conn:
                conn.execute(text(create_sql))
                conn.commit()

            engine.dispose()

            logger.info("Created PostgreSQL table", schema=schema, table=table_name)
            return True

        except Exception as e:
            logger.error("Error creating PostgreSQL table", error=str(e), table=table_name)
            raise


class RedshiftConnector:
    """Amazon Redshift database connector."""

    @staticmethod
    async def test_connection(request: ConnectionTestRequest) -> ConnectionTestResponse:
        """Test Redshift connection."""
        start_time = time.time()

        try:
            import redshift_connector

            # Connect to Redshift
            conn = await asyncio.wait_for(
                asyncio.to_thread(
                    redshift_connector.connect,
                    host=request.host,
                    port=request.port,
                    database=request.database,
                    user=request.username,
                    password=request.password,
                    ssl=request.ssl_mode != "disable"
                ),
                timeout=30.0
            )

            # Get server version
            cursor = conn.cursor()
            cursor.execute('SELECT version()')
            version = cursor.fetchone()[0]
            server_version = version.split(',')[0] if version else None

            cursor.close()
            conn.close()

            connection_time = (time.time() - start_time) * 1000

            logger.info(
                "Redshift connection test successful",
                host=request.host,
                database=request.database,
                time_ms=connection_time
            )

            return ConnectionTestResponse(
                success=True,
                message="Connection successful",
                server_version=server_version,
                connection_time_ms=round(connection_time, 2)
            )

        except asyncio.TimeoutError:
            logger.error("Redshift connection timeout", host=request.host)
            return ConnectionTestResponse(
                success=False,
                message="Connection timeout after 30 seconds"
            )
        except Exception as e:
            error_msg = str(e)
            logger.error("Redshift connection test failed", error=error_msg, host=request.host)

            # Parse common error messages
            if "authentication failed" in error_msg.lower():
                message = "Authentication failed: Invalid username or password"
            elif "database" in error_msg.lower() and "does not exist" in error_msg.lower():
                message = f"Database '{request.database}' does not exist"
            else:
                message = f"Connection failed: {error_msg}"

            return ConnectionTestResponse(
                success=False,
                message=message
            )

    @staticmethod
    def get_tables(connection_string: str) -> List[TableInfo]:
        """Get list of tables from Redshift database."""
        try:
            engine = create_engine(connection_string)
            inspector = inspect(engine)

            tables = []

            for schema in inspector.get_schema_names():
                # Skip system schemas
                if schema in ['information_schema', 'pg_catalog', 'pg_toast', 'pg_internal']:
                    continue

                for table_name in inspector.get_table_names(schema=schema):
                    columns = inspector.get_columns(table_name, schema=schema)

                    tables.append(TableInfo(
                        schema=schema,
                        name=table_name,
                        column_count=len(columns),
                        columns=[{
                            'name': col['name'],
                            'type': str(col['type']),
                            'nullable': col.get('nullable', True),
                            'default': col.get('default')
                        } for col in columns]
                    ))

            engine.dispose()

            logger.info("Retrieved Redshift tables", count=len(tables))
            return tables

        except Exception as e:
            logger.error("Error getting Redshift tables", error=str(e))
            raise


# Global connector instances
postgresql_connector = PostgreSQLConnector()
redshift_connector = RedshiftConnector()
