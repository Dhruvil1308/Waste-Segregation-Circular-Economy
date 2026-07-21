import requests

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    # 1. Register a Buyer (Partner)
    buyer_user = "buyer_test" + str(id(object()))
    try:
        requests.post(f"{BASE_URL}/signup", json={
            "username": f"{buyer_user}@test.com",
            "password": "password123",
            "name": "Buyer Test",
            "role": "collector",
            "location": "Test City"
        })
    except:
        pass # Might already exist

    # 2. Login
    res = requests.post(f"{BASE_URL}/login", data={
        "username": f"{buyer_user}@test.com",
        "password": "password123"
    })
    token = res.json().get("access_token")
    if not token:
        print("Login failed")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Check Available Waste
    res = requests.get(f"{BASE_URL}/waste/available", headers=headers)
    print("Available Waste Response:", res.status_code)
    listings = res.json()
    print("Listings Count:", len(listings))
    print("Listings:", listings)

if __name__ == "__main__":
    test_api()
