from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.crud import credential as credential_crud
from app.services.db_connector import postgresql_connector, redshift_connector
from app.services.ddl_generator import DDLGenerator
from app.schemas.credential import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    TableListResponse,
    DatabaseType
)
from app.schemas.destination import TableSchema, TableColumn
from app.schemas.etl_job import ColumnMappingCreate
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(request: ConnectionTestRequest):
    """
    Test a database connection.

    This endpoint allows testing a connection before saving credentials.
    """
    logger.info("Testing connection", db_type=request.db_type, host=request.host)

    if request.db_type == DatabaseType.POSTGRESQL:
        result = await postgresql_connector.test_connection(request)
    elif request.db_type == DatabaseType.REDSHIFT:
        result = await redshift_connector.test_connection(request)
    else:
        raise HTTPException(status_code=400, detail="Unsupported database type")

    return result


@router.get("/tables/{credential_id}", response_model=TableListResponse)
async def list_tables(
    credential_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of tables from a database using saved credentials.

    Returns schema, table name, and column information.
    """
    # Get credential
    credential = await credential_crud.get_credential(db, credential_id)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Get connection string
    connection_string = credential_crud.get_connection_string(credential)

    try:
        # Get tables based on database type
        if credential.db_type.value == "postgresql":
            tables = postgresql_connector.get_tables(connection_string)
        elif credential.db_type.value == "redshift":
            tables = redshift_connector.get_tables(connection_string)
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")

        logger.info(
            "Retrieved tables",
            credential_id=credential_id,
            count=len(tables)
        )

        return TableListResponse(tables=tables)

    except Exception as e:
        logger.error("Error listing tables", credential_id=credential_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Error listing tables: {str(e)}")


@router.post("/test-credential/{credential_id}", response_model=ConnectionTestResponse)
async def test_saved_credential(
    credential_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Test connection using a saved credential.

    Useful for verifying that saved credentials still work.
    """
    # Get credential
    credential = await credential_crud.get_credential(db, credential_id)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Build test request
    connection_string = credential_crud.get_connection_string(credential)

    # Extract password from connection string
    # Format: protocol://username:password@host:port/database
    parts = connection_string.split('@')[0].split('//')[-1]
    password = parts.split(':')[-1]

    test_request = ConnectionTestRequest(
        db_type=credential.db_type,
        host=credential.host,
        port=credential.port,
        database=credential.database,
        username=credential.username,
        password=password,
        ssl_mode=getattr(credential, 'ssl_mode', 'prefer')
    )

    # Test connection
    if credential.db_type.value == "postgresql":
        result = await postgresql_connector.test_connection(test_request)
    elif credential.db_type.value == "redshift":
        result = await redshift_connector.test_connection(test_request)
    else:
        raise HTTPException(status_code=400, detail="Unsupported database type")

    return result


@router.get("/tables/{credential_id}/{schema}/{table}/schema", response_model=TableSchema)
async def get_table_schema(
    credential_id: int,
    schema: str,
    table: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed schema for a specific table.

    Returns column names, types, nullable status, and defaults.
    """
    # Get credential
    credential = await credential_crud.get_credential(db, credential_id)

    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Get connection string
    connection_string = credential_crud.get_connection_string(credential)

    try:
        # Get all tables and filter to the specific one
        if credential.db_type.value == "postgresql":
            tables = postgresql_connector.get_tables(connection_string)
        elif credential.db_type.value == "redshift":
            tables = redshift_connector.get_tables(connection_string)
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")

        # Find the specific table
        target_table = None
        for t in tables:
            if t.schema_name == schema and t.name == table:
                target_table = t
                break

        if not target_table:
            raise HTTPException(
                status_code=404,
                detail=f"Table {schema}.{table} not found"
            )

        # Convert to TableSchema format
        columns = [
            TableColumn(
                name=col['name'],
                type=col['type'],
                nullable=col['nullable'],
                default=col.get('default')
            )
            for col in target_table.columns
        ]

        logger.info(
            "Retrieved table schema",
            credential_id=credential_id,
            schema=schema,
            table=table,
            column_count=len(columns)
        )

        return TableSchema(
            schema_name=schema,
            table_name=table,
            columns=columns
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error getting table schema",
            credential_id=credential_id,
            schema=schema,
            table=table,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=f"Error getting table schema: {str(e)}")


class GenerateDDLRequest(BaseModel):
    """Request schema for DDL generation."""
    schema: str = Field(..., description="Schema name")
    table: str = Field(..., description="Table name")
    columns: List[ColumnMappingCreate] = Field(..., description="Column mappings")
    db_type: str = Field(..., description="Database type (postgresql or redshift)")


@router.post("/generate-ddl")
async def generate_table_ddl(request: GenerateDDLRequest):
    """
    Generate CREATE TABLE DDL from column mappings.

    Automatically adds created_at and updated_at timestamp columns.
    """
    logger.info(
        "Generating DDL",
        schema=request.schema,
        table=request.table,
        db_type=request.db_type,
        column_count=len(request.columns)
    )

    try:
        ddl = DDLGenerator.generate(
            schema=request.schema,
            table=request.table,
            columns=request.columns,
            db_type=request.db_type
        )

        return {"ddl": ddl}

    except ValueError as e:
        logger.warning("DDL generation validation error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error generating DDL", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating DDL: {str(e)}")
