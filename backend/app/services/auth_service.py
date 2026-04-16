from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, OperationFailure

from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongodb import get_users_collection
from app.models.schemas import AuthResponse, UserCreate, UserLogin, UserPublic


class AuthService:
    @staticmethod
    def _read_field(document: dict, *keys: str):
        for key in keys:
            if key in document and document[key] is not None:
                return document[key]
        return None

    @staticmethod
    def _to_user_public(user_doc: dict) -> UserPublic:
        full_name = AuthService._read_field(user_doc, "full_name", "fullName", "name") or ""
        created_at = AuthService._read_field(user_doc, "created_at", "createdAt")
        last_login_at = AuthService._read_field(user_doc, "last_login_at", "lastLoginAt")
        last_logout_at = AuthService._read_field(user_doc, "last_logout_at", "lastLogoutAt")

        if created_at is None:
            created_at = datetime.now(timezone.utc)

        return UserPublic(
            id=str(user_doc["_id"]),
            full_name=full_name,
            email=user_doc["email"],
            created_at=created_at,
            last_login_at=last_login_at,
            last_logout_at=last_logout_at,
        )

    @staticmethod
    async def _insert_user_with_compatibility(
        users,
        *,
        email: str,
        full_name: str,
        password_hash: str,
        now: datetime,
    ) -> dict:
        candidate_documents = [
            {
                "full_name": full_name,
                "email": email,
                "password_hash": password_hash,
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
                "last_logout_at": None,
            },
            {
                "fullName": full_name,
                "email": email,
                "passwordHash": password_hash,
                "createdAt": now,
                "updatedAt": now,
                "lastLoginAt": now,
                "lastLogoutAt": None,
            },
            {
                "name": full_name,
                "email": email,
                "hashed_password": password_hash,
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
                "last_logout_at": None,
            },
        ]

        last_validation_error: OperationFailure | None = None

        for candidate in candidate_documents:
            try:
                result = await users.insert_one(candidate)
                candidate["_id"] = result.inserted_id
                return candidate
            except DuplicateKeyError as exc:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc
            except OperationFailure as exc:
                if exc.code == 121 or "Document failed validation" in str(exc):
                    last_validation_error = exc
                    continue
                raise

        if last_validation_error is not None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Signup is temporarily unavailable",
            ) from last_validation_error

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create user",
        )

    @staticmethod
    def _login_update_fields(user_doc: dict, now: datetime) -> dict:
        if "lastLoginAt" in user_doc or "updatedAt" in user_doc:
            return {"lastLoginAt": now, "updatedAt": now}
        return {"last_login_at": now, "updated_at": now}

    @staticmethod
    def _logout_update_fields(user_doc: dict, now: datetime) -> dict:
        if "lastLogoutAt" in user_doc or "updatedAt" in user_doc:
            return {"lastLogoutAt": now, "updatedAt": now}
        return {"last_logout_at": now, "updated_at": now}

    @staticmethod
    async def signup(payload: UserCreate) -> AuthResponse:
        users = get_users_collection()
        normalized_email = payload.email.lower()
        existing = await users.find_one({"email": normalized_email})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

        now = datetime.now(timezone.utc)
        full_name = " ".join(payload.full_name.split())
        if not full_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Full name is required")

        password_hash = hash_password(payload.password)
        user_doc = await AuthService._insert_user_with_compatibility(
            users,
            email=normalized_email,
            full_name=full_name,
            password_hash=password_hash,
            now=now,
        )
        user = AuthService._to_user_public(user_doc)
        token = create_access_token(user.id)
        return AuthResponse(access_token=token, user=user)

    @staticmethod
    async def login(payload: UserLogin) -> AuthResponse:
        users = get_users_collection()
        user_doc = await users.find_one({"email": payload.email.lower()})
        stored_hash = None
        if user_doc:
            stored_hash = AuthService._read_field(user_doc, "password_hash", "passwordHash", "hashed_password")

        if not user_doc or not stored_hash or not verify_password(payload.password, stored_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        now = datetime.now(timezone.utc)
        update_fields = AuthService._login_update_fields(user_doc, now)
        await users.update_one(
            {"_id": user_doc["_id"]},
            {"$set": update_fields},
        )
        for field_name, field_value in update_fields.items():
            user_doc[field_name] = field_value

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

        user_doc = await users.find_one({"_id": object_id})
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        now = datetime.now(timezone.utc)
        update_fields = AuthService._logout_update_fields(user_doc, now)
        result = await users.update_one(
            {"_id": object_id},
            {"$set": update_fields},
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
