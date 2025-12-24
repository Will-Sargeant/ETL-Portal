# ETL Portal

A modern, self-hosted ETL (Extract, Transform, Load) platform for automating data pipelines. Built with FastAPI, React, and Apache Airflow.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

ETL Portal is a web-based platform that enables users to:

- **Upload CSV files** and preview data with automatic type inference
- **Configure data transformations** with visual column mapping
- **Connect to databases** (PostgreSQL, Amazon Redshift) with encrypted credential storage
- **Execute ETL jobs** on-demand or on a schedule via Apache Airflow
- **Monitor job progress** with real-time status updates
- **Track execution history** with detailed logs and metrics

### Key Features

- 🔐 **Secure Credential Management** - AES-256 encrypted database credentials
- 🔄 **Multiple Load Strategies** - INSERT, UPSERT, TRUNCATE_INSERT
- 📊 **Data Preview** - View and analyze CSV data before processing
- 🎯 **Column Mapping** - Visual interface for mapping source to destination columns
- 🔧 **Data Transformations** - Built-in functions (UPPER, LOWER, TRIM) and calculated columns
- ⏰ **Job Scheduling** - Cron-based scheduling with automatic Airflow DAG generation
- 📈 **Real-time Progress Tracking** - Server-Sent Events (SSE) for live job monitoring
- 📜 **Job Run History** - Complete execution history with logs and metrics
- 🔍 **Type Inference** - Automatic detection of data types from CSV files
- 🎛️ **Schedule Management** - Create, update, enable/disable job schedules with preset cron expressions

---

## Architecture

ETL Portal follows a **microservices architecture** with containerized components orchestrated via Docker Compose.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    Frontend     │
                    │  (React + Vite) │
                    │   Port: 3000    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  FastAPI        │
                    │  Backend        │
                    │  Port: 8000     │
                    └─────┬───┬───┬───┘
                          │   │   │
        ┌─────────────────┘   │   └─────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│   PostgreSQL   │   │  Apache Airflow │   │     Redis      │
│  App Database  │   │  (Orchestrator) │   │    (Cache)     │
│  Port: 5432    │   │                 │   │  Port: 6379    │
└────────────────┘   └────────┬────────┘   └────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼────────┐  ┌───────▼────────┐
            │ Airflow Worker │  │  Airflow DB    │
            │  (Executes     │  │  (Metadata)    │
            │   ETL Jobs)    │  │                │
            └────────┬───────┘  └────────────────┘
                     │
            ┌────────▼────────┐
            │  Destination    │
            │   Database      │
            │ (PostgreSQL/    │
            │   Redshift)     │
            └─────────────────┘
