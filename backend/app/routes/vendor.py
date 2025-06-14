from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.vendor import Vendor

# Create a new API router just for vendor routes
router = APIRouter(prefix="/vendors", tags=["vendors"])

# Dependency to get a new DB session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Get all vendors
@router.get("/")
def get_all_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()

# Add a new vendor
@router.post("/")
def create_vendor(vendor: dict, db: Session = Depends(get_db)):
    new_vendor = Vendor(**vendor)
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    return new_vendor

# Update a vendor
@router.put("/{vendor_id}")
def update_vendor(vendor_id: int, vendor: dict, db: Session = Depends(get_db)):
    db_vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not db_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    for key, value in vendor.items():
        setattr(db_vendor, key, value)

    db.commit()
    return db_vendor

# Delete a vendor
@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    db_vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not db_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    db.delete(db_vendor)
    db.commit()
    return {"message": "Vendor deleted"}
