
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

try:
    print("Attempting to import backend.chatbot.router...")
    from backend.chatbot import router
    print("Successfully imported chatbot router!")
    
    print("Attempting to import backend.main...")
    from backend import main
    print("Successfully imported main app!")
    
    print("Verification Passed: implementation allows imports.")
except Exception as e:
    print(f"Verification Failed: {e}")
