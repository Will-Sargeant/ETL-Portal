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

- **Upload CSV files or connect to Google Sheets** and preview data with automatic type inference
- **Configure data transformations** with visual column mapping and nullable controls
- **Connect to databases** (PostgreSQL, Amazon Redshift) with encrypted credential storage
- **Execute ETL jobs** on-demand or on a schedule via Apache Airflow
- **Monitor job progress** with real-time status updates
- **Track execution history** with detailed logs and metrics

### Key Features

- 🔐 **Secure Credential Management** - AES-256 encrypted database credentials
- 🔐 **User Authentication** - Local login (email/password) and Google OAuth with JWT tokens
- 👥 **User Management** - Admin-only user creation, role assignment, and deactivation
- 🔑 **Role-Based Access Control** - Admin and user roles with ownership-based permissions
- 🔄 **Multiple Load Strategies** - INSERT, UPSERT, TRUNCATE_INSERT
- 📊 **Data Preview** - View and analyze CSV and Google Sheets data before processing
- 📑 **Google Sheets Integration** - Direct connection to Google Sheets with OAuth authentication
- 🎯 **Column Mapping** - Visual interface for mapping source to destination columns with nullable configuration
- 🔧 **Data Transformations** - Built-in functions for string, date, numeric, and null handling operations
- ⏰ **Job Scheduling** - Cron-based scheduling with automatic Airflow DAG generation
- 📈 **Real-time Progress Tracking** - Server-Sent Events (SSE) for live job monitoring
- 📜 **Job Run History** - Complete execution history with logs and metrics
- 🔍 **Type Inference** - Automatic detection of data types from CSV files and Google Sheets
- 🎛️ **Schedule Management** - Create, update, enable/disable job schedules with preset cron expressions
- 🌙 **Dark Mode** - System-aware theme with light/dark/auto modes and localStorage persistence
- 🔎 **Advanced Filtering** - Filter ETL jobs by status, source type, destination type, and destination table

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
                    └─────┬───┬───┬───┬──────┐
                          │   │   │   │      │
        ┌─────────────────┘   │   │   │      └──────────────┐
        │                     │   │   │                     │
┌───────▼────────┐   ┌────────▼───┴───▼────────┐   ┌───────▼────────┐
│   PostgreSQL   │   │  Apache Airflow          │   │     Redis      │
│ ETL Portal DB  │   │  (Orchestrator)          │   │    (Cache)     │
│  Port: 5432    │   │                          │   │  Port: 6379    │
└────────────────┘   └────────┬────────┬────────┘   └────────────────┘
                              │        │
                    ┌─────────┴────┐   │
                    │              │   │
            ┌───────▼────────┐ ┌──▼───▼──────┐
            │ Airflow Worker │ │  Airflow DB │
            │  (Executes     │ │  (Metadata) │
            │   ETL Jobs)    │ │             │
            └────────┬───────┘ └─────────────┘
                     │
            ┌────────▼────────────────────────────────────┐
            │  YOUR DESTINATION DATABASES                 │
            │  ─────────────────────────────────────────  │
            │  • Production PostgreSQL / Redshift         │
            │  • Data Warehouse / Data Lake               │
            │  • Business Intelligence databases          │
            │                                             │
            │  ⚠️  Development: Test Database provided    │
            │     (PostgreSQL, Port 5433, auto-seeded)   │
            └────────┬────────────────────────────────────┘
                     │
            ┌────────▼────────────────────────────────────┐
            │  YOUR VISUALIZATION / BI STACK              │
            │  ─────────────────────────────────────────  │
            │  • Tableau / Power BI / Looker              │
            │  • Custom dashboards                        │
            │  • Data analysis tools                      │
            │                                             │
            │  ⚠️  Development: Metabase provided         │
            │     (Port 3001)                             │
            └─────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Scalability** - Airflow Celery executor allows horizontal scaling of workers
3. **Data Isolation** - Separate databases for application data and Airflow metadata
4. **Stateless Services** - Backend and frontend are stateless for easy scaling
5. **Shared Storage** - Common volume mount for CSV files across all containers

---

## Authentication & Authorization

ETL Portal uses JWT-based authentication with support for both local credentials and Google OAuth.

### Authentication Methods

#### 1. Local Authentication (Email/Password)

**How it works:**
1. User submits email and password via login form
2. Backend verifies credentials using bcrypt password hashing
3. On success, backend issues JWT access token (30 min) and refresh token (30 days)
4. Frontend stores tokens in localStorage and includes access token in all API requests
5. When access token expires, frontend automatically uses refresh token to get new access token

