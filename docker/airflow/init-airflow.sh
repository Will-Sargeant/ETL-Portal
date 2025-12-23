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
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com \
    --password admin 2>/dev/null || true

# Execute the command passed to docker run (without quotes to allow word splitting)
exec $@
