from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.schemas import AuthResponse, LogoutResponse, UserCreate, UserLogin, UserPublic
from app.services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: UserCreate) -> AuthResponse:
    return await auth_service.signup(payload)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin) -> AuthResponse:
    return await auth_service.login(payload)


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)) -> UserPublic:
    return await auth_service.get_public_user_by_id(str(user["_id"]))


@router.post("/logout", response_model=LogoutResponse)
async def logout(user: dict = Depends(get_current_user)) -> LogoutResponse:
    await auth_service.logout(str(user["_id"]))
    return LogoutResponse()
