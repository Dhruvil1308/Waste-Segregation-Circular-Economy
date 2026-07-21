import os
import sys

# Allow running this file directly (python backend/seed_data.py) by putting the
# project root on the path so `backend` is importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import models, database
from backend.auth import get_password_hash
from backend.services.impact_service import ImpactService

# All demo accounts share this password.
DEMO_PASSWORD = "pass123"

def seed_data():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=database.engine)

    db = database.SessionLocal()
    
    
    # Check if data exists
    if db.query(models.User).first():
        print("Data already exists. Skipping seed.")
        db.close()
        return

    print("Seeding Users...")
    # Waste Generators (coordinates matter: they drive nearby-collector routing)
    urban1 = models.User(
        name="Urban Generator 1",
        username="urban1",
        role="generator",
        location="Indiranagar, Bangalore",
        latitude=12.9784, longitude=77.6408,
        password_hash=get_password_hash(DEMO_PASSWORD)
    )
    urban2 = models.User(
        name="Urban Generator 2",
        username="urban2",
        role="generator",
        location="Koramangala, Bangalore",
        latitude=12.9352, longitude=77.6245,
        password_hash=get_password_hash(DEMO_PASSWORD)
    )

    # Collection teams (SHGs)
    coop1 = models.User(
        name="Rural Women Coop A",
        username="coop1",
        role="collector",
        location="Ramnagara, Rural",
        latitude=12.7209, longitude=77.2800,  # ~45 km out: deliberately out of range
        service_radius_km=5.0,
        password_hash=get_password_hash(DEMO_PASSWORD)
    )
    coop2 = models.User(
        name="Rural Women Coop B",
        username="coop2",
        role="collector",
        location="Indiranagar, Bangalore", # Intentionally close for matching
        latitude=12.9784, longitude=77.6408,
        service_radius_km=8.0,             # covers both generators above
        password_hash=get_password_hash(DEMO_PASSWORD)
    )

    admin1 = models.User(
        name="Community Admin",
        username="admin",
        role="admin",
        location="Bangalore",
        latitude=12.9716, longitude=77.5946,
        password_hash=get_password_hash(DEMO_PASSWORD)
    )

    db.add_all([urban1, urban2, coop1, coop2, admin1])
    db.commit()
    
    # Refresh to get IDs
    db.refresh(urban1)
    db.refresh(urban2)
    db.refresh(coop1) # Rural
    db.refresh(coop2) # Nearby

    print("Seeding Waste Listings...")
    waste1 = models.WasteListing(
        user_id=urban1.id,
        waste_type="veg",
        quantity_kg=50.0,
        location="Indiranagar, Bangalore",
        status="available"
    )
    waste2 = models.WasteListing(
        user_id=urban2.id,
        waste_type="mixed",
        quantity_kg=120.0,
        location="Koramangala, Bangalore",
        status="available"
    )
    # create an accepted match
    waste3 = models.WasteListing(
        user_id=urban1.id,
        waste_type="food",
        quantity_kg=200.0,
        location="Indiranagar, Bangalore",
        status="scheduled"
    )
    db.add_all([waste1, waste2, waste3])
    db.commit()
    
    db.refresh(waste3)

    print("Seeding Matches & Impact...")
    # Matches
    match1 = models.Match(
        listing_id=waste3.id,
        cooperative_id=coop2.id,
        match_score=95.0
    )
    db.add(match1)
    
    # Impact
    co2, income = ImpactService.calculate_impact(waste3.quantity_kg)
    impact1 = models.ImpactLog(
        waste_listing_id=waste3.id,
        waste_kg=waste3.quantity_kg,
        co2_saved=co2,
        income_generated=income
    )
    db.add(impact1)
    db.commit()

    print("Seeding Complete!")
    db.close()

if __name__ == "__main__":
    seed_data()
