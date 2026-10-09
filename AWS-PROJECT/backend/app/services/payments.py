import hashlib
import hmac
import time
import requests
from .. import config as C
from ..store import db
from . import notify


def _secret():
    return C.RAZORPAY_KEY_SECRET or C.DEV_RAZORPAY_SECRET


def mock_mode():
    return not (C.RAZORPAY_KEY_ID and C.RAZORPAY_KEY_SECRET)


def create_order(req, campaign_id):
    receipt = db.new_id("rcpt")
    if mock_mode():
        order_id, key_id = db.new_id("order_mock"), "rzp_test_mock"
    else:
        r = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(C.RAZORPAY_KEY_ID, C.RAZORPAY_KEY_SECRET),
            json={"amount": req.amount_inr * 100, "currency": "INR", "receipt": receipt,
                  "notes": {"campaign_id": campaign_id}},
            timeout=10,
        )
        r.raise_for_status()
        order_id, key_id = r.json()["id"], C.RAZORPAY_KEY_ID
    db.donations[order_id] = {
        "order_id": order_id, "campaign_id": campaign_id, "amount_inr": req.amount_inr,
        "donor_name": req.donor_name, "donor_email": req.donor_email,
        "anonymous": req.anonymous, "status": "created", "created_at": int(time.time()),
    }
    return {"order_id": order_id, "currency": "INR", "amount": req.amount_inr * 100,
            "key_id": key_id, "mock": mock_mode()}


def signature_ok(order_id, payment_id, signature):
    expected = hmac.new(_secret().encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def record_payment(order_id, payment_id):
    d = db.donations[order_id]
    with db.lock:
        existing = next((e for e in db.ledger if e["payment_id"] == payment_id), None)
        if existing:
            return existing, False
        d["status"], d["payment_id"] = "paid", payment_id
        entry = {"payment_id": payment_id, "order_id": order_id, "campaign_id": d["campaign_id"],
                 "amount_inr": d["amount_inr"], "name": "Anonymous" if d["anonymous"] else (d["donor_name"] or "Donor"),
                 "paid_at": int(time.time())}
        db.ledger.append(entry)
    notify.send_email(d["donor_email"], "Your Bio-Sentinel impact receipt",
                      f"Thank you. We received Rs {d['amount_inr']} (payment {payment_id}).")
    return entry, True


def totals():
    out = {k: 0 for k in C.CAMPAIGNS}
    for e in db.ledger:
        out[e["campaign_id"]] += e["amount_inr"]
    return out
