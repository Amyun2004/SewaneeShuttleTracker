"""
config does these:
puling from the .env the following: 
model configuration
database configuration
Cors configuration
http configuration

converting cors stro to list

running the settings

"""

from pydantic_settings import SettingsConfigDict, BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra = 'ignore')

    #database configuration 
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sewanee_transit"

    #Cors configuration 
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    jwt_secret: str = "dev-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7 

    #http configuration and cookies configuraiton 
    cookie_secure: bool = False
    cookie_domain: str | None = None

    #misc configuration 
    env: str = "development"

    @property 
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
