from pydantic import BaseModel, Field
from typing import Dict, Optional, Any, List
from uuid import uuid4

class ChatbotSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: int
    user_role: str              # "urban" or "cooperative"
    intent: str                 # "GIVE_WASTE" | "FIND_WASTE"
    step: int = 1               # Legacy field (can keep for now)
    history: List[Dict[str, str]] = [] # Stores [{"role": "user", "content": "..."}]
    answers: Dict[str, Any] = {} 
    completed: bool = False
