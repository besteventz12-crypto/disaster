import os
from typing import List, Optional
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spaCy

app = FastAPI(title="Disaster API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextIn(BaseModel):
    text: str


class EmergencyContact(BaseModel):
    name: str
    phone: str


class UserIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    emergencyContacts: List[EmergencyContact] = []
    remember: bool = False


class MedicalInfo(BaseModel):
    injury: Optional[str] = "none"
    conditions: List[str] = []
    allergies: Optional[str] = ""


class SosAlertIn(BaseModel):
    name: str
    location: str
    type: str
    details: Optional[str] = ""
    peopleCount: Optional[str] = "1"
    medicalInfo: MedicalInfo
    evidenceMedia: List[str] = []
    timestamp: str


class WarningListIn(BaseModel):
    warnings: List[str]


class ContactPersonIn(BaseModel):
    name: str
    phone: str
    relation: Optional[str] = ""


class MissingPersonIn(BaseModel):
    personName: str
    age: Optional[int] = None
    gender: Optional[str] = ""
    clothingDescription: Optional[str] = ""
    physicalDescription: Optional[str] = ""
    lastSeenLocation: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seenAt: Optional[str] = ""
    notes: Optional[str] = ""
    photoUrl: Optional[str] = ""
    contact: ContactPersonIn


class FoundPersonIn(BaseModel):
    personName: Optional[str] = "Unknown"
    estimatedAge: Optional[int] = None
    gender: Optional[str] = ""
    clothingDescription: Optional[str] = ""
    physicalDescription: Optional[str] = ""
    foundLocation: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    foundAt: Optional[str] = ""
    suspicionNotes: Optional[str] = ""
    photoUrl: Optional[str] = ""
    contact: ContactPersonIn


class MatchRunRequest(BaseModel):
    threshold: Optional[float] = 0.62


class ShelterIn(BaseModel):
    name: str
    latitude: float
    longitude: float
    address: Optional[str] = ""
    capacity: Optional[int] = 0
    contact: Optional[str] = ""
    notes: Optional[str] = ""


class AdminLoginIn(BaseModel):
    email: str
    password: str


JWT_SECRET = os.getenv("JWT_SECRET", "replace_with_a_long_random_secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "12"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@resqlink.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ResQlink@2026")


def _create_admin_token(email: str):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "role": "admin",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRES_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_admin(authorization: str = Header(default="")):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Admin session expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid auth token") from exc

    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access denied")

    return payload


@app.get("/health")
def health():
    status = spaCy.health_check()
    return {"ok": True, "status": status}


@app.post("/process-text")
def process_text_endpoint(payload: TextIn):
    result = spaCy.process_text(payload.text)
    return {"ok": True, "result": result}


@app.post("/users")
def create_user(payload: UserIn):
    result = spaCy.create_user_record(payload.model_dump())
    return {"ok": True, "result": result}


@app.post("/sos-alerts")
def create_sos_alert(payload: SosAlertIn):
    result = spaCy.create_sos_alert(payload.model_dump())
    return {"ok": True, "result": result}


@app.get("/sos-alerts")
def list_sos_alerts():
    items = spaCy.list_sos_alerts()
    return {"ok": True, "items": items}


@app.get("/sos-alerts/admin")
def list_sos_alerts_admin(_admin=Depends(require_admin)):
    items = spaCy.list_sos_alerts()
    return {"ok": True, "items": items}


@app.get("/sos-alerts/{alert_id}")
def get_sos_alert(alert_id: str):
    try:
        item = spaCy.get_sos_alert_by_id(alert_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not item:
        raise HTTPException(status_code=404, detail="SOS alert not found")

    return {"ok": True, "item": item}


@app.post("/admin/login")
def admin_login(payload: AdminLoginIn):
    email = payload.email.strip().lower()
    password = payload.password
    if email != ADMIN_EMAIL or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    token = _create_admin_token(email)
    return {
        "ok": True,
        "token": token,
        "tokenType": "Bearer",
        "expiresInHours": JWT_EXPIRES_HOURS,
        "user": {"email": email, "role": "admin"},
    }


@app.get("/admin/session")
def admin_session(payload=Depends(require_admin)):
    return {"ok": True, "user": {"email": payload.get("sub"), "role": payload.get("role")}}


@app.get("/warnings")
def get_warnings():
    warnings = spaCy.get_warnings()
    return {"ok": True, "warnings": warnings}


@app.put("/warnings")
def update_warnings(payload: WarningListIn, _admin=Depends(require_admin)):
    warnings = spaCy.save_warnings(payload.warnings)
    return {"ok": True, "warnings": warnings}


@app.post("/missing-persons")
def create_missing_person(payload: MissingPersonIn):
    result = spaCy.create_missing_person_report(payload.model_dump())
    return {"ok": True, "result": result}


@app.post("/found-persons")
def create_found_person(payload: FoundPersonIn):
    result = spaCy.create_found_person_report(payload.model_dump())
    return {"ok": True, "result": result}


@app.get("/missing-persons")
def list_missing_persons():
    data = spaCy.list_missing_person_reports()
    return {"ok": True, "items": data}


@app.get("/found-persons")
def list_found_persons():
    data = spaCy.list_found_person_reports()
    return {"ok": True, "items": data}


@app.delete("/missing-persons/{missing_person_id}")
def delete_missing_person(missing_person_id: str, _admin=Depends(require_admin)):
    try:
        deleted = spaCy.delete_missing_person_report(missing_person_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Missing person report not found")

    return {"ok": True, "deleted": True}


@app.delete("/found-persons/{found_person_id}")
def delete_found_person(found_person_id: str, _admin=Depends(require_admin)):
    try:
        deleted = spaCy.delete_found_person_report(found_person_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Found person report not found")

    return {"ok": True, "deleted": True}


@app.post("/matches/run")
def run_person_matching(payload: MatchRunRequest, _admin=Depends(require_admin)):
    threshold = payload.threshold if payload.threshold is not None else 0.62
    matches = spaCy.run_person_matching(threshold=float(threshold))
    return {"ok": True, "matches": matches, "count": len(matches)}


@app.post("/matches/run/missing/{missing_person_id}")
def run_person_matching_for_missing(missing_person_id: str, payload: MatchRunRequest, _admin=Depends(require_admin)):
    threshold = payload.threshold if payload.threshold is not None else 0.62
    matches = spaCy.run_person_matching_for_missing(missing_person_id=missing_person_id, threshold=float(threshold))
    return {"ok": True, "matches": matches, "count": len(matches)}


@app.get("/matches")
def list_matches():
    matches = spaCy.list_person_matches()
    return {"ok": True, "items": matches}


@app.post("/shelters")
def create_shelter(payload: ShelterIn, _admin=Depends(require_admin)):
    result = spaCy.create_shelter(payload.model_dump())
    return {"ok": True, "result": result}


@app.get("/shelters")
def list_shelters(latitude: Optional[float] = None, longitude: Optional[float] = None, radiusKm: float = 5.0):
    if latitude is not None and longitude is not None:
        items = spaCy.list_shelters_nearby(latitude=latitude, longitude=longitude, radius_km=radiusKm)
        return {"ok": True, "items": items, "radiusKm": radiusKm}

    items = spaCy.list_shelters()
    return {"ok": True, "items": items}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename or "upload.bin"
    content_type = file.content_type or "application/octet-stream"
    res = spaCy.process_bytes(contents, filename=filename, content_type=content_type)
    return {"ok": True, "result": res}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "5000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