```

### Design Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Scalability** - Airflow Celery executor allows horizontal scaling of workers
3. **Data Isolation** - Separate databases for application data and Airflow metadata
4. **Stateless Services** - Backend and frontend are stateless for easy scaling
5. **Shared Storage** - Common volume mount for CSV files across all containers

---

## Technology Stack

### Frontend

**Framework**: React 18 + TypeScript
- **Why**: Type safety, component reusability, strong ecosystem
- **Build Tool**: Vite - Fast development with HMR (Hot Module Replacement)
- **UI Library**: shadcn/ui + Tailwind CSS - Modern, accessible components
- **State Management**: TanStack Query (React Query) - Server state caching and synchronization
- **Routing**: React Router v6 - Client-side routing
- **Forms**: React Hook Form - Performant form validation
- **HTTP Client**: Axios - Promise-based HTTP with interceptors

### Backend

**Framework**: FastAPI (Python 3.11)
- **Why**: Async support, automatic OpenAPI docs, type hints, high performance
- **ORM**: SQLAlchemy 1.4 (async) - Database abstraction layer
  - *Note*: Using 1.4 for Airflow compatibility (Airflow 2.10.4 requires <2.0)
- **Database Driver**: asyncpg - Fast async PostgreSQL driver
- **Validation**: Pydantic v2 - Data validation with type hints
- **Authentication**: (Planned) SAML2/Okta integration
- **Logging**: structlog - Structured, JSON-formatted logs
- **Security**: cryptography - AES-256 credential encryption

### Orchestration

**Framework**: Apache Airflow 2.10.4
- **Why**: Industry standard for workflow orchestration, robust scheduling, excellent monitoring
- **Executor**: CeleryExecutor - Distributed task execution across multiple workers
- **Message Broker**: Redis - Task queue for Celery
- **Metadata DB**: PostgreSQL - Separate from app database for isolation

### Data Processing

**Library**: pandas 2.1.4
- **Why**: Powerful data manipulation, wide format support, efficient type inference
- **Data Types**: NumPy 1.26.2 - Numerical computing foundation
- **Expression Evaluation**: simpleeval 0.9.13 - Safe Python expression execution for calculated columns
- **Encoding Detection**: chardet 5.2.0 - Automatic character encoding detection for CSV files

### Databases

**Application DB**: PostgreSQL 15
- **Why**: ACID compliance, JSON support, mature and reliable, excellent performance

**Destination DBs**: PostgreSQL, Amazon Redshift
- **PostgreSQL**: asyncpg driver for high-performance async operations
- **Redshift**: redshift-connector (PostgreSQL-compatible wire protocol)

### Infrastructure

**Containerization**: Docker + Docker Compose
- **Why**: Consistent environments, easy deployment, service isolation
- **Images**: Alpine-based for minimal size where possible
- **Volumes**: Persistent storage for databases and file uploads

---

## Core Components

### 1. Frontend (React Application)

**Location**: `frontend/`

**Purpose**: Web-based UI for ETL job configuration and monitoring

**Key Components**:
- **CSV Upload** (`CSVUpload.tsx`) - Drag-and-drop file upload with client-side validation
- **Data Preview** (`DataPreview.tsx`) - Tabular display with pagination and type inference
- **Job Configuration Wizard** (`JobConfigurationWizard.tsx`) - Multi-step guided setup
- **Column Mapping** - Visual interface for source-to-destination column mapping
- **Destination Config** - Database credential selection and table configuration
- **Job Dashboard** - Real-time job status and execution history

**State Management**:
- TanStack Query for server state (caching, background refetching, optimistic updates)
- React useState/useContext for local UI state
- React Router for navigation and route state

**API Integration**:
- Centralized Axios client with base URL configuration
- Type-safe API modules in `lib/api/`
- Automatic error handling with toast notifications (sonner)

---

### 2. Backend (FastAPI Application)

**Location**: `backend/`

**Purpose**: RESTful API server for business logic, data persistence, and Airflow orchestration

#### Key API Endpoints

**Sources** (`/api/v1/sources`):
- `POST /csv/upload` - Upload CSV, analyze structure, generate preview
- `GET /csv/{file_id}/preview` - Retrieve paginated data preview
- `GET /csv/{file_id}/metadata` - Get file metadata
- `DELETE /csv/{file_id}` - Delete uploaded file

**Credentials** (`/api/v1/credentials`):
- `POST /` - Create encrypted database credential
- `GET /`, `GET /{id}` - List/get credentials
- `PUT /{id}`, `DELETE /{id}` - Update/delete credentials
- `POST /{id}/test` - Test database connectivity

**Destinations** (`/api/v1/destinations`):
- `POST /{credential_id}/schemas` - List database schemas
- `POST /{credential_id}/tables` - List tables in schema
- `POST /{credential_id}/schema` - Introspect table structure

**ETL Jobs** (`/api/v1/jobs`):
- `POST /` - Create job with column mappings (auto-generates DDL if needed)
- `GET /`, `GET /{id}` - List/get jobs
- `PUT /{id}`, `DELETE /{id}` - Update/delete jobs
- `POST /execute/{id}` - Trigger immediate execution via Airflow

#### Data Models

**ETLJob**: Job configuration (source, destination, load strategy, batch size)
**ColumnMapping**: Column transformations and type mappings
**Credential**: Encrypted database credentials (AES-256-GCM)
**JobRun**: Execution tracking (status, progress, errors, timestamps)
**Schedule**: (Planned) Cron-based job schedules

#### Services Layer

**CSV Service** (`csv_service.py`):
- File upload with encoding detection
- Type inference (text, number, date, boolean)
- Data preview generation
- Column statistics

**Transformation Service** (`transformation_service.py`):
- String transformations (UPPER, LOWER, TRIM, etc.)
- Type conversions (TEXT, NUMERIC, TIMESTAMP, BOOLEAN)
- Safe expression evaluation for calculated columns

**ETL Service** (`etl_service.py`):
- **Main orchestrator** for job execution
- Read CSV → Transform → Write in batches
- Progress tracking with database updates
- Error handling with transaction rollback

**Airflow Client** (`airflow_client.py`):
- Trigger DAG runs via Airflow REST API
- Monitor DAG execution status
- HTTP basic auth to Airflow webserver

#### Security

- **AES-256-GCM encryption** for database credentials at rest
- **Parameterized queries** to prevent SQL injection
- **Input validation** via Pydantic schemas
- **CORS configuration** for frontend access
- **Environment-based secrets** (encryption keys, passwords)

---

### 3. Apache Airflow (Workflow Orchestration)

**Location**: `airflow/`

**Purpose**: Schedule and execute ETL jobs as distributed workflows

#### Architecture Components

**Airflow Webserver**:
- Web UI for DAG monitoring (http://localhost:8080)
- REST API for programmatic access
- Basic auth (airflow/airflow)

**Airflow Scheduler**:
- Monitors DAGs and triggers tasks
- Manages task dependencies and retries
- Handles failure recovery

**Airflow Worker** (Celery):
- Executes Python tasks in isolated processes
- Scalable: Multiple workers can run in parallel
- Has read-only access to backend code (`./backend:/app:ro`)
- Has read-write access to uploads (`./uploads:/app/uploads:rw`)

**Redis** (Celery Broker):
- Task queue for distributing work to workers
- Stores task results and state

**Airflow Metadata DB**:
- Separate PostgreSQL database
- Stores DAG runs, task instances, execution logs

#### DAG Implementation

**ETL Job Executor** (`dags/etl_job_executor.py`):

```python
# Static DAG that handles ALL job executions
dag = DAG(
    'etl_job_executor',
    schedule_interval=None,  # Triggered via API, not scheduled
    max_active_runs=10,      # Allow 10 concurrent executions
)

