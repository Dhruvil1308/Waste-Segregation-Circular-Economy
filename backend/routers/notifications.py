from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import database, models, schemas, auth
from backend.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=List[schemas.NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Newest first. The frontend polls this every few seconds."""
    return notification_service.list_for_user(db, current_user.id, limit=limit, unread_only=unread_only)


@router.get("/count")
async def unread_notification_count(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Cheap endpoint for the badge, so polling stays light."""
    return {"unread": notification_service.unread_count(db, current_user.id)}


@router.post("/read")
async def mark_notifications_read(
    request: schemas.MarkReadRequest = schemas.MarkReadRequest(),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Marks the listed notifications read, or all of them when none are given."""
    updated = notification_service.mark_read(db, current_user.id, request.notification_ids)
    return {"marked_read": updated}