**API Endpoints:**
- `POST /api/v1/auth/local/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token using refresh token
- `POST /api/v1/auth/logout` - Revoke refresh token

#### 2. Google OAuth

**How it works:**
1. User clicks "Sign in with Google" button
2. Frontend redirects to Google OAuth consent screen
3. User authorizes the application
4. Google redirects back with authorization code
5. Frontend sends code to backend at `/api/v1/auth/google/login`
6. Backend exchanges code for Google user info
7. Backend creates user account (first time) or looks up existing user
8. Backend issues JWT tokens same as local auth
9. Frontend stores tokens and redirects to app

**First-time Google users:**
- Automatically created with 'user' role
- No password required (Google OAuth only)
- Profile picture synced from Google account

**API Endpoints:**
- `POST /api/v1/auth/google/login` - Login with Google OAuth code

### User Roles

**Admin Role:**
- Full access to all resources regardless of owner
- Can create, view, edit, and delete any ETL jobs or credentials
- Can manage users (create, deactivate, change roles)
- Can assign job/credential ownership to any user
- Pre-seeded admin account: `admin@test.com` / `admin123`

**User Role:**
- Can only view and manage their own ETL jobs and credentials
- Cannot access other users' resources
- Cannot manage users
- Jobs and credentials automatically assigned to themselves
- Pre-seeded user account: `user@test.com` / `user123`

### Token System

**Access Token (JWT):**
- Expiration: 30 minutes
- Payload: `{ sub: user_id, role: "admin"|"user", exp: timestamp }`
- Sent in Authorization header: `Bearer <access_token>`
- Used for all API requests

**Refresh Token (JWT):**
- Expiration: 30 days
- Stored in database with revocation capability
- Used only to obtain new access tokens
- Automatically revoked on logout

**Token Refresh Flow:**
1. Frontend detects 401 error (expired access token)
2. Axios interceptor automatically calls `/api/v1/auth/refresh`
3. Backend validates refresh token and issues new access token
4. Frontend retries original request with new token
5. If refresh token is invalid/expired, user is logged out

### Protected Routes

All API endpoints (except auth endpoints) require valid JWT access token:
- Unauthenticated requests return 401 Unauthorized
- Non-admin users accessing admin-only endpoints return 403 Forbidden
- Users accessing other users' resources return 403 Forbidden

**Admin-Only Endpoints:**
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PATCH /api/v1/users/{id}/role` - Change user role
- `DELETE /api/v1/users/{id}` - Deactivate user

**Ownership Checks:**
- ETL jobs and credentials have `user_id` foreign key
- Non-admin users can only access records where `user_id` matches their ID
- Admins bypass ownership checks

### User Management (Admin Only)

Admins can manage users via the Users page (`/users`):

**Create User:**
- Set email, full name, password (min 8 characters), and role
- Email must be unique
- Users created with 'local' auth provider
- Automatically active on creation

**Change Role:**
- Admins can promote users to admin or demote admins to user
- Admins cannot demote themselves (safety check)
- Role changes take effect immediately

**Deactivate User (Soft Delete):**
- Sets `is_active = false` in database
- User cannot log in but data is preserved
- Admins cannot deactivate themselves (safety check)
- Deactivated users don't appear in assignment dropdowns

### Development Test Accounts

Two test accounts are automatically seeded during database migrations:

| Email | Password | Role | Use Case |
|-------|----------|------|----------|
| admin@test.com | admin123 | admin | Full admin access, user management, view all resources |
| user@test.com | user123 | user | Regular user access, own resources only |

