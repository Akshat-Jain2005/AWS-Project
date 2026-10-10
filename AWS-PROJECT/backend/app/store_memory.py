import threading
import time
import uuid
import copy
from collections import defaultdict, deque

class MemoryStore:
    def __init__(self):
        self.reset()

    def reset(self):
        self._lock = threading.RLock()
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

    @property
    def lock(self):
        return self._lock

    def new_id(self, prefix):
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def append_telemetry(self, station_id, data):
        with self.lock:
            self.history[station_id].append(data)

    def list_history(self, station_id):
        with self.lock:
            return list(self.history[station_id])

    def get_station(self, station_id):
        with self.lock:
            return self.stations.get(station_id)

    def put_station(self, station_id, data):
        with self.lock:
            self.stations[station_id] = data

    def list_stations(self):
        with self.lock:
            return list(self.stations.values())
            
    def get_stations_dict(self):
        with self.lock:
            return {k: v for k, v in self.stations.items()}

    def get_report(self, report_id):
        with self.lock:
            return self.reports.get(report_id)

    def put_report(self, report):
        with self.lock:
            self.reports[report["id"]] = report

    def list_reports(self):
        with self.lock:
            return list(self.reports.values())

    def get_incident(self, incident_id):
        with self.lock:
            return self.incidents.get(incident_id)

    def put_incident(self, incident):
        with self.lock:
            self.incidents[incident["id"]] = incident

    def list_incidents(self):
        with self.lock:
            return list(self.incidents.values())

    def get_subscriber(self, phone):
        with self.lock:
            return self.subscribers.get(phone)

    def put_subscriber(self, phone, data):
        with self.lock:
            self.subscribers[phone] = data

    def delete_subscriber(self, phone):
        with self.lock:
            self.subscribers.pop(phone, None)

    def list_subscribers(self):
        with self.lock:
            return list(self.subscribers.values())

    def get_otp(self, phone):
        with self.lock:
            return self.otps.get(phone)

    def put_otp(self, phone, data):
        with self.lock:
            self.otps[phone] = data

    def delete_otp(self, phone):
        with self.lock:
            self.otps.pop(phone, None)

    def get_donation(self, order_id):
        with self.lock:
            return self.donations.get(order_id)

    def put_donation(self, order_id, data):
        with self.lock:
            self.donations[order_id] = data

    def get_ledger(self):
        with self.lock:
            return list(self.ledger)

    def append_ledger(self, entry):
        with self.lock:
            self.ledger.append(entry)

    def get_alert(self, alert_id):
        with self.lock:
            return self.alerts.get(alert_id)

    def put_alert(self, alert):
        with self.lock:
            self.alerts[alert["id"]] = alert

    def list_alerts(self):
        with self.lock:
            return list(self.alerts.values())

    def get_gate(self):
        with self.lock:
            return dict(self.gate)

    def update_gate(self, **kwargs):
        with self.lock:
            self.gate.update(kwargs)

    def get_rules(self):
        with self.lock:
            return dict(self.rules)

    def update_rules(self, changes):
        with self.lock:
            self.rules.update(changes)

    def get_audit(self):
        with self.lock:
            return list(self.audit)

    def log_audit(self, actor, action, detail=None, actor_id=None):
        from .services.audit import entry_hash, GENESIS_HASH
        entry = {
            "audit_id": uuid.uuid4().hex[:8],
            "timestamp": int(time.time()),
            "actor": actor,
            "actor_id": actor_id,
            "action": action,
            "detail": detail or {},
        }
        with self.lock:
            seq = len(self.audit)
            prev = self.audit[-1]["hash"] if seq > 0 else GENESIS_HASH
            entry["seq"] = seq
            entry["prev_hash"] = prev
            entry["hash"] = entry_hash(entry, prev)
            self.audit.append(entry)
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

    def get_outbox(self):
        with self.lock:
            return list(self.outbox)

    def append_outbox(self, msg):
        with self.lock:
            self.outbox.append(msg)

    def clear_outbox(self):
        self.outbox.clear()
