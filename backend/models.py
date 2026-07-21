from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

# --- Role vocabulary ---
ROLE_GENERATOR = "generator"   # households / businesses producing waste
ROLE_COLLECTOR = "collector"   # SHG collection teams
ROLE_ADMIN = "admin"           # community administrator
ROLES = (ROLE_GENERATOR, ROLE_COLLECTOR, ROLE_ADMIN)

# --- Pickup request lifecycle ---
STATUS_REQUESTED = "requested"   # waiting for a collector to accept
STATUS_ACCEPTED = "accepted"     # a collector claimed it
STATUS_EN_ROUTE = "en_route"     # collector is on the way
STATUS_COLLECTED = "collected"   # QR scanned at the doorstep
STATUS_PROCESSED = "processed"   # processed at the facility
REQUEST_STATUSES = (STATUS_REQUESTED, STATUS_ACCEPTED, STATUS_EN_ROUTE, STATUS_COLLECTED, STATUS_PROCESSED)

# A generator with this many unaccepted requests gets escalated to Admin.
ESCALATION_THRESHOLD = 3


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    role = Column(String)  # see ROLES
    location = Column(String) # Human-readable address
    phone_number = Column(String, nullable=True) # For auto-fill
    # Basic auth fields (demo only)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

    # Geo, used to route requests to nearby collectors
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    service_radius_km = Column(Float, default=5.0)  # collectors only

    listings = relationship("WasteListing", back_populates="owner", foreign_keys="WasteListing.user_id")
    matches = relationship("Match", back_populates="cooperative")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")

class WasteListing(Base):
    """A pickup request raised by a generator."""
    __tablename__ = "waste_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    waste_type = Column(String) # "veg", "food", "mixed"
    category = Column(String, nullable=True) # AI-detected: plastic, organic, paper, metal, glass, ewaste, mixed
    quantity_kg = Column(Float, nullable=True)
    image_url = Column(String, nullable=True)
    location = Column(String) # Can differentiate from user location if needed
    phone_number = Column(String, nullable=True) # Contact for this specific listing
    created_at = Column(DateTime, default=datetime.utcnow)
    pickup_time = Column(DateTime, nullable=True) # Scheduled pickup time
    status = Column(String, default=STATUS_REQUESTED) # see REQUEST_STATUSES

    # Geo of the pickup point itself
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Assignment + chain of custody
    collector_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    collected_at = Column(DateTime, nullable=True)
    qr_token = Column(String, unique=True, index=True, nullable=True) # scanned at the doorstep
    escalated = Column(Boolean, default=False) # no collector responded

    owner = relationship("User", back_populates="listings", foreign_keys=[user_id])
    collector = relationship("User", foreign_keys=[collector_id])
    match_record = relationship("Match", back_populates="listing", uselist=False)
    journey_steps = relationship("JourneyStep", back_populates="listing")


class Ticket(Base):
    """A complaint raised by a generator, optionally about a specific request."""
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    generator_id = Column(Integer, ForeignKey("users.id"))
    listing_id = Column(Integer, ForeignKey("waste_listings.id"), nullable=True)
    subject = Column(String)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)   # AI-detected from the attached photo
    image_url = Column(String, nullable=True)
    status = Column(String, default="open")    # open, acknowledged, resolved
    escalated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_note = Column(String, nullable=True)

    generator = relationship("User", foreign_keys=[generator_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    listing = relationship("WasteListing")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String)  # new_request, request_accepted, en_route, collected, escalation, ticket_update
    title = Column(String)
    message = Column(String, nullable=True)
    listing_id = Column(Integer, ForeignKey("waste_listings.id"), nullable=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("waste_listings.id"))
    cooperative_id = Column(Integer, ForeignKey("users.id")) # The cooperative who accepted it
    match_score = Column(Float) # 0-100 score
    matched_at = Column(DateTime, default=datetime.utcnow)

    listing = relationship("WasteListing", back_populates="match_record")
    cooperative = relationship("User", back_populates="matches")

class ImpactLog(Base):
    __tablename__ = "impact_logs"

    id = Column(Integer, primary_key=True, index=True)
    waste_listing_id = Column(Integer, ForeignKey("waste_listings.id"))
    waste_kg = Column(Float)
    co2_saved = Column(Float)
    income_generated = Column(Float)
    logged_at = Column(DateTime, default=datetime.utcnow)

class JourneyStep(Base):
    __tablename__ = "journey_steps"
    id = Column(Integer, primary_key=True, index=True)
    waste_listing_id = Column(Integer, ForeignKey("waste_listings.id"))
    step_name = Column(String) # "Listed", "Accepted", "Collected", "Processed"
    description = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    listing = relationship("WasteListing", back_populates="journey_steps")

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    balance = Column(Float, default=0.0) # Green Credits
    badges = Column(String, default="[]") # JSON string of badges
    
    user = relationship("User", back_populates="wallet")
    transactions = relationship("CreditTransaction", back_populates="wallet")

class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"))
    amount = Column(Float)
    transaction_type = Column(String) # "EARN", "SPEND"
    reason = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    wallet = relationship("Wallet", back_populates="transactions")
