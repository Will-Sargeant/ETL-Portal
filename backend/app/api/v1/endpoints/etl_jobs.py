from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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
        db_job = await crud.create_etl_job(db, job)
        return db_job
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
    db_job = await crud.update_etl_job(db, job_id, job_update)

    if not db_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ETL job not found"
        )

    return db_job


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

    # Create job run record
    job_run = JobRun(
        job_id=job_id,
        status=RunStatus.PENDING,
        started_at=datetime.utcnow(),
        triggered_by="manual",
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
