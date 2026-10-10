# app/services/audit.py
import hashlib
import json

GENESIS_HASH = "0" * 64
_HASHED_FIELDS = ("seq", "audit_id", "timestamp", "actor", "actor_id", "action", "detail")


def entry_hash(fields, prev_hash):
    payload = {k: fields.get(k) for k in _HASHED_FIELDS}
    payload["prev_hash"] = prev_hash
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


def verify_chain(entries):
    prev = GENESIS_HASH
    for i, e in enumerate(entries):
        if e.get("seq") != i or e.get("prev_hash") != prev or entry_hash(e, prev) != e.get("hash"):
            return {"intact": False, "entries": len(entries), "broken_at": i}
        prev = e["hash"]
    return {"intact": True, "entries": len(entries), "head_hash": prev}
