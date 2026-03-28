"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str  # service-role key (bypasses RLS for admin ops)
    supabase_anon_key: str
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
