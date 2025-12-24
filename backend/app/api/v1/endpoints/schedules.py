from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.schedule import Schedule
from app.models.etl_job import ETLJob
from app.schemas.etl_job import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.services.airflow_service import AirflowService
from app.services.airflow_client import airflow_client
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/", response_model=List[ScheduleResponse])
async def list_schedules(
    job_id: Optional[int] = None,
    enabled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List schedules with optional filtering.

    Args:
        job_id: Filter by specific job ID
        enabled: Filter by enabled status
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return

    Returns:
        List of schedules matching the filters
    """
    query = select(Schedule).order_by(Schedule.created_at.desc())

    # Apply filters
    if job_id is not None:
        query = query.where(Schedule.job_id == job_id)

    if enabled is not None:
        query = query.where(Schedule.enabled == enabled)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    schedules = result.scalars().all()

    return schedules


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific schedule by ID.

    Args:
        schedule_id: The schedule ID

    Returns:
        Schedule details

    Raises:
        HTTPException: 404 if schedule not found
    """
    schedule = await db.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found"
        )

    return schedule


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new schedule for an ETL job.

    Args:
        schedule_data: Schedule configuration
        job_id: The job ID to schedule

    Returns:
        Created schedule

    Raises:
        HTTPException: 404 if job not found, 400 if job already has a schedule
    """
    # Verify job exists
    job = await db.get(ETLJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found"
        )

    # Check if job already has a schedule
    existing = await db.execute(
        select(Schedule).where(Schedule.job_id == job_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job {job_id} already has a schedule. Use PUT to update."
        )

    # Create schedule
    schedule = Schedule(
        job_id=job_id,
        cron_expression=schedule_data.cron_expression,
        enabled=schedule_data.enabled,
        airflow_dag_id=f"etl_job_{job_id}_scheduled"
    )

    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Generate Airflow DAG for this schedule
    try:
        airflow_service = AirflowService()
        dag_id = airflow_service.generate_scheduled_dag(job, schedule)
        logger.info("airflow_dag_generated", job_id=job_id, dag_id=dag_id)

        # Unpause the DAG if schedule is enabled
        if schedule.enabled:
            await airflow_client.unpause_dag(dag_id)
            logger.info("airflow_dag_unpaused", dag_id=dag_id)
    except Exception as e:
        logger.error("failed_to_generate_dag", job_id=job_id, error=str(e))
        # Don't fail the request if DAG generation fails
        # The schedule is still created in the database

    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a schedule.

    Args:
        schedule_id: The schedule ID
        schedule_data: Updated schedule configuration

    Returns:
        Updated schedule

    Raises:
        HTTPException: 404 if schedule not found
    """
    schedule = await db.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found"
        )

    # Update fields
    update_data = schedule_data.model_dump(exclude_unset=True)
    cron_changed = "cron_expression" in update_data

    for field, value in update_data.items():
        setattr(schedule, field, value)

    await db.commit()
    await db.refresh(schedule)

    # Regenerate Airflow DAG if cron expression changed
    if cron_changed and schedule.airflow_dag_id:
        try:
            airflow_service = AirflowService()
            job = await db.get(ETLJob, schedule.job_id)
            if job:
                dag_id = airflow_service.update_scheduled_dag(job, schedule)
                logger.info("airflow_dag_updated", schedule_id=schedule_id, dag_id=dag_id)
        except Exception as e:
            logger.error("failed_to_update_dag", schedule_id=schedule_id, error=str(e))

    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a schedule.

    Args:
        schedule_id: The schedule ID

    Raises:
        HTTPException: 404 if schedule not found
    """
    schedule = await db.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found"
        )

    # Delete Airflow DAG file
    if schedule.airflow_dag_id:
        try:
            airflow_service = AirflowService()
            deleted = airflow_service.delete_dag(schedule.airflow_dag_id)
            if deleted:
                logger.info("airflow_dag_deleted", dag_id=schedule.airflow_dag_id)
            else:
                logger.warning("airflow_dag_not_found", dag_id=schedule.airflow_dag_id)
        except Exception as e:
            logger.error("failed_to_delete_dag", dag_id=schedule.airflow_dag_id, error=str(e))

    await db.delete(schedule)
    await db.commit()

    return None


@router.post("/{schedule_id}/enable", response_model=ScheduleResponse)
async def enable_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Enable a schedule.

    Args:
        schedule_id: The schedule ID

    Returns:
        Updated schedule

    Raises:
        HTTPException: 404 if schedule not found
    """
    schedule = await db.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found"
        )

    schedule.enabled = True
    await db.commit()
    await db.refresh(schedule)

    # Unpause DAG in Airflow
    if schedule.airflow_dag_id:
        try:
            success = await airflow_client.unpause_dag(schedule.airflow_dag_id)
            if success:
                logger.info("airflow_dag_unpaused", dag_id=schedule.airflow_dag_id)
            else:
                logger.warning("failed_to_unpause_dag", dag_id=schedule.airflow_dag_id)
        except Exception as e:
            logger.error("error_unpausing_dag", dag_id=schedule.airflow_dag_id, error=str(e))

    return schedule


@router.post("/{schedule_id}/disable", response_model=ScheduleResponse)
async def disable_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Disable a schedule.

    Args:
        schedule_id: The schedule ID

    Returns:
        Updated schedule

    Raises:
        HTTPException: 404 if schedule not found
    """
    schedule = await db.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found"
        )

    schedule.enabled = False
    await db.commit()
    await db.refresh(schedule)

    # Pause DAG in Airflow
    if schedule.airflow_dag_id:
        try:
            success = await airflow_client.pause_dag(schedule.airflow_dag_id)
            if success:
                logger.info("airflow_dag_paused", dag_id=schedule.airflow_dag_id)
            else:
                logger.warning("failed_to_pause_dag", dag_id=schedule.airflow_dag_id)
        except Exception as e:
            logger.error("error_pausing_dag", dag_id=schedule.airflow_dag_id, error=str(e))

    return schedule
