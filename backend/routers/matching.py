from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend import database, models, auth
from backend.services.matching_service import MatchingService

router = APIRouter(
    prefix="/match",
    tags=["matching"]
)

@router.get("/recommendations/{listing_id}")
async def get_match_recommendations(
    listing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get Cooperative recommendations for a specific Listing.
    Uses Rule-Based matching (MVP).
    """
    recommendations = MatchingService.get_recommendations(listing_id, db)
    return {"listing_id": listing_id, "recommendations": recommendations}
