"""
Google OAuth API endpoints.

Provides endpoints for Google OAuth 2.0 authentication flow.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.google_oauth_service import google_oauth_service
from app.core.encryption import encrypt_credentials
import structlog

router = APIRouter()
logger = structlog.get_logger()


class OAuthCallbackRequest(BaseModel):
    """Request model for OAuth callback."""
    code: str


@router.get("/auth-url")
async def get_google_auth_url():
    """
    Get Google OAuth authorization URL.

    Returns the OAuth URL that the frontend should redirect users to for authentication.

    Returns:
        dict: Contains auth_url and state
            - auth_url: URL to redirect user to for Google OAuth
            - state: CSRF protection state parameter

    Raises:
        HTTPException: 500 if OAuth URL generation fails
    """
    try:
        auth_url, state = google_oauth_service.get_authorization_url()

        return {
            "auth_url": auth_url,
            "state": state
        }
    except ValueError as e:
        logger.error("failed_to_generate_auth_url", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    except Exception as e:
        logger.error("failed_to_generate_auth_url", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to generate authorization URL"
        )


@router.post("/callback")
async def google_oauth_callback(request: OAuthCallbackRequest):
    """
    Handle Google OAuth callback.

    Exchanges the authorization code for access and refresh tokens,
    encrypts the credentials, and returns them to the frontend.

    Args:
        request: Contains the authorization code from Google

    Returns:
        dict: Contains success status and encrypted credentials
            - success: True if successful
            - credentials: Encrypted credentials string

    Raises:
        HTTPException: 400 if code exchange fails
    """
    try:
        # Exchange code for credentials
        credentials = await google_oauth_service.exchange_code_for_credentials(
            code=request.code
        )

        # Encrypt credentials for storage
        encrypted_credentials = encrypt_credentials(credentials)

        logger.info(
            "oauth_callback_success",
            has_refresh_token=bool(credentials.get('refresh_token'))
        )

        return {
            "success": True,
            "credentials": encrypted_credentials
        }

    except ValueError as e:
        logger.error("oauth_callback_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error("oauth_callback_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail="Failed to complete OAuth flow"
        )
