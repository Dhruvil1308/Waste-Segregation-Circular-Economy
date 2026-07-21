from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    username: str
    role: str
    location: str
    phone_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class UserCreate(UserBase):
    password: str
    service_radius_km: Optional[float] = 5.0

class UserResponse(UserBase):
    id: int
    service_radius_km: Optional[float] = None
    class Config:
        from_attributes = True

# --- Waste Schemas ---
class WasteBase(BaseModel):
    waste_type: str
    category: Optional[str] = None
    quantity_kg: Optional[float] = None
    image_url: Optional[str] = None
    location: str
    phone_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class WasteCreate(WasteBase):
    pass

class WasteAnalysisResponse(BaseModel):
    waste_type: str
    category: str
    estimated_quantity_kg: float
    description: str
    recyclable: bool = False
    handling_note: str = ""
    image_url: Optional[str] = None

class JourneyStepResponse(BaseModel):
    step_name: str
    description: str
    timestamp: datetime
    class Config:
        from_attributes = True

class WasteResponse(WasteBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    pickup_time: Optional[datetime] = None
    collector_id: Optional[int] = None
    accepted_at: Optional[datetime] = None
    collected_at: Optional[datetime] = None
    escalated: bool = False
    journey_steps: List[JourneyStepResponse] = []
    class Config:
        from_attributes = True

class NearbyRequestResponse(WasteResponse):
    """A request as seen by a collector, with how far away it is."""
    distance_km: Optional[float] = None
    generator_name: Optional[str] = None

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: Optional[str] = None
    listing_id: Optional[int] = None
    ticket_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class MarkReadRequest(BaseModel):
    notification_ids: Optional[List[int]] = None

# --- Ticket Schemas ---
class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    listing_id: Optional[int] = None
    category: Optional[str] = None
    image_url: Optional[str] = None

class TicketUpdate(BaseModel):
    status: str  # acknowledged | resolved
    resolution_note: Optional[str] = None

class TicketResponse(BaseModel):
    id: int
    generator_id: int
    listing_id: Optional[int] = None
    subject: str
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    escalated: bool = False
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    generator_name: Optional[str] = None
    class Config:
        from_attributes = True

# --- Tracking Schemas ---
class TrackingResponse(BaseModel):
    """Public, token-addressed view of a pickup's chain of custody."""
    id: int
    status: str
    category: Optional[str] = None
    waste_type: str
    quantity_kg: Optional[float] = None
    location: str
    created_at: datetime
    accepted_at: Optional[datetime] = None
    collected_at: Optional[datetime] = None
    escalated: bool = False
    generator_name: Optional[str] = None
    collector_name: Optional[str] = None
    journey_steps: List[JourneyStepResponse] = []

# --- Admin Schemas ---
class AdminOverview(BaseModel):
    total_generators: int
    total_collectors: int
    total_requests: int
    open_requests: int
    escalated_requests: int
    open_tickets: int
    escalated_tickets: int
    collected_kg: float

# --- Match Schemas ---
class MatchResponse(BaseModel):
    match_score: float
    listing_id: int
    # In a real scenario, we'd include more cooperative details here
    recommended_action: str = "Accept this listing?" 

# --- Impact Schemas ---
class ImpactSummary(BaseModel):
    total_waste_kg: float
    total_co2_saved: float
    total_income_generated: float
