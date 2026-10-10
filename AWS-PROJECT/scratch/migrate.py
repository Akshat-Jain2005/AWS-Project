import re
import os

FILES = [
    "backend/app/services/payments.py",
    "backend/app/services/incidents.py",
    "backend/app/services/alerts.py",
    "backend/app/services/notify.py",
    "backend/app/routers/payments.py",
    "backend/app/routers/subscribers.py",
    "backend/app/routers/reports.py",
    "backend/app/routers/operator.py",
    "backend/app/routers/monitoring.py"
]

def process_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Generic Replacements for all collections
    # db.incidents.values() -> db.list_incidents()
    content = re.sub(r'db\.([a-z_]+)\.values\(\)', r'db.list_\1()', content)
    
    # db.reports.get(id) -> db.get_report(id)
    # dict gets: db.reports.get(x) -> db.get_report(x)
    content = re.sub(r'db\.(reports|incidents|subscribers|otps|stations|donations|alerts)\.get\(([^,)]+)(?:,\s*\{\})?\)', r'db.get_\1(\2)', content)
    
    # db.history[sid].append(x) -> db.append_telemetry(sid, x)
    content = re.sub(r'db\.history\[([^\]]+)\]\.append\((.+)\)', r'db.append_telemetry(\1, \2)', content)

    # db.outbox.append(x) -> db.append_outbox(x)
    content = re.sub(r'db\.outbox\.append\((.+)\)', r'db.append_outbox(\1)', content)

    # db.ledger.append(x) -> db.append_ledger(x)
    content = re.sub(r'db\.ledger\.append\((.+)\)', r'db.append_ledger(\1)', content)
    
    # for e in db.ledger: -> for e in db.get_ledger():
    content = re.sub(r'db\.ledger', r'db.get_ledger()', content)

    # db.audit -> db.get_audit()
    # db.gate -> db.get_gate()
    content = re.sub(r'db\.audit', r'db.get_audit()', content)
    content = re.sub(r'db\.gate', r'db.get_gate()', content)
    content = re.sub(r'db\.rules', r'db.get_rules()', content)

    with open(filepath, "w") as f:
        f.write(content)

for f in FILES:
    process_file(f)
