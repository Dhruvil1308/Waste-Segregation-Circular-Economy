import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend import models, database
from backend.routers import auth, users, waste, matching, impact, wallet, notifications, tickets, admin

# Create Database Tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(
    title="Waste Marketplace Backend (AI/ML Ready)",
    description="Backend-only MVP for Urban-Rural Waste Marketplace Hackathon",
    version="0.1.0"
)

# CORS Setup (Allow All for Hackathon/Demo)
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
# Serve uploaded waste images
os.makedirs(waste.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=waste.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(waste.router)
app.include_router(matching.router)
app.include_router(impact.router)
app.include_router(wallet.router)
app.include_router(notifications.router)
app.include_router(tickets.router)
app.include_router(admin.router)
from backend.chatbot import router as chatbot_router
app.include_router(chatbot_router.router)




@app.get("/")
def root():
    return {"message": "Welcome to the Waste Marketplace API. Go to /docs for Swagger UI."}
    # Reload trigger
