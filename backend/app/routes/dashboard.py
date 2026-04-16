from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.schemas import DashboardResponse
from app.services.dashboard_service import dashboard_service


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(user: dict = Depends(get_current_user)) -> DashboardResponse:
    return await dashboard_service.get_dashboard(str(user["_id"]))
