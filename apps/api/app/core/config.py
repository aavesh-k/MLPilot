from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUTOML_")

    app_name: str = "AutoML Studio API"
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:4321"]
    runs_dir: Path = Path(__file__).resolve().parent.parent.parent / "runs"


settings = Settings()
