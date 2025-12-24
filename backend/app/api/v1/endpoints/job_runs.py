from typing import List, Optional
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.models.job_run import JobRun, RunStatus
from app.schemas.etl_job import JobRunResponse
from app.services.airflow_client import airflow_client
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/", response_model=List[JobRunResponse])
async def list_job_runs(
    job_id: Optional[int] = None,
    status: Optional[RunStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List job runs with optional filtering.

    Args:
        job_id: Filter by specific job ID
        status: Filter by run status (PENDING, RUNNING, COMPLETED, FAILED)
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return

    Returns:
        List of job runs matching the filters
    """
    query = select(JobRun).order_by(JobRun.started_at.desc())

    # Apply filters
    if job_id is not None:
        query = query.where(JobRun.job_id == job_id)

    if status is not None:
        query = query.where(JobRun.status == status)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    job_runs = result.scalars().all()

    # Check Airflow state for runs that might be retrying
    for job_run in job_runs:
        if job_run.airflow_dag_run_id and job_run.status in [RunStatus.FAILED, RunStatus.RUNNING]:
            try:
                task_instance = await airflow_client.get_task_instance(
                    dag_id="etl_job_executor",
                    dag_run_id=job_run.airflow_dag_run_id,
                    task_id="execute_etl_job"
                )

                if task_instance:
                    airflow_state = task_instance.get('state')

                    if airflow_state == 'up_for_retry':
                        # Update status to RETRYING if Airflow shows retry
                        if job_run.status != RunStatus.RETRYING:
                            job_run.status = RunStatus.RETRYING
                            job_run.message = f"Task is retrying (attempt {task_instance.get('try_number', 1)})"
                            await db.commit()
                            logger.info(
                                "job_run_status_updated_to_retrying_in_list",
                                job_run_id=job_run.id,
                                airflow_state=airflow_state,
                                try_number=task_instance.get('try_number')
                            )
                    elif airflow_state == 'running' and job_run.status == RunStatus.FAILED:
                        # Task is actually running, update from stale FAILED status
                        job_run.status = RunStatus.RUNNING
                        await db.commit()
                        logger.info(
                            "job_run_status_updated_to_running_in_list",
                            job_run_id=job_run.id,
                            airflow_state=airflow_state
                        )

            except Exception as e:
                # Don't fail the request if we can't check Airflow
                logger.warning(
                    "failed_to_check_airflow_task_state_in_list",
                    job_run_id=job_run.id,
                    error=str(e)
                )

    return job_runs


@router.get("/{job_run_id}", response_model=JobRunResponse)
async def get_job_run(
    job_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific job run by ID.

    Args:
        job_run_id: The job run ID

    Returns:
        Job run details including progress, status, and error information

    Raises:
        HTTPException: 404 if job run not found
    """
    job_run = await db.get(JobRun, job_run_id)

    if not job_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job run {job_run_id} not found"
        )

    # If job has Airflow DAG run ID, check Airflow for actual task state
    if job_run.airflow_dag_run_id and job_run.status in [RunStatus.FAILED, RunStatus.RUNNING]:
        try:
            task_instance = await airflow_client.get_task_instance(
                dag_id="etl_job_executor",
                dag_run_id=job_run.airflow_dag_run_id,
                task_id="execute_etl_job"
            )

            if task_instance:
                airflow_state = task_instance.get('state')

                # Map Airflow states to our RunStatus
                # Airflow states: queued, running, success, failed, up_for_retry, up_for_reschedule, etc.
                if airflow_state == 'up_for_retry':
                    # Update status to RETRYING if Airflow shows retry
                    if job_run.status != RunStatus.RETRYING:
                        job_run.status = RunStatus.RETRYING
                        job_run.message = f"Task is retrying (attempt {task_instance.get('try_number', 1)})"
                        await db.commit()
                        await db.refresh(job_run)
                        logger.info(
                            "job_run_status_updated_to_retrying",
                            job_run_id=job_run_id,
                            airflow_state=airflow_state,
                            try_number=task_instance.get('try_number')
                        )
                elif airflow_state == 'running' and job_run.status == RunStatus.FAILED:
                    # Task is actually running, update from stale FAILED status
                    job_run.status = RunStatus.RUNNING
                    await db.commit()
                    await db.refresh(job_run)
                    logger.info(
                        "job_run_status_updated_to_running",
                        job_run_id=job_run_id,
                        airflow_state=airflow_state
                    )

        except Exception as e:
            # Don't fail the request if we can't check Airflow
            logger.warning(
                "failed_to_check_airflow_task_state",
                job_run_id=job_run_id,
                error=str(e)
            )

    return job_run


@router.get("/{job_run_id}/logs")
async def get_job_run_logs(
    job_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution logs for a job run, including Airflow logs if available.

    Args:
        job_run_id: The job run ID

    Returns:
        Logs as text or JSON array, combined with Airflow task logs

    Raises:
        HTTPException: 404 if job run not found
    """
    job_run = await db.get(JobRun, job_run_id)

    if not job_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job run {job_run_id} not found"
        )

    # Start with application logs
    combined_logs = job_run.logs or ""

    # Try to fetch Airflow logs if DAG run ID exists
    if job_run.airflow_dag_run_id:
        try:
            airflow_logs = await airflow_client.get_task_logs(
                dag_id="etl_job_executor",
                dag_run_id=job_run.airflow_dag_run_id,
                task_id="execute_etl_job"
            )

            if airflow_logs:
                # Append Airflow logs with a separator
                if combined_logs:
                    combined_logs += "\n\n" + "=" * 80 + "\n"
                    combined_logs += "AIRFLOW TASK LOGS\n"
                    combined_logs += "=" * 80 + "\n\n"
                combined_logs += airflow_logs

                logger.info("fetched_airflow_logs", job_run_id=job_run_id, dag_run_id=job_run.airflow_dag_run_id)
        except Exception as e:
            logger.warning(
                "failed_to_fetch_airflow_logs",
                job_run_id=job_run_id,
                dag_run_id=job_run.airflow_dag_run_id,
                error=str(e)
            )
            # Don't fail the request if Airflow logs can't be fetched
            if combined_logs:
                combined_logs += f"\n\n[Note: Could not fetch Airflow logs: {str(e)}]"

    return {
        "job_run_id": job_run_id,
        "logs": combined_logs,
        "error_message": job_run.error_message,
        "status": job_run.status
    }


@router.delete("/{job_run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_run(
    job_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a job run record.

    If the job run has an associated Airflow task that is still running, pending, or retrying,
    the task will be marked as failed in Airflow before deleting the database record.

    Args:
        job_run_id: The job run ID

    Raises:
        HTTPException: 404 if job run not found
    """
    job_run = await db.get(JobRun, job_run_id)

    if not job_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job run {job_run_id} not found"
        )

    # If job has an Airflow DAG run ID and is not already in a terminal state,
    # mark the Airflow task as failed to cancel it
    if job_run.airflow_dag_run_id and job_run.status not in [RunStatus.COMPLETED, RunStatus.FAILED]:
        logger.info(
            "canceling_airflow_task_for_deleted_job_run",
            job_run_id=job_run_id,
            airflow_dag_run_id=job_run.airflow_dag_run_id,
            status=job_run.status
        )

        try:
            success = await airflow_client.mark_task_failed(
                dag_id="etl_job_executor",
                dag_run_id=job_run.airflow_dag_run_id,
                task_id="execute_etl_job"
            )

            if success:
                logger.info(
                    "airflow_task_canceled_successfully",
                    job_run_id=job_run_id,
                    airflow_dag_run_id=job_run.airflow_dag_run_id
                )
            else:
                logger.warning(
                    "failed_to_cancel_airflow_task",
                    job_run_id=job_run_id,
                    airflow_dag_run_id=job_run.airflow_dag_run_id,
                    message="Proceeding with deletion anyway"
                )
        except Exception as e:
            # Log the error but don't fail the deletion
            logger.warning(
                "error_canceling_airflow_task",
                job_run_id=job_run_id,
                airflow_dag_run_id=job_run.airflow_dag_run_id,
                error=str(e),
                message="Proceeding with deletion anyway"
            )

    await db.delete(job_run)
    await db.commit()

    logger.info("job_run_deleted", job_run_id=job_run_id)
    return None


@router.get("/{job_run_id}/stream")
async def stream_job_progress(
    job_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Stream real-time progress updates for a job run via Server-Sent Events (SSE).

    This endpoint establishes a persistent connection and sends progress updates
    every second until the job completes or fails.

    Args:
        job_run_id: The job run ID to monitor

    Returns:
        EventSourceResponse streaming progress updates

    Raises:
        HTTPException: 404 if job run not found

    Event Format:
        {
            "status": "running",
            "progress_percentage": 45,
            "rows_processed": 45000,
            "rows_total": 100000,
            "message": "Processing batch 45/100"
        }
    """
    # Verify job run exists
    job_run = await db.get(JobRun, job_run_id)
    if not job_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job run {job_run_id} not found"
        )

    async def event_generator():
        """Generate SSE events with job run progress updates."""
        try:
            while True:
                # Get fresh database session for each iteration
                async for session in get_db():
                    job_run = await session.get(JobRun, job_run_id)

                    if not job_run:
                        # Job run was deleted
                        yield {
                            "event": "error",
                            "data": json.dumps({"error": "Job run not found"})
                        }
                        break

                    # Prepare progress data
                    progress_data = {
                        "id": job_run.id,
                        "job_id": job_run.job_id,
                        "status": job_run.status.value,
                        "progress_percentage": job_run.progress_percentage or 0,
                        "rows_processed": job_run.rows_processed or 0,
                        "rows_total": job_run.rows_total or 0,
                        "message": job_run.message,
                        "started_at": job_run.started_at.isoformat() if job_run.started_at else None,
                        "completed_at": job_run.completed_at.isoformat() if job_run.completed_at else None,
                    }

                    # Send progress update
                    yield {
                        "event": "progress",
                        "data": json.dumps(progress_data)
                    }

                    # Check Airflow task state if available
                    if job_run.airflow_dag_run_id and job_run.status in [RunStatus.FAILED, RunStatus.RUNNING]:
                        try:
                            task_instance = await airflow_client.get_task_instance(
                                dag_id="etl_job_executor",
                                dag_run_id=job_run.airflow_dag_run_id,
                                task_id="execute_etl_job"
                            )

                            if task_instance:
                                airflow_state = task_instance.get('state')
                                if airflow_state == 'up_for_retry':
                                    # Update to RETRYING if Airflow shows retry
                                    if job_run.status != RunStatus.RETRYING:
                                        job_run.status = RunStatus.RETRYING
                                        job_run.message = f"Task is retrying (attempt {task_instance.get('try_number', 1)})"
                                        await session.commit()
                                        progress_data['status'] = RunStatus.RETRYING.value
                                        progress_data['message'] = job_run.message
                        except Exception as e:
                            logger.warning("failed_to_check_airflow_in_sse", error=str(e))

                    # Check if job is in terminal state
                    if job_run.status in [RunStatus.COMPLETED, RunStatus.FAILED]:
                        # Send final completion event
                        yield {
                            "event": "complete" if job_run.status == RunStatus.COMPLETED else "failed",
                            "data": json.dumps(progress_data)
                        }
                        break

                    break  # Exit the async for loop

                # Wait 1 second before next update
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            # Client disconnected
            pass
        except Exception as e:
            # Send error event
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())
