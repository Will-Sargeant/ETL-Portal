#!/bin/bash
set -e

echo "Waiting for Metabase to be ready..."

# Wait for Metabase to be fully started (check the /api/health endpoint)
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "Metabase is ready!"
        break
    fi
    echo "Waiting for Metabase to start... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Metabase did not start in time"
    exit 1
fi

# Wait a bit more for Metabase to be fully initialized
sleep 10

# Check if Metabase has been set up (has an admin user)
SETUP_TOKEN=$(curl -s http://localhost:3000/api/session/properties | grep -o '"setup-token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SETUP_TOKEN" ] || [ "$SETUP_TOKEN" = "null" ]; then
    echo "Metabase is already set up. Skipping auto-configuration."
    echo "To add test-db connection, log in to Metabase at http://localhost:3002"
    exit 0
fi

echo "Metabase not yet configured. Setting up with test database connection..."

# Setup Metabase with initial admin user and test-db connection
curl -s -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$SETUP_TOKEN'",
    "user": {
      "first_name": "Admin",
      "last_name": "User",
      "email": "admin@metabase.local",
      "password": "metabase123",
      "site_name": "ETL Portal Analytics"
    },
    "database": {
      "engine": "postgres",
      "name": "Test Database",
      "details": {
        "host": "test-db",
        "port": 5432,
        "dbname": "test_db",
        "user": "test_user",
        "password": "test_password",
        "ssl": false,
        "tunnel-enabled": false
      },
      "auto_run_queries": true,
      "is_full_sync": true,
      "schedules": {
        "metadata_sync": {
          "schedule_day": null,
          "schedule_frame": null,
          "schedule_hour": 0,
          "schedule_type": "hourly"
        },
        "cache_field_values": {
          "schedule_day": null,
          "schedule_frame": null,
          "schedule_hour": 0,
          "schedule_type": "hourly"
        }
      }
    },
    "prefs": {
      "site_name": "ETL Portal Analytics",
      "allow_tracking": false
    }
  }' > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Metabase configured successfully!"
    echo "  - Admin email: admin@metabase.local"
    echo "  - Admin password: metabase123"
    echo "  - Test Database connection added automatically"
    echo ""
    echo "Access Metabase at: http://localhost:3002"
else
    echo "✗ Failed to configure Metabase automatically"
    echo "Please set up manually at http://localhost:3002"
fi
