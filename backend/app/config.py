from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    frontend_origin: str
    aws_region: str
    s3_bucket_name: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env"
    )

settings = Settings()