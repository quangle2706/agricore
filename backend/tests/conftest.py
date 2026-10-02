import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.dependencies import get_db
from app.main import app
from app.models import Base, Farm, User, UserRole, FieldJob
from app.security import create_access_token, hash_password

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", 
    "postgresql+asyncpg://postgres:123456@127.0.0.1:5432/agricore_test"
)

#a separate async engine/session factory just for tests
test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

@pytest_asyncio.fixture
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    #ASGITransport lets AsyncClient speak directly to the FastAPI app in-process,
    #over a real ASGI interface with no actual network socket (no running server required)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac: #asyncclient
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_users(db_session):
    users = {
        "admin": User(username="test_admin", hashed_password=hash_password("pw"), role=UserRole.FARM_OPERATIONS_ADMIN),
        "operator": User(username="test_operator", hashed_password=hash_password("pw"), role=UserRole.FIELD_HAND),
        "auditor": User(username="test_auditor", hashed_password=hash_password("pw"), role=UserRole.AUDITOR),
    }
    for user in users.values():
        db_session.add(user)
    await db_session.commit()
    for user in users.values():
        await db_session.refresh(user)
    return users


@pytest_asyncio.fixture
async def seeded_farm(db_session):
    farm = Farm(name="Test Farm", location_region="Test Region", capacity=10, supervisor_id=1)
    db_session.add(farm)
    await db_session.commit()
    await db_session.refresh(farm)
    return farm


@pytest_asyncio.fixture
async def seeded_facility(db_session):
    facility = Farm(name="Test Facility", location_region="Test Region", capacity=10, supervisor_id=1)
    db_session.add(facility)
    await db_session.commit()
    await db_session.refresh(facility)
    return facility


def auth_header(user: User) -> dict[str, str]:
    token = create_access_token(data={"sub": user.username, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# We can put seeded information go into here 
# instead of being in test_missions.py