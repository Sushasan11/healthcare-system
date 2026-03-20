from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/healthconnect"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/healthconnect"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "change-me-to-a-random-64-char-string"
    PHI_ENCRYPTION_KEY: str = "0" * 64  # 32 bytes hex — override in .env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_HOURS: int = 24
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@healthconnect.local"
    EMAILS_FROM_NAME: str = "HealthConnect"
    FIRST_ADMIN_EMAIL: str = "admin@healthconnect.local"
    FIRST_ADMIN_PASSWORD: str = "Admin@1234"
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    PRESCRIPTION_HMAC_KEY: str = "default-dev-key-change-in-prod"


settings = Settings()
