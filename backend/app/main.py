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

##BEGIN EXCEPTIONS

#This exception handles when our database constraint (specifically, our fuel_level not being between 0 and 100)
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={"detail": "A database constraint was violated (e.g. a duplicate value)"},
    )

#this is a catch-all exception handler so that ANY unexpected failure (bugs or unknown conditions) returns a 
#constant JSON response
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error has occured."},
    )