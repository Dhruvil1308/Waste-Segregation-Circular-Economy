"""
One-off migration: bcrypt-hash any password still stored in plain text.

Older builds stored User.password_hash as the raw password. Run this once after
upgrading to hashed auth so existing accounts keep working with the same password:

    python migrate_passwords.py
"""
from backend import models, database
from backend.auth import get_password_hash

# Every bcrypt hash starts with one of these prefixes.
BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2x$", "$2y$")


def already_hashed(value: str) -> bool:
    return bool(value) and value.startswith(BCRYPT_PREFIXES)


def migrate():
    db = database.SessionLocal()
    try:
        users = db.query(models.User).all()
        migrated = skipped = blank = 0

        for user in users:
            if already_hashed(user.password_hash):
                skipped += 1
            elif not user.password_hash:
                # No usable password to preserve; leave it for a manual reset.
                blank += 1
            else:
                user.password_hash = get_password_hash(user.password_hash)
                migrated += 1

        db.commit()
        print(f"Migrated {migrated} plain-text password(s).")
        print(f"Skipped {skipped} already-hashed account(s).")
        if blank:
            print(f"WARNING: {blank} account(s) had an empty password and need a manual reset.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
