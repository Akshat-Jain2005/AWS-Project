import hmac
import time
from fastapi import APIRouter, Depends, Header, HTTPException
from bio_sentinel_inference import STATION_METADATA, evaluate_telemetry
from .. import config as C
from ..auth import require_operator
from ..schemas import TelemetryPayload
from ..services import incidents
from ..store import db

router = APIRouter()


@router.post("/telemetry")
def ingest_telemetry(payload: TelemetryPayload, x_api_key: str = Header(default="")):
    if C.SENSOR_API_KEY and not hmac.compare_digest(x_api_key, C.SENSOR_API_KEY):
        raise HTTPException(401, "Invalid sensor key")
    sid = payload.station_id
    if sid not in STATION_METADATA:
        raise HTTPException(404, "Unknown station")
    data = payload.model_dump()
    result = evaluate_telemetry(data)
    now = int(time.time())
    with db.lock:
        db.history[sid].append({
            "timestamp": payload.timestamp, "received_at": now,
            **data["chemical"], **data["biological"], "threat_level": result["threat_level"],
        })
        db.stations[sid] = {"status": result["threat_level"], "last_telemetry": data,
                            "last_result": result, "updated_at": now}
    inc = incidents.on_telemetry(sid, result)
    return {**result, "incident_id": inc["id"] if inc and inc["status"] != "CLOSED" else None}


@router.get("/telemetry/{station_id}")
def telemetry_history(station_id: str, limit: int = 50):
    if station_id not in STATION_METADATA:
        raise HTTPException(404, "Unknown station")
    rows = list(db.history[station_id])[-max(1, min(limit, 200)):]
    return {"station_id": station_id, "readings": rows}


@router.get("/status")
def public_status():
    """Public dashboard data. No controls, no audit trail."""
    stations = []
    for sid, meta in STATION_METADATA.items():
        s = db.stations.get(sid, {})
        stations.append({"station_id": sid, "name": meta["name"], "status": s.get("status", "NORMAL"),
                         "updated_at": s.get("updated_at")})
    open_incs = [incidents.incident_view(i) for i in db.incidents.values() if i["status"] != "CLOSED"]
    top = max(open_incs, key=lambda i: incidents.LEVEL_RANK[i["level"]], default=None)
    summary = None
    if top:
        summary = {k: top[k] for k in ("station_id", "level", "anomaly_type", "confidence", "t_minus_seconds")}
    return {"overall": incidents.overall_status(), "stations": stations, "incident": summary,
            "intake_status": db.gate["intake_status"], **incidents.deficit_view()}


@router.get("/stations")
def corridor(user=Depends(require_operator)):
    out = []
    for sid, meta in STATION_METADATA.items():
        s = db.stations.get(sid, {})
        out.append({"station_id": sid, "name": meta["name"], "distance_km": meta["distance_km"],
                    "coords": C.STATION_COORDS.get(sid), "status": s.get("status", "NORMAL"),
                    "last_telemetry": s.get("last_telemetry"), "last_result": s.get("last_result")})
    return {"stations": out, "gate_state": db.gate, **incidents.deficit_view(),
            "incidents": [incidents.incident_view(i) for i in db.incidents.values() if i["status"] != "CLOSED"]}


@router.get("/incidents")
def list_incidents(user=Depends(require_operator)):
    return [incidents.incident_view(i) for i in sorted(db.incidents.values(), key=lambda i: -i["opened_at"])]


@router.post("/incidents/{incident_id}/close")
def close(incident_id: str, user=Depends(require_operator)):
    inc = incidents.close_incident(incident_id, user["name"], user["id"])
    if not inc:
        raise HTTPException(404, "Incident not found or already closed")
    return incidents.incident_view(inc)
