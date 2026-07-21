from typing import Optional, Dict, List, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .models import ChatbotSession
from .ai_client import generate_ai_response
from backend import models
import json
import re

# In-memory storage for sessions
sessions: Dict[str, ChatbotSession] = {}

class ChatbotService:
    @staticmethod
    def start_session(user_id: int, user_role: str, intent: str) -> Dict[str, Any]:
        """
        Starts a new AI session.
        """
        session = ChatbotSession(
            user_id=user_id,
            user_role=user_role,
            intent=intent,
            history=[]
        )
        sessions[session.session_id] = session
        
        # Initial greeting from AI
        intro_prompt = "Hello! "
        if intent == "GIVE_WASTE":
            intro_prompt += "I see you want to give away waste. What do you have? (e.g., leftover food, old fabrics)"
        elif intent == "FIND_WASTE":
            intro_prompt += "I see you are looking for materials. What do you need? (e.g., vegetable peels for compost)"
        
        # Add system initial message to history
        session.history.append({"role": "model", "content": intro_prompt})
        
        return {
            "session_id": session.session_id,
            "message": intro_prompt,
            "completed": False
        }

    @staticmethod
    def answer_question(session_id: str, text_input: str, db: Session = None) -> Dict[str, Any]:
        """
        Processes user input with the AI provider and returns response + potential DB matches.
        """
        session = sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Add user message
        session.history.append({"role": "user", "content": text_input})
        
        # Build System Prompt
        system_instruction = (
            "You are a smart, creative assistant for a Waste Marketplace. "
            f"User Role: {session.user_role}. Intent: {session.intent}. "
            "Your Goal: Help them exchange waste effectively. "
            "1. Be Creative: If they have waste, suggest what it can be used for (upcycling). "
            "If they need waste, suggest what they can make. "
            "2. Identify Needs: If the user clearly states what they want to buy/find, "
            "output a special marker at the end of your response: "
            "SEARCH_DB: <search_term> "
            "Example: 'That sounds great. SEARCH_DB: denim scrap' "
            "3. Keep it concise and helpful. "
            "4. LANGUAGE HANDLING: ALWAYS reply in the SAME LANGUAGE that the user uses. "
            "If the user speaks Gujarati, reply in Gujarati. If Marathi, reply in Marathi. "
            "Do NOT switch to English unless the user speaks English."
        )
        
        # Call the AI provider
        ai_response = generate_ai_response(session.history, system_instruction)
        response_text = ai_response["text"]
        
        # Parse for Search Intent
        match_data = []
        search_match = re.search(r"SEARCH_DB:\s*(.+)", response_text)
        if search_match and db:
            search_term = search_match.group(1).strip()
            # Remove the marker from the text shown to user
            response_text = response_text.replace(search_match.group(0), "").strip()
            
            # Perform DB Search
            match_data = ChatbotService._search_db(search_term, db)
            if match_data:
                 response_text += f"\n\nI found {len(match_data)} listings matching '{search_term}':"

        # Add AI response to history
        session.history.append({"role": "model", "content": response_text})
        
        return {
            "message": response_text,
            "data": match_data, # Frontend can render these cards
            "completed": False 
        }

    @staticmethod
    def _search_db(term: str, db: Session) -> List[Dict]:
        """
        Simple fuzzy search in DB.
        """
        # Map some common terms if needed, or just %like% search
        # Basic implementation: Search `waste_type`
        results = db.query(models.WasteListing).filter(
            models.WasteListing.waste_type.ilike(f"%{term}%"),
            models.WasteListing.status == "available"
        ).all()
        
        # If no exact match, try broad categories mapping (simple rule-based fallback)
        if not results:
            if "veg" in term.lower() or "food" in term.lower():
                results = db.query(models.WasteListing).filter(
                    models.WasteListing.waste_type.in_(["veg", "food", "mixed"]),
                    models.WasteListing.status == "available"
                ).all()

        return [{
            "id": r.id,
            "waste_type": r.waste_type,
            "quantity_kg": r.quantity_kg,
            "location": r.location,
            "owner_id": r.user_id
        } for r in results]

    @staticmethod
    def complete_session(session_id: str, db: Session) -> Dict[str, Any]:
        """
        Legacy/Cleanup - Not strictly needed for dynamic chat but keeps API valid.
        """
        return {"message": "Chat ended.", "completed": True}
