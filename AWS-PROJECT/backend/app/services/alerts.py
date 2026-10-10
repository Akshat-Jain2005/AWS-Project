import time
from .. import config as C  # type: ignore
from ..store import db      # type: ignore
from . import notify


def texts_for(kind, ward, override=None):
    sched = C.WARD_SCHEDULES.get(ward, "as announced")
    if kind == "rationing":
        return {
            "en": f"Water alert: River pollution. {ward} will get water {sched} today. Store water safely. Reply STOP to opt out.",
            "hi": f"जल सूचना: नदी में प्रदूषण के कारण {ward} में आज {sched} पानी मिलेगा। बंद करने के लिए STOP भेजें।",
        }
    if kind == "all_clear":
        return {
            "en": f"All clear: Water supply is back to normal in {ward}. Thank you for your patience.",
            "hi": f"सब सामान्य: {ward} में जल आपूर्ति सामान्य हो गई है।",
        }
    msg = override or ""
    return {"en": msg, "hi": msg}


def audience(wards, kind):
    wanted = {w.lower() for w in wards}
    wanted_type = {"rationing": "rationing", "all_clear": "all_clear"}.get(kind, "pollution")
    return [s for s in db.subscribers.values()
            if s["verified"] and not s["opted_out"]
            and s["ward"].lower() in wanted and wanted_type in s["alert_types"]]


def _deliver(alert, subs):
    sent = skipped = 0
    now = time.time()
    if "sms" in alert["channels"]:
        for s in subs:
            if now - s.get("last_sent_at", 0) < C.SMS_COOLDOWN_S:
                skipped += 1
                continue
            t = alert["texts"][s["ward"]]
            text = t["en"] if s["language"] == "en" else t["hi"] if s["language"] == "hi" else f"{t['en']}\n{t['hi']}"
            notify.send_sms(s["phone"], text)
            s["last_sent_at"] = now
            sent += 1
    if "telegram" in alert["channels"]:
        texts_vals = list(alert["texts"].values())
        first_en = texts_vals[0]["en"] if texts_vals else ""
        kind = alert["kind"]
        if kind == "rationing":
            msg = (
                f"📢 <b>EMERGENCY WATER RATIONING NOTICE</b>\n\n"
                f"<b>Status:</b> Intake Gates Closed (-{C.DEFICIT_MGD} MGD Deficit)\n"
                f"<b>Affected Areas:</b> {', '.join(alert['wards'][:3])}...\n"
                f"<b>Schedule:</b> {first_en}\n\n"
                "💧 <i>Please store water safely. Clean tanker dispatch in progress.</i>"
            )
        elif kind == "all_clear":
            msg = (
                "✅ <b>ALL CLEAR: WATER SUPPLY RESTORED</b>\n\n"
                "River parameters upstream have normalized. Wazirabad intake gates reopened.\n"
                "Normal piped supply restoring across all municipal wards."
            )
        else:
            msg = f"📢 <b>BIO-SENTINEL BULLETIN</b>\n\n{first_en}"
        notify.send_telegram(msg)
    # Broadcast to SNS citizen alert topic for all subscribed ward residents
    first_text = next(iter(alert["texts"].values()), {"en": ""})
    notify.alert_citizens(f"Bio-Sentinel: {alert['kind']}", first_text.get("en", ""))
    alert.update(status="sent", sent=sent, skipped_cooldown=skipped, sent_at=int(now))


def create_alert(kind, wards, channels, actor, actor_id=None, message=None, system=False):
    subs = audience(wards, kind)
    alert = {
        "id": db.new_id("alert"), "kind": kind, "wards": wards, "channels": channels,
        "recipients": len(subs), "sent": 0, "skipped_cooldown": 0, "status": "created",
        "created_by": actor, "created_by_id": actor_id, "approved_by": None,
        "created_at": int(time.time()),
        "texts": {w: texts_for(kind, w, message) for w in {s["ward"] for s in subs} | set(wards)},
    }
    db.alerts[alert["id"]] = alert
    if not system and len(subs) > C.TWO_PERSON_THRESHOLD:
        alert["status"] = "pending_approval"
        db.log_audit(actor, "ALERT_PENDING_APPROVAL", {"alert_id": alert["id"], "recipients": len(subs)}, actor_id)
        return alert
    _deliver(alert, subs)
    db.log_audit(actor, "ALERT_SENT", {"alert_id": alert["id"], "kind": kind, "sent": alert["sent"]}, actor_id)
    return alert


def approve_alert(alert_id, approver, approver_id):
    alert = db.alerts.get(alert_id)
    if not alert:
        return None, "not_found"
    if alert["status"] != "pending_approval":
        return alert, "not_pending"
    if approver_id == alert["created_by_id"]:
        return alert, "same_operator"
    alert["approved_by"] = approver
    _deliver(alert, audience(alert["wards"], alert["kind"]))
    db.log_audit(approver, "ALERT_APPROVED", {"alert_id": alert_id, "sent": alert["sent"]}, approver_id)
    return alert, "ok"
