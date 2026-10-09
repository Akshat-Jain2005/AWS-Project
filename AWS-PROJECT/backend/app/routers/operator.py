import time
from fastapi import APIRouter, Depends, HTTPException
from .. import config as C
from ..auth import require_operator
from ..schemas import AlertIn, GateIn, RulesIn
from ..services import alerts, incidents
from ..store import db

router = APIRouter()
GATE_STATES = {"SHUTDOWN": "CLOSED_EMERGENCY_SHUTDOWN", "DIVERT_BYPASS": "DIVERTED_TO_BYPASS", "RESTORE": "OPEN"}


@router.post("/gate-command")
def gate_command(cmd: GateIn, user=Depends(require_operator)):
    new = GATE_STATES[cmd.action]
    prev = db.gate["intake_status"]
    if prev == new:
        raise HTTPException(409, f"Intake is already {new}")
    now = int(time.time())
    db.gate.update(intake_status=new, last_actuation_timestamp=now)
    entry = db.log_audit(user["name"], f"GATE_{cmd.action}",
                         {"rationale": cmd.rationale, "previous_status": prev, "new_status": new}, user["id"])
    alert_id = None
    if cmd.action != "RESTORE":
        for inc in db.incidents.values():
            if inc["status"] == "OPEN":
                inc["status"] = "ACKNOWLEDGED"
        if db.rules["sms_on_shutdown"]:
            a = alerts.create_alert("rationing", list(C.WARD_SCHEDULES), ["sms", "telegram"], "system:rule", system=True)
            alert_id = a["id"]
    elif db.rules["all_clear_on_restore"]:
        a = alerts.create_alert("all_clear", list(C.WARD_SCHEDULES), ["sms", "telegram"], "system:rule", system=True)
        alert_id = a["id"]
    return {"success": True, "current_gate_status": new, **incidents.deficit_view(),
            "audit_log": entry, "alert_id": alert_id}


@router.post("/alerts/send", status_code=201)
def send_alert(body: AlertIn, user=Depends(require_operator)):
    a = alerts.create_alert("custom", body.wards, body.channels, user["name"], user["id"], message=body.message)
    return {k: v for k, v in a.items() if k != "texts"}


@router.post("/alerts/{alert_id}/approve")
def approve_alert(alert_id: str, user=Depends(require_operator)):
    a, state = alerts.approve_alert(alert_id, user["name"], user["id"])
    if state == "not_found":
        raise HTTPException(404, "Alert not found")
    if state == "not_pending":
        raise HTTPException(409, "Alert is not waiting for approval")
    if state == "same_operator":
        raise HTTPException(403, "A second operator must approve this alert")
    return {k: v for k, v in a.items() if k != "texts"}


@router.get("/alerts")
def list_alerts(user=Depends(require_operator)):
    return [{k: v for k, v in a.items() if k != "texts"}
            for a in sorted(db.alerts.values(), key=lambda a: -a["created_at"])]


@router.get("/audit")
def audit_log(limit: int = 100, user=Depends(require_operator)):
    return list(reversed(db.audit))[:max(1, min(limit, 500))]


@router.get("/automation/rules")
def get_rules(user=Depends(require_operator)):
    return db.rules


@router.put("/automation/rules")
def set_rules(body: RulesIn, user=Depends(require_operator)):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    db.rules.update(changes)
    db.log_audit(user["name"], "RULES_UPDATED", changes, user["id"])
    return db.rules
