"""
Airflow API Client for triggering and managing DAG runs.
"""

import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AirflowClient:
    """Client for interacting with Airflow REST API."""

    def __init__(self):
        self.base_url = settings.AIRFLOW_API_URL
        self.auth = (settings.AIRFLOW_USERNAME, settings.AIRFLOW_PASSWORD)
        self.timeout = 30.0  # 30 seconds timeout

    async def trigger_dag(
        self,
        dag_id: str,
        conf: Dict[str, Any]
    ) -> str:
        """
        Trigger a DAG run.

        Args:
            dag_id: ID of the DAG to trigger
            conf: Configuration dictionary to pass to the DAG run

        Returns:
            The DAG run ID

        Raises:
            httpx.HTTPError: If the request fails
        """
        url = f"{self.base_url}/dags/{dag_id}/dagRuns"

        payload = {
            "conf": conf
        }

        logger.info(
            "triggering_airflow_dag",
            dag_id=dag_id,
            conf=conf
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    auth=self.auth
                )

                response.raise_for_status()
                data = response.json()

                dag_run_id = data.get('dag_run_id')

                logger.info(
                    "airflow_dag_triggered",
                    dag_id=dag_id,
                    dag_run_id=dag_run_id
                )

                return dag_run_id

        except httpx.HTTPStatusError as e:
            logger.error(
                "airflow_dag_trigger_failed",
                dag_id=dag_id,
                status_code=e.response.status_code,
                error=e.response.text
            )
            raise

        except httpx.RequestError as e:
            logger.error(
                "airflow_api_request_failed",
                dag_id=dag_id,
                error=str(e)
            )
            raise

    async def get_dag_run_status(
        self,
        dag_id: str,
        dag_run_id: str
    ) -> Dict[str, Any]:
        """
        Get the status of a DAG run.

        Args:
            dag_id: ID of the DAG
            dag_run_id: ID of the DAG run

        Returns:
            Dictionary with DAG run status information

        Raises:
            httpx.HTTPError: If the request fails
        """
        url = f"{self.base_url}/dags/{dag_id}/dagRuns/{dag_run_id}"

        logger.debug(
            "getting_dag_run_status",
            dag_id=dag_id,
            dag_run_id=dag_run_id
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url,
                    auth=self.auth
                )

                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(
                "dag_run_status_failed",
                dag_id=dag_id,
                dag_run_id=dag_run_id,
                status_code=e.response.status_code,
                error=e.response.text
            )
            raise

        except httpx.RequestError as e:
            logger.error(
                "airflow_api_request_failed",
                dag_id=dag_id,
                dag_run_id=dag_run_id,
                error=str(e)
            )
            raise

    async def get_dag_info(self, dag_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a DAG.

        Args:
            dag_id: ID of the DAG

        Returns:
            Dictionary with DAG information, or None if not found
        """
        url = f"{self.base_url}/dags/{dag_id}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url,
                    auth=self.auth
                )

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            logger.error(
                "get_dag_info_failed",
                dag_id=dag_id,
                error=str(e)
            )
            return None

    async def pause_dag(self, dag_id: str) -> bool:
        """
        Pause a DAG.

        Args:
            dag_id: ID of the DAG to pause

        Returns:
            True if successful, False otherwise
        """
        url = f"{self.base_url}/dags/{dag_id}"

        payload = {
            "is_paused": True
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(
                    url,
                    json=payload,
                    auth=self.auth
                )

                response.raise_for_status()

                logger.info("dag_paused", dag_id=dag_id)
                return True

        except httpx.HTTPError as e:
            logger.error(
                "pause_dag_failed",
                dag_id=dag_id,
                error=str(e)
            )
            return False

    async def unpause_dag(self, dag_id: str) -> bool:
        """
        Unpause a DAG.

        Args:
            dag_id: ID of the DAG to unpause

        Returns:
            True if successful, False otherwise
        """
        url = f"{self.base_url}/dags/{dag_id}"

        payload = {
            "is_paused": False
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(
                    url,
                    json=payload,
                    auth=self.auth
                )

                response.raise_for_status()

                logger.info("dag_unpaused", dag_id=dag_id)
                return True

        except httpx.HTTPError as e:
            logger.error(
                "unpause_dag_failed",
                dag_id=dag_id,
                error=str(e)
            )
            return False


# Global client instance
airflow_client = AirflowClient()
