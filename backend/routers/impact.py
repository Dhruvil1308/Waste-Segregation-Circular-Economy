from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import database, models, auth, schemas

router = APIRouter(
    prefix="/impact",
    tags=["impact"]
)

@router.get("/summary", response_model=schemas.ImpactSummary)
async def get_total_impact(
    db: Session = Depends(database.get_db)
    # Open to all authenticated users for now
):
    """
    Get total environmental and social impact summary.
    """
    stats = db.query(
        func.sum(models.ImpactLog.waste_kg).label("total_waste"),
        func.sum(models.ImpactLog.co2_saved).label("total_co2"),
        func.sum(models.ImpactLog.income_generated).label("total_income")
    ).first()

    return {
        "total_waste_kg": stats.total_waste or 0.0,
        "total_co2_saved": stats.total_co2 or 0.0,
        "total_income_generated": stats.total_income or 0.0
    }

@router.get("/my", response_model=schemas.ImpactSummary)
async def get_my_impact(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get impact stats for the logged-in user (Urban or Cooperative).
    """
    # Filter by listings owned (urban) OR matches (coop)?
    # Simplified: Link ImpactLog -> WasteListing -> User
    # Join ImpactLog, WasteListing
    stats = db.query(
        func.sum(models.ImpactLog.waste_kg).label("total_waste"),
        func.sum(models.ImpactLog.co2_saved).label("total_co2"),
        func.sum(models.ImpactLog.income_generated).label("total_income")
    ).join(models.WasteListing).filter(models.WasteListing.user_id == current_user.id).first()
    
    return {
        "total_waste_kg": stats.total_waste or 0.0,
        "total_co2_saved": stats.total_co2 or 0.0,
        "total_income_generated": stats.total_income or 0.0
    }

@router.get("/partner-stats")
async def get_partner_stats(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get real-time stats for the Partner Dashboard.
    """
    # 1. Available Batches (Marketplace)
    available_batches = db.query(models.WasteListing).filter(models.WasteListing.status == "available").count()
    
    # 2. My Capacity / Processed Waste (Collected by this Partner)
    # Join Match table to find listings claimed by this user.
    # The only statuses the API ever writes are available -> scheduled -> collected,
    # so "collected" is what actually counts as processed here.
    processed_query = db.query(func.sum(models.WasteListing.quantity_kg))\
        .join(models.Match, models.Match.listing_id == models.WasteListing.id)\
        .filter(models.Match.cooperative_id == current_user.id)\
        .filter(models.WasteListing.status == "collected")
        
    processed_kg = processed_query.scalar() or 0.0
    
    # 3. Earnings (Simplified: 10 INR per kg processed)
    estimated_earnings = processed_kg * 10
    
    return {
        "available_batches": available_batches,
        "processed_kg": processed_kg,
        "capacity_kg": 1000.0, # Hardcoded max capacity for MVP
        "earnings": estimated_earnings
    }

@router.get("/history")
async def get_revenue_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_cooperative)
):
    """
    Get detailed impact/revenue history for the partner.
    """
    # Join ImpactLog -> WasteListing -> Match -> User(Partner)
    # We want logs for listings matched to this user
    
    # Select ImpactLog + WasteListing data
    logs = db.query(models.ImpactLog, models.WasteListing)\
        .join(models.WasteListing, models.WasteListing.id == models.ImpactLog.waste_listing_id)\
        .join(models.Match, models.Match.listing_id == models.WasteListing.id)\
        .filter(models.Match.cooperative_id == current_user.id)\
        .order_by(models.ImpactLog.logged_at.desc())\
        .all()
        
    # Transform to simple list
    history = []
    for log, listing in logs:
        history.append({
            "id": log.id,
            "date": log.logged_at,
            "waste_type": listing.waste_type,
            "quantity_kg": log.waste_kg,
            "revenue": log.income_generated,
            "co2_saved": log.co2_saved
        })
        
    return history
