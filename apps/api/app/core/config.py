from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUTOML_")

    app_name: str = "AutoML Studio API"
    cors_origins: list[str] = ["http://localhost:4321"]
    runs_dir: Path = Path(__file__).resolve().parent.parent.parent / "runs"

    def model_post_init(self, __context) -> None:
        self.runs_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