execute_task = PythonOperator(
    task_id='execute_etl_job',
    python_callable=execute_etl_job,  # Imports ETLService from /app
)
```

**Execution Flow**:
1. Backend creates `JobRun` record (status=PENDING)
2. Backend triggers DAG via Airflow REST API with `{job_id, job_run_id}`
3. Scheduler queues task on Redis
4. Worker picks up task and executes Python callable
5. Worker calls `ETLService.execute_job(job_id, job_run_id)`
6. ETL service reads CSV, transforms data, writes to destination
7. Progress updates written to `JobRun` table throughout execution
8. Final status (COMPLETED/FAILED) persisted on completion

**Why This Architecture**:
- **Single static DAG** - Simpler than dynamic DAG generation per job
- **Configuration via database** - Job behavior controlled by `ETLJob` and `ColumnMapping` records
- **Direct Python execution** - No HTTP overhead, direct database access
- **Shared codebase** - Workers use same ETL logic as backend via volume mount

---

### 4. PostgreSQL Databases

#### Application Database

**Container**: `postgres`
**Port**: 5432
**Purpose**: Store application data

**Tables**:
- `etl_jobs` - Job configurations
- `column_mappings` - Column transformation rules
- `credentials` - Encrypted database credentials
- `job_runs` - Execution history and metrics
- `schedules` - (Planned) Cron schedules

**Volume**: `postgres_data` - Persistent storage

#### Airflow Metadata Database

**Container**: `airflow-db`
**Port**: Not exposed
**Purpose**: Airflow operational data

**Schema**: Managed by Airflow migrations
- DAG definitions, task instances, logs, connections

**Volume**: `airflow_postgres_data` - Persistent storage

**Why Separate Databases**:
1. **Isolation** - Airflow schema changes don't affect app data
2. **Performance** - Avoid contention between transactional (app) and analytical (Airflow logs) workloads
3. **Backup strategy** - Different RPO/RTO requirements
4. **Versioning** - Independent migration lifecycles

---

### 5. File Storage

**Location**: `./uploads` (host directory)

**Mount Configuration**:
```yaml
# All containers share the same host directory
backend:
  volumes:
    - ./uploads:/app/uploads:rw

