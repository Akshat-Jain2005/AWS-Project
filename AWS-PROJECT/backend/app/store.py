"""In-memory store. Every method here maps to a DynamoDB table later:
telemetry, reports, incidents, subscribers, campaigns (ledger), alerts, audit."""
import threading
import time
import uuid
from collections import defaultdict, deque


class Store:
    def __init__(self):
        self.reset()

    def reset(self):
        self.lock = threading.RLock()
        self.history = defaultdict(lambda: deque(maxlen=200))
        self.stations = {}
        self.reports = {}
        self.incidents = {}
        self.subscribers = {}
        self.otps = {}
        self.donations = {}
        self.ledger = []
        self.alerts = {}
        self.audit = []
        self.outbox = []
        self.rate = defaultdict(list)
        self.gate = {"intake_status": "OPEN", "last_actuation_timestamp": None}
        self.rules = {
            "operator_telegram_on_incident": True,
            "sms_on_shutdown": True,
            "all_clear_on_restore": True,
        }

    def new_id(self, prefix):
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def log_audit(self, actor, action, detail=None, actor_id=None):
        entry = {
            "audit_id": uuid.uuid4().hex[:8],
            "timestamp": int(time.time()),
            "actor": actor,
            "actor_id": actor_id,
            "action": action,
            "detail": detail or {},
        }
        with self.lock:
            self.audit.append(entry)  # append-only: no update or delete method exists
        return entry

    def rate_limited(self, key, limit, window_s):
        now = time.time()
        with self.lock:
            recent = [t for t in self.rate[key] if now - t < window_s]
            if len(recent) >= limit:
                self.rate[key] = recent
                return True
            recent.append(now)
            self.rate[key] = recent
            return False


db = Store()
