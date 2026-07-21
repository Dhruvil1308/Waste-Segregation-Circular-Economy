import os
import sys

# Allow running this file directly (python tests/verify_listings.py) by putting
# the project root on the path so `backend` is importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models

def verify_listings():
    db = SessionLocal()
    try:
        listings = db.query(models.WasteListing).all()
        print(f"Total Listings: {len(listings)}")
        for l in listings:
            print(f"ID: {l.id} | Type: {l.waste_type} | Qty: {l.quantity_kg} | Status: {l.status} | UserID: {l.user_id}")
            
        print("-" * 30)
        users = db.query(models.User).all()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f"ID: {u.id} | Name: {u.name} | Role: {u.role} | Username: {u.username}")

    finally:
        db.close()

if __name__ == "__main__":
    verify_listings()
