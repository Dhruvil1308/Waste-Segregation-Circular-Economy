import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend import models, schemas, database

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = "hackathon_secret_key_demo_only"
    logger.warning("JWT_SECRET_KEY is not set - falling back to the insecure demo key.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300 # Longer for demo

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# bcrypt only hashes the first 72 bytes and raises on anything longer.
BCRYPT_MAX_BYTES = 72

# passlib is not used here: passlib 1.7.4 cannot read the version of bcrypt 5.x
# and fails outright on Python 3.14, so we call bcrypt directly.

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:BCRYPT_MAX_BYTES],
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Pre-migration rows stored the password in plain text, which is not a
        # valid bcrypt hash. Treat them as failed logins; run migrate_passwords.py.
        logger.warning("Rejected a login against a non-bcrypt password hash.")
        return False

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

def _require_role(current_user: models.User, role: str, label: str):
    if current_user.role != role:
        raise HTTPException(status_code=403, detail=f"Not authorized ({label} only)")
    return current_user

def get_current_generator(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.ROLE_GENERATOR, "Waste Generator")

def get_current_collector(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.ROLE_COLLECTOR, "Waste Collector")

def get_current_admin(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.ROLE_ADMIN, "Admin")

def get_current_collector_or_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in (models.ROLE_COLLECTOR, models.ROLE_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized (Collector or Admin only)")
    return current_user

# Backwards-compatible aliases for the pre-rename role names.
get_current_active_urban_user = get_current_generator
get_current_active_cooperative = get_current_collector
