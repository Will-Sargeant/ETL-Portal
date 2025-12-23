# ETL Portal

A multi-user web-based ETL portal for extracting data from CSV files and Google Sheets, transforming it, and loading into PostgreSQL or Amazon Redshift databases.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Python 3.11 + FastAPI
- **Database**: PostgreSQL (application data)
- **Job Scheduler**: Apache Airflow
- **Caching**: Redis
- **Deployment**: Docker Compose

## Features

- CSV file upload and processing (up to 1M rows)
- PostgreSQL and Amazon Redshift connectivity
- Visual schema mapping and transformation rules
- Data quality validations
- Batch processing with progress tracking
- Scheduled ETL jobs via Airflow
- Real-time job monitoring with SSE
- Encrypted credential storage

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local development)
- Node.js 20+ (for local development)

## Quick Start

### 1. Clone and Setup

```bash
cd "ETL Portal"
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Generate encryption keys
python -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())" >> .env
python -c "from cryptography.fernet import Fernet; print('AIRFLOW_FERNET_KEY=' + Fernet.generate_key().decode())" >> .env
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))" >> .env
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs
- **Airflow UI**: http://localhost:8080 (username: admin, password: admin)

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec backend alembic upgrade head
```

## Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## Project Structure

```
ETL Portal/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Configuration, database, security
│   │   ├── crud/        # Database operations
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utilities
│   ├── alembic/         # Database migrations
│   └── requirements.txt
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── features/    # Feature modules
│   │   ├── hooks/       # Custom hooks
│   │   ├── lib/         # API client, utilities
│   │   ├── pages/       # Page components
│   │   └── types/       # TypeScript types
│   └── package.json
├── airflow/             # Airflow DAGs and config
│   ├── dags/           # Generated DAG files
│   ├── logs/           # Airflow logs
│   └── plugins/        # Custom plugins
├── docker/              # Docker configurations
└── docker-compose.yml
```

## Database Schema

- **etl_jobs**: Job configurations
- **column_mappings**: Column mapping rules
- **job_runs**: Execution history
- **credentials**: Encrypted database credentials
- **schedules**: Job scheduling configuration

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Project structure
- [x] Docker setup
- [x] Database models
- [x] FastAPI backend foundation
- [x] React frontend foundation

### Phase 2: CSV Upload (In Progress)
- [ ] File upload endpoint
- [ ] CSV parsing and validation
- [ ] Data preview API
- [ ] Upload UI component

### Phase 3: Database Connectivity
- [ ] PostgreSQL connector
- [ ] Redshift connector
- [ ] Connection testing
- [ ] Credential management

### Phase 4: ETL Engine
- [ ] Schema mapping
- [ ] Transformation engine
- [ ] Data loading with batching
- [ ] Progress tracking

### Phase 5: Job Management
- [ ] Job CRUD operations
- [ ] Job execution engine
- [ ] Real-time monitoring with SSE

### Phase 6: Frontend - Wizard
- [ ] Multi-step wizard
- [ ] CSV upload UI
- [ ] Schema mapping UI
- [ ] Transformation rules UI

### Phase 7: Airflow Integration
- [ ] Dynamic DAG generation
- [ ] Scheduling UI
- [ ] Schedule management

### Phase 8: Google Sheets
- [ ] Google OAuth
- [ ] Sheets API integration
- [ ] Sheet selection UI

### Phase 9: Authentication
- [ ] Google OAuth
- [ ] Okta integration
- [ ] JWT authentication
- [ ] User management

## Contributing

This is a work in progress. Check the Development Roadmap above for current status.

## License

MIT
