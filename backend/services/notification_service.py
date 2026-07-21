"""Creates the in-app notifications that the frontend polls for."""
from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from backend import models

# Notification types
NEW_REQUEST = "new_request"
REQUEST_ACCEPTED = "request_accepted"
EN_ROUTE = "en_route"
COLLECTED = "collected"
ESCALATION = "escalation"
TICKET_UPDATE = "ticket_update"


def notify(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str = None,
    listing_id: int = None,
    ticket_id: int = None,
    commit: bool = True,
) -> models.Notification:
    notification = models.Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        listing_id=listing_id,
        ticket_id=ticket_id,
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    return notification


def notify_many(db: Session, user_ids: Iterable[int], **kwargs) -> List[models.Notification]:
    """Fan a single notification out to several users in one commit."""
    created = [notify(db, user_id=user_id, commit=False, **kwargs) for user_id in user_ids]
    db.commit()
    return created


def notify_admins(db: Session, **kwargs) -> List[models.Notification]:
    admin_ids = [
        user.id for user in db.query(models.User).filter(models.User.role == models.ROLE_ADMIN).all()
    ]
    return notify_many(db, admin_ids, **kwargs)


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id, models.Notification.is_read == False)  # noqa: E712
        .count()
    )


def list_for_user(db: Session, user_id: int, limit: int = 50, unread_only: bool = False):
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)  # noqa: E712
    return query.order_by(models.Notification.created_at.desc()).limit(limit).all()


def mark_read(db: Session, user_id: int, notification_ids: Optional[List[int]] = None) -> int:
    """Marks the given notifications read, or all of the user's if none are given."""
    query = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False,  # noqa: E712
    )
    if notification_ids:
        query = query.filter(models.Notification.id.in_(notification_ids))

    updated = query.update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return updated
