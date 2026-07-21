from fastapi import APIRouter
from backend import database, models
from fastapi import Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/debug")

@router.get("/users")
def get_all_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).all()
