"""
Escalation: a generator whose requests nobody answers must not be ignored silently.

Rule (chosen with the product owner): once a generator has ESCALATION_THRESHOLD
requests still sitting unaccepted, every one of those requests is flagged and the
admin plus all collectors are alerted, so the backlog surfaces instead of rotting.
"""
from typing import List

from sqlalchemy.orm import Session

from backend import models
from backend.services import notification_service


def unanswered_requests(db: Session, generator_id: int) -> List[models.WasteListing]:
    return (
        db.query(models.WasteListing)
        .filter(
            models.WasteListing.user_id == generator_id,
            models.WasteListing.status == models.STATUS_REQUESTED,
        )
        .order_by(models.WasteListing.created_at)
        .all()
    )


def evaluate_generator(db: Session, generator: models.User) -> bool:
    """
    Re-checks one generator's backlog and syncs the escalated flags.

    Returns True if they are currently escalated. Idempotent: alerts are only sent
    on the transition into escalation, so polling clients cannot spam the admin.
    """
    pending = unanswered_requests(db, generator.id)
    is_escalated = len(pending) >= models.ESCALATION_THRESHOLD

    if not is_escalated:
        # Backlog cleared - drop stale flags so the alert disappears on its own.
        changed = False
        for request in pending:
            if request.escalated:
                request.escalated = False
                changed = True
        if changed:
            db.commit()
        return False

    newly_escalated = [request for request in pending if not request.escalated]
    if not newly_escalated:
        return True  # already escalated, nothing more to announce

    for request in pending:
        request.escalated = True
    db.commit()

    title = f"{generator.name or generator.username} has {len(pending)} unanswered pickups"
    message = (
        f"No collector has responded to {len(pending)} requests from "
        f"{generator.name or generator.username} ({generator.location or 'location unknown'}). "
        "Please assign a team."
    )

    notification_service.notify_admins(
        db,
        type=notification_service.ESCALATION,
        title=title,
        message=message,
        listing_id=pending[0].id,
    )

    collector_ids = [
        user.id for user in db.query(models.User).filter(models.User.role == models.ROLE_COLLECTOR).all()
    ]
    notification_service.notify_many(
        db,
        collector_ids,
        type=notification_service.ESCALATION,
        title="Escalated pickup needs a team",
        message=message,
        listing_id=pending[0].id,
    )

    return True


def escalated_requests(db: Session) -> List[models.WasteListing]:
    """Every currently-escalated request, newest first - powers the admin alert panel."""
    return (
        db.query(models.WasteListing)
        .filter(
            models.WasteListing.escalated == True,  # noqa: E712
            models.WasteListing.status == models.STATUS_REQUESTED,
        )
        .order_by(models.WasteListing.created_at.desc())
        .all()
    )
