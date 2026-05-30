"""Settings loaded from .env via pydantic-settings.

Importing `settings` anywhere in the app gives you typed access to every
config value with validation, defaults, and a single source of truth.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- database ---
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/sewanee_transit"
    )

    # --- auth ---
    jwt_secret: str = "dev-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    # --- http ---
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    cookie_domain: str | None = None

    # --- misc ---
    env: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        """Split the comma-separated CORS_ORIGINS env var into a list."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so .env is only parsed once per process."""
    return Settings()


settings = get_settings()