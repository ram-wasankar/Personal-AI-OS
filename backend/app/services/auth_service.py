from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongodb import get_users_collection
from app.models.schemas import AuthResponse, UserCreate, UserLogin, UserPublic


class AuthService:
    @staticmethod
    def _to_user_public(user_doc: dict) -> UserPublic:
        return UserPublic(
            id=str(user_doc["_id"]),
            full_name=user_doc.get("full_name", ""),
            email=user_doc["email"],
            created_at=user_doc["created_at"],
            last_login_at=user_doc.get("last_login_at"),
            last_logout_at=user_doc.get("last_logout_at"),
        )

    @staticmethod
    async def signup(payload: UserCreate) -> AuthResponse:
        users = get_users_collection()
        existing = await users.find_one({"email": payload.email.lower()})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

        now = datetime.now(timezone.utc)
        full_name = " ".join(payload.full_name.split())
        if not full_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Full name is required")

        user_doc = {
            "full_name": full_name,
            "email": payload.email.lower(),
            "password_hash": hash_password(payload.password),
            "created_at": now,
            "updated_at": now,
            "last_login_at": now,
            "last_logout_at": None,
        }
        result = await users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user = AuthService._to_user_public(user_doc)
        token = create_access_token(user.id)
        return AuthResponse(access_token=token, user=user)

    @staticmethod
    async def login(payload: UserLogin) -> AuthResponse:
        users = get_users_collection()
        user_doc = await users.find_one({"email": payload.email.lower()})
        if not user_doc or not verify_password(payload.password, user_doc["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        now = datetime.now(timezone.utc)
        await users.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"last_login_at": now, "updated_at": now}},
        )
        user_doc["last_login_at"] = now

        user = AuthService._to_user_public(user_doc)
        token = create_access_token(str(user_doc["_id"]))
        return AuthResponse(access_token=token, user=user)

    @staticmethod
    async def get_public_user_by_id(user_id: str) -> UserPublic:
        user_doc = await AuthService.get_user_by_id(user_id)
        return AuthService._to_user_public(user_doc)

    @staticmethod
    async def logout(user_id: str) -> None:
        users = get_users_collection()
        try:
            object_id = ObjectId(user_id)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user") from exc

        now = datetime.now(timezone.utc)
        result = await users.update_one(
            {"_id": object_id},
            {"$set": {"last_logout_at": now, "updated_at": now}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

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
