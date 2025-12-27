from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.etl_job import ETLJob
from app.models.column_mapping import ColumnMapping
from app.models.schedule import Schedule
from app.models.job_run import JobRun
from app.schemas.etl_job import ETLJobCreate, ETLJobUpdate, ColumnMappingCreate


def generate_ddl(schema: str, table: str, column_mappings: List[ColumnMappingCreate]) -> str:
    """
    Generate CREATE TABLE DDL from column mappings.

    Args:
        schema: Database schema name
        table: Table name
        column_mappings: List of column mapping configurations

    Returns:
        CREATE TABLE DDL statement
    """
    columns_ddl = []

    for mapping in column_mappings:
        mapping_dict = mapping.model_dump()

        # Skip excluded columns
        if mapping_dict.get("exclude", False):
            continue

        col_name = mapping_dict["destination_column"]
        col_type = mapping_dict["destination_type"]
        is_nullable = mapping_dict.get("is_nullable", True)
        is_primary_key = mapping_dict.get("is_primary_key", False)

        # Build column definition
        col_def = f'  "{col_name}" {col_type}'

        if is_primary_key:
            col_def += " PRIMARY KEY"
        elif not is_nullable:
            col_def += " NOT NULL"

        columns_ddl.append(col_def)

    # Join all column definitions
    columns_str = ',\n'.join(columns_ddl)

    # Generate full CREATE TABLE statement
    ddl = f'CREATE TABLE "{schema}"."{table}" (\n{columns_str}\n);'

    return ddl


async def create_etl_job(
    db: AsyncSession,
    job: ETLJobCreate
) -> ETLJob:
    """Create a new ETL job with column mappings and optional schedule."""
    # Extract column mappings and schedule
    column_mappings_data = job.column_mappings
    schedule_data = job.schedule
    job_data = job.model_dump(exclude={"column_mappings", "schedule"})

    # Generate DDL if creating a new table
    if job.create_new_table and not job.new_table_ddl and column_mappings_data:
        schema = job.destination_config.get("schema", "public")
        table = job.destination_config.get("table")
        if table:
            job_data["new_table_ddl"] = generate_ddl(schema, table, column_mappings_data)

    # Create ETL job
    db_job = ETLJob(**job_data)
    db.add(db_job)
    await db.flush()  # Flush to get the job ID

    # Create column mappings
    for mapping in column_mappings_data:
        mapping_dict = mapping.model_dump()
        # Map schema field names to model field names
        db_mapping = ColumnMapping(
            job_id=db_job.id,
            source_column=mapping_dict["source_column"],
            source_data_type=mapping_dict["source_type"],
            dest_column=mapping_dict["destination_column"],
            dest_data_type=mapping_dict["destination_type"],
            transformations=mapping_dict.get("transformation"),
            is_nullable=mapping_dict.get("is_nullable", True),
            default_value=mapping_dict.get("default_value"),
            exclude=mapping_dict.get("exclude", False),
            column_order=mapping_dict.get("column_order", 0),
            is_primary_key=mapping_dict.get("is_primary_key", False),
        )
        db.add(db_mapping)

    # Create schedule if provided
    if schedule_data:
        db_schedule = Schedule(
            job_id=db_job.id,
            cron_expression=schedule_data.cron_expression,
            enabled=schedule_data.enabled,
            airflow_dag_id=f"etl_job_{db_job.id}_scheduled"
        )
        db.add(db_schedule)
        await db.flush()  # Flush to get the schedule ID

        # Generate Airflow DAG for the schedule
        try:
            from app.services.airflow_service import AirflowService
            from app.services.airflow_client import airflow_client

            airflow_service = AirflowService()
            dag_id = airflow_service.generate_scheduled_dag(db_job, db_schedule)

            # Unpause the DAG if schedule is enabled
            if db_schedule.enabled:
                await airflow_client.unpause_dag(dag_id)
        except Exception as e:
            # Log error but don't fail the job creation
            import logging
            logging.error(f"Failed to generate Airflow DAG for job {db_job.id}: {e}")

    await db.commit()
    await db.refresh(db_job)

    # Load relationships
    result = await db.execute(
        select(ETLJob)
        .where(ETLJob.id == db_job.id)
        .options(selectinload(ETLJob.column_mappings))
    )
    return result.scalar_one()


async def get_etl_job(
    db: AsyncSession,
    job_id: int
) -> Optional[ETLJob]:
    """Get an ETL job by ID with column mappings and computed status."""
    result = await db.execute(
        select(ETLJob)
        .where(ETLJob.id == job_id)
        .options(selectinload(ETLJob.column_mappings))
    )
    job = result.scalar_one_or_none()

    if not job:
        return None

    # Compute status same as in get_etl_jobs
    # Count job runs
    run_count_result = await db.execute(
        select(func.count(JobRun.id))
        .where(JobRun.job_id == job_id)
    )
    run_count = run_count_result.scalar() or 0

    # Count active schedules
    active_schedule_result = await db.execute(
        select(func.count(Schedule.id))
        .where(Schedule.job_id == job_id, Schedule.enabled == True)
    )
    active_schedule_count = active_schedule_result.scalar() or 0

    # Detach from session to avoid triggering updates
    db.expunge(job)

    # Compute status
    if job.is_paused:
        job.status = "paused"
    elif active_schedule_count > 0 or run_count > 0:
        job.status = "live"
    else:
        job.status = "draft"

    return job


async def get_etl_jobs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None
) -> List[ETLJob]:
    """Get all ETL jobs with last execution date and computed status."""
    from app.models.schedule import Schedule

    # Subquery to get the latest started_at for each job
    latest_run_subquery = (
        select(
            JobRun.job_id,
            func.max(JobRun.started_at).label('last_executed_at')
        )
        .group_by(JobRun.job_id)
        .subquery()
    )

    # Subquery to count job runs for each job
    run_count_subquery = (
        select(
            JobRun.job_id,
            func.count(JobRun.id).label('run_count')
        )
        .group_by(JobRun.job_id)
        .subquery()
    )

    # Subquery to check for active schedules
    active_schedule_subquery = (
        select(
            Schedule.job_id,
            func.count(Schedule.id).label('active_schedule_count')
        )
        .where(Schedule.enabled == True)
        .group_by(Schedule.job_id)
        .subquery()
    )

    # Main query with left joins
    query = (
        select(
            ETLJob,
            latest_run_subquery.c.last_executed_at,
            func.coalesce(run_count_subquery.c.run_count, 0).label('run_count'),
            func.coalesce(active_schedule_subquery.c.active_schedule_count, 0).label('active_schedule_count')
        )
        .outerjoin(latest_run_subquery, ETLJob.id == latest_run_subquery.c.job_id)
        .outerjoin(run_count_subquery, ETLJob.id == run_count_subquery.c.job_id)
        .outerjoin(active_schedule_subquery, ETLJob.id == active_schedule_subquery.c.job_id)
        .offset(skip)
        .limit(limit)
        .order_by(ETLJob.created_at.desc())
    )

    if status:
        query = query.where(ETLJob.status == status)

    result = await db.execute(query)

    # Attach last_executed_at and compute status for each job
    # We need to detach from session to avoid triggering updates
    jobs = []
    for job, last_executed_at, run_count, active_schedule_count in result:
        # Detach the job from the session so we can modify it without updating DB
        db.expunge(job)

        job.last_executed_at = last_executed_at

        # Compute status based on rules:
        # - paused if is_paused is True
        # - live if has active schedule OR has been run at least once
        # - draft otherwise
        if job.is_paused:
            job.status = "paused"
        elif active_schedule_count > 0 or run_count > 0:
            job.status = "live"
        else:
            job.status = "draft"

        jobs.append(job)

    return jobs


async def update_etl_job(
    db: AsyncSession,
    job_id: int,
    job_update: ETLJobUpdate
) -> Optional[ETLJob]:
    """Update an ETL job."""
    db_job = await get_etl_job(db, job_id)

    if not db_job:
        return None

    update_data = job_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_job, field, value)

    await db.commit()
    await db.refresh(db_job)

    # Load relationships
    result = await db.execute(
        select(ETLJob)
        .where(ETLJob.id == db_job.id)
        .options(selectinload(ETLJob.column_mappings))
    )
    return result.scalar_one()


async def delete_etl_job(
    db: AsyncSession,
    job_id: int
) -> bool:
    """Delete an ETL job."""
    db_job = await get_etl_job(db, job_id)

    if not db_job:
        return False

    await db.delete(db_job)
    await db.commit()

    return True


async def update_column_mappings(
    db: AsyncSession,
    job_id: int,
    mappings: List[ColumnMappingCreate]
) -> List[ColumnMapping]:
    """Update column mappings for a job (replaces all existing mappings)."""
    from app.services.ddl_generator import DDLGenerator

    # Get the job to access schema/table info (without loading mappings to avoid session conflicts)
    result = await db.execute(
        select(ETLJob).where(ETLJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise ValueError(f"Job {job_id} not found")

    # Delete existing mappings using a direct delete statement
    await db.execute(
        select(ColumnMapping).where(ColumnMapping.job_id == job_id)
    )
    existing = await db.execute(
        select(ColumnMapping).where(ColumnMapping.job_id == job_id)
    )
    for mapping in existing.scalars().all():
        await db.delete(mapping)

    # Flush to ensure deletions are committed before adding new ones
    await db.flush()

    # Create new mappings
    new_mappings = []
    for mapping_data in mappings:
        # Map frontend field names to backend column names
        mapping_dict = mapping_data.model_dump(exclude_none=True)

        # Handle transformations array or single transformation
        transformations_value = mapping_dict.get('transformations')
        if not transformations_value and mapping_dict.get('transformation'):
            # Convert single transformation to array
            transformations_value = [mapping_dict['transformation']]

        db_mapping = ColumnMapping(
            job_id=job_id,
            source_column=mapping_dict['source_column'],
            source_data_type=mapping_dict.get('source_type'),
            dest_column=mapping_dict['destination_column'],
            dest_data_type=mapping_dict['destination_type'],
            transformations=transformations_value,
            is_nullable=mapping_dict.get('is_nullable', True),
            default_value=mapping_dict.get('default_value'),
            exclude=mapping_dict.get('exclude', False),
            column_order=mapping_dict.get('column_order', 0),
            is_primary_key=mapping_dict.get('is_primary_key', False),
        )
        db.add(db_mapping)
        new_mappings.append(db_mapping)

    # Regenerate DDL with new column mappings
    schema = job.destination_config.get('schema', 'public')
    table = job.destination_config.get('table') or job.destination_config.get('table_name')

    if table and mappings:
        new_ddl = DDLGenerator.generate(
            schema=schema,
            table=table,
            columns=mappings,
            db_type=job.destination_type.value if hasattr(job.destination_type, 'value') else job.destination_type
        )

        # Update job with new DDL
        job.new_table_ddl = new_ddl
        db.add(job)

    await db.commit()

    # Refresh all mappings
    for mapping in new_mappings:
        await db.refresh(mapping)

    return new_mappings
