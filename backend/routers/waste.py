import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend import database, models, schemas, auth
from backend.database import PROJECT_ROOT
from backend.services.impact_service import ImpactService
from backend.services import geo_service, qr_service, notification_service, escalation_service
from backend.chatbot.ai_client import analyze_image

router = APIRouter(
    prefix="/waste",
    tags=["waste"]
)

UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _save_upload(contents: bytes, content_type: str) -> Optional[str]:
    """
    Persists the uploaded image and returns its public path, or None if the type
    is not a supported image. Stored server-side because the browser's blob: URL
    is scoped to the uploading tab and is meaningless to any other client.
    """
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if not extension:
        return None

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    return f"/uploads/{filename}"


@router.post("/analyze", response_model=schemas.WasteAnalysisResponse)
async def analyze_waste_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_urban_user)
):
    """
    Upload an image to get AI-detected waste type and estimated weight.

    Also stores the image and returns an absolute image_url the client should send
    back to /waste/create, so the picture survives for every other user.

    Note: if the AI call fails this deliberately returns MOCK_ANALYSIS rather than
    erroring, so the demo flow keeps working. Mock results are tagged "[MOCK]" in
    the description - check for that if you need to know the analysis was real.
    """
    contents = await file.read()
    analysis = analyze_image(contents, file.content_type)

    path = _save_upload(contents, file.content_type)
    # Absolute, because the frontend is served from a different origin than the API.
    analysis["image_url"] = str(request.base_url).rstrip("/") + path if path else None

    return analysis

@router.post("/create", response_model=schemas.WasteResponse)
async def create_waste_listing(
    waste: schemas.WasteCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_urban_user)
):
    """
    Create a new organic waste listing (Urban Users only).
    """
    final_quantity = waste.quantity_kg if waste.quantity_kg is not None else 0.0

    # Fall back to the generator's saved home coordinates when the request has none.
    latitude = waste.latitude if waste.latitude is not None else current_user.latitude
    longitude = waste.longitude if waste.longitude is not None else current_user.longitude

    db_waste = models.WasteListing(
        user_id=current_user.id,
        waste_type=waste.waste_type,
        category=waste.category,
        quantity_kg=final_quantity,
        image_url=waste.image_url,
        location=waste.location,
        phone_number=waste.phone_number,
        latitude=latitude,
        longitude=longitude,
        status=models.STATUS_REQUESTED,
        qr_token=qr_service.generate_token(),
    )
    db.add(db_waste)

    # Auto-update the user's phone so it can be pre-filled next time.
    if waste.phone_number:
        current_user.phone_number = waste.phone_number
        db.add(current_user)

    db.commit()
    db.refresh(db_waste)

    db.add(models.JourneyStep(
        waste_listing_id=db_waste.id,
        step_name="Requested",
        description="Pickup requested by the generator."
    ))
    db.commit()

    # Alert the collectors whose service area covers this pickup.
    nearby = geo_service.find_nearby_collectors(db, latitude, longitude)
    if nearby:
        notification_service.notify_many(
            db,
            [collector.id for collector in nearby],
            type=notification_service.NEW_REQUEST,
            title=f"New {db_waste.category or db_waste.waste_type} pickup nearby",
            message=f"{final_quantity} kg at {db_waste.location}. Tap to accept.",
            listing_id=db_waste.id,
        )

    # A fresh request may push this generator over the unanswered threshold.
    escalation_service.evaluate_generator(db, current_user)

    db.refresh(db_waste)
    return db_waste

