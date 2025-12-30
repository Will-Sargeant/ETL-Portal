from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud import etl_job as crud
from app.schemas.etl_job import (
    ETLJobCreate,
    ETLJobUpdate,
    ETLJobResponse,
    ETLJobListResponse,
    ColumnMappingCreate,
    ColumnMappingResponse,
    JobRunResponse,
    RunStatus,
)
from app.models.job_run import JobRun
from datetime import datetime

router = APIRouter()


@router.post("/", response_model=ETLJobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: ETLJobCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new ETL job with column mappings."""
    try:
        # Validate primary key requirements for UPSERT strategy
        if job.load_strategy == "upsert":
            # Get primary key columns from column mappings
            primary_key_columns = [
                col.destination_column
                for col in job.column_mappings
                if col.is_primary_key and not col.exclude and col.destination_column
            ]

            # UPSERT requires at least one primary key column
            if not primary_key_columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="UPSERT strategy requires at least one column to be marked as a Primary Key. "
                           "These columns uniquely identify rows for update operations."
                )

            # Validate upsert keys exist
            if not job.upsert_keys or len(job.upsert_keys) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="UPSERT strategy requires selecting upsert key columns."
                )

            # Validate upsert keys are a subset of primary keys
            invalid_upsert_keys = [
                key for key in job.upsert_keys
                if key not in primary_key_columns
            ]

            if invalid_upsert_keys:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Upsert keys must be marked as Primary Keys. "
                           f"The following upsert keys are not primary keys: {', '.join(invalid_upsert_keys)}. "
                           f"Please mark these columns as Primary Keys or select different upsert keys."
                )

        db_job = await crud.create_etl_job(db, job)
        return db_job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create ETL job: {str(e)}"
        )


@router.get("/", response_model=List[ETLJobListResponse])
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all ETL jobs."""
    jobs = await crud.get_etl_jobs(db, skip=skip, limit=limit, status=status)
    return jobs


@router.get("/{job_id}", response_model=ETLJobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get an ETL job by ID."""
    db_job = await crud.get_etl_job(db, job_id)

    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    return db_job


@router.put("/{job_id}", response_model=ETLJobResponse)
async def update_job(
    job_id: int,
    job_update: ETLJobUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an ETL job."""
    try:
        # Validate primary key requirements for UPSERT strategy (if being updated)
        if job_update.load_strategy == "upsert" or (
            job_update.column_mappings is not None and job_update.load_strategy is None
        ):
            # If column_mappings are being updated, validate them
            if job_update.column_mappings is not None:
                # Get primary key columns from column mappings
                primary_key_columns = [
                    col.destination_column
                    for col in job_update.column_mappings
                    if col.is_primary_key and not col.exclude and col.destination_column
                ]

                # Check if this is/will be an UPSERT job
                # Need to check the existing job to see if it's UPSERT
                existing_job = await crud.get_etl_job(db, job_id)
                if not existing_job:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="ETL job not found"
                    )

                # Determine effective load strategy
                effective_load_strategy = (
                    job_update.load_strategy if job_update.load_strategy is not None
                    else existing_job.load_strategy
                )

                # Validate for UPSERT
                if effective_load_strategy == "upsert":
                    if not primary_key_columns:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="UPSERT strategy requires at least one column to be marked as a Primary Key. "
                                   "These columns uniquely identify rows for update operations."
                        )

                    # Get effective upsert keys
                    effective_upsert_keys = (
                        job_update.upsert_keys if job_update.upsert_keys is not None
                        else existing_job.upsert_keys
                    )

                    if not effective_upsert_keys or len(effective_upsert_keys) == 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="UPSERT strategy requires selecting upsert key columns."
                        )

                    # Validate upsert keys are a subset of primary keys
                    invalid_upsert_keys = [
                        key for key in effective_upsert_keys
                        if key not in primary_key_columns
                    ]

                    if invalid_upsert_keys:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Upsert keys must be marked as Primary Keys. "
                                   f"The following upsert keys are not primary keys: {', '.join(invalid_upsert_keys)}. "
                                   f"Please mark these columns as Primary Keys or select different upsert keys."
                        )

        db_job = await crud.update_etl_job(db, job_id, job_update)

        if not db_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ETL job not found"
            )

        return db_job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update ETL job: {str(e)}"
        )


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an ETL job."""
    success = await crud.delete_etl_job(db, job_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    return None


@router.post("/{job_id}/regenerate-ddl")
async def regenerate_ddl(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Regenerate DDL for an ETL job based on current column mappings."""
    from app.services.ddl_generator import DDLGenerator

    # Get job
    job = await crud.get_etl_job(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    # Get column mappings
    if not job.column_mappings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job has no column mappings"
        )

    # Get destination config
    schema = job.destination_config.get('schema', 'public')
    table = job.destination_config.get('table') or job.destination_config.get('table_name')

    if not table:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job destination config missing table name"
        )

    # Convert ColumnMapping models to schema format for DDL generator
    from app.schemas.etl_job import ColumnMappingCreate
    column_schemas = []
    for mapping in job.column_mappings:
        column_schema = ColumnMappingCreate(
            source_column=mapping.source_column,
            destination_column=mapping.dest_column,
            source_type=mapping.source_data_type or 'text',
            destination_type=mapping.dest_data_type,
            transformations=mapping.transformations,
            is_nullable=mapping.is_nullable,
            default_value=mapping.default_value,
            exclude=mapping.exclude,
            is_calculated=mapping.is_calculated,
            expression=mapping.calculation_expression,
            column_order=mapping.column_order,
            is_primary_key=mapping.is_primary_key
        )
        column_schemas.append(column_schema)

    # Generate DDL
    new_ddl = DDLGenerator.generate(
        schema=schema,
        table=table,
        columns=column_schemas,
        db_type=job.destination_type.value if hasattr(job.destination_type, 'value') else job.destination_type
    )

    # Update job
    job.new_table_ddl = new_ddl
    await db.commit()
    await db.refresh(job)

    return {
        "job_id": job_id,
        "ddl": new_ddl,
        "message": "DDL regenerated successfully"
    }


