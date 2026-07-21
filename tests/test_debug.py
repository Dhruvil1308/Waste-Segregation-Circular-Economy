import requests
import json

def get_users():
    try:
        res = requests.get("http://127.0.0.1:8000/debug/users")
        print(json.dumps(res.json(), indent=2))
    except Exception as e:
        print(e)
        
if __name__ == "__main__":
    get_users()
