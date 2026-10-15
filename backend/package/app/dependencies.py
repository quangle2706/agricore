#for get db
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal

#addition - for get current user and require role
import jwt 
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select

from app.models import User, UserRole
from app.security import decode_access_token
from app.permissions import get_role_permissions

##pagination
from typing import Literal
from fastapi import Query

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(
        token: str = Depends(oauth2_scheme),
        db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )
    try:
        payload = decode_access_token(token)
        username = payload.get("sub") #'sub' is the standard claim name for the subject of the token (username)
        if username is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

def require_role(*allowed_roles: UserRole):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{current_user.role.value}' is not permitted to perform this action"
                ),
            )
        return current_user
    return role_checker

# check permission
def require_permission(required_permission: str):
    async def checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        permissions = get_role_permissions(current_user.role)
        if required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return checker

# define pagination params
class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1), #check param if valid >= 1
        size: int = Query(default=10, ge=1, le=100), # size should be 1 <= x <= 100
        sort_by: str = Query(default="id"), 
        sort_dir: Literal["asc", "desc"] = Query(default="asc"), # only "asc" or "desc"
    ):
        self.page = page
        self.size = size
        self.sort_by = sort_by
        self.sort_dir = sort_dir