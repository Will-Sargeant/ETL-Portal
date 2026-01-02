"""
ETL Job Executor DAG

This is a static DAG that handles ALL ETL job executions.
It is triggered manually or by scheduled DAGs with job_id and job_run_id in conf.
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import sys
import os

# Add the backend app directory to Python path so we can import modules
backend_path = '/app'
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

default_args = {
    'owner': 'etl_portal',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(hours=2),  # Max 2 hours per job
}


def execute_etl_job(**context):
    """
    Python callable to execute ETL job.

    Receives job_id and job_run_id from DAG run conf and executes the ETL job.
    """
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.services.etl_service import ETLService
    from app.core.config import settings

    # Get parameters from DAG run configuration
    dag_run = context['dag_run']
    job_id = dag_run.conf.get('job_id')
    job_run_id = dag_run.conf.get('job_run_id')

    if not job_id or not job_run_id:
        raise ValueError(
            f"Missing required parameters: job_id={job_id}, job_run_id={job_run_id}"
        )

    print(f"Starting ETL job execution: job_id={job_id}, job_run_id={job_run_id}")

    # Create async database session
    async def run_etl():
        # Create async engine
        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_pre_ping=True
        )

        # Create async session factory
        async_session_factory = sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

        async with async_session_factory() as session:
            try:
                # Create ETL service and execute job
                etl_service = ETLService(session)
                await etl_service.execute_job(job_id, job_run_id)

                print(f"ETL job completed successfully: job_id={job_id}, job_run_id={job_run_id}")

            except Exception as e:
                print(f"ETL job failed: job_id={job_id}, job_run_id={job_run_id}, error={str(e)}")
                raise

            finally:
                await engine.dispose()

    # Run the async function
    asyncio.run(run_etl())


# Define the DAG
dag = DAG(
    'etl_job_executor',
    default_args=default_args,
    description='Execute ETL jobs triggered by API or scheduled DAGs',
    schedule_interval=None,  # Triggered manually, not scheduled
    catchup=False,
    max_active_runs=10,  # Allow up to 10 concurrent job executions
    tags=['etl', 'executor'],
    is_paused_upon_creation=False,  # Auto-enable on deployment
)

# Single task to execute the ETL job
execute_task = PythonOperator(
    task_id='execute_etl_job',
    python_callable=execute_etl_job,
    provide_context=True,
    dag=dag,
)
