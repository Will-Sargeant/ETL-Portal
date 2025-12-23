# Development Guide

## Phase 1: Foundation ✅ COMPLETE

You've completed the foundation! Here's what's been set up:

### Backend Infrastructure
- ✅ FastAPI application with async support
- ✅ SQLAlchemy 2.0 models (ETLJob, ColumnMapping, JobRun, Credential, Schedule)
- ✅ Alembic migrations
- ✅ Fernet encryption for credentials
- ✅ Structured logging with structlog
- ✅ Database connection pooling

### Frontend Infrastructure
- ✅ React 18 + TypeScript + Vite
- ✅ TanStack Query for server state
- ✅ Tailwind CSS + shadcn/ui components
- ✅ React Router v6
- ✅ Axios API client with interceptors

### DevOps
- ✅ Docker Compose with all services
- ✅ PostgreSQL for app data
- ✅ Redis for caching
- ✅ Airflow (webserver, scheduler, worker)
- ✅ Environment configuration

## Next Steps: Phase 2 - CSV Upload

### Backend Tasks

1. **Create file upload endpoint** (`backend/app/api/v1/endpoints/sources.py`)
   ```python
   @router.post("/csv/upload")
   async def upload_csv(file: UploadFile)
   ```

2. **Build CSV service** (`backend/app/services/csv_service.py`)
   - Handle chunked uploads
   - Validate file format
   - Parse CSV with pandas
   - Infer data types
   - Generate preview data

3. **Create schemas** (`backend/app/schemas/source.py`)
   - UploadResponse
   - DataPreview
   - ColumnInfo

### Frontend Tasks

1. **CSV upload component** (`frontend/src/features/sources/CSVUpload.tsx`)
   - Drag-and-drop with react-dropzone
   - Upload progress bar
   - File validation feedback

2. **Data preview component** (`frontend/src/features/sources/DataPreview.tsx`)
   - Table with first 100 rows
   - Column statistics
   - Data type indicators

3. **API hooks** (`frontend/src/features/sources/api.ts`)
   - useUploadCSV mutation
   - useDataPreview query

## File Structure Reference

```
backend/app/
  api/v1/endpoints/    # API route handlers
  core/                # Config, database, security
  crud/                # Database CRUD operations
  models/              # SQLAlchemy models ✅
  schemas/             # Pydantic request/response models
  services/            # Business logic (ETL engine, etc.)
  utils/               # Helper functions

frontend/src/
  components/ui/       # shadcn/ui components (Button, Card, etc.)
  features/            # Feature-specific components
    sources/           # CSV upload, Google Sheets
    jobs/              # Job list, job detail
    wizard/            # Multi-step wizard
  hooks/               # Custom React hooks
  lib/                 # API client ✅, utilities ✅
  pages/               # Route pages
  types/               # TypeScript type definitions
```

## Useful Commands

### Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Access backend shell
docker-compose exec backend bash

# Access PostgreSQL
docker-compose exec postgres psql -U etl_user -d etl_portal
```

### Backend

```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Run migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# Python shell
docker-compose exec backend python

# Run tests (once created)
docker-compose exec backend pytest
```

### Frontend

```bash
# Install new package
cd frontend && npm install <package>

# Type check
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

## Database Models Reference

### ETLJob
- Stores job configuration
- Links to column_mappings, job_runs, schedule
- Fields: name, source_type, source_config, destination_type, etc.

### ColumnMapping
- Maps source columns to destination columns
- Stores transformations per column
- Fields: source_column, dest_column, transformations, is_calculated

### JobRun
- Tracks execution history
- Real-time progress updates
- Fields: status, rows_processed, error_count, logs

### Credential
- Encrypted database credentials
- Fields: db_type, encrypted_connection_string, host, port

### Schedule
- Cron-based scheduling
- Links to Airflow DAG
- Fields: cron_expression, enabled, last_run, next_run

## API Patterns

### Standard Response Format
```python
{
  "data": {...},
  "message": "Success",
  "status": "ok"
}
```

### Error Response
```python
{
  "detail": "Error message",
  "status": "error"
}
```

## Testing Strategy

1. **Backend Unit Tests**: Test services and CRUD operations
2. **Backend Integration Tests**: Test API endpoints
3. **Frontend Component Tests**: Test UI components with Testing Library
4. **E2E Tests**: Test complete user flows with Playwright

## Security Checklist

- ✅ Fernet encryption for credentials
- ✅ Environment variable configuration
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ⏳ Input validation (add when building endpoints)
- ⏳ Rate limiting (add when needed)
- ⏳ HTTPS in production
- ⏳ OAuth authentication (Phase 12)

## Performance Considerations

- Use async/await throughout backend
- Stream large CSV files (don't load entire file in memory)
- Batch database inserts (10k rows at a time)
- Use pagination for API responses
- Implement caching with Redis where appropriate
- Use TanStack Query's built-in caching on frontend

## Debugging Tips

### Backend
- Check logs: `docker-compose logs -f backend`
- Enable SQL echo in settings for query debugging
- Use structlog for structured logging
- Add breakpoints with `import pdb; pdb.set_trace()`

### Frontend
- React DevTools for component inspection
- TanStack Query DevTools for cache inspection
- Network tab for API calls
- Console for errors and logs

## Ready to Continue?

Run the setup script to get started:

```bash
./setup.sh
```

Then start building Phase 2 - CSV Upload!