**To use:**
1. Start the application
2. Go to login page (http://localhost:3000)
3. Enter credentials above
4. Access token stored in localStorage, valid for 30 minutes

**Security Note:** Change these passwords in production environments by updating the Alembic migration or creating new admin users.

### Security Features

- **Password Hashing:** bcrypt with random salt (cost factor 12)
- **Token Signing:** HS256 algorithm with SECRET_KEY from environment
- **Token Expiration:** Access tokens expire after 30 minutes
- **Token Revocation:** Refresh tokens can be revoked on logout
- **Input Validation:** Pydantic schemas validate all auth requests
- **CORS Configuration:** Restricts API access to configured origins
- **No Password Storage:** Google OAuth users have no password_hash

---

## Technology Stack

### Frontend

**Framework**: React 18 + TypeScript
- **Why**: Type safety, component reusability, strong ecosystem
- **Build Tool**: Vite - Fast development with HMR (Hot Module Replacement)
- **UI Library**: shadcn/ui + Tailwind CSS - Modern, accessible components with built-in dark mode
- **State Management**:
  - TanStack Query (React Query) - Server state caching and synchronization
  - Zustand - Lightweight state management for theme and UI state
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
- **Authentication**: JWT-based auth with local login and Google OAuth
- **Password Hashing**: bcrypt with random salt (cost factor 12)
- **Token Management**: jose (python-jose) for JWT encoding/decoding
- **OAuth**: google-auth-oauthlib for Google Sign-In
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
- String transformations (UPPER, LOWER, TRIM, CAPITALIZE, TITLE, etc.)
- Date/Time transformations (EXTRACT_YEAR, EXTRACT_MONTH, TODAY, NOW)
- Numeric transformations (ABS, FLOOR, CEILING)
- Null handling (FILL_NULL, FILL_ZERO)
- Type conversions handled automatically via column type mapping

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

#### ETL Portal Database (Application Database)

**Container**: `postgres` (etl_portal_app_db)
**Port**: 5432
**Purpose**: Store ETL Portal application metadata

**Tables**:
- `etl_jobs` - Job configurations
- `column_mappings` - Column transformation rules
- `credentials` - Encrypted database credentials
- `job_runs` - Execution history and metrics
- `schedules` - Cron schedules

**Volume**: `postgres_data` - Persistent storage

#### Test Database (ETL Destination)

**Container**: `test-db` (etl_portal_test_db)
**Port**: 5433
**Purpose**: Default destination for ETL job testing and development

**Features**:
- Auto-created on `docker-compose up`
- Credential auto-seeded via Alembic migration
- Pre-configured in UI as "Test Database"
- Useful for development and testing ETL pipelines

**Volume**: `test_db_data` - Persistent storage

#### Airflow Metadata Database

**Container**: `airflow-db`
**Port**: Not exposed
**Purpose**: Airflow operational data

**Schema**: Managed by Airflow migrations
- DAG definitions, task instances, logs, connections

**Volume**: `airflow_postgres_data` - Persistent storage

**Why Separate Databases**:
1. **Isolation** - Each database serves a distinct purpose (app metadata, ETL destination, Airflow operations)
2. **Performance** - Avoid contention between transactional (app), ETL (test DB), and analytical (Airflow logs) workloads
3. **Backup strategy** - Different RPO/RTO requirements for each database
4. **Versioning** - Independent migration lifecycles
5. **Testing** - Test Database provides isolated environment for ETL development

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
                      (mappings, types)
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

- **Docker** 20.x+ and **Docker Compose** 2.x+
- **4GB+ RAM** for containers
- **10GB+ disk space**
- **(Optional) Node.js 18+** for frontend development
- **(Optional) Python 3.11+** for backend development

### Quick Start

1. **Clone repository**:
   ```bash
   git clone <repository-url>
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

   This will:
   - Create all database tables
   - **Automatically seed a "Test Database" credential** for the test-db container
   - The test credential will appear in the Credentials tab, ready to use

6. **Access application**:
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs
   - Airflow UI: http://localhost:8080 (airflow/airflow)
   - Test Database: Available as **"Test Database"** in Credentials tab

7. **Login to application**:
   - Use test credentials to log in:
     - Admin: `admin@test.com` / `admin123`
     - User: `user@test.com` / `user123`
   - Or configure Google OAuth (see Google Sheets Integration Setup below)

---

### Google Sheets Integration Setup

To enable Google Sheets as a data source, configure Google Cloud OAuth 2.0 credentials. This is a **one-time admin setup** - once configured, all users can connect their personal Google accounts.

#### 1. Create Google Cloud Project & Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "ETL Portal")
3. Enable required APIs:
   - **Google Sheets API**: APIs & Services → Library → Search "Google Sheets API" → Enable
   - **Google Drive API**: APIs & Services → Library → Search "Google Drive API" → Enable

#### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (for Google Workspace) or **External**
3. Fill in app information:
   - **App name**: ETL Portal
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
5. Add test users if using External mode
6. Save and continue

#### 3. Create OAuth Client Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Select **Web application**
4. Add authorized redirect URI:
   ```
   http://localhost:3000/auth/google/callback
   ```
   *(Add production URLs like `https://etl.yourcompany.com/auth/google/callback` when deploying)*
5. Click **Create**
6. **Copy the Client ID and Client Secret** (you'll need these next)

#### 4. Configure ETL Portal

1. Open `.env` file in the project root
2. Add Google OAuth credentials:
   ```bash
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret-here
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```
3. Restart backend:
   ```bash
   docker-compose restart backend
   ```

#### 5. Using Google Sheets

Once configured, users can:

1. Navigate to **ETL Jobs** → **Create New Job**
2. Click the **Google Sheets** tab
3. Click **Connect Google Sheets**
4. Sign in with **their own** Google account (popup window)
5. Grant permission to access spreadsheets
6. Select spreadsheet and sheet from the list
7. Preview data and configure the job

**Key Points**:
- Each user connects their own Google account (individual OAuth)
- Users can only access their own spreadsheets
- Credentials are encrypted and stored per-job
- Automatic type inference and real-time preview

**For detailed setup instructions**, see [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)

---

### Create Your First ETL Job

1. Go to http://localhost:3000
2. Upload a CSV file
3. Review data preview and column types
4. Click "Configure Job"
5. Select the **"Test Database"** credential (auto-seeded during setup)
6. Configure table name and load strategy
7. Map columns (source → destination)
8. Add transformations if needed
9. Click "Create & Execute"
10. Monitor progress in real-time

**Note**: The "Test Database" credential is automatically created and points to the test-db container (PostgreSQL on port 5433). You can use this for testing without setting up external databases.

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
- Auto-refresh for active runs (every 3 seconds)
- Duration calculations
- Logs viewer with copy functionality
- Status badges with color coding
- Delete job runs (with confirmation dialog)

#### Advanced Job Filtering

Filter and search through ETL jobs using multiple criteria:

**Available Filters**:
- **Status**: Draft, Live, Completed, Paused
- **Source Type**: CSV, Google Sheets
- **Destination Type**: PostgreSQL, Redshift
- **Destination Table**: Searchable dropdown of schema.table names

**Features**:
- Unified filter popover with all options
- Searchable table filter (handles thousands of tables)
- Active filter badges with individual removal
- "Clear All Filters" button
- Filter persistence (filters remain visible even when no results match)
- Server-side status filtering for performance
- Client-side filtering for source, destination, and table

**Frontend Component**:
```typescript
import { JobsList } from '@/features/etl-jobs/JobsList'

<JobsList onViewJob={(jobId) => navigate(`/jobs/${jobId}`)} />
```

#### Dark Mode

Built-in dark mode support with automatic system preference detection:

**Features**:
- **Three theme modes**: Light, Dark, System (auto-detects OS preference)
- **localStorage persistence**: Theme preference saved across sessions
- **Smooth transitions**: 200ms animated theme switching
- **No flash on load**: Blocking script prevents wrong theme flash
- **Animated toggle**: Sun/Moon icon with smooth rotation animation
- **Keyboard accessible**: Full ARIA support and screen reader friendly

**Theme Toggle Location**: Top-right corner of navigation bar

**How it works**:
1. On first visit, defaults to system preference (light/dark based on OS)
2. Click sun/moon icon to toggle between light and dark
3. Theme preference saved to localStorage
4. Persists across page refreshes and browser sessions
5. Automatically updates when OS theme changes (if using system mode)

**Technical Implementation**:
- Zustand store for state management with persist middleware
- Tailwind CSS class-based dark mode (`dark:` variants)
- CSS custom properties for semantic color tokens
- All shadcn/ui components automatically support dark mode

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
- Every 4 hours: `0 */4 * * *`
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
# Application Database (ETL Portal metadata)
POSTGRES_USER=etl_user
POSTGRES_PASSWORD=etl_password
POSTGRES_DB=etl_portal
DATABASE_URL=postgresql+asyncpg://etl_user:etl_password@postgres:5432/etl_portal

# Test Database (ETL job destination)
TEST_DB_HOST=test-db
TEST_DB_PORT=5432
TEST_DB_USER=test_user
TEST_DB_PASSWORD=test_password
TEST_DB_NAME=test_db

# Security
ENCRYPTION_KEY=<your-fernet-key>
SECRET_KEY=<your-jwt-secret-key>  # Generate with: openssl rand -hex 32

# Authentication & Google OAuth (Optional - for Google Sign-In)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# File Upload
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=1000000000  # 1GB

# Airflow
AIRFLOW_API_URL=http://airflow-webserver:8080/api/v1
AIRFLOW_USERNAME=airflow
AIRFLOW_PASSWORD=airflow

# Redis
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

### Completed

✅ CSV upload and parsing
✅ Google Sheets integration (OAuth, direct data loading)
✅ Database connectivity (PostgreSQL, Redshift)
✅ Credential encryption and management
✅ Separate application and test databases with auto-seeding
✅ Column mapping with nullable configuration
✅ Data transformations (20+ functions across 4 categories)
✅ Type conversion via column mapping (removed redundant transformation functions)
✅ Job execution via Airflow
✅ Real-time progress monitoring (SSE)
✅ Job run history with logs viewer
✅ Job scheduling (cron-based with Airflow DAG generation)
✅ All load strategies (INSERT, UPSERT, TRUNCATE_INSERT)
✅ DDL auto-generation
✅ Batch processing
✅ Error handling and structured logging
✅ Metabase integration for data visualization
✅ Dark mode with system preference detection
✅ Advanced job filtering (status, source, destination, table)
✅ Searchable table filter for large datasets
✅ Authentication system (Local + Google OAuth with JWT)
✅ User management (create, deactivate, role assignment)
✅ Role-based access control (admin/user permissions)
✅ User ownership for ETL jobs and credentials

### In Progress

🔄 Additional data source connectors (APIs, databases)

### Planned

📋 Data quality validation rules
📋 Advanced scheduling options (dependencies, backfilling)
📋 Email notifications for job failures
📋 API rate limiting and quotas

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
