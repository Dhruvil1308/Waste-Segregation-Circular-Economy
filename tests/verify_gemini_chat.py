import requests
import time

BASE_URL = "http://127.0.0.1:8000"

# 1. Login to get token
def login(username, password):
    url = f"{BASE_URL}/login"
    payload = {"username": username, "password": password}
    response = requests.post(url, data=payload)
    if response.status_code == 200:
        return response.json()["access_token"]
    raise Exception(f"Login failed: {response.text}")

# 2. Start Chat
def start_chat(token, intent="FIND_WASTE"): # Role must match intent user type
    url = f"{BASE_URL}/chatbot/start"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"intent": intent, "user_role": "collector"} # Assuming we use a coop user
    response = requests.post(url, json=payload, headers=headers)
    print("Start Chat:", response.json())
    return response.json()["session_id"]

# 3. Message Chat
def send_message(token, session_id, message):
    url = f"{BASE_URL}/chatbot/answer"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"session_id": session_id, "text_input": message}
    response = requests.post(url, json=payload, headers=headers)
    print(f"Me: {message}")
    print(f"AI: {response.json().get('message')}")
    data = response.json().get('data')
    if data:
        print(f"Found Data: {data}")
    return response.json()

def run_verification():
    # Pre-req: Needs a user. I will assume 'cooperative_user' from seed or create one.
    # For now, I'll attempt to signup a new coop user to be safe.
    import random
    suffix = random.randint(1000, 9999)
    username = f"coop_gemini_{suffix}"
    password = "password123"
    
    # Signup
    try:
        requests.post(f"{BASE_URL}/signup", json={
            "username": username, 
            "password": password, 
            "name": "Gemini Tester", 
            "role": "collector", 
            "location": "Test Lab"
        })
    except:
        pass # Ignore if fail, maybe exists

    # Login
    try:
        token = login(username, password)
        print("Logged in.")
        
        session_id = start_chat(token, intent="FIND_WASTE")
        
        # Test 1: Simple Chat
        send_message(token, session_id, "I am looking for some waste to make biogas.")
        
        # Test 2: Trigger DB Search (Creative + Search)
        # "I need organic waste"
        send_message(token, session_id, "I specifically need mixed organic waste for my plant.")
        
    except Exception as e:
        print(f"Verification Failed: {e}")

if __name__ == "__main__":
    run_verification()
