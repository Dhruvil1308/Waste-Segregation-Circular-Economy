from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import database, models, schemas, auth
from backend.services import notification_service

router = APIRouter(prefix="/tickets", tags=["tickets"])

VALID_STATUSES = ("open", "acknowledged", "resolved")


def _to_response(ticket: models.Ticket) -> schemas.TicketResponse:
    payload = schemas.TicketResponse.model_validate(ticket, from_attributes=True)
    payload.generator_name = ticket.generator.name if ticket.generator else None
    return payload


@router.post("/", response_model=schemas.TicketResponse)
async def raise_ticket(
    ticket: schemas.TicketCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_generator),
):
    """
    Raise a complaint, optionally about a specific pickup and with a photo whose
    category came from /waste/analyze.
    """
    if ticket.listing_id:
        listing = db.query(models.WasteListing).filter(models.WasteListing.id == ticket.listing_id).first()
        if not listing:
            raise HTTPException(status_code=404, detail="Referenced request not found")
        if listing.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="That request belongs to another user")

    db_ticket = models.Ticket(
        generator_id=current_user.id,
        listing_id=ticket.listing_id,
        subject=ticket.subject,
        description=ticket.description,
        category=ticket.category,
        image_url=ticket.image_url,
        status="open",
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    # Complaints go to everyone who can act on them.
    recipients = [
        user.id for user in db.query(models.User)
        .filter(models.User.role.in_([models.ROLE_COLLECTOR, models.ROLE_ADMIN]))
        .all()
    ]
    notification_service.notify_many(
        db,
        recipients,
        type=notification_service.TICKET_UPDATE,
        title=f"New complaint: {db_ticket.subject}",
        message=f"Raised by {current_user.name or current_user.username}.",
        ticket_id=db_ticket.id,
    )

    return _to_response(db_ticket)


@router.get("/my", response_model=List[schemas.TicketResponse])
async def my_tickets(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_generator),
):
    tickets = (
        db.query(models.Ticket)
        .filter(models.Ticket.generator_id == current_user.id)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    return [_to_response(ticket) for ticket in tickets]


@router.get("/", response_model=List[schemas.TicketResponse])
async def all_tickets(
    status_filter: str = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector_or_admin),
):
    """Queue for collectors and admins. Escalated tickets sort to the top."""
    query = db.query(models.Ticket)
    if status_filter:
        query = query.filter(models.Ticket.status == status_filter)

    tickets = query.order_by(
        models.Ticket.escalated.desc(),
        models.Ticket.created_at.desc(),
    ).all()
    return [_to_response(ticket) for ticket in tickets]


@router.patch("/{ticket_id}", response_model=schemas.TicketResponse)
async def update_ticket(
    ticket_id: int,
    update: schemas.TicketUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector_or_admin),
):
    if update.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")

    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = update.status
    if update.resolution_note:
        ticket.resolution_note = update.resolution_note

    if update.status == "resolved":
        ticket.resolved_at = datetime.utcnow()
        ticket.resolved_by_id = current_user.id
        ticket.escalated = False  # answered, so the alert clears

    db.commit()
    db.refresh(ticket)

    notification_service.notify(
        db,
        user_id=ticket.generator_id,
        type=notification_service.TICKET_UPDATE,
        title=f"Your complaint was {update.status}",
        message=update.resolution_note or f"'{ticket.subject}' is now {update.status}.",
        ticket_id=ticket.id,
    )

    return _to_response(ticket)
