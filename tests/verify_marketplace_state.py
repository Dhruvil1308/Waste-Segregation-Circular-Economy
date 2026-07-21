import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    # 1. Login as an Urban user (vic@gmail.com) to check their listings
    print("--- Checking Urban User (vic@gmail.com) ---")
    s = requests.Session()
    res = s.post(f"{BASE_URL}/login", data={"username": "vic@gmail.com", "password": "password123"})
    if res.status_code == 200:
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check My Listings
        listings = requests.get(f"{BASE_URL}/waste/my", headers=headers).json()
        print(f"My Listings found: {len(listings)}")
        print(json.dumps(listings, indent=2))
    else:
        print("Login failed for vic@gmail.com")

    # 2. Login as a Coop user (vicc@gmail.com) to check Available Feed
    print("\n--- Checking Coop User (vicc@gmail.com) ---")
    res = s.post(f"{BASE_URL}/login", data={"username": "vicc@gmail.com", "password": "password123"})
    if res.status_code == 200:
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check Available Waste
        available = requests.get(f"{BASE_URL}/waste/available", headers=headers).json()
        print(f"Available Waste found: {len(available)}")
        print(json.dumps(available, indent=2))
    else:
        print("Login failed for vicc@gmail.com")

if __name__ == "__main__":
    run_test()
