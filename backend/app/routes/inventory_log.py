from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.inventory_log import InventoryLog

router = APIRouter(prefix="/logs", tags=["inventory logs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def get_logs(db: Session = Depends(get_db)):
    return db.query(InventoryLog).order_by(InventoryLog.timestamp.desc()).all()
