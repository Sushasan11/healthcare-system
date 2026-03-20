from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.db import lifespan

# Rate limiter backed by in-memory storage
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")

app = FastAPI(title="HealthConnect", lifespan=lifespan)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
origins = [o.strip() for o in settings.BACKEND_CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.routers import auth, admin, profile, doctors, availability, appointments, consultations, ws, prescriptions, drugs, notifications  # noqa: E402

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(profile.router)
app.include_router(doctors.router)
app.include_router(availability.router)
app.include_router(appointments.router)
app.include_router(consultations.router)
app.include_router(consultations.files_router)
app.include_router(ws.router)
app.include_router(prescriptions.router)
app.include_router(drugs.router)
app.include_router(notifications.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "HealthConnect"}
