"""
FastAPI application entry point
"""

import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, farms, equipments, field_jobs, operators, service_reports
from app.config import settings

FRONTEND_ORIGIN = settings.frontend_origin

app = FastAPI(
    title="AgriCore Command Center",
    description="Management API for Prairie Crest Agricultural Cooperative",
    version="0.1.0",
)

#CORS Configuration
app.add_middleware(
    CORSMiddleware, 
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(equipments.router)
app.include_router(field_jobs.router)
app.include_router(operators.router)
app.include_router(service_reports.router)

@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/version", tags=["health"])
async def version() -> dict[str, str]:
    return {"version": app.version}