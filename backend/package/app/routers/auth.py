#Define Auth APIs and CRUD API for User

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role, require_permission, get_current_user, PaginationParams
from app.models import User, UserRole
from app.schemas.user import Token, UserCreate, UserRead, UserUpdate, CurrentUserRead
from app.security import create_access_token, hash_password, verify_password

from fastapi import Response
from datetime import datetime, timezone
from app.schemas.token import TokenPair, RefreshTokenRequest
from app.services.refresh_tokens import add_refresh_token, get_locked_token, revoke_chain, unauthorized, validate_refresh_token
from app.permissions import get_role_name, get_role_permissions

from app.schemas.pagination import Page

from app.services.record_service import snapshot, soft_delete_record, restore_record, create_record, update_record, get_record
from app.schemas.audit import AuditRead
from app.services.audit_service import add_audit, read_history

router = APIRouter(prefix="/auth", tags=["auth"])

SORT_COLUMNS = {
    "id": User.id,
    "username": User.username,
    "role": User.role,
}

async def query_user_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    role=None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )
    
    conditions = [
        User.deleted_at.is_(None),
    ]

    if search and search.strip():
        term = (
            search.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{term}%"
        conditions.append(
            or_(User.username.ilike(pattern, escape="\\"),)
        )

    if role is not None:
        conditions.append(User.role == role)

    count_stmt = (
        select(func.count()).select_from(User).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(User).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(User.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

@router.get("/users", response_model=Page[UserRead])
async def list_users(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    role: UserRole | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:read"))
):
    return await query_user_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        role=role,
    )

# get inactive list
@router.get("/inactive", response_model=list[UserRead])
async def inactive_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    statement = (
        select(User).where(User.deleted_at.is_not(None))
        .order_by(User.deleted_at.desc(), User.id.desc(),)
    )

    return (await db.scalars(statement)).all()

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
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
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
    await db.flush()

    add_audit(
        db,
        record_type="user",
        record_id=user.id,
        action="CREATE",
        actor=admin,
        changes={
            key: {"before": None, "after": value}
            for key, value in snapshot(user).items()
        },
    )

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
# @router.get("/users", response_model=list[UserRead])
# async def list_users(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
#     _: User = Depends(require_permission("user:read"))
# ) -> list[UserRead]:
#     statement = select(User)
#     result = await db.execute(statement)
#     users = result.scalars().all()
#     return users

@router.patch("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    _: User = Depends(require_permission("user:update"))
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    user.username = payload.username
    user.role = payload.role
    if payload.password:
        user.hashed_password = hash_password(payload.password)

    return await update_record(db, "user", user_id, payload, current_user)
    # await db.commit()
    # await db.refresh(user)
    # return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    _: User = Depends(require_permission("user:delete"))
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    await soft_delete_record(db, "user", user_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    # await db.delete(user)
    # await db.commit()


# restore record
@router.post("/{user_id}/restore", response_model=UserRead)
async def restore_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    return await restore_record(db, "user", user_id, admin)

# read history
@router.get(
    "/{user_id}/history",
    response_model=list[AuditRead]
)
async def user_history(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    record = await get_record(db, "user", user_id, include_deleted=True,)

    role = getattr(user.role, "value", user.role) # to handle enum and string representation of role

    if (record.deleted_at is not None and role != UserRole.FARM_OPERATIONS_ADMIN):
        raise HTTPException(404, "Record not found")

    return await read_history(db, "user", user_id)


#--- get permissions of user
@router.get("/me", response_model=CurrentUserRead)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return CurrentUserRead(
        username=current_user.username,
        role=get_role_name(current_user.role),
        permissions=sorted(
            get_role_permissions(current_user.role)
        ),
    )