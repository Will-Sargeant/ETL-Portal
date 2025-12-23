FROM apache/airflow:2.10.4-python3.11

USER root

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER airflow

# Install Python packages
# Note: SQLAlchemy 1.4.x comes with Airflow, not upgrading to 2.0 to avoid conflicts
RUN pip install --no-cache-dir \
    pandas==2.1.4 \
    numpy==1.26.2 \
    psycopg2-binary==2.9.9 \
    asyncpg==0.29.0 \
    cryptography==41.0.7 \
    pydantic==2.5.3 \
    pydantic-settings==2.1.0 \
    python-dotenv==1.0.0 \
    structlog==23.3.0 \
    simpleeval==0.9.13 \
    chardet==5.2.0 \
    google-auth==2.25.2 \
    google-auth-oauthlib==1.2.0 \
    google-auth-httplib2==0.2.0 \
    google-api-python-client==2.111.0 \
    redshift-connector==2.0.918 \
    fastapi==0.109.0 \
    httpx==0.26.0

# Initialize airflow database
COPY --chown=airflow:root init-airflow.sh /init-airflow.sh
RUN chmod +x /init-airflow.sh

ENTRYPOINT ["/init-airflow.sh"]
