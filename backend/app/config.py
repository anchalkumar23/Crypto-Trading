"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite+aiosqlite:///./vegalab.db"

    # CORS
    frontend_origin: str = "http://localhost:5173"

    # JWT
    jwt_secret: str = "dev-secret-change-me"
    jwt_access_min: int = 15
    jwt_refresh_days: int = 7
    jwt_algorithm: str = "HS256"

    # Encryption key for exchange API keys at rest.
    # If unset, generate one for development.
    secrets_encryption_key: str = ""

    # Initial admin
    initial_admin_email: str = "admin@vegalab.local"
    initial_admin_password: str = "ChangeMeNow!"

    # Engine
    engine_tick_seconds: int = 30
    enable_live_trading: bool = False

    # Defaults seeded on first run
    default_pairs: list[str] = Field(
        default_factory=lambda: [
            "BTCUSDT",
            "ETHUSDT",
            "SOLUSDT",
            "BNBUSDT",
            "XRPUSDT",
            "DOGEUSDT",
            "AVAXUSDT",
            "LINKUSDT",
            "MATICUSDT",
            "ARBUSDT",
            "OPUSDT",
            "APTUSDT",
        ]
    )

    def get_fernet(self) -> Fernet:
        """Return a Fernet instance, generating a dev key if missing."""
        key = self.secrets_encryption_key
        if not key:
            # Dev fallback. Production must set this.
            key = Fernet.generate_key().decode()
        return Fernet(key.encode() if isinstance(key, str) else key)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
