import hashlib
import hmac
import json
import time

from app import config
from app.store import db
from conftest import OP1, OP2, REPORTER, subscribe_and_verify, telemetry


# ---------- telemetry, incidents, status ----------

def test_healthy_telemetry_opens_no_incident(client):
    r = client.post("/telemetry", json=telemetry())
    assert r.status_code == 200
    assert r.json()["threat_level"] == "NORMAL"
    assert r.json()["incident_id"] is None
    assert client.get("/status").json()["overall"] == "NORMAL"


def test_toxic_telemetry_opens_incident_and_alerts_operators(client):
    r = client.post("/telemetry", json=telemetry(toxic=True))
    assert r.json()["anomaly_type"] == "BIO_KINEMATIC_COLLAPSE"
    inc_id = r.json()["incident_id"]
    assert inc_id
    status = client.get("/status").json()
    assert status["overall"] == "ALERT"
    assert status["incident"]["confidence"] == "SENSOR_ALERT"
    assert status["incident"]["t_minus_seconds"] > 0
    assert any(m["channel"] == "telegram" for m in db.outbox)


def test_unknown_station_rejected_and_history_works(client):
    assert client.post("/telemetry", json=telemetry("NOPE")).status_code == 404
    client.post("/telemetry", json=telemetry())
    client.post("/telemetry", json=telemetry())
    assert len(client.get("/telemetry/STATION_02_PANIPAT").json()["readings"]) == 2


def test_incident_autocloses_after_normal_readings(client):
    client.post("/telemetry", json=telemetry(toxic=True))
    for _ in range(config.AUTOCLOSE_NORMAL_READINGS):
        client.post("/telemetry", json=telemetry())
    assert client.get("/incidents", headers=OP1).json()[0]["status"] == "CLOSED"


def test_stations_requires_operator(client):
    assert client.get("/stations").status_code == 401
    assert client.get("/stations", headers=REPORTER).status_code == 200
    assert client.get("/stations", headers=OP1).status_code == 200


# ---------- field reports ----------

BAD = {"lat": 29.40, "lng": 76.98, "source_type": "drain_outfall", "ammonia_ppm": 4.0,
       "observations": ["dark_color", "foam"]}


def test_report_flow_and_moderation(client):
    r = client.post("/reports", json=BAD)
    assert r.status_code == 201 and r.json()["severity"] == "red"
    assert client.get("/reports").json() == []
    assert client.get("/reports/pending").status_code == 401
    rid = r.json()["id"]
    assert client.patch(f"/reports/{rid}", json={"action": "approve"}, headers=OP1).status_code == 200
    assert len(client.get("/reports").json()) == 1


def test_cluster_rule_raises_unverified_incident(client):
    for _ in range(3):
        client.post("/reports", json=BAD, headers=REPORTER)
    inc = client.get("/incidents", headers=OP1).json()
    assert len(inc) == 1
    assert inc[0]["confidence"] == "UNVERIFIED_SEND_INSPECTOR"


def test_sensor_plus_report_is_confirmed(client):
    client.post("/telemetry", json=telemetry(toxic=True))
    client.post("/reports", json=BAD, headers=REPORTER)
    assert client.get("/incidents", headers=OP1).json()[0]["confidence"] == "CONFIRMED"


