from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongodb import get_users_collection
from app.models.schemas import AuthResponse, UserCreate, UserLogin, UserPublic


class AuthService:
    @staticmethod
    async def signup(payload: UserCreate) -> AuthResponse:
        users = get_users_collection()
        existing = await users.find_one({"email": payload.email.lower()})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

        user_doc = {
            "email": payload.email.lower(),
            "password_hash": hash_password(payload.password),
            "created_at": datetime.now(timezone.utc),
        }
        result = await users.insert_one(user_doc)
        user = UserPublic(id=str(result.inserted_id), email=payload.email.lower())
        token = create_access_token(user.id)
        return AuthResponse(access_token=token, user=user)

    @staticmethod
    async def login(payload: UserLogin) -> AuthResponse:
        users = get_users_collection()
        user_doc = await users.find_one({"email": payload.email.lower()})
        if not user_doc or not verify_password(payload.password, user_doc["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user = UserPublic(id=str(user_doc["_id"]), email=user_doc["email"])
        token = create_access_token(str(user_doc["_id"]))
        return AuthResponse(access_token=token, user=user)

    @staticmethod
    async def get_user_by_id(user_id: str) -> dict:
        users = get_users_collection()
        try:
            object_id = ObjectId(user_id)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user") from exc

        user_doc = await users.find_one({"_id": object_id})
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user_doc


auth_service = AuthService()
