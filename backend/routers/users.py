from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from backend import database, models, schemas, auth

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.get("/", response_model=List[schemas.UserResponse])
async def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users