airflow-worker:
  volumes:
    - ./uploads:/app/uploads:rw
```

**Purpose**: Shared storage for uploaded CSV files

**Lifecycle**:
1. User uploads CSV via frontend
2. Backend saves to `./uploads/{uuid}.csv`
3. Backend analyzes file and returns metadata
4. User creates job referencing `file_id`
5. Airflow worker reads CSV from shared volume during execution

**Critical Fix Applied** (2025-12-23):
- Initially, backend used Docker named volume (`upload_data`)
- Airflow used host directory bind mount (`./uploads`)
- **Result**: Files uploaded to backend were invisible to Airflow
- **Solution**: Changed both to use same host directory bind mount
- **Migration**: Copied files from old volume to host directory

---

## Data Flow

### Job Creation Flow

```
User → Frontend → Backend API
                      ↓
              CSV Service (parse)
                      ↓
              Type Inference
                      ↓
              DDL Generator (if creating new table)
                      ↓
              Save ETLJob + ColumnMappings
```

### Job Execution Flow

```
User/API → Backend → Airflow API → Scheduler → Redis Queue
                                                     ↓
                                                  Worker
                                                     ↓
                                               ETL Service
                                                     ↓
                            ┌────────────────────────┴───────────────┐
                            ↓                                        ↓
                     Read CSV (pandas)                      Update JobRun
                            ↓                                  (progress)
                    Apply Transformations
                   (mappings, types, expressions)
                            ↓
                    Write to Destination
                    (asyncpg - batches)
                            ↓
                    Update JobRun (final status)
```

### Transformation Pipeline

```
CSV → pandas DataFrame → Filter Columns → Rename → Transform
                                                        ↓
                                                 Type Conversion
                                                        ↓
                                              Calculated Columns
                                                        ↓
                                                  Fill Defaults
                                                        ↓
                                              Batch Write (asyncpg)
                                                        ↓
                                        Load Strategy (INSERT/UPSERT/TRUNCATE)
                                                        ↓
                                              Destination Database
```

**Load Strategies**:
- **INSERT**: Simple batch insert (fails on duplicates)
- **UPSERT**: `INSERT ... ON CONFLICT DO UPDATE` (requires upsert_keys)
- **TRUNCATE_INSERT**: Clear table, then batch insert (replaces all data)

---

## Getting Started

### Prerequisites

- Docker 20.x+
- Docker Compose 2.x+
- 4GB+ RAM for containers
- 10GB+ disk space

### Quick Start

1. **Clone repository**:
   ```bash
   cd "ETL Portal"
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Generate encryption key**:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   Add to `.env`:
   ```
   ENCRYPTION_KEY=<generated-key>
   ```

4. **Start services**:
   ```bash
   docker-compose up -d
   ```

5. **Run migrations**:
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

6. **Access application**:
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs
   - Airflow UI: http://localhost:8080 (airflow/airflow)

### Create Your First ETL Job

1. Go to http://localhost:3000
2. Upload a CSV file
3. Review data preview and column types
4. Click "Configure Job"
5. Create/select a database credential
6. Configure table name and load strategy
7. Map columns (source → destination)
8. Add transformations if needed
9. Click "Create & Execute"
10. Monitor progress in real-time

### New Features Guide

#### Real-time Job Monitoring

Track job execution progress in real-time using Server-Sent Events (SSE):

**Backend API**:
```bash
GET /api/v1/job-runs/{job_run_id}/stream
```

