import requests
import random
import string

BASE_URL = "http://127.0.0.1:8000"

def get_random_string(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

def verify_signup():
    username = f"user_{get_random_string()}"
    password = "secretpassword"
    
    print(f"Attempting to signup user: {username}")
    
    payload = {
        "username": username,
        "password": password,
        "name": f"Test User {username}",
        "role": "generator",
        "location": "Test Location"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/signup", json=payload)
        
        if response.status_code == 200:
            print("Signup successful!")
            data = response.json()
            if "access_token" in data and data["token_type"] == "bearer":
                 print("Access token received.")
                 print("Verification Passed: /signup endpoint works.")
            else:
                 print("Verification Failed: Invalid response format.")
                 print(data)
        else:
            print(f"Verification Failed: Status Code {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Verification Failed: Connection error. Is the server running? {e}")

if __name__ == "__main__":
    verify_signup()
