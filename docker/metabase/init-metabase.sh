#!/bin/bash
set -e

echo "Waiting for Metabase to be ready..."

# Wait for Metabase to be fully started (check the /api/health endpoint)
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://metabase:3000/api/health > /dev/null 2>&1; then
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

# Try to login first to see if admin user already exists
echo "Checking if Metabase is already configured..."
SESSION=$(curl -s -X POST http://metabase:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@metabase.local","password":"metabase123"}' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SESSION" ]; then
    echo "Admin user already exists, checking for Test Database connection..."

    # Check if Test Database already exists
    DB_EXISTS=$(curl -s http://metabase:3000/api/database \
      -H "X-Metabase-Session: $SESSION" | grep -c '"name":"Test Database"' || echo "0")

    if [ "$DB_EXISTS" -gt 0 ]; then
        echo "✓ Metabase is already fully configured"
        echo "  - Admin email: admin@metabase.local"
        echo "  - Test Database connection already exists"
        exit 0
    fi

    echo "Adding Test Database connection..."
else
    # No existing user, need to run setup first
    echo "No admin user found. Creating admin user..."

    # Get setup token
    SETUP_TOKEN=$(curl -s http://metabase:3000/api/session/properties | grep -o '"setup-token":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$SETUP_TOKEN" ] || [ "$SETUP_TOKEN" = "null" ]; then
        echo "✗ No setup token available. Manual setup required at http://localhost:3002"
        exit 0
    fi

    # Setup Metabase with initial admin user
    RESPONSE=$(curl -s -w "%{http_code}" -X POST http://metabase:3000/api/setup \
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
        "prefs": {
          "site_name": "ETL Portal Analytics",
          "allow_tracking": false
        }
      }')

    HTTP_CODE="${RESPONSE: -3}"

    if [ "$HTTP_CODE" != "200" ]; then
        echo "✗ Failed to create admin user (HTTP $HTTP_CODE)"
        echo "Please set up manually at http://localhost:3002"
        exit 1
    fi

    echo "✓ Admin user created successfully"
    echo "Logging in to add Test Database connection..."

    # Login to get session token
    SESSION=$(curl -s -X POST http://metabase:3000/api/session \
      -H "Content-Type: application/json" \
      -d '{"username":"admin@metabase.local","password":"metabase123"}' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$SESSION" ]; then
        echo "✗ Failed to login to Metabase after user creation"
        exit 1
    fi
fi

# At this point, we have a SESSION token (either from existing login or new setup)

# Wait a bit for Sample Database to be created (if it's going to be)
echo "Checking for Sample Database..."
sleep 5

# Remove the Sample Database if it exists
# Look for Sample Database and extract its ID (usually ID 1)
SAMPLE_DB_ID=$(curl -s http://metabase:3000/api/database \
  -H "X-Metabase-Session: $SESSION" | grep -o '"id":[0-9]*[^}]*"name":"Sample Database"' | grep -o '"id":[0-9]*' | grep -o '[0-9]*' || echo "")

if [ -n "$SAMPLE_DB_ID" ]; then
    echo "Removing Sample Database (H2)..."
    curl -s -X DELETE "http://metabase:3000/api/database/$SAMPLE_DB_ID" \
      -H "X-Metabase-Session: $SESSION" > /dev/null
    echo "✓ Removed Sample Database"
else
    echo "✓ No Sample Database found (already disabled)"
fi

# Now add the Test Database connection
echo "Adding Test Database connection to Metabase..."

DB_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://metabase:3000/api/database \
  -H "Content-Type: application/json" \
  -H "X-Metabase-Session: $SESSION" \
  -d '{
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
  }')

DB_HTTP_CODE="${DB_RESPONSE: -3}"

if [ "$DB_HTTP_CODE" = "200" ]; then
    echo ""
    echo "✓ Metabase configured successfully!"
    echo "  - Admin email: admin@metabase.local"
    echo "  - Admin password: metabase123"
    echo "  - Test Database connection added automatically"
    echo ""
    echo "Access Metabase at: http://localhost:3002"
else
    echo "✗ Failed to add Test Database connection (HTTP $DB_HTTP_CODE)"
    echo "Response: ${DB_RESPONSE:0:-3}"
    echo "You can add it manually at http://localhost:3002"
    exit 1
fi
