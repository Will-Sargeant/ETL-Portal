#!/bin/bash

echo "=== ETL Portal Setup Script ==="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✓ .env file already exists"
else
    echo "Creating .env file from template..."
    cp .env.example .env

    echo "Generating security keys..."

    # Generate ENCRYPTION_KEY
    ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    sed -i.bak "s|ENCRYPTION_KEY=|ENCRYPTION_KEY=${ENCRYPTION_KEY}|" .env

    # Generate AIRFLOW_FERNET_KEY
    AIRFLOW_FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    sed -i.bak "s|AIRFLOW_FERNET_KEY=|AIRFLOW_FERNET_KEY=${AIRFLOW_FERNET_KEY}|" .env

    # Generate SECRET_KEY
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i.bak "s|SECRET_KEY=your-secret-key-change-in-production|SECRET_KEY=${SECRET_KEY}|" .env

    rm .env.bak

    echo "✓ .env file created with generated keys"
fi

echo ""
echo "=== Starting Docker services ==="
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "=== Running database migrations ==="
docker-compose exec -T backend alembic upgrade head

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Services are now running:"
echo "  - Frontend:  http://localhost:3000"
echo "  - Backend:   http://localhost:8000"
echo "  - API Docs:  http://localhost:8000/api/docs"
echo "  - Airflow:   http://localhost:8080 (admin/admin)"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
