import requests
import time
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"

def run_advanced_verification():
    print("--- Starting Advanced Features Verification ---")
    
    # 1. Signup Urban User (Owner)
    u_suffix = int(time.time())
    owner_creds = {"username": f"owner_{u_suffix}", "password": "p", "name": "Owner", "role": "generator", "location": "City"}
    requests.post(f"{BASE_URL}/signup", json=owner_creds)
    owner_token = requests.post(f"{BASE_URL}/login", data=owner_creds).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    
    # 2. Check Initial Wallet
    w = requests.get(f"{BASE_URL}/wallet/balance", headers=owner_headers).json()
    print(f"Initial Wallet: {w['balance']}") # Should be 0
    
    # 3. Create Listing
    listing_data = {"waste_type": "veg", "quantity_kg": 10.0, "location": "City Center"}
    list_resp = requests.post(f"{BASE_URL}/waste/create", json=listing_data, headers=owner_headers)
    listing_id = list_resp.json()["id"]
    print(f"Created Listing #{listing_id}")
    
    # 4. Signup Coop User
    coop_creds = {"username": f"coop_{u_suffix}", "password": "p", "name": "Coop", "role": "collector", "location": "Rural"}
    requests.post(f"{BASE_URL}/signup", json=coop_creds)
    coop_token = requests.post(f"{BASE_URL}/login", data=coop_creds).json()["access_token"]
    coop_headers = {"Authorization": f"Bearer {coop_token}"}
    
    # 5. Accept Listing (the coop schedules a pickup time)
    pickup_time = (datetime.now() + timedelta(days=1)).isoformat()
    accept_resp = requests.post(
        f"{BASE_URL}/waste/accept/{listing_id}",
        json={"pickup_time": pickup_time},
        headers=coop_headers
    )
    print(f"Accepted Status: {accept_resp.status_code}")

    # 6. Confirm Pickup (the owner confirms, which awards the credits)
    collect_resp = requests.post(f"{BASE_URL}/waste/confirm-pickup/{listing_id}", headers=owner_headers)
    print("Collect Response:", collect_resp.json())
    
    if collect_resp.status_code == 200:
        print("Verification Passed: Collection endpoint works.")
        
        # 7. Verify Wallet Update
        w_final = requests.get(f"{BASE_URL}/wallet/balance", headers=owner_headers).json()
        print(f"Final Wallet: {w_final['balance']}")
        expected = 10.0 * 10 # 10kg * 10 pts
        if w_final['balance'] == expected:
            print(f"Verification Passed: Wallet credited {expected} points.")
        else:
            print(f"Verification Failed: Expected {expected}, got {w_final['balance']}")
            
        # 8. Verify Impact Stats
        impact = requests.get(f"{BASE_URL}/impact/summary").json()
        print(f"Global Impact: {impact}")
        if impact['total_waste_kg'] > 0:
             print("Verification Passed: Impact log works.")
             
    else:
        print("Verification Failed: Collection failed.")
        print(collect_resp.text)

if __name__ == "__main__":
    run_advanced_verification()
