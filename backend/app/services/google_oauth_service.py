"""
Google OAuth 2.0 Service.

Handles OAuth authentication flow for Google Sheets access.
"""

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from app.core.config import settings
import structlog

logger = structlog.get_logger()


class GoogleOAuthService:
    """Service for handling Google OAuth 2.0 authentication."""

    def __init__(self):
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ]

    def get_authorization_url(self, redirect_uri: str = None) -> tuple[str, str]:
        """
        Generate OAuth authorization URL.

        Args:
            redirect_uri: Optional custom redirect URI. Uses settings.GOOGLE_REDIRECT_URI if not provided.

        Returns:
            Tuple of (authorization_url, state)

        Raises:
            ValueError: If Google client credentials are not configured
        """
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise ValueError(
                "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
            )

        redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI

        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uris": [redirect_uri],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=self.scopes,
            )
            flow.redirect_uri = redirect_uri

            authorization_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent'  # Force consent to get refresh token
            )

            logger.info(
                "oauth_url_generated",
                redirect_uri=redirect_uri,
                scopes=self.scopes
            )

            return authorization_url, state

        except Exception as e:
            logger.error("failed_to_generate_oauth_url", error=str(e))
            raise ValueError(f"Failed to generate OAuth URL: {e}")

    async def exchange_code_for_credentials(
        self,
        code: str,
        redirect_uri: str = None
    ) -> dict:
        """
        Exchange authorization code for credentials.

        Args:
            code: Authorization code from OAuth callback
            redirect_uri: Optional custom redirect URI. Uses settings.GOOGLE_REDIRECT_URI if not provided.

        Returns:
            Dictionary containing credentials:
                - token: Access token
                - refresh_token: Refresh token (for offline access)
                - token_uri: Token endpoint URI
                - client_id: OAuth client ID
                - client_secret: OAuth client secret
                - scopes: Granted scopes

        Raises:
            ValueError: If code exchange fails
        """
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise ValueError(
                "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
            )

        redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI

        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uris": [redirect_uri],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=self.scopes,
            )
            flow.redirect_uri = redirect_uri

            # Exchange code for token
            flow.fetch_token(code=code)

            credentials = flow.credentials

            credentials_dict = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes,
            }

            logger.info(
                "oauth_code_exchanged",
                has_refresh_token=bool(credentials.refresh_token),
                scopes=credentials.scopes
            )

            return credentials_dict

        except Exception as e:
            logger.error("failed_to_exchange_oauth_code", error=str(e))
            raise ValueError(f"Failed to exchange OAuth code: {e}")


# Singleton instance
google_oauth_service = GoogleOAuthService()
