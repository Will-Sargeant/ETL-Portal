#!/bin/bash
set -e

# Wait for postgres to be ready
while ! nc -z airflow-db 5432; do
  echo "Waiting for Airflow database to be ready..."
  sleep 2
done

# Initialize the database (only runs if not already initialized)
airflow db migrate

# Create default admin user if it doesn't exist
airflow users create \
    --username ${AIRFLOW_ADMIN_USER:-admin} \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email ${AIRFLOW_ADMIN_EMAIL:-admin@example.com} \
    --password ${AIRFLOW_ADMIN_PASSWORD:-admin} 2>/dev/null || true

# Create HTTP connection for scheduled DAGs to call backend API
airflow connections delete etl_portal_api 2>/dev/null || true
airflow connections create etl_portal_api \
    --conn-type http \
    --conn-host backend \
    --conn-port 8000 2>/dev/null || true

# Unpause the main etl_job_executor DAG so it can process jobs
# Note: This command will fail if the DAG doesn't exist yet, which is fine
airflow dags unpause etl_job_executor 2>/dev/null || true

# Execute the command passed to docker run (without quotes to allow word splitting)
exec $@