def test_citizen_reports_are_rate_limited(client):
    codes = [client.post("/reports", json={**BAD, "ammonia_ppm": 0.1, "observations": []}).status_code
             for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


# ---------- subscribers and SMS ----------

def test_subscribe_otp_flow(client):
    r = client.post("/subscribe", json={"phone": "98765 43210", "ward": "Civil Lines", "consent": True})
    assert r.json()["phone"] == "+919876543210"
    assert client.post("/subscribe/verify", json={"phone": "9876543210", "code": "000000"}).status_code == 400
    assert subscribe_and_verify(client).status_code == 200
    assert client.get("/subscribers/summary", headers=OP1).json()["by_ward"] == {"Civil Lines": 1}


def test_subscribe_requires_consent_and_valid_phone(client):
    assert client.post("/subscribe", json={"phone": "9876543210", "ward": "Civil Lines", "consent": False}).status_code == 400
    assert client.post("/subscribe", json={"phone": "123", "ward": "Civil Lines", "consent": True}).status_code == 422


def test_manual_alert_only_reaches_selected_ward_and_respects_stop(client):
    subscribe_and_verify(client, "9876543210", "Civil Lines")
    subscribe_and_verify(client, "9123456780", "Karol Bagh")
    db.outbox.clear()
    r = client.post("/alerts/send", json={"wards": ["Civil Lines"], "message": "Test alert"}, headers=OP1)
    assert r.status_code == 201 and r.json()["sent"] == 1
    assert [m["to"] for m in db.outbox] == ["+919876543210"]
    client.post("/subscribe/stop", json={"phone": "9876543210"})
    db.subscribers["+919876543210"]["last_sent_at"] = 0
    r = client.post("/alerts/send", json={"wards": ["Civil Lines"], "message": "Test alert"}, headers=OP1)
    assert r.json()["recipients"] == 0


def test_sms_cooldown_blocks_repeat_messages(client):
    subscribe_and_verify(client)
    first = client.post("/alerts/send", json={"wards": ["Civil Lines"], "message": "One"}, headers=OP1).json()
    second = client.post("/alerts/send", json={"wards": ["Civil Lines"], "message": "Two"}, headers=OP1).json()
    assert first["sent"] == 1 and second["sent"] == 0 and second["skipped_cooldown"] == 1


def test_large_alert_needs_second_operator(client, monkeypatch):
    monkeypatch.setattr(config, "TWO_PERSON_THRESHOLD", 0)
    subscribe_and_verify(client)
    a = client.post("/alerts/send", json={"wards": ["Civil Lines"], "message": "Big one"}, headers=OP1).json()
    assert a["status"] == "pending_approval"
    assert client.post(f"/alerts/{a['id']}/approve", headers=OP1).status_code == 403
    done = client.post(f"/alerts/{a['id']}/approve", headers=OP2)
    assert done.status_code == 200 and done.json()["status"] == "sent"


# ---------- gate command, automation, audit ----------

def test_gate_requires_operator_and_valid_input(client):
    body = {"action": "SHUTDOWN", "rationale": "Toxic plume confirmed"}
    assert client.post("/gate-command", json=body).status_code == 401
    assert client.post("/gate-command", json={"action": "SHUTDOWN", "rationale": "x"}, headers=OP1).status_code == 422


def test_shutdown_sends_rationing_sms_and_audits(client):
    subscribe_and_verify(client, ward="Civil Lines", language="both")
    db.outbox.clear()
    r = client.post("/gate-command", json={"action": "SHUTDOWN", "rationale": "Toxic plume confirmed"}, headers=OP1)
    assert r.status_code == 200
    assert r.json()["deficit_mgd"] == 110
    sms = [m for m in db.outbox if m["channel"] == "sms"]
    assert len(sms) == 1 and "6-9 AM" in sms[0]["text"] and "जल सूचना" in sms[0]["text"]
    assert client.post("/gate-command", json={"action": "SHUTDOWN", "rationale": "again"}, headers=OP1).status_code == 409
    assert client.get("/audit", headers=OP1).json()[0]["action"] in {"ALERT_SENT", "GATE_SHUTDOWN"}
    pub = client.get("/status").json()
    assert pub["overall"] == "ALERT" and pub["rationing"]


def test_restore_sends_all_clear_and_rules_can_be_disabled(client):
    subscribe_and_verify(client)
    client.put("/automation/rules", json={"sms_on_shutdown": False}, headers=OP1)
    db.outbox.clear()
    client.post("/gate-command", json={"action": "SHUTDOWN", "rationale": "Plume arriving"}, headers=OP1)
    assert not [m for m in db.outbox if m["channel"] == "sms"]
    r = client.post("/gate-command", json={"action": "RESTORE", "rationale": "All clear"}, headers=OP1)
    assert r.json()["current_gate_status"] == "OPEN" and r.json()["deficit_mgd"] == 0
    assert any("All clear" in m["text"] for m in db.outbox if m["channel"] == "sms")


def test_telegram_live_mock_dispatch(client):
    # Toxic telemetry opens an incident and dispatches a rich HTML Telegram alert.
    client.post("/telemetry", json=telemetry(toxic=True))
    tg = [m for m in db.outbox if m["channel"] == "telegram"]
    assert tg, "expected a telegram message in the outbox"
    assert any("<b>" in m["text"] and "BIO-SENTINEL" in m["text"] for m in tg)

    # An operator bulletin routed to the telegram channel is recorded with HTML too.
    db.outbox.clear()
    r = client.post("/alerts/send",
                    json={"wards": ["Civil Lines"], "channels": ["telegram"], "message": "Boil water advisory"},
                    headers=OP1)
    assert r.status_code == 201
    tg = [m for m in db.outbox if m["channel"] == "telegram"]
    assert tg and "<b>" in tg[0]["text"] and "Boil water advisory" in tg[0]["text"]

    # In DEV_MODE nothing is sent over the wire – the "to" is the configured chat/console.
    assert all(m["to"] for m in tg)


# ---------- donations and Razorpay ----------

def sign(order_id, payment_id, secret="dev_razorpay_secret"):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def order(client, amount=1500, anonymous=True):
    return client.post("/donations/order", json={"amount_inr": amount, "donor_name": "Aarav",
                       "donor_email": "aarav@example.com", "anonymous": anonymous}).json()


def test_any_amount_order_and_valid_payment(client):
    o = order(client, 1500)
    assert o["amount"] == 150000 and o["mock"] is True
    r = client.post("/verify-payment", json={"order_id": o["order_id"], "payment_id": "pay_1",
                                              "signature": sign(o["order_id"], "pay_1")})
    assert r.status_code == 200 and r.json()["verified"] is True
    camp = client.get("/campaigns").json()
    assert camp["donor_wall"][0]["name"] == "Anonymous"
    assert camp["campaigns"][0]["raised_inr"] == 1500
    assert any(m["channel"] == "email" for m in db.outbox)


def test_bad_signature_is_rejected_and_not_recorded(client):
    o = order(client)
    r = client.post("/verify-payment", json={"order_id": o["order_id"], "payment_id": "pay_1", "signature": "bad"})
    assert r.status_code == 400 and db.ledger == []


def test_duplicate_payment_is_idempotent(client):
    o = order(client, 499)
    body = {"order_id": o["order_id"], "payment_id": "pay_9", "signature": sign(o["order_id"], "pay_9")}
    client.post("/verify-payment", json=body)
    assert client.post("/verify-payment", json=body).json()["new"] is False
    assert len(db.ledger) == 1


def test_amount_limits_and_state_adaptive_campaign(client):
    assert client.post("/donations/order", json={"amount_inr": 5, "donor_email": "a@b.com"}).status_code == 422
    assert client.get("/campaigns").json()["active"] == "upkeep"
    client.post("/gate-command", json={"action": "SHUTDOWN", "rationale": "Plume confirmed"}, headers=OP1)
    assert client.get("/campaigns").json()["active"] == "relief"


# ---------- Razorpay webhook ----------

def webhook_event(order_id, payment_id="pay_wh", event="payment.captured"):
    return {"event": event,
            "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id}}}}


def test_webhook_records_payment_with_valid_signature(client):
    o = order(client, 750)
    raw = json.dumps(webhook_event(o["order_id"], "pay_wh1")).encode()
    sig = hmac.new(b"dev_razorpay_secret", raw, hashlib.sha256).hexdigest()
    r = client.post("/donations/webhook", content=raw,
                    headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 200 and r.json()["status"] == "processed"
    assert len(db.ledger) == 1 and db.ledger[0]["payment_id"] == "pay_wh1"
    assert db.ledger[0]["impact_liters"] == 1500  # 750 INR * 2 L


def test_webhook_rejects_bad_signature(client):
    o = order(client, 750)
    raw = json.dumps(webhook_event(o["order_id"], "pay_wh2")).encode()
    r = client.post("/donations/webhook", content=raw, headers={"X-Razorpay-Signature": "bad"})
    assert r.status_code == 400 and db.ledger == []


def test_webhook_is_idempotent_and_ignores_unknown_orders(client):
    o = order(client, 499)
    raw = json.dumps(webhook_event(o["order_id"], "pay_wh3")).encode()
    sig = hmac.new(b"dev_razorpay_secret", raw, hashlib.sha256).hexdigest()
    headers = {"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    assert client.post("/donations/webhook", content=raw, headers=headers).json()["new"] is True
    assert client.post("/donations/webhook", content=raw, headers=headers).json()["new"] is False
    assert len(db.ledger) == 1

    unknown = json.dumps(webhook_event("order_does_not_exist", "pay_x")).encode()
    usig = hmac.new(b"dev_razorpay_secret", unknown, hashlib.sha256).hexdigest()
    r = client.post("/donations/webhook", content=unknown,
                    headers={"X-Razorpay-Signature": usig, "Content-Type": "application/json"})
    assert r.status_code == 200 and r.json()["status"] == "ignored"


# ---------- Amazon Location: map config and river-health GeoJSON ----------

def test_map_config_hides_api_key(client):
    r = client.get("/map-config")
    assert r.status_code == 200
    body = r.json()
    assert {"region", "style", "style_url"} <= body.keys()
    assert "api_key" not in body  # key must never be exposed to clients
    assert body["region"] == config.AWS_REGION
    # style_url points at the backend descriptor proxy, carrying no key or AWS host
    assert "/map/style/" in body["style_url"]
    assert "key=" not in body["style_url"] and "maps.geo." not in body["style_url"]


def test_map_descriptor_proxy_strips_key_and_rewrites_tiles(client, monkeypatch):
    import app.routers.monitoring as mon
    monkeypatch.setattr(config, "LOCATION_API_KEY", "v1.public.SECRET")
    fake = {
        "version": 8,
        "sources": {"aws": {"type": "vector", "tiles": [
            "https://maps.geo.ap-southeast-2.amazonaws.com/v2/tiles/vector.basemap/{z}/{x}/{y}?key=v1.public.SECRET"]}},
        "sprite": "https://maps.geo.ap-southeast-2.amazonaws.com/v2/styles/x/sprites/sprites",
        "glyphs": "https://maps.geo.ap-southeast-2.amazonaws.com/v2/glyphs/{fontstack}/{range}.pbf",
    }

    class FakeResp:
        status_code, ok = 200, True
        def json(self):
            return fake

    monkeypatch.setattr(mon.requests, "get", lambda *a, **k: FakeResp())
    body = client.get("/map/style/Standard/descriptor").json()
    assert "v1.public.SECRET" not in json.dumps(body)  # key fully stripped
    tiles0 = body["sources"]["aws"]["tiles"][0]
    assert "/map/tiles/vector.basemap/{z}/{x}/{y}" in tiles0 and "maps.geo." not in tiles0


def test_river_health_geojson_structure(client):
    r = client.get("/river-health/yamuna-panipat")
    assert r.status_code == 200
    gj = r.json()
    assert gj["type"] == "FeatureCollection"
    assert len(gj["features"]) == len(config.STATION_COORDS) - 1
    assert all(f["properties"]["health_status"] == "NORMAL" for f in gj["features"])
    # RFC 7946 coordinate order is [lon, lat]: lon ~76.9-77.3, lat ~28.7-29.5.
    lon, lat = gj["features"][0]["geometry"]["coordinates"][0]
    assert 76.9 <= lon <= 77.3 and 28.7 <= lat <= 29.5


def test_river_health_threat_escalation(client):
    client.post("/telemetry", json=telemetry(toxic=True))  # CRITICAL at STATION_02_PANIPAT
    gj = client.get("/river-health/yamuna-panipat").json()
    reach = next(f for f in gj["features"] if f["properties"]["from_node"] == "STATION_02_PANIPAT")
    assert reach["properties"]["health_status"] == "CRITICAL"
    assert reach["properties"]["threat_level"] == "CRITICAL_LEVEL_3"


def test_river_health_time_window_bounds_incident_age(client):
    client.post("/telemetry", json=telemetry(toxic=True))
    inc = next(i for i in db.incidents.values() if i["station_id"] == "STATION_02_PANIPAT")
    inc["last_seen"] = int(time.time()) - 2 * 3600  # last unhealthy reading 2h ago

    def status_at(hours):
        gj = client.get(f"/river-health/yamuna-panipat?hours={hours}").json()
        reach = next(f for f in gj["features"] if f["properties"]["from_node"] == "STATION_02_PANIPAT")
        return reach["properties"]["health_status"]

    assert status_at(1) == "NORMAL"      # 1h window excludes the 2h-old incident
    assert status_at(24) == "CRITICAL"   # 24h window includes it
    # Query bounds are enforced (ge=1, le=168)
    assert client.get("/river-health/x?hours=0").status_code == 422
    assert client.get("/river-health/x?hours=200").status_code == 422


# ---------- auth: /me, /auth/config, and Google operator sign-in ----------

def test_auth_config_and_me(client):
    assert "google_client_id" in client.get("/auth/config").json()
    assert client.get("/me").json()["role"] == "public"
    assert client.get("/me", headers=OP1).json()["role"] == "operator"


def test_google_signin_authorizes_only_allowlisted_operators(client, monkeypatch):
    from app import auth
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "test.apps.googleusercontent.com")
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", ["chief@dept.gov.in", "@ops.gov.in"])
    state = {"email": ""}
    monkeypatch.setattr(auth, "_verify_google",
                        lambda token: {"sub": "123456789", "email_verified": True,
                                       "email": state["email"], "name": "Op",
                                       "hd": state["email"].rsplit("@", 1)[-1]})
    jwt = {"Authorization": "Bearer aaa.bbb.ccc"}  # JWT-shaped (two dots); value is irrelevant to the fake verifier

    state["email"] = "chief@dept.gov.in"          # exact allowlist match
    assert client.get("/me", headers=jwt).json()["role"] == "operator"
    state["email"] = "eng@ops.gov.in"             # domain allowlist match
    assert client.get("/stations", headers=jwt).status_code == 200
    state["email"] = "stranger@gmail.com"         # verified but not authorized
    assert client.get("/me", headers=jwt).json()["role"] == "authenticated"
    assert client.get("/stations", headers=jwt).status_code == 403
