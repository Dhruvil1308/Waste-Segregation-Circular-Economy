"""
Creates (or repairs) the five demo accounts, independently of seed_data.py.

seed_data.py bails out if the database has ANY user, so on a database that has
seen real traffic it will never create these. This script is per-user idempotent:
run it any time to get a known-good set of logins for a demo.

    python create_demo_users.py
"""
from backend import models, database
from backend.auth import get_password_hash

DEMO_PASSWORD = "pass123"

DEMO_USERS = [
    # username, name, role, location, lat, lon, radius
    ("urban1", "Meera Shah",        models.ROLE_GENERATOR, "Indiranagar, Bangalore",  12.9784, 77.6408, None),
    ("urban2", "Rakesh Kumar",      models.ROLE_GENERATOR, "Koramangala, Bangalore",  12.9352, 77.6245, None),
    ("coop1",  "Rural Women Coop A", models.ROLE_COLLECTOR, "Ramnagara, Rural",       12.7209, 77.2800, 5.0),
    ("coop2",  "Rural Women Coop B", models.ROLE_COLLECTOR, "Indiranagar, Bangalore", 12.9784, 77.6408, 8.0),
    ("admin",  "Community Admin",    models.ROLE_ADMIN,     "Bangalore",              12.9716, 77.5946, None),
]


def run():
    models.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    try:
        for username, name, role, location, lat, lon, radius in DEMO_USERS:
            user = db.query(models.User).filter(models.User.username == username).first()
            action = "updated" if user else "created"

            if not user:
                user = models.User(username=username)
                db.add(user)

            # Reset every field so a half-broken demo account gets repaired too.
            user.name = name
            user.role = role
            user.location = location
            user.latitude = lat
            user.longitude = lon
            user.service_radius_km = radius if radius is not None else 5.0
            user.password_hash = get_password_hash(DEMO_PASSWORD)

            print(f"  {action:8} {username:8} ({role})")

        db.commit()
        print(f"\nAll demo accounts use the password: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
