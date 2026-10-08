#Define Auth APIs and CRUD API for User

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models import User, UserRole
from app.schemas.user import Token, UserCreate, UserRead, UserUpdate
from app.security import create_access_token, hash_password, verify_password

from fastapi import Response
from datetime import datetime, timezone
from app.schemas.token import TokenPair, RefreshTokenRequest
from app.services.refresh_tokens import add_refresh_token, get_locked_token, revoke_chain, unauthorized, validate_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])

# @router.post("/token", response_model=Token)
# async def login(
#     form_data: OAuth2PasswordRequestForm = Depends(),
#     db: AsyncSession = Depends(get_db),
# ) -> Token:
#     result = await db.execute(select(User).where(func.lower(User.username) == form_data.username.lower()))
#     user = result.scalar_one_or_none()

#     if user is None or not verify_password(form_data.password, user.hashed_password):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Incorrect username or password",
#             headers={"WWW-Authenticate": "Bearer"}
#         )

#     access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
#     return Token(access_token=access_token, token_type="bearer")


@router.post("/token", response_model=TokenPair)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    result = await db.execute(select(User).where(func.lower(User.username) == form_data.username.lower()))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    refresh_token = add_refresh_token(db, user_id=user.id,)

    await db.commit()
    response.headers["Cache-Control"] = "no-store"
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
) -> User:
    existing = await db.execute(select(User).where(func.lower(User.username) == payload.username.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{payload.username}' is already taken",
        )

    user = User(
        username = payload.username,
        hashed_password = hash_password(payload.password),
        role = payload.role
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


#---- Refresh Token ----
@router.post("/refresh", response_model=TokenPair)
async def refresh(
    body: RefreshTokenRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_token = validate_refresh_token(body.refresh_token)
    stored_token = await get_locked_token(db, raw_token)

    if stored_token is None:
        raise unauthorized()

    if stored_token.revoked:
        await revoke_chain(db, stored_token.chain_id)

        await db.commit()
        raise unauthorized()

    expires_at = stored_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc):
        raise unauthorized()

    user = await db.get(User, stored_token.user_id)

    if user is None:
        await revoke_chain(db, stored_token.chain_id)
        await db.commit()
        raise unauthorized()


    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}
    )

    stored_token.revoked = True

    replacement = add_refresh_token(
        db,
        user_id=user.id,
        chain_id=stored_token.chain_id,
        expires_at=stored_token.expires_at,
    )

    # Revoke old token and add new token
    await db.commit()

    response.headers["Cache-Control"] = "no-store"

    return TokenPair(
        access_token=access_token,
        refresh_token=replacement,
    )


@router.post("/logout")
async def logout(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    raw_token = validate_refresh_token(body.refresh_token)
    stored_token = await get_locked_token(db, raw_token)

    if stored_token is not None:
        # Logout revoke session/chain.
        await revoke_chain(db, stored_token.chain_id)

    await db.commit()

    return {"message": "Logged out"}

#-----------------------

#CRUD Operators
@router.get("/users", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> list[UserRead]:
    statement = select(User)
    result = await db.execute(statement)
    users = result.scalars().all()
    return users

@router.patch("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    user.username = payload.username
    user.role = payload.role
    if payload.password:
        user.hashed_password = hash_password(payload.password)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    await db.delete(user)
    await db.commit()