**Frontend Usage**:
```typescript
import { JobRunProgress } from '@/features/etl-jobs/JobRunProgress'

<JobRunProgress
  jobRunId={123}
  jobName="My ETL Job"
  onComplete={() => console.log('Job finished!')}
/>
```

**Features**:
- Live progress bar with percentage
- Row processing counter
- Real-time status updates
- Auto-reconnection on disconnect
- Toast notifications on completion/failure

#### Job Run History

View complete execution history for all jobs:

**API Endpoints**:
```bash
# List all job runs
GET /api/v1/job-runs/

# Filter by job
GET /api/v1/job-runs/?job_id=123

# Filter by status
GET /api/v1/job-runs/?status=completed

# Get specific run
GET /api/v1/job-runs/{job_run_id}

# Get execution logs
GET /api/v1/job-runs/{job_run_id}/logs

# Delete job run
DELETE /api/v1/job-runs/{job_run_id}
```

**Frontend Component**:
```typescript
import { JobRunHistory } from '@/features/etl-jobs/JobRunHistory'

<JobRunHistory jobId={123} showJobName={false} />
```

**Features**:
- Filterable table (by job, status)
- Auto-refresh for active runs (every 3 seconds)
- Duration calculations
- Logs viewer with copy functionality
- Status badges with color coding
- Delete job runs

#### Schedule Management

Create and manage scheduled job executions with automatic Airflow DAG generation:

**API Endpoints**:
```bash
# Create schedule for a job
POST /api/v1/schedules/?job_id=123
{
  "cron_expression": "0 0 * * *",
  "enabled": true
}

# List all schedules
GET /api/v1/schedules/

# Update schedule
PUT /api/v1/schedules/{schedule_id}
{
  "cron_expression": "0 */6 * * *"
}

# Enable/disable schedule
POST /api/v1/schedules/{schedule_id}/enable
POST /api/v1/schedules/{schedule_id}/disable

# Delete schedule
DELETE /api/v1/schedules/{schedule_id}
```

**Frontend Component**:
```typescript
import { ScheduleManager } from '@/features/etl-jobs/ScheduleManager'

<ScheduleManager jobId={123} showJobName={false} />
```

**Cron Expression Presets**:
- Every minute: `* * * * *`
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`
- Every day at midnight: `0 0 * * *`
- Every Monday at 9 AM: `0 9 * * 1`
- Custom expressions supported

**Features**:
- Automatic Airflow DAG file generation
- DAG pause/unpause on schedule enable/disable
- DAG deletion when schedule is removed
- Visual cron builder with presets
- Last run and next run timestamps
- Enable/disable toggle

**How Scheduling Works**:

1. **Create Schedule** → Backend generates Python DAG file in `/opt/airflow/dags/`
2. **Airflow Detects DAG** → Scheduler picks up new DAG file automatically
3. **DAG Triggers** → At scheduled time, DAG calls `/api/v1/jobs/execute/{job_id}`
4. **Job Executes** → Backend creates JobRun and triggers Airflow worker
5. **Progress Updates** → JobRun updates streamed via SSE to frontend

**Generated DAG Example**:
```python
# /opt/airflow/dags/etl_job_123_scheduled.py
from airflow import DAG
from airflow.providers.http.operators.http import SimpleHttpOperator

dag = DAG(
    dag_id='etl_job_123_scheduled',
    schedule_interval='0 0 * * *',
    catchup=False,
    tags=['etl-portal', 'scheduled', 'job-123']
)

execute_job = SimpleHttpOperator(
    task_id='execute_etl_job_123',
    http_conn_id='etl_portal_api',
    endpoint='/api/v1/jobs/execute/123',
    method='POST',
    dag=dag
)
```

---

## Configuration

### Environment Variables

**Backend** (`.env`):
```bash
DATABASE_URL=postgresql+asyncpg://etl_user:etl_password@postgres:5432/etl_portal
ENCRYPTION_KEY=<your-fernet-key>
SECRET_KEY=<your-secret>
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=1000000000  # 1GB
AIRFLOW_API_URL=http://airflow-webserver:8080/api/v1
AIRFLOW_USERNAME=airflow
AIRFLOW_PASSWORD=airflow
REDIS_URL=redis://redis:6379/1
```

**Airflow** (docker-compose.yml):
```yaml
environment:
  - AIRFLOW__CORE__EXECUTOR=CeleryExecutor
  - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@airflow-db/airflow
  - AIRFLOW__CELERY__BROKER_URL=redis://redis:6379/0
  - PYTHONPATH=/app  # Access to backend code
```

### Critical Volume Mounts

**Backend**:
```yaml
volumes:
  - ./backend:/app              # Hot reload in development
  - ./uploads:/app/uploads:rw   # Shared CSV storage
```

**Airflow Worker**:
```yaml
volumes:
  - ./backend:/app:ro           # Read-only backend code
  - ./uploads:/app/uploads:rw   # Shared CSV storage
```

**Why This Matters**:
- Backend and Airflow MUST share the same upload directory
- Without shared storage, Airflow cannot access uploaded CSV files
- Workers need backend code to import and execute `ETLService`

---

## Development

### Backend Development

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run locally (with Docker PostgreSQL)
DATABASE_URL=postgresql+asyncpg://etl_user:etl_password@localhost:5432/etl_portal \
uvicorn app.main:app --reload --port 8000

# Create migration
alembic revision --autogenerate -m "add new field"

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Airflow Development

```bash
# List DAGs
docker-compose exec airflow-worker airflow dags list

# Trigger DAG manually
docker-compose exec airflow-worker airflow dags trigger etl_job_executor \
  --conf '{"job_id": 1, "job_run_id": 1}'

# View task logs
docker-compose exec airflow-worker airflow tasks logs \
  etl_job_executor execute_etl_job <dag-run-id>

# Test Python callable directly
docker-compose exec airflow-worker python -c "
from app.services.etl_service import ETLService
# Test code here
"
```

### Debugging Tips

**Backend errors**:
```bash
docker-compose logs -f backend
```

**Airflow task failures**:
1. Check Airflow UI: http://localhost:8080
2. View task logs in UI or via CLI
3. Check worker logs: `docker-compose logs -f airflow-worker`

**Database issues**:
```bash
# Connect to database
docker-compose exec postgres psql -U etl_user -d etl_portal

# View recent job runs
SELECT id, job_id, status, progress_percentage, error_message
FROM job_runs
ORDER BY started_at DESC
LIMIT 10;
```

---

## Troubleshooting

### CSV File Not Found During Execution

**Symptom**: `CSV file not found: <file_id>` error in Airflow logs

**Cause**: Backend and Airflow using different storage locations

**Solution**:
1. Verify `docker-compose.yml` volume mounts:
   ```yaml
   backend:
     volumes:
       - ./uploads:/app/uploads:rw

   airflow-worker:
     volumes:
       - ./uploads:/app/uploads:rw
   ```

2. Check files exist on host:
   ```bash
   ls -lah uploads/
   ```

3. Verify files visible in containers:
   ```bash
   docker exec etl_portal_backend ls -lah /app/uploads/
   docker exec etl_portal_airflow_worker ls -lah /app/uploads/
   ```

### Table Does Not Exist Error

**Symptom**: `relation "schema.table" does not exist`

**Causes**:
1. `create_new_table=true` but `new_table_ddl=NULL`
2. DDL generation failed during job creation

**Solution**:
- DDL now auto-generated (fix applied 2025-12-23)
- For old jobs, manually set DDL:
  ```sql
  UPDATE etl_jobs
  SET new_table_ddl = 'CREATE TABLE ...'
  WHERE id = <job_id>;
  ```

### Airflow DAG Not Triggering

**Symptoms**: Job stays in PENDING status

**Debugging**:
1. Check Airflow webserver: http://localhost:8080
2. Verify DAG exists and is not paused
3. Check scheduler logs: `docker-compose logs airflow-scheduler`
4. Verify API credentials in backend `.env`
5. Check Celery workers: Airflow UI → Admin → Workers

**Common fixes**:
```bash
# Restart Airflow services
docker-compose restart airflow-scheduler airflow-worker

# Unpause DAG via CLI
docker-compose exec airflow-worker airflow dags unpause etl_job_executor
```

### Database Connection Failed

**Symptoms**: Credential test fails, job execution fails connecting to destination

**Debugging**:
1. Test connection via UI "Test Connection" button
2. Verify encryption key matches in backend and worker
3. Check network connectivity from worker to destination
4. Review firewall rules

**Common issues**:
- Using `localhost` in connection string (use host IP or Docker service name)
- Wrong port number
- Database not allowing connections from Docker network
- Incorrect credentials

### Job Stuck in RUNNING Status

**Symptoms**: Progress at 0%, no updates

**Debugging**:
1. Check worker logs: `docker-compose logs -f airflow-worker`
2. Check database for recent updates:
   ```sql
   SELECT * FROM job_runs WHERE id = <job_run_id>;
   ```
3. Check if worker crashed:
   ```bash
   docker-compose ps airflow-worker
   ```

**Solutions**:
- Restart worker: `docker-compose restart airflow-worker`
- Check for Python exceptions in worker logs
- Verify CSV file exists and is readable

### SQLAlchemy Compatibility Errors

**Symptom**: `cannot import name 'async_sessionmaker'`

**Cause**: Mixing SQLAlchemy 2.0 syntax with Airflow's 1.4 dependency

**Solution**: Already fixed (2025-12-23)
- Backend uses `sessionmaker` (1.4-compatible)
- Airflow Dockerfile pins SQLAlchemy <2.0

---

## Project Status

### Completed (Phase 4)

✅ CSV upload and parsing
✅ Database connectivity (PostgreSQL, Redshift)
✅ Credential encryption and management
✅ Column mapping and transformations
✅ Job execution via Airflow
✅ Progress tracking
✅ All load strategies (INSERT, UPSERT, TRUNCATE_INSERT)
✅ DDL auto-generation
✅ Batch processing
✅ Error handling and logging

### In Progress

🔄 Real-time progress monitoring (SSE)
🔄 Job run history UI
🔄 Schedule management

### Planned (See plan file)

📋 **Phase 9**: Google Sheets integration (OAuth, Sheets API)
📋 **Phase 7**: Job scheduling (cron, dynamic DAG generation)
📋 **Phase 6**: Job monitoring dashboard
📋 **Phase 8**: Authentication (SAML2/Okta, RBAC)

---

## Architecture Decisions

### Why Apache Airflow?

**Alternatives**: Prefect, Dagster, Celery alone

**Chosen for**:
- ✅ Industry standard with proven scalability
- ✅ Rich ecosystem and community
- ✅ Built-in scheduling, retries, monitoring
- ✅ Python-based (same language as backend)
- ✅ CeleryExecutor for horizontal scaling

### Why FastAPI?

**Alternatives**: Django, Flask

**Chosen for**:
- ✅ Native async/await support
- ✅ Automatic OpenAPI documentation
- ✅ Pydantic validation
- ✅ High performance
- ✅ Modern Python features

### Why Single Static DAG?

**Alternative**: Generate DAG file per job

**Chosen for**:
- ✅ Simpler architecture
- ✅ No DAG file management overhead
- ✅ Configuration stored in database
- ✅ Easier to maintain
- ✅ Airflow scheduler doesn't need to parse new files

**Trade-off**:
- ❌ All jobs share same DAG-level settings (retries, timeout)
- ✅ Can be overridden at task level if needed

### Why Shared Volume for CSVs?

**Alternative**: S3/MinIO object storage

**Chosen for MVP**:
- ✅ Simple setup
- ✅ Fast local file access
- ✅ Easy debugging (files visible on host)

**Production recommendation**:
- Migrate to S3 for durability and scalability

---

## License

MIT

## Contributing

Contributions welcome! This project is actively developed.

## Support

For issues: Create GitHub issue
For questions: Check documentation or Troubleshooting section

---

**Built for data engineers who value simplicity and reliability**
