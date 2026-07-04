from fastapi import APIRouter, HTTPException, status, Depends
from typing import List

# --- CORRECTED IMPORTS ---
# Use .. to go up one directory to find the files
from ..models import Session, SessionCreate, SessionUpdate
from ..firebase_config import sessions_collection, verify_firebase_token, db

# Create a router object
router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"]
)

# --- Helper to verify user permissions ---
def verify_session_access(token: dict, patient_id: str | None = None, session_data: dict | None = None):
    uid = token.get('uid')
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        
    user_doc = db.collection('users').document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
        
    user_data = user_doc.to_dict() or {}
    role = user_data.get('userType', 'patient')
    
    if role == 'practitioner':
        return True
        
    if patient_id and uid != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Patients can only access their own data.")
        
    if session_data and session_data.get('patientId') != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Patients can only access their own sessions.")
        
    return True

# --- Endpoint to Create a New Session ---
@router.post("/", response_model=Session, status_code=status.HTTP_201_CREATED)
def create_session(session_data: SessionCreate, token: dict = Depends(verify_firebase_token)):
    try:
        verify_session_access(token, patient_id=session_data.patientId)
        data = session_data.model_dump()
        update_time, doc_ref = sessions_collection.add(data)
        return Session.model_validate({"id": doc_ref.id, **data})
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# --- Endpoint to Get All Sessions for a Patient ---
@router.get("/{patient_id}", response_model=List[Session])
def get_all_sessions(patient_id: str, token: dict = Depends(verify_firebase_token)):
    try:
        verify_session_access(token, patient_id=patient_id)
        sessions = []
        docs = sessions_collection.where('patientId', '==', patient_id).stream()
        for doc in docs:
            session_data = doc.to_dict() or {}
            sessions.append(Session.model_validate({"id": doc.id, **session_data}))
        return sessions
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Endpoint to Update (Reschedule) a Session ---
@router.put("/{session_id}", response_model=Session)
def update_session(session_id: str, session_update: SessionUpdate, token: dict = Depends(verify_firebase_token)):
    try:
        doc_ref = sessions_collection.document(session_id)
        session_snap = doc_ref.get()
        if not session_snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        
        session_data = session_snap.to_dict()
        verify_session_access(token, session_data=session_data)
        
        update_data = session_update.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
            
        doc_ref.update(update_data)
        updated_doc = doc_ref.get()
        updated_data = updated_doc.to_dict() or {}
        return Session.model_validate({"id": updated_doc.id, **updated_data})
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Endpoint to Delete (Cancel) a Session ---
@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, token: dict = Depends(verify_firebase_token)):
    try:
        doc_ref = sessions_collection.document(session_id)
        session_snap = doc_ref.get()
        if not session_snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
            
        session_data = session_snap.to_dict()
        verify_session_access(token, session_data=session_data)
        
        doc_ref.delete()
        return
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
