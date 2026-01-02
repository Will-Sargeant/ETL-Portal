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

# Unpause critical DAGs so they can operate immediately
# Note: These commands will fail if the DAGs don't exist yet, which is fine
airflow dags unpause etl_job_executor 2>/dev/null || true
airflow dags unpause dag_health_monitor 2>/dev/null || true

echo "Critical DAGs have been unpaused (if they exist)"

# Execute the command passed to docker run (without quotes to allow word splitting)
exec $@
