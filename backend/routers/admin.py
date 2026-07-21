from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend import database, models, schemas, auth
from backend.services import escalation_service, notification_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=schemas.AdminOverview)
async def community_overview(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Headline numbers for the community dashboard."""
    def count_users(role):
        return db.query(models.User).filter(models.User.role == role).count()

    collected_kg = (
        db.query(func.sum(models.WasteListing.quantity_kg))
        .filter(models.WasteListing.status.in_([models.STATUS_COLLECTED, models.STATUS_PROCESSED]))
        .scalar()
    ) or 0.0

    return schemas.AdminOverview(
        total_generators=count_users(models.ROLE_GENERATOR),
        total_collectors=count_users(models.ROLE_COLLECTOR),
        total_requests=db.query(models.WasteListing).count(),
        open_requests=db.query(models.WasteListing)
            .filter(models.WasteListing.status == models.STATUS_REQUESTED).count(),
        escalated_requests=db.query(models.WasteListing)
            .filter(models.WasteListing.escalated == True,  # noqa: E712
                    models.WasteListing.status == models.STATUS_REQUESTED).count(),
        open_tickets=db.query(models.Ticket).filter(models.Ticket.status != "resolved").count(),
        escalated_tickets=db.query(models.Ticket)
            .filter(models.Ticket.escalated == True).count(),  # noqa: E712
        collected_kg=round(collected_kg, 2),
    )


@router.get("/alerts", response_model=List[schemas.NearbyRequestResponse])
async def escalation_alerts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector_or_admin),
):
    """
    Requests nobody answered - the highlighted alert list shown to admins and
    collectors so an ignored generator cannot stay ignored.
    """
    results = []
    for request in escalation_service.escalated_requests(db):
        payload = schemas.NearbyRequestResponse.model_validate(request, from_attributes=True)
        payload.generator_name = request.owner.name if request.owner else None
        results.append(payload)
    return results


@router.post("/recheck-escalations")
async def recheck_escalations(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Re-evaluates every generator's backlog; useful after bulk changes."""
    generators = db.query(models.User).filter(models.User.role == models.ROLE_GENERATOR).all()
    escalated = [g.id for g in generators if escalation_service.evaluate_generator(db, g)]
    return {"checked": len(generators), "escalated_generators": escalated}


@router.get("/users", response_model=List[schemas.UserResponse])
async def list_users(
    role: str = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin),
):
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    return query.order_by(models.User.id).all()


@router.get("/requests", response_model=List[schemas.NearbyRequestResponse])
async def list_all_requests(
    status_filter: str = None,
    limit: int = 200,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin),
):
    query = db.query(models.WasteListing)
    if status_filter:
        query = query.filter(models.WasteListing.status == status_filter)

    results = []
    for request in query.order_by(models.WasteListing.created_at.desc()).limit(limit).all():
        payload = schemas.NearbyRequestResponse.model_validate(request, from_attributes=True)
        payload.generator_name = request.owner.name if request.owner else None
        results.append(payload)
    return results


@router.post("/assign/{listing_id}/{collector_id}")
async def assign_collector(
    listing_id: int,
    collector_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Admin override: hand an unanswered request directly to a collection team."""
    listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Request not found")

    collector = db.query(models.User).filter(
        models.User.id == collector_id, models.User.role == models.ROLE_COLLECTOR
    ).first()
    if not collector:
        raise HTTPException(status_code=404, detail="Collector not found")
    if listing.status != models.STATUS_REQUESTED:
        raise HTTPException(status_code=400, detail=f"Request is already '{listing.status}'")

    from datetime import datetime
    listing.collector_id = collector.id
    listing.status = models.STATUS_ACCEPTED
    listing.accepted_at = datetime.utcnow()
    listing.escalated = False

    db.add(models.JourneyStep(
        waste_listing_id=listing.id,
        step_name="Assigned",
        description=f"Assigned to {collector.name or collector.username} by admin.",
    ))
    db.commit()

    notification_service.notify(
        db, user_id=collector.id, type=notification_service.NEW_REQUEST,
        title="A pickup was assigned to you",
        message=f"Admin assigned request #{listing.id} at {listing.location}.",
        listing_id=listing.id,
    )
    notification_service.notify(
        db, user_id=listing.user_id, type=notification_service.REQUEST_ACCEPTED,
        title="Your pickup was assigned",
        message=f"{collector.name or collector.username} will collect it shortly.",
        listing_id=listing.id,
    )

    if listing.owner:
        escalation_service.evaluate_generator(db, listing.owner)

    return {"message": "Collector assigned.", "listing_id": listing.id, "collector_id": collector.id}
