"""
DAG Health Monitor

This DAG runs periodically to ensure critical DAGs remain unpaused.
Specifically monitors and auto-unpauses the etl_job_executor DAG.
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import DagModel
from datetime import datetime, timedelta
from airflow.utils.state import State

default_args = {
    'owner': 'etl_portal',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 2,
    'retry_delay': timedelta(minutes=1),
}


def check_and_unpause_critical_dags(**context):
    """
    Check critical DAGs and ensure they are unpaused.
    Auto-unpauses etl_job_executor if it's paused.
    """
    from airflow.settings import Session

    # List of critical DAGs that should always be unpaused
    critical_dags = ['etl_job_executor']

    session = Session()
    try:
        for dag_id in critical_dags:
            dag_model = session.query(DagModel).filter(DagModel.dag_id == dag_id).first()

            if dag_model:
                if dag_model.is_paused:
                    print(f"WARNING: Critical DAG '{dag_id}' is paused. Unpausing now...")
                    dag_model.is_paused = False
                    session.commit()
                    print(f"SUCCESS: DAG '{dag_id}' has been unpaused.")
                else:
                    print(f"OK: DAG '{dag_id}' is already unpaused.")
            else:
                print(f"WARNING: DAG '{dag_id}' not found in database. It may not be loaded yet.")
    except Exception as e:
        print(f"ERROR: Failed to check/unpause DAGs: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()


# Define the monitoring DAG - runs every 5 minutes
dag = DAG(
    'dag_health_monitor',
    default_args=default_args,
    description='Monitor and ensure critical DAGs remain unpaused',
    schedule_interval='*/5 * * * *',  # Every 5 minutes
    catchup=False,
    tags=['monitoring', 'health-check'],
    is_paused_upon_creation=False,  # Auto-enable on deployment
)

# Task to check and unpause critical DAGs
monitor_task = PythonOperator(
    task_id='check_critical_dags',
    python_callable=check_and_unpause_critical_dags,
    provide_context=True,
    dag=dag,
)
