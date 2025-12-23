from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings."""

    # Application
    APP_NAME: str = "ETL Portal"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://etl_user:etl_password@localhost:5432/etl_portal",
        env="DATABASE_URL"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/1", env="REDIS_URL")

    # Security
    ENCRYPTION_KEY: str = Field(default="", env="ENCRYPTION_KEY")
    SECRET_KEY: str = Field(
        default="your-secret-key-change-in-production",
        env="SECRET_KEY"
    )

    # File Upload
    UPLOAD_DIR: str = Field(default="./uploads", env="UPLOAD_DIR")
    MAX_UPLOAD_SIZE: int = Field(default=1_000_000_000, env="MAX_UPLOAD_SIZE")  # 1GB
    TEMP_FILE_CLEANUP_HOURS: int = Field(default=24, env="TEMP_FILE_CLEANUP_HOURS")

    # ETL Processing
    DEFAULT_BATCH_SIZE: int = Field(default=10000, env="DEFAULT_BATCH_SIZE")
    MAX_PREVIEW_ROWS: int = Field(default=100, env="MAX_PREVIEW_ROWS")

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173"],
        env="CORS_ORIGINS"
    )

    # Airflow
    AIRFLOW_DAGS_DIR: str = Field(default="./airflow/dags", env="AIRFLOW_DAGS_DIR")
    AIRFLOW_API_URL: str = Field(
        default="http://airflow-webserver:8080/api/v1",
        env="AIRFLOW_API_URL"
    )
    AIRFLOW_USERNAME: str = Field(default="admin", env="AIRFLOW_USERNAME")
    AIRFLOW_PASSWORD: str = Field(default="admin", env="AIRFLOW_PASSWORD")

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
