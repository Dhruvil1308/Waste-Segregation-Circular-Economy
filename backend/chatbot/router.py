
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend import database, auth, models
from .service import ChatbotService

router = APIRouter(
    prefix="/chatbot",
    tags=["chatbot"]
)

# --- Request Schemas ---
class StartRequest(BaseModel):
    intent: str
    user_role: str

class AnswerRequest(BaseModel):
    session_id: str
    text_input: str

class CompleteRequest(BaseModel):
    session_id: str

# --- Endpoints ---

@router.post("/start")
async def start_chatbot(
    request: StartRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Start a new chatbot session.
    """
    # Validate Role using Auth (Security Best Practice)
    if request.user_role != current_user.role:
        raise HTTPException(
            status_code=400, 
            detail=f"Role mismatch. Token says {current_user.role}, requested {request.user_role}"
        )

    return ChatbotService.start_session(
        user_id=current_user.id,
        user_role=request.user_role,
        intent=request.intent
    )

@router.post("/answer")
async def answer_chatbot(
    request: AnswerRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
    # Note: We could validate session ownership here if sessions stored user_id
):
    """
    Submit an answer to the current chatbot question.
    """
    return ChatbotService.answer_question(
        session_id=request.session_id,
        text_input=request.text_input,
        db=db
    )

@router.post("/complete")
async def complete_chatbot(
    request: CompleteRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Complete the chatbot session and trigger the business logic (Give/Find Waste).
    """
    return ChatbotService.complete_session(
        session_id=request.session_id,
        db=db
    )
