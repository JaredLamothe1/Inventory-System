# create_admin.py
from app.database import SessionLocal
from app.models.user import User
from app.utils import hash_password
import app.models 

EMAIL = "admin@example.com"
USERNAME = "admin"
PASSWORD = "changeme"  # <-- change this after login

db = SessionLocal()
u = db.query(User).filter(User.username == USERNAME).first()
if not u:
    u = User(username=USERNAME, email=EMAIL, hashed_password=hash_password(PASSWORD))
    db.add(u)
    action = "created"
else:
    u.email = EMAIL
    u.hashed_password = hash_password(PASSWORD)
    action = "updated"

db.commit()
print(f"User {action}: id={u.id}, username={u.username}, email={u.email}")
db.close()
