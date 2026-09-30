"""
Run from the /backend directory with .venv active:
    python -m scripts.seed_users
"""

import asyncio

from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.security import hash_password

async def seed_users() -> None:
    async with AsyncSessionLocal() as session:
        session.add_all([
            User(username="admin", hashed_password=hash_password("AdminPass123!"), role=UserRole.FARM_OPERATIONS_ADMIN),
            User(username="fieldhand", hashed_password=hash_password("FieldHandPass123!"), role=UserRole.FIELD_HAND),
            User(username="auditor", hashed_password=hash_password("AuditorPass123!"), role=UserRole.AUDITOR),
        ])
        await session.commit()

if __name__ == "__main__":
    asyncio.run(seed_users())