from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend import database, models, auth, schemas
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend import database, models, auth, schemas
from datetime import timedelta

router = APIRouter()

@router.post("/signup", response_model=schemas.Token)
async def signup(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Reject unknown roles outright - an unrecognised role passes every role guard
    # and leaves the account unable to do anything.
    if user.role not in models.ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of {', '.join(models.ROLES)}"
        )


    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        password_hash=hashed_password,
        name=user.name,
        role=user.role,
        location=user.location,
        phone_number=user.phone_number,
        latitude=user.latitude,
        longitude=user.longitude,
        service_radius_km=user.service_radius_km or 5.0
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Auto-login
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": db_user.username, "role": db_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
