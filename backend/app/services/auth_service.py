"""
Authentication service for user login via Google OAuth and SAML.
"""

import httpx
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings


class GoogleAuthService:
    """Service for handling Google OAuth 2.0 user authentication (separate from Sheets access)."""

    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

    async def exchange_code_for_tokens(self, code: str) -> dict:
        """Exchange authorization code for access and ID tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_LOGIN_REDIRECT_URI,
                    "grant_type": "authorization_code",
                }
            )
            response.raise_for_status()
            return response.json()

    async def verify_id_token(self, id_token_str: str) -> dict:
        """Verify and decode the Google ID token."""
        idinfo = id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        return {
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "provider_user_id": idinfo.get("sub"),
        }


class SAMLService:
    """Service for handling SAML 2.0 authentication (Okta compatible)."""

    def process_saml_response(self, saml_response: str) -> dict:
        """
        Process and validate SAML response.

        Note: This is a placeholder for SAML implementation.
        Full implementation would use python3-saml library.
        """
        # TODO: Implement full SAML processing with onelogin's python3-saml
        # For now, this is a placeholder
        raise NotImplementedError("SAML authentication not yet implemented")


# Singleton instances
google_auth_service = GoogleAuthService()
saml_service = SAMLService()
