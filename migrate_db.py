import sqlite3

def migrate():
    conn = sqlite3.connect("marketplace_v2.db")
    cursor = conn.cursor()
    
    # 1. Add phone_number to users
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN phone_number TEXT")
        print("Added phone_number to users")
    except sqlite3.OperationalError as e:
        print(f"Skipped users: {e}")

    # 2. Add phone_number to waste_listings
    try:
        cursor.execute("ALTER TABLE waste_listings ADD COLUMN phone_number TEXT")
        print("Added phone_number to waste_listings")
    except sqlite3.OperationalError as e:
        print(f"Skipped waste_listings_phone: {e}")

    # 3. Add pickup_time to waste_listings
    try:
        cursor.execute("ALTER TABLE waste_listings ADD COLUMN pickup_time TIMESTAMP")
        print("Added pickup_time to waste_listings")
    except sqlite3.OperationalError as e:
        print(f"Skipped pickup_time: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
