import requests
import zlib
import struct

BASE_URL = "http://127.0.0.1:8000"


def make_png(width=64, height=64, rgb=(90, 140, 60)):
    """
    Builds a small solid-colour PNG. OpenAI rejects 1x1 images as unsupported,
    so the test image needs real dimensions to exercise the live vision path.
    """
    raw = b"".join(b"\x00" + bytes(list(rgb) * width) for _ in range(height))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))

def run_vision_test():
    # 1. Login
    try:
        auth = requests.post(f"{BASE_URL}/login", data={"username": "gu_tester_12345", "password": "password123"}) # Reuse prev user or new
        if auth.status_code != 200:
            # Create new
            u = "vision_user_876"
            requests.post(f"{BASE_URL}/signup", json={"username": u, "password": "p", "name": "V", "role": "generator", "location": "L"})
            auth = requests.post(f"{BASE_URL}/login", data={"username": u, "password": "p"})
            
        token = auth.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Image Upload
        image_bytes = make_png()

        files = {'file': ('test.png', image_bytes, 'image/png')}
        
        print("Uploading Image for Analysis...")
        resp = requests.post(f"{BASE_URL}/waste/analyze", files=files, headers=headers)
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "waste_type" not in data:
                print("Verification Failed: Missing keys.")
            elif "[MOCK]" in str(data.get("description", "")):
                # The endpoint falls back to canned data when the AI call fails,
                # so a mock response means the live vision path is broken.
                print("Verification Failed: got the MOCK fallback, the AI call did not succeed.")
            else:
                print("Verification Passed: live AI analysis returned structured data.")
        else:
            print("Verification Failed.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_vision_test()
