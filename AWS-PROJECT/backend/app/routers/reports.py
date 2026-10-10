import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from .. import config as C
from ..auth import current_user, require_operator
from ..schemas import ReportIn, ReportReview
from ..services import incidents
from ..store import db

router = APIRouter()


def _public(r):
    return {k: r[k] for k in ("id", "created_at", "lat", "lng", "location_label", "source_type",
                              "ammonia_ppm", "ph", "temperature_c", "observations", "note", "severity", "reporter_type")}


@router.post("/reports/upload-url")
def upload_url(user=Depends(current_user)):
    # Local placeholder. At deploy time this returns a presigned S3 URL.
    return {"photo_key": f"reports/{uuid.uuid4().hex}.jpg", "upload_url": None}


@router.post("/reports", status_code=201)
def submit_report(body: ReportIn, request: Request, user=Depends(current_user)):
    verified = user["role"] in ("reporter", "operator")
    ip = request.client.host if request.client else "unknown"
    if not verified and db.rate_limited(f"report:{ip}", 5, 3600):
        raise HTTPException(429, "Too many reports. Try again later.")
    rec = {
        "id": db.new_id("rep"), "created_at": time.time(), "status": "pending",
        "reporter_type": "verified" if verified else "citizen",
        "reporter_name": user["name"] if verified else None,
        "lat": body.lat, "lng": body.lng, "location_label": body.location_label,
        "source_type": body.source_type, "ammonia_ppm": body.ammonia_ppm, "ph": body.ph, "temperature_c": body.temperature_c,
        "observations": [o for o in body.observations if o in C.ALLOWED_OBSERVATIONS],
        "note": body.note, "photo_key": body.photo_key,
    }
    rec["severity"] = incidents.report_severity(rec)
    with db.lock:
        db.reports[rec["id"]] = rec
        inc = incidents.on_report(rec)
    return {**_public(rec), "status": rec["status"], "incident_id": inc["id"] if inc else None}


@router.get("/reports")
def approved_reports(limit: int = 50):
    rows = [r for r in db.reports.values() if r["status"] == "approved"]
    rows.sort(key=lambda r: -r["created_at"])
    return [_public(r) for r in rows[:max(1, min(limit, 200))]]


@router.get("/reports/pending")
def pending_reports(user=Depends(require_operator)):
    rows = [r for r in db.reports.values() if r["status"] == "pending"]
    rows.sort(key=lambda r: -r["created_at"])
    return [{**r, "status": r["status"]} for r in rows]


@router.patch("/reports/{report_id}")
def review_report(report_id: str, body: ReportReview, user=Depends(require_operator)):
    rec = db.reports.get(report_id)
    if not rec:
        raise HTTPException(404, "Report not found")
    rec["status"] = "approved" if body.action == "approve" else "rejected"
    db.log_audit(user["name"], f"REPORT_{rec['status'].upper()}", {"report_id": report_id, "note": body.note}, user["id"])
    return {"id": report_id, "status": rec["status"]}
