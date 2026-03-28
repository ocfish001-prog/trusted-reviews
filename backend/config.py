"""
Application configuration loaded from environment variables.
"""
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str  # postgresql://user:pass@host:port/dbname (Railway provides this)
    jwt_secret: str  # random secret for signing JWTs
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days
    anthropic_api_key: str
    cors_origins: str = "http://localhost:3000"
    port: int = 8000

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
