"""
ETL Execution Service for processing and loading data.

Orchestrates the full ETL workflow: Extract, Transform, Load.
"""

import pandas as pd
import asyncpg
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.etl_job import ETLJob, SourceType, DestinationType
from app.models.job_run import JobRun, RunStatus
from app.models.column_mapping import ColumnMapping
from app.models.credential import Credential
from app.services.transformation_service import transformation_service
from app.services.csv_service import csv_service
from app.services.db_connector import get_connection_string
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class ETLService:
    """Service for executing ETL jobs."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_job(self, job_id: int, job_run_id: int) -> None:
        """
        Main ETL execution orchestrator.

        This is called by Airflow to execute a job.

        Args:
            job_id: ID of the ETL job to execute
            job_run_id: ID of the job run to track progress

        Raises:
            Exception: If execution fails
        """
        try:
            # Load job and job run
            job_run = await self.db.get(JobRun, job_run_id)
            if not job_run:
                raise ValueError(f"JobRun {job_run_id} not found")

            # Eagerly load column_mappings to avoid lazy loading in async context
            stmt = select(ETLJob).where(ETLJob.id == job_id).options(selectinload(ETLJob.column_mappings))
            result = await self.db.execute(stmt)
            job = result.scalar_one_or_none()
            if not job:
                raise ValueError(f"ETL Job {job_id} not found")

            logger.info(
                "etl_job_started",
                job_id=job_id,
                job_run_id=job_run_id,
                job_name=job.name
            )

            # Update status to RUNNING
            await self._update_job_run(
                job_run,
                status=RunStatus.RUNNING,
                message="Job execution started"
            )
            await self.db.commit()

            # Step 1: Read source data
            df = await self.read_source_data(job)
            await self._update_job_run(
                job_run,
                rows_total=len(df),
                message=f"Read {len(df)} rows from source"
            )
            await self.db.commit()

            # Step 2: Apply transformations
            df_transformed = await self.apply_transformations(df, job)
            await self._update_job_run(
                job_run,
                message="Transformations applied successfully"
            )
            await self.db.commit()

            # Step 3: Write to destination
            await self.write_to_destination(df_transformed, job, job_run)

            # Mark as completed
            await self._update_job_run(
                job_run,
                status=RunStatus.COMPLETED,
                completed_at=datetime.utcnow(),
                progress_percentage=100,
                message="Job completed successfully"
            )
            await self.db.commit()

            logger.info(
                "etl_job_completed",
                job_id=job_id,
                job_run_id=job_run_id,
                rows_processed=job_run.rows_processed
            )

        except Exception as e:
            logger.error(
                "etl_job_failed",
                job_id=job_id,
                job_run_id=job_run_id,
                error=str(e),
                error_type=type(e).__name__
            )

            # Mark as failed
            job_run = await self.db.get(JobRun, job_run_id)
            if job_run:
                await self._update_job_run(
                    job_run,
                    status=RunStatus.FAILED,
                    completed_at=datetime.utcnow(),
                    error_message=str(e),
                    message=f"Job failed: {str(e)}"
                )
                await self.db.commit()

            raise

    async def read_source_data(self, job: ETLJob) -> pd.DataFrame:
        """
        Read data from the configured source.

        Args:
            job: ETL job configuration

        Returns:
            DataFrame with source data

        Raises:
            ValueError: If source type is unsupported or file not found
        """
        if job.source_type == SourceType.CSV:
            return await self._read_csv(job.source_config)
        elif job.source_type == SourceType.GOOGLE_SHEETS:
            return await self._read_google_sheets(job.source_config)
        else:
            raise ValueError(f"Unsupported source type: {job.source_type}")

    async def _read_csv(self, source_config: Dict[str, Any]) -> pd.DataFrame:
        """Read data from uploaded CSV file."""
        file_id = source_config.get('file_id')
        if not file_id:
            raise ValueError("CSV source config must include 'file_id'")

        file_path = Path(settings.UPLOAD_DIR) / f"{file_id}.csv"
        if not file_path.exists():
            raise ValueError(f"CSV file not found: {file_id}")

        logger.info("reading_csv", file_id=file_id, file_path=str(file_path))

        # Read the CSV file
        df = pd.read_csv(file_path, low_memory=False, keep_default_na=True)

        logger.info(
            "csv_read_complete",
            file_id=file_id,
            rows=len(df),
            columns=len(df.columns)
        )

        return df

    async def _read_google_sheets(self, source_config: Dict[str, Any]) -> pd.DataFrame:
        """
        Read data from Google Sheets.

        Args:
            source_config: Dictionary containing:
                - encrypted_credentials: Encrypted Google OAuth credentials
                - spreadsheet_id: Google Sheets spreadsheet ID
                - sheet_name: Name of the sheet to read

        Returns:
            DataFrame with sheet data

        Raises:
            ValueError: If required config is missing or read fails
        """
        from app.services.google_sheets_service import google_sheets_service
        from app.core.encryption import decrypt_credentials

        encrypted_credentials = source_config.get('encrypted_credentials')
        spreadsheet_id = source_config.get('spreadsheet_id')
        sheet_name = source_config.get('sheet_name')

        if not all([encrypted_credentials, spreadsheet_id, sheet_name]):
            raise ValueError(
                "Google Sheets source config must include 'encrypted_credentials', "
                "'spreadsheet_id', and 'sheet_name'"
            )

        logger.info(
            "reading_google_sheets",
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name
        )

        # Decrypt credentials
        credentials = decrypt_credentials(encrypted_credentials)

        # Fetch data from Google Sheets
        df = await google_sheets_service.get_sheet_data(
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            credentials_dict=credentials
        )

        logger.info(
            "google_sheets_read_complete",
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            rows=len(df),
            columns=len(df.columns)
        )

        return df

    async def apply_transformations(
        self,
        df: pd.DataFrame,
        job: ETLJob
    ) -> pd.DataFrame:
        """
        Apply column mappings and transformations.

        Args:
            df: Source DataFrame
            job: ETL job configuration

        Returns:
            Transformed DataFrame
        """
        # Load column mappings with the job eagerly loaded
        result = await self.db.execute(
            select(ColumnMapping)
            .where(ColumnMapping.job_id == job.id)
            .order_by(ColumnMapping.column_order)
        )
        column_mappings = result.scalars().all()

        if not column_mappings:
            logger.warning("no_column_mappings", job_id=job.id)
            return df

        transformed_df = pd.DataFrame()

        for mapping in column_mappings:
            # Skip excluded columns
            if mapping.exclude:
                logger.debug("column_excluded", column=mapping.source_column)
                continue

            # Skip columns without a source (table-only columns)
            # These columns exist in the destination table but not in the source CSV
            if not mapping.source_column:
                logger.debug("column_skipped_no_source", column=mapping.dest_column)
                continue

            # Get source column
            if mapping.source_column not in df.columns:
                raise ValueError(
                    f"Source column '{mapping.source_column}' not found in data"
                )

            series = df[mapping.source_column].copy()

            # Apply transformations if specified (handles both list and single string)
            if mapping.transformations:
                try:
                    # Handle both list and single transformation for backward compatibility
                    if isinstance(mapping.transformations, list):
                        series = transformation_service.apply_transformations(
                            series,
                            mapping.transformations
                        )
                    else:
                        series = transformation_service.apply_transformation(
                            series,
                            mapping.transformations
                        )
                    logger.info(
                        "transformation_applied",
                        source_column=mapping.source_column,
                        transformation=mapping.transformations
                    )
                except Exception as e:
                    logger.error(
                        "transformation_failed",
                        column=mapping.source_column,
                        transformation=mapping.transformations,
                        error=str(e)
                    )
                    raise

            # Apply data type conversion
            if mapping.dest_data_type:
                try:
                    series = transformation_service.convert_data_type(
                        series,
                        mapping.dest_data_type
                    )
                except Exception as e:
                    logger.warning(
                        "data_type_conversion_failed",
                        column=mapping.source_column,
                        target_type=mapping.dest_data_type,
                        error=str(e),
                        message="Continuing with original type"
                    )

            # Apply default value for nulls
            if mapping.default_value and not mapping.is_nullable:
                series = series.fillna(mapping.default_value)

            # Add to transformed dataframe
            transformed_df[mapping.dest_column] = series

        logger.info(
            "transformations_complete",
            job_id=job.id,
            input_columns=len(df.columns),
            output_columns=len(transformed_df.columns),
            rows=len(transformed_df)
        )

        return transformed_df

    async def write_to_destination(
        self,
        df: pd.DataFrame,
        job: ETLJob,
        job_run: JobRun
    ) -> None:
        """
        Write data to destination database in batches.

        Args:
            df: DataFrame to write
            job: ETL job configuration
            job_run: Job run for progress tracking
        """
        if job.destination_type == DestinationType.POSTGRESQL:
            await self._write_to_postgresql(df, job, job_run)
        elif job.destination_type == DestinationType.REDSHIFT:
            await self._write_to_redshift(df, job, job_run)
        else:
            raise ValueError(f"Unsupported destination type: {job.destination_type}")

    async def _write_to_postgresql(
        self,
        df: pd.DataFrame,
        job: ETLJob,
        job_run: JobRun
    ) -> None:
        """Write data to PostgreSQL database."""
        dest_config = job.destination_config
        credential_id = dest_config.get('credential_id')
        schema = dest_config.get('schema', 'public')
        table = dest_config.get('table')

        if not credential_id or not table:
            raise ValueError("Destination config must include credential_id and table")

        # Get credential
        credential = await self.db.get(Credential, credential_id)
        if not credential:
            raise ValueError(f"Credential {credential_id} not found")

        # Get connection string
        conn_string = get_connection_string(credential)

        logger.info(
            "connecting_to_postgresql",
            credential_id=credential_id,
            schema=schema,
            table=table
        )

        # Connect to PostgreSQL using asyncpg
        conn = await asyncpg.connect(conn_string)

        # Ensure destination schema exists
        logger.info("ensuring_schema_exists", schema=schema)
        await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')

        try:
            # Create table if needed (BEFORE starting batch processing)
            if job.create_new_table and job.new_table_ddl:
                # Check if table already exists
                table_exists_query = f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = '{schema}'
                        AND table_name = '{table}'
                    );
                """
                table_exists = await conn.fetchval(table_exists_query)

                if not table_exists:
                    logger.info("creating_new_table", table=table)

                    # Check if DDL contains invalid types (like "number" which should be "NUMERIC")
                    ddl_to_use = job.new_table_ddl
                    if ddl_to_use and ' number ' in ddl_to_use.lower():
                        logger.warning(
                            "invalid_ddl_detected",
                            table=table,
                            message="DDL contains invalid 'number' type, fixing inline"
                        )
                        # Fix invalid types in the DDL string directly
                        # Replace " number " with " NUMERIC " (case-insensitive)
                        import re
                        ddl_to_use = re.sub(
                            r'\b(number|NUMBER)\b',
                            'NUMERIC',
                            ddl_to_use,
                            flags=re.IGNORECASE
                        )
                        logger.info("ddl_fixed_inline", table=table)

                    try:
                        await conn.execute(ddl_to_use)
                        logger.info("table_created", table=table)
                    except Exception as e:
                        logger.error("table_creation_failed", table=table, error=str(e))
                        raise ValueError(f"Failed to create table {schema}.{table}: {str(e)}")
                else:
                    logger.info("table_already_exists_skipping_creation", table=table)

            # Get column names from dataframe
            columns = list(df.columns)
            column_names_str = ', '.join([f'"{col}"' for col in columns])

            # Check if table exists and get its schema with data types
            existing_columns_query = f"""
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = '{schema}' AND table_name = '{table}'
                ORDER BY ordinal_position
            """
            existing_columns_result = await conn.fetch(existing_columns_query)
            existing_columns = [row['column_name'] for row in existing_columns_result]
            # Build a map of column name -> PostgreSQL data type
            existing_column_types = {
                row['column_name']: row['udt_name'] if row['udt_name'] else row['data_type']
                for row in existing_columns_result
            }
            table_exists = len(existing_columns) > 0

            # Auto-generated timestamp columns that are managed by the backend
            # These should be excluded from schema validation
            auto_generated_columns = {'created_at', 'updated_at', 'inserted_date', 'modified_date'}

            # Filter out auto-generated columns from both lists for schema comparison
            columns_for_comparison = [col for col in columns if col not in auto_generated_columns]
            existing_columns_for_comparison = [col for col in existing_columns if col not in auto_generated_columns]

            # Handle load strategy
            if job.load_strategy == "truncate_insert":
                # Check if table schema matches current column mappings
                # If not, drop and recreate the table
                try:
                    # If table doesn't exist, create it
                    if not table_exists:
                        logger.info("table_does_not_exist_creating_for_truncate_insert", table=table)
                        if job.new_table_ddl:
                            await conn.execute(job.new_table_ddl)
                            logger.info("table_created", table=table)
                        else:
                            raise ValueError(f"Table {schema}.{table} does not exist and no DDL provided")
                    # Check if columns match (excluding auto-generated timestamp columns)
                    elif set(existing_columns_for_comparison) != set(columns_for_comparison):
                        logger.info(
                            "schema_mismatch_detected",
                            table=table,
                            existing_columns=existing_columns_for_comparison,
                            new_columns=columns_for_comparison,
                            action="dropping_and_recreating_table"
                        )

                        # Drop the existing table
                        await conn.execute(f'DROP TABLE IF EXISTS "{schema}"."{table}" CASCADE')
                        logger.info("table_dropped", table=table)

                        # Recreate table using DDL if available
                        if job.new_table_ddl:
                            await conn.execute(job.new_table_ddl)
                            logger.info("table_recreated_from_ddl", table=table)
                        else:
                            # Generate DDL from column mappings
                            logger.warning(
                                "no_ddl_available",
                                table=table,
                                message="Cannot recreate table without DDL"
                            )
                            raise ValueError(
                                f"Schema mismatch detected but no DDL available to recreate table. "
                                f"Expected columns: {columns_for_comparison}, Found: {existing_columns_for_comparison}"
                            )
                    else:
                        # Schema matches, just truncate
                        logger.info("truncating_table", table=table)
                        await conn.execute(f'TRUNCATE TABLE "{schema}"."{table}"')

                except asyncpg.exceptions.UndefinedTableError:
                    # Table doesn't exist, create it
                    if job.new_table_ddl:
                        logger.info("table_does_not_exist_creating", table=table)
                        await conn.execute(job.new_table_ddl)
                        logger.info("table_created", table=table)
                    else:
                        raise ValueError(f"Table {schema}.{table} does not exist and no DDL provided")
            else:
                # For INSERT and UPSERT strategies, handle schema changes gracefully
                if table_exists:
                    # Compare schemas excluding auto-generated timestamp columns
                    existing_set = set(existing_columns_for_comparison)
                    expected_set = set(columns_for_comparison)

                    # Check for missing columns (columns in job but not in table)
                    missing_columns = expected_set - existing_set

                    # Check for extra columns (columns in table but not in job)
                    extra_columns = existing_set - expected_set

                    if missing_columns or extra_columns:
                        logger.warning(
                            "schema_mismatch_detected",
                            table=table,
                            load_strategy=job.load_strategy,
                            existing_columns=existing_columns_for_comparison,
                            expected_columns=columns_for_comparison,
                            missing_columns=list(missing_columns),
                            extra_columns=list(extra_columns)
                        )

                        # For INSERT strategy, automatically add missing columns
                        if missing_columns and job.load_strategy == "insert":
                            logger.info(
                                "auto_adding_missing_columns",
                                table=table,
                                columns=list(missing_columns)
                            )

                            # Get column type mappings from job
                            column_type_map = {
                                mapping.dest_column: mapping.dest_data_type
                                for mapping in job.column_mappings
                                if not mapping.exclude
                            }

                            # Add each missing column
                            for col in missing_columns:
                                col_type = column_type_map.get(col, 'TEXT')
                                alter_sql = f'ALTER TABLE "{schema}"."{table}" ADD COLUMN "{col}" {col_type}'
                                try:
                                    await conn.execute(alter_sql)
                                    logger.info("column_added", table=table, column=col, type=col_type)
                                except Exception as e:
                                    logger.error("column_add_failed", table=table, column=col, error=str(e))
                                    raise ValueError(f"Failed to add column '{col}' to table '{schema}'.'{table}': {str(e)}")

                            # Refresh the existing columns list
                            existing_columns_result = await conn.fetch(existing_columns_query)
                            existing_columns = [row['column_name'] for row in existing_columns_result]
                            existing_columns_for_comparison = [col for col in existing_columns if col not in auto_generated_columns]

                        # Log warning about extra columns (but don't auto-drop for safety)
                        if extra_columns and job.load_strategy == "insert":
                            logger.warning(
                                "extra_columns_detected",
                                table=table,
                                extra_columns=list(extra_columns),
                                message="Table has columns not in job configuration. "
                                        "Data will still be inserted successfully, but these columns will remain NULL. "
                                        f"To remove them, run: ALTER TABLE {schema}.{table} DROP COLUMN <column_name>"
                            )

                        # For UPSERT strategy, fail if schema doesn't match exactly (excluding auto-generated columns)
                        elif job.load_strategy == "upsert" and (missing_columns or extra_columns):
                            logger.error(
                                "schema_mismatch_for_upsert",
                                table=table,
                                existing_columns=existing_columns_for_comparison,
                                expected_columns=columns_for_comparison
                            )
                            raise ValueError(
                                f"Schema mismatch detected for UPSERT strategy. "
                                f"Table '{schema}.{table}' has columns {existing_columns_for_comparison} but job expects {columns_for_comparison}. "
                                f"UPSERT requires exact schema match. Either use TRUNCATE_INSERT strategy to auto-recreate the table, "
                                f"or manually update the table schema to match the job's column mappings. "
                                f"Note: Auto-generated timestamp columns (created_at, updated_at) are excluded from this comparison."
                            )
                else:
                    # Table doesn't exist for INSERT/UPSERT, create it if we have DDL
                    if job.new_table_ddl:
                        logger.info("creating_table_for_insert_or_upsert", table=table, strategy=job.load_strategy)
                        await conn.execute(job.new_table_ddl)
                        logger.info("table_created", table=table)
                    else:
                        raise ValueError(f"Table {schema}.{table} does not exist and no DDL provided")

            # Add timestamp columns if they exist in the table
            # Check if table has created_at or updated_at columns
            has_created_at = 'created_at' in existing_columns
            has_updated_at = 'updated_at' in existing_columns

            # Strategy-specific timestamp handling:
            # - INSERT/TRUNCATE_INSERT: Set timestamps to current time in DataFrame
            # - UPSERT: Add columns with NULL, use COALESCE in INSERT to set defaults
            if job.load_strategy in ["insert", "truncate_insert"]:
                # Set actual timestamp values for INSERT/TRUNCATE_INSERT
                if has_created_at and 'created_at' not in df.columns:
                    from datetime import datetime
                    df['created_at'] = datetime.utcnow()

                if has_updated_at and 'updated_at' not in df.columns:
                    from datetime import datetime
                    df['updated_at'] = datetime.utcnow()
            elif job.load_strategy == "upsert":
                # For UPSERT: Add columns with NULL
                # INSERT will use COALESCE to default to CURRENT_TIMESTAMP
                # UPDATE will preserve created_at and set updated_at to CURRENT_TIMESTAMP
                if has_created_at and 'created_at' not in df.columns:
                    df['created_at'] = None

                if has_updated_at and 'updated_at' not in df.columns:
                    df['updated_at'] = None

            # Update columns list to include timestamps
            columns = list(df.columns)
            column_names_str = ', '.join([f'"{col}"' for col in columns])

            # For UPSERT and INSERT strategies, convert DataFrame column types to match existing table schema
            # This prevents type mismatch errors when user changes column types in job config
            if table_exists and job.load_strategy in ["upsert", "insert"]:
                for col in columns:
                    if col in existing_column_types and col in df.columns:
                        db_type = existing_column_types[col]

                        # Convert DataFrame column to match database type
                        try:
                            if db_type in ('text', 'varchar', 'char', 'bpchar'):
                                # Convert to string
                                df[col] = df[col].astype(str)
                                df[col] = df[col].replace('nan', None)  # Convert string 'nan' back to None
                                df[col] = df[col].replace('<NA>', None)
                                logger.debug("column_type_converted", column=col, to_type="text", db_type=db_type)

                            elif db_type in ('int2', 'int4', 'int8', 'integer', 'bigint', 'smallint'):
                                # Convert to integer, handling None/NaN
                                df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
                                logger.debug("column_type_converted", column=col, to_type="integer", db_type=db_type)

                            elif db_type in ('float4', 'float8', 'numeric', 'decimal', 'real', 'double precision'):
                                # Convert to float, handling None/NaN
                                df[col] = pd.to_numeric(df[col], errors='coerce')
                                logger.debug("column_type_converted", column=col, to_type="numeric", db_type=db_type)

                            elif db_type in ('bool', 'boolean'):
                                # Convert to boolean
                                df[col] = df[col].astype(bool)
                                logger.debug("column_type_converted", column=col, to_type="boolean", db_type=db_type)

                            elif db_type in ('timestamp', 'timestamptz', 'date', 'time'):
                                # Convert to datetime
                                df[col] = pd.to_datetime(df[col], errors='coerce')
                                # Replace NaT (Not a Time) with None for asyncpg compatibility
                                df[col] = df[col].where(pd.notna(df[col]), None)
                                logger.debug("column_type_converted", column=col, to_type="timestamp", db_type=db_type)

                            else:
                                # For other types, convert to string as a safe default
                                logger.warning("unknown_db_type_converting_to_text", column=col, db_type=db_type)
                                df[col] = df[col].astype(str)
                                df[col] = df[col].replace('nan', None)

                        except Exception as e:
                            logger.error(
                                "column_type_conversion_failed",
                                column=col,
                                from_type=str(df[col].dtype),
                                to_type=db_type,
                                error=str(e)
                            )
                            raise ValueError(
                                f"Failed to convert column '{col}' from {df[col].dtype} to database type '{db_type}': {str(e)}"
                            )

            # For UPSERT strategy, ensure unique constraint exists on upsert keys
            if job.load_strategy == "upsert" and job.upsert_keys:
                # Check if table has a unique constraint on the upsert keys
                upsert_keys_list = ', '.join([f"'{key}'" for key in job.upsert_keys])
                constraint_check_query = f"""
                    SELECT COUNT(*) as constraint_count
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = '{schema}'
                        AND tc.table_name = '{table}'
                        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
                        AND kcu.column_name IN ({upsert_keys_list})
                    GROUP BY tc.constraint_name
                    HAVING COUNT(DISTINCT kcu.column_name) = {len(job.upsert_keys)}
                """
                constraint_exists = await conn.fetchval(constraint_check_query)

                if not constraint_exists:
                    # Check if columns are marked as primary keys in job configuration
                    pk_columns = [
                        mapping.dest_column
                        for mapping in job.column_mappings
                        if mapping.is_primary_key and not mapping.exclude
                    ]

                    # If upsert keys match PK columns in config, automatically add PRIMARY KEY constraint
                    if set(job.upsert_keys) == set(pk_columns) and pk_columns:
                        logger.info(
                            "auto_adding_primary_key_constraint",
                            table=table,
                            columns=job.upsert_keys
                        )

                        try:
                            # Check if table already has any primary key
                            existing_pk_query = f"""
                                SELECT constraint_name
                                FROM information_schema.table_constraints
                                WHERE table_schema = '{schema}'
                                    AND table_name = '{table}'
                                    AND constraint_type = 'PRIMARY KEY'
                            """
                            existing_pk = await conn.fetchval(existing_pk_query)

                            if existing_pk:
                                # Drop existing primary key first
                                drop_pk_sql = f'ALTER TABLE "{schema}"."{table}" DROP CONSTRAINT "{existing_pk}"'
                                await conn.execute(drop_pk_sql)
                                logger.info("dropped_existing_pk", table=table, constraint=existing_pk)

                            # Add new primary key constraint
                            pk_columns_quoted = ', '.join([f'"{col}"' for col in job.upsert_keys])
                            add_pk_sql = f'ALTER TABLE "{schema}"."{table}" ADD PRIMARY KEY ({pk_columns_quoted})'
                            await conn.execute(add_pk_sql)

                            logger.info(
                                "primary_key_constraint_added",
                                table=table,
                                columns=job.upsert_keys
                            )
                        except Exception as e:
                            logger.error(
                                "failed_to_add_primary_key",
                                table=table,
                                columns=job.upsert_keys,
                                error=str(e)
                            )
                            raise ValueError(
                                f"Failed to automatically add PRIMARY KEY constraint on {job.upsert_keys}. "
                                f"Error: {str(e)}. "
                                f"You may need to manually add it: ALTER TABLE {schema}.{table} ADD PRIMARY KEY ({', '.join(job.upsert_keys)})"
                            )
                    else:
                        # Upsert keys don't match PK config, require manual intervention
                        logger.error(
                            "upsert_missing_unique_constraint",
                            table=table,
                            upsert_keys=job.upsert_keys,
                            pk_columns=pk_columns
                        )
                        raise ValueError(
                            f"UPSERT strategy requires a PRIMARY KEY or UNIQUE constraint on the upsert key columns {job.upsert_keys}. "
                            f"Table '{schema}.{table}' does not have such a constraint. "
                            f"To fix this:\n"
                            f"1. Mark the upsert key columns as Primary Keys in the column mapping, OR\n"
                            f"2. Manually add a constraint: ALTER TABLE {schema}.{table} ADD PRIMARY KEY ({', '.join(job.upsert_keys)}), OR\n"
                            f"3. Use TRUNCATE_INSERT strategy to recreate the table with proper constraints."
                        )

            # Prepare data for insertion
            total_rows = len(df)
            batch_size = job.batch_size or 10000
            rows_processed = 0
            rows_failed = 0

            for start_idx in range(0, total_rows, batch_size):
                end_idx = min(start_idx + batch_size, total_rows)
                batch_df = df.iloc[start_idx:end_idx].copy()

                # Convert DataFrame to list of tuples
                # Replace NaN and NaT with None for SQL NULL
                # Use explicit replacement for NaT which .where() doesn't handle properly
                batch_df = batch_df.replace({pd.NaT: None})
                batch_df = batch_df.where(pd.notna(batch_df), None)

                records = [tuple(row) for row in batch_df.values]

                try:
                    if job.load_strategy == "upsert" and job.upsert_keys:
                        # Build upsert query with COALESCE for timestamp defaults
                        upsert_keys_str = ', '.join([f'"{key}"' for key in job.upsert_keys])

                        # Build VALUES clause with COALESCE for timestamp columns
                        values_clauses = []
                        for i, col in enumerate(columns):
                            if col in ('created_at', 'updated_at'):
                                # Use COALESCE to default NULL to CURRENT_TIMESTAMP on INSERT
                                values_clauses.append(f'COALESCE(${i+1}, CURRENT_TIMESTAMP)')
                            else:
                                values_clauses.append(f'${i+1}')
                        values_str = ', '.join(values_clauses)

                        # Build SET clause for update
                        # Exclude: upsert keys (unchangeable), created_at (preserve original)
                        update_columns = [
                            col for col in columns
                            if col not in job.upsert_keys and col != 'created_at'
                        ]

                        # For updated_at, set to current timestamp only when data actually changes
                        set_clauses = []
                        for col in update_columns:
                            if col == 'updated_at':
                                # Use CURRENT_TIMESTAMP for updated_at on updates
                                set_clauses.append(f'"{col}" = CURRENT_TIMESTAMP')
                            else:
                                set_clauses.append(f'"{col}" = EXCLUDED."{col}"')

                        set_clause = ', '.join(set_clauses)

                        if set_clause:  # Only if there are columns to update
                            # Build WHERE clause to only update when values actually differ
                            # Compare all non-timestamp columns (exclude updated_at, created_at, and upsert keys)
                            comparison_columns = [
                                col for col in update_columns
                                if col not in ('updated_at', 'created_at') and col not in job.upsert_keys
                            ]

                            if comparison_columns:
                                # Only update if at least one column value is different
                                where_conditions = []
                                for col in comparison_columns:
                                    # Use IS DISTINCT FROM to handle NULL comparisons correctly
                                    where_conditions.append(f'"{schema}"."{table}"."{col}" IS DISTINCT FROM EXCLUDED."{col}"')
                                where_clause = ' OR '.join(where_conditions)

                                query = f'''
                                    INSERT INTO "{schema}"."{table}" ({column_names_str})
                                    VALUES ({values_str})
                                    ON CONFLICT ({upsert_keys_str})
                                    DO UPDATE SET {set_clause}
                                    WHERE {where_clause}
                                '''
                            else:
                                # No columns to compare (only timestamps), update unconditionally
                                query = f'''
                                    INSERT INTO "{schema}"."{table}" ({column_names_str})
                                    VALUES ({values_str})
                                    ON CONFLICT ({upsert_keys_str})
                                    DO UPDATE SET {set_clause}
                                '''
                        else:
                            # All columns are upsert keys, just do nothing on conflict
                            query = f'''
                                INSERT INTO "{schema}"."{table}" ({column_names_str})
                                VALUES ({values_str})
                                ON CONFLICT ({upsert_keys_str})
                                DO NOTHING
                            '''

                        # Execute batch
                        await conn.executemany(query, records)
                    else:
                        # Simple INSERT
                        placeholders = ', '.join([f'${i+1}' for i in range(len(columns))])
                        query = f'INSERT INTO "{schema}"."{table}" ({column_names_str}) VALUES ({placeholders})'
                        await conn.executemany(query, records)

                    rows_processed += len(records)

                    # Update progress
                    progress = int((rows_processed / total_rows) * 100)
                    await self._update_job_run(
                        job_run,
                        rows_processed=rows_processed,
                        progress_percentage=progress,
                        message=f"Processed {rows_processed}/{total_rows} rows"
                    )
                    await self.db.commit()

                    logger.info(
                        "batch_written",
                        batch=start_idx // batch_size + 1,
                        rows=len(records),
                        total_processed=rows_processed
                    )

                except Exception as e:
                    rows_failed += len(records)
                    logger.error(
                        "batch_write_failed",
                        batch=start_idx // batch_size + 1,
                        rows=len(records),
                        error=str(e)
                    )
                    # Update progress with failed count
                    await self._update_job_run(
                        job_run,
                        rows_failed=rows_failed,
                        error_count=rows_failed
                    )
                    await self.db.commit()
                    # Re-raise the exception to fail the job
                    raise

            # Final update
            await self._update_job_run(
                job_run,
                rows_processed=rows_processed,
                rows_failed=rows_failed,
                error_count=rows_failed,
                progress_percentage=100
            )
            await self.db.commit()

            logger.info(
                "postgresql_write_complete",
                rows_processed=rows_processed,
                rows_failed=rows_failed,
                table=f"{schema}.{table}"
            )

        finally:
            await conn.close()

    async def _write_to_redshift(
        self,
        df: pd.DataFrame,
        job: ETLJob,
        job_run: JobRun
    ) -> None:
        """Write data to Amazon Redshift."""
        # Redshift uses the same connection protocol as PostgreSQL
        # but with some optimizations for bulk loading
        # For now, we'll use the same method as PostgreSQL
        # In the future, this could be optimized with COPY command from S3
        await self._write_to_postgresql(df, job, job_run)

    async def _update_job_run(
        self,
        job_run: JobRun,
        **kwargs
    ) -> None:
        """Update job run fields."""
        for key, value in kwargs.items():
            if hasattr(job_run, key):
                setattr(job_run, key, value)

        # Don't commit here - let the caller decide when to commit


# Helper function to get ETL service instance
def get_etl_service(db: AsyncSession) -> ETLService:
    """Get ETL service instance."""
    return ETLService(db)
