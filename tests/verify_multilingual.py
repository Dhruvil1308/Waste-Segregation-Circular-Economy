import requests
import json
import random

BASE_URL = "http://127.0.0.1:8000"

def run_multilingual_test():
    # 1. Login/Signup
    suffix = random.randint(10000, 99999)
    username = f"gu_tester_{suffix}"
    password = "password123"
    
    # Signup
    try:
        requests.post(f"{BASE_URL}/signup", json={
            "username": username, "password": password, 
            "name": "Gujarati Tester", "role": "generator", "location": "Ahmedabad"
        })
    except: pass

    # Login
    auth_resp = requests.post(f"{BASE_URL}/login", data={"username": username, "password": password})
    if auth_resp.status_code != 200:
        print("Login failed")
        return
    token = auth_resp.json()["access_token"]
    
    # 2. Start Chat
    start_resp = requests.post(
        f"{BASE_URL}/chatbot/start", 
        json={"intent": "GIVE_WASTE", "user_role": "generator"},
        headers={"Authorization": f"Bearer {token}"}
    )
    session_id = start_resp.json()["session_id"]
    print(f"Chat Started: {start_resp.json()['message']}") # Likely English default greeting, which is fine
    
    # 3. Send Gujarati Message
    gu_msg = "મારી પાસે શાકભાજીનો કચરો છે." # "I have vegetable waste"
    print(f"Me (Gujarati): {gu_msg}")
    
    resp = requests.post(
        f"{BASE_URL}/chatbot/answer",
        json={"session_id": session_id, "text_input": gu_msg},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"AI Response: {resp.json().get('message')}")

if __name__ == "__main__":
    run_multilingual_test()
