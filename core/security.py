"""Generate a bcrypt password hash for admin login.
Usage: python hash_password.py <your-password>
Then set ADMIN_PASSWORD_HASH in your Railway env vars.
"""
import sys
import bcrypt

if len(sys.argv) < 2:
    print("Usage: python hash_password.py <password>")
    sys.exit(1)

password = sys.argv[1]
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
print(f"\nYour bcrypt hash:\n{hashed}\n")
print("Set this as ADMIN_PASSWORD_HASH in Railway environment variables.")