@router.get("/my", response_model=List[schemas.WasteResponse])
async def read_my_listings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get all listings created by the current user.
    """
    return db.query(models.WasteListing).filter(models.WasteListing.user_id == current_user.id).all()

@router.get("/available", response_model=List[schemas.NearbyRequestResponse])
async def read_available_listings(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector)
):
    """
    Open pickup requests within this collector's service radius, nearest first.

    Requests without coordinates are still shown (with distance_km = null) so
    older or GPS-less submissions do not silently disappear from the queue.
    """
    open_requests = (
        db.query(models.WasteListing)
        .filter(models.WasteListing.status == models.STATUS_REQUESTED)
        .all()
    )

    radius = current_user.service_radius_km or geo_service.DEFAULT_RADIUS_KM
    visible = []
    for request in open_requests:
        distance = geo_service.distance_between(
            current_user.latitude, current_user.longitude, request.latitude, request.longitude
        )
        if distance is not None and distance > radius:
            continue
        visible.append((distance, request))

    # Unknown distances sort last, but are never dropped.
    visible.sort(key=lambda pair: (pair[0] is None, pair[0] if pair[0] is not None else 0))

    results = []
    for distance, request in visible[skip: skip + limit]:
        payload = schemas.NearbyRequestResponse.model_validate(request, from_attributes=True)
        payload.distance_km = round(distance, 2) if distance is not None else None
        payload.generator_name = request.owner.name if request.owner else None
        results.append(payload)

    return results


@router.get("/pickups", response_model=List[schemas.WasteResponse])
async def read_partner_pickups(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector)
):
    """Requests this collector has accepted, in any state."""
    return (
        db.query(models.WasteListing)
        .filter(models.WasteListing.collector_id == current_user.id)
        .order_by(models.WasteListing.accepted_at.desc())
        .all()
    )


class AcceptRequest(schemas.BaseModel):
    pickup_time: Optional[datetime] = None


@router.post("/accept/{listing_id}")
async def accept_waste_listing(
    listing_id: int,
    request: AcceptRequest = AcceptRequest(),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector)
):
    """Collector claims an open request; the generator is told immediately."""
    listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Request not found")
    if listing.status != models.STATUS_REQUESTED:
        raise HTTPException(status_code=400, detail="This request has already been accepted")

    listing.status = models.STATUS_ACCEPTED
    listing.collector_id = current_user.id
    listing.accepted_at = datetime.utcnow()
    listing.pickup_time = request.pickup_time
    listing.escalated = False  # answered, so it no longer counts against the generator

    db.add(models.Match(listing_id=listing.id, cooperative_id=current_user.id, match_score=100.0))
    db.add(models.JourneyStep(
        waste_listing_id=listing.id,
        step_name="Accepted",
        description=f"Accepted by {current_user.name or current_user.username}."
    ))
    db.commit()

    notification_service.notify(
        db,
        user_id=listing.user_id,
        type=notification_service.REQUEST_ACCEPTED,
        title="Your pickup was accepted",
        message=f"{current_user.name or current_user.username} will collect it shortly.",
        listing_id=listing.id,
    )

    # Their backlog shrank, so the escalation flag may no longer apply.
    if listing.owner:
        escalation_service.evaluate_generator(db, listing.owner)

    return {
        "message": "Pickup accepted. The generator has been notified.",
        "status": listing.status,
        "listing_id": listing.id,
    }


@router.post("/en-route/{listing_id}")
async def mark_en_route(
    listing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector)
):
    """Collector is on the way - the generator sees a live status change."""
    listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Request not found")
    if listing.collector_id != current_user.id:
        raise HTTPException(status_code=403, detail="This pickup is assigned to another collector")
    if listing.status != models.STATUS_ACCEPTED:
        raise HTTPException(status_code=400, detail=f"Cannot start travel from status '{listing.status}'")

    listing.status = models.STATUS_EN_ROUTE
    db.add(models.JourneyStep(
        waste_listing_id=listing.id,
        step_name="En route",
        description=f"{current_user.name or current_user.username} is on the way."
    ))
    db.commit()

    notification_service.notify(
        db,
        user_id=listing.user_id,
        type=notification_service.EN_ROUTE,
        title="Your collector is on the way",
        message="Have your QR code ready for scanning at handover.",
        listing_id=listing.id,
    )

    return {"message": "Marked en route.", "status": listing.status}


class ScanRequest(schemas.BaseModel):
    qr_token: str


@router.post("/collect")
async def collect_by_qr(
    scan: ScanRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_collector)
):
    """
    Close the loop by scanning the generator's QR at handover.

    The token only ever appears on the generator's screen, so a successful scan
    is evidence the collector was physically present.
    """
    listing = qr_service.find_by_token(db, scan.qr_token)
    if not listing:
        raise HTTPException(status_code=404, detail="Unrecognised QR code")
    if listing.collector_id != current_user.id:
        raise HTTPException(status_code=403, detail="This pickup is assigned to another collector")
    if listing.status not in (models.STATUS_ACCEPTED, models.STATUS_EN_ROUTE):
        raise HTTPException(status_code=400, detail=f"Cannot collect from status '{listing.status}'")

    listing.status = models.STATUS_COLLECTED
    listing.collected_at = datetime.utcnow()
    db.add(models.JourneyStep(
        waste_listing_id=listing.id,
        step_name="Collected",
        description=f"QR verified at handover by {current_user.name or current_user.username}."
    ))
    db.commit()

    # Credits and impact are awarded on verified collection.
    result = ImpactService.log_pickup(db, listing)

    notification_service.notify(
        db,
        user_id=listing.user_id,
        type=notification_service.COLLECTED,
        title="Pickup collected",
        message="Thanks! Your green credits have been added.",
        listing_id=listing.id,
    )

    return {
        "message": "Collection confirmed via QR.",
        "status": listing.status,
        "listing_id": listing.id,
        **result,
    }

@router.post("/confirm-pickup/{listing_id}")
async def confirm_pickup(
    listing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_generator)
):
    """
    Manual fallback: the generator confirms collection themselves.

    The primary path is the collector scanning the QR at handover (/waste/collect);
    this exists for when scanning is not possible.
    """
    listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Request not found")

    if listing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this pickup")

    if listing.status not in (models.STATUS_ACCEPTED, models.STATUS_EN_ROUTE):
        raise HTTPException(status_code=400, detail=f"Cannot confirm from status '{listing.status}'")

    listing.status = models.STATUS_COLLECTED
    listing.collected_at = datetime.utcnow()
    db.add(models.JourneyStep(
        waste_listing_id=listing.id,
        step_name="Collected",
        description="Collection confirmed by the generator."
    ))
    db.commit()

    result = ImpactService.log_pickup(db, listing)

    if listing.collector_id:
        notification_service.notify(
            db,
            user_id=listing.collector_id,
            type=notification_service.COLLECTED,
            title="Pickup confirmed by the generator",
            message=f"Request #{listing.id} was marked collected.",
            listing_id=listing.id,
        )

    return {"message": "Pickup confirmed! Green Credits awarded.", **result}


@router.get("/qr/{listing_id}")
async def get_pickup_qr(
    listing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    The QR the generator shows at handover, as inline SVG.

    Only the owner (or an admin) can fetch it - if collectors could read the token
    they could mark pickups collected without ever showing up.
    """
    listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Request not found")
    if listing.user_id != current_user.id and current_user.role != models.ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to view this QR code")

    if not listing.qr_token:
        listing.qr_token = qr_service.generate_token()
        db.commit()

    return {
        "listing_id": listing.id,
        "qr_token": listing.qr_token,
        "svg": qr_service.render_svg(listing.qr_token),
    }


@router.get("/track/{qr_token}", response_model=schemas.TrackingResponse)
async def track_pickup(qr_token: str, db: Session = Depends(database.get_db)):
    """
    Token-addressed tracking, deliberately public so a generator can follow a
    pickup without logging in. The token is unguessable and read-only.
    """
    listing = qr_service.find_by_token(db, qr_token)
    if not listing:
        raise HTTPException(status_code=404, detail="Unrecognised tracking code")

    return schemas.TrackingResponse(
        id=listing.id,
        status=listing.status,
        category=listing.category,
        waste_type=listing.waste_type,
        quantity_kg=listing.quantity_kg,
        location=listing.location,
        created_at=listing.created_at,
        accepted_at=listing.accepted_at,
        collected_at=listing.collected_at,
        escalated=bool(listing.escalated),
        generator_name=listing.owner.name if listing.owner else None,
        collector_name=listing.collector.name if listing.collector else None,
        journey_steps=listing.journey_steps,
    )
