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

            job = await self.db.get(ETLJob, job_id)
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
            # Will be implemented in Phase 9
            raise NotImplementedError("Google Sheets support coming soon")
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

            # Handle calculated columns
            if mapping.is_calculated and mapping.calculation_expression:
                try:
                    series = transformation_service.evaluate_expression(
                        df,
                        mapping.calculation_expression,
                        mapping.dest_column
                    )
                    logger.info(
                        "calculated_column_created",
                        column=mapping.dest_column,
                        expression=mapping.calculation_expression
                    )
                except Exception as e:
                    logger.error(
                        "calculated_column_failed",
                        column=mapping.dest_column,
                        expression=mapping.calculation_expression,
                        error=str(e)
                    )
                    raise
            else:
                # Get source column
                if mapping.source_column not in df.columns:
                    raise ValueError(
                        f"Source column '{mapping.source_column}' not found in data"
                    )

                series = df[mapping.source_column].copy()

                # Apply transformation if specified
                if mapping.transformations:
                    try:
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

        try:
            # Create table if needed (BEFORE starting batch processing)
            if job.create_new_table and job.new_table_ddl:
                logger.info("creating_new_table", table=table)
                try:
                    await conn.execute(job.new_table_ddl)
                    logger.info("table_created", table=table)
                except Exception as e:
                    logger.error("table_creation_failed", table=table, error=str(e))
                    raise ValueError(f"Failed to create table {schema}.{table}: {str(e)}")

            # Handle load strategy
            if job.load_strategy == "truncate_insert":
                logger.info("truncating_table", table=table)
                await conn.execute(f'TRUNCATE TABLE "{schema}"."{table}"')

            # Prepare data for insertion
            total_rows = len(df)
            batch_size = job.batch_size or 10000
            rows_processed = 0
            rows_failed = 0

            # Get column names
            columns = list(df.columns)
            column_names_str = ', '.join([f'"{col}"' for col in columns])

            for start_idx in range(0, total_rows, batch_size):
                end_idx = min(start_idx + batch_size, total_rows)
                batch_df = df.iloc[start_idx:end_idx]

                # Convert DataFrame to list of tuples
                # Replace NaN with None for SQL NULL
                batch_df = batch_df.where(pd.notna(batch_df), None)
                records = [tuple(row) for row in batch_df.values]

                try:
                    if job.load_strategy == "upsert" and job.upsert_keys:
                        # Build upsert query
                        placeholders = ', '.join([f'${i+1}' for i in range(len(columns))])
                        upsert_keys_str = ', '.join([f'"{key}"' for key in job.upsert_keys])

                        # Build SET clause for update (exclude upsert keys)
                        update_columns = [col for col in columns if col not in job.upsert_keys]
                        set_clause = ', '.join([f'"{col}" = EXCLUDED."{col}"' for col in update_columns])

                        if set_clause:  # Only if there are columns to update
                            query = f'''
                                INSERT INTO "{schema}"."{table}" ({column_names_str})
                                VALUES ({placeholders})
                                ON CONFLICT ({upsert_keys_str})
                                DO UPDATE SET {set_clause}
                            '''
                        else:
                            # All columns are upsert keys, just do nothing on conflict
                            query = f'''
                                INSERT INTO "{schema}"."{table}" ({column_names_str})
                                VALUES ({placeholders})
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