@router.put("/{job_id}/mappings", response_model=List[ColumnMappingResponse])
async def update_mappings(
    job_id: int,
    mappings: List[ColumnMappingCreate],
    db: AsyncSession = Depends(get_db)
):
    """Update column mappings for an ETL job."""
    # Verify job exists
    db_job = await crud.get_etl_job(db, job_id)
    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    try:
        updated_mappings = await crud.update_column_mappings(db, job_id, mappings)
        return updated_mappings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update column mappings: {str(e)}"
        )


@router.post("/execute/{job_id}", response_model=JobRunResponse, status_code=status.HTTP_201_CREATED)
async def execute_job(
    job_id: int,
    trigger_source: str = Query(default="manual", regex="^(manual|scheduled)$"),
    db: AsyncSession = Depends(get_db)
):
    """Execute an ETL job immediately via Airflow."""
    from app.services.airflow_client import airflow_client

    # Get job
    db_job = await crud.get_etl_job(db, job_id)
    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    # Check if job is paused
    if db_job.is_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job is paused. Resume the job before executing."
        )

    # Create job run record
    job_run = JobRun(
        job_id=job_id,
        status=RunStatus.PENDING,
        started_at=datetime.utcnow(),
        triggered_by=trigger_source,
        message="Job execution initiated"
    )

    db.add(job_run)
    await db.commit()
    await db.refresh(job_run)

    # Trigger Airflow DAG execution
    try:
        dag_run_id = await airflow_client.trigger_dag(
            'etl_job_executor',
            conf={
                'job_id': job_id,
                'job_run_id': job_run.id
            }
        )

        # Store Airflow DAG run ID for tracking
        job_run.airflow_dag_run_id = dag_run_id
        job_run.message = f"Job execution queued in Airflow (DAG run: {dag_run_id})"
        await db.commit()
        await db.refresh(job_run)

    except Exception as e:
        # If Airflow trigger fails, mark the job run as failed
        job_run.status = RunStatus.FAILED
        job_run.error_message = f"Failed to trigger Airflow DAG: {str(e)}"
        job_run.message = "Failed to start job execution"
        await db.commit()
        await db.refresh(job_run)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger job execution: {str(e)}"
        )

    return job_run


@router.post("/{job_id}/pause", response_model=ETLJobResponse)
async def pause_job(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Pause a job - blocks all execution (manual and scheduled).
    If the job has an active schedule, it will be disabled and the Airflow DAG will be paused.
    """
    from app.services.airflow_client import airflow_client
    from app.models.schedule import Schedule
    from sqlalchemy import select

    # Get job
    db_job = await crud.get_etl_job(db, job_id)
    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    # Set is_paused flag
    db_job.is_paused = True

    # Get and disable any schedules
    result = await db.execute(
        select(Schedule).where(Schedule.job_id == job_id)
    )
    schedule = result.scalar_one_or_none()

    if schedule:
        schedule.enabled = False

        # Pause the Airflow DAG if it exists
        if schedule.airflow_dag_id:
            try:
                await airflow_client.pause_dag(schedule.airflow_dag_id)
            except Exception as e:
                # Log error but don't fail the pause operation
                import logging
                logging.error(f"Failed to pause Airflow DAG {schedule.airflow_dag_id}: {e}")

    await db.commit()

    # Re-fetch the job with updated status
    updated_job = await crud.get_etl_job(db, job_id)
    return updated_job


@router.post("/{job_id}/resume", response_model=ETLJobResponse)
async def resume_job(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Resume a paused job.
    If the job has a schedule, it will be re-enabled and the Airflow DAG will be unpaused.
    """
    from app.services.airflow_client import airflow_client
    from app.models.schedule import Schedule
    from sqlalchemy import select

    # Get job
    db_job = await crud.get_etl_job(db, job_id)
    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    # Clear is_paused flag
    db_job.is_paused = False

    # Get and re-enable schedules
    result = await db.execute(
        select(Schedule).where(Schedule.job_id == job_id)
    )
    schedule = result.scalar_one_or_none()

    if schedule:
        schedule.enabled = True

        # Unpause the Airflow DAG if it exists
        if schedule.airflow_dag_id:
            try:
                await airflow_client.unpause_dag(schedule.airflow_dag_id)
            except Exception as e:
                # Log error but don't fail the resume operation
                import logging
                logging.error(f"Failed to unpause Airflow DAG {schedule.airflow_dag_id}: {e}")

    await db.commit()

    # Re-fetch the job with updated status
    updated_job = await crud.get_etl_job(db, job_id)
    return updated_job
