from fastapi import APIRouter

from app.models.schemas import AuthResponse, UserCreate, UserLogin
from app.services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: UserCreate) -> AuthResponse:
    return await auth_service.signup(payload)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin) -> AuthResponse:
    return await auth_service.login(payload)
