"""
Central app settings, loaded from environment variables / .env.
Import `settings` anywhere config values are needed — never call
os.getenv() directly outside this file.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"  # verify current model name in Google AI Studio
    github_token: str = ""  # optional, raises GitHub API rate limits from 60/hr to 5000/hr
    # Signing key for access tokens. The default is a placeholder so the app still
    # boots in dev and CI; anything issuing real tokens must override it.
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12

    class Config:
        env_file = ".env"


settings = Settings()
