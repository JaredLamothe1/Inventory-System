# seed_admin.py
from app.database import SessionLocal
from app.models.user import User
from app.utils import hash_password
import app.models 
EMAIL = "jaredlamothe2@gmail.com"
USERNAME = "admin"
PASSWORD = "changeme"  # change later

db = SessionLocal()
u = db.query(User).filter(User.username == USERNAME).first()
if not u:
    u = User(username=USERNAME, email=EMAIL, hashed_password=hash_password(PASSWORD))
    db.add(u)
    action = "created"
else:
    u.email = EMAIL
    action = "updated"

db.commit()
print(f"User {action}: id={u.id}, username={u.username}, email={u.email}")
db.close()
