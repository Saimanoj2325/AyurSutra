from fastapi import APIRouter, HTTPException, Depends
from typing import List
from firebase_config import db, verify_firebase_token
from models import Practitioner

router = APIRouter(
    prefix="/practitioners",
    tags=["Practitioners"]
)

@router.get("/", response_model=List[Practitioner])
def get_all_practitioners(token: dict = Depends(verify_firebase_token)):
    """
    Retrieve all documents from the 'practitioners' collection.
    """
    try:
        practitioners = []
        # Query the dedicated 'practitioners' collection directly
        docs = db.collection('practitioners').stream()
        
        for doc in docs:
            practitioner_data = doc.to_dict()
            practitioners.append(Practitioner(
                id=doc.id, 
                name=practitioner_data.get('name'), 
                userType=practitioner_data.get('userType', 'practitioner')
            ))
        
        return practitioners
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))