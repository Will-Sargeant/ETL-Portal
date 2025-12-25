from fastapi import APIRouter

# Import endpoint routers
from app.api.v1.endpoints import sources, credentials, destinations, etl_jobs, job_runs, schedules, transformations

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(sources.router, prefix="/sources", tags=["sources"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
api_router.include_router(destinations.router, prefix="/destinations", tags=["destinations"])
api_router.include_router(etl_jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(job_runs.router, prefix="/job-runs", tags=["job-runs"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(transformations.router, prefix="/transformations", tags=["transformations"])


@api_router.get("/")
async def api_root():
    """API v1 root endpoint."""
    return {"message": "ETL Portal API v1"}
