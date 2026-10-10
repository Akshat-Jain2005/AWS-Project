# DynamoDB Migration Plan

## 1. Current State Inspection
- The application stores all state in `backend/app/store.py` within an in-memory `Store` singleton (`db`).
- Collections include: `history`, `stations`, `reports`, `incidents`, `subscribers`, `otps`, `donations`, `ledger`, `alerts`, `audit`, `outbox`, `rate`, `gate`, `rules`.
- Data flow: Routers (`monitoring.py`, `reports.py`, `operator.py`, `payments.py`, `subscribers.py`, `toxicity.py`) and services (`incidents.py`, `alerts.py`, `notify.py`, `payments.py`) import `db` directly and manipulate dictionaries/lists in-place.
- Concurrency: Uses `threading.RLock()` for thread safety.
- Audit Chain: Append-only list with cryptographic hashes linking the sequence.

## 2. Storage Abstraction
We will refactor `backend/app/store.py` into a factory/interface and introduce two implementations:
- `backend/app/store/memory.py`: `MemoryStore`
- `backend/app/store/dynamodb.py`: `DynamoStore`

The `Store` interface will provide methods like:
- `get_station(station_id)`
- `update_station(station_id, data)`
- `append_telemetry(station_id, reading)`
- `get_telemetry(station_id, limit)`
- `get_incident(incident_id)`
- `put_incident(incident)`
- `list_incidents(status=None)`
- `get_report(report_id)`
- `put_report(report)`
- `list_reports(status=None)`
- `rate_limited(key, limit, window_s)`
- `log_audit(entry)`
- `get_audit_log(limit)`
- ... and so on for all entities.

## 3. DynamoDB Architecture
Table: `bio-sentinel` (configurable via `DDB_TABLE_NAME`).
Billing: `PAY_PER_REQUEST`.
Attributes: `pk` (String), `sk` (String), `gsi1pk` (String), `gsi1sk` (String), `ttl` (Number).

**Key Schema Mapping:**
- **Stations**: `pk="STATION#<id>"`, `sk="META"`
- **Telemetry**: `pk="TS#<station_id>"`, `sk="<timestamp>#<uuid>"`, `ttl`
- **Active Incidents**: `pk="INC#ACTIVE"`, `sk="<incident_id>"`
- **Closed Incidents**: `pk="INC#CLOSED"`, `sk="<incident_id>"`
- **Reports**: `pk="REP#<report_id>"`, `sk="META"`, `gsi1pk="STATUS#<status>"`, `gsi1sk="<created_at>"`
- **Subscribers**: `pk="SUB#<phone>"`, `sk="META"`, `gsi1pk="WARD#<ward>"`, `gsi1sk="<phone>"`
- **OTPs**: `pk="OTP#<phone>"`, `sk="META"`, `ttl`
- **Donations**: `pk="DON#<order_id>"`, `sk="META"`
- **Ledger**: `pk="LEDGER"`, `sk="<payment_id>"`
- **Alerts**: `pk="ALT#<alert_id>"`, `sk="META"`
- **Audit Entries**: `pk="AUDIT"`, `sk="<zero_padded_seq>"`
- **Audit Head**: `pk="AUDITHEAD"`, `sk="HEAD"`
- **Rate Limits**: `pk="RATE#<key>"`, `sk="<timestamp>"`, `ttl`
- **Gate/Rules**: `pk="CONFIG"`, `sk="GATE"` / `sk="RULES"`

## 4. Implementation Steps
1. Create storage interface and `MemoryStore` in `backend/app/store/memory.py`.
2. Update all routers and services to use the new interface methods instead of direct dict manipulation.
3. Verify tests still pass with `MemoryStore` (`pytest`).
4. Implement `DynamoStore` in `backend/app/store/dynamodb.py` using `boto3`.
5. Add `Decimal` conversion utilities.
6. Add `create_table.py` utility.
7. Update `config.py` with `STORE_BACKEND`, `DDB_TABLE_NAME`, `DDB_ENDPOINT_URL`.
8. Update `requirements.txt` to include `boto3` and `moto[dynamodb]` for tests.
9. Create `test_dynamodb.py` using `moto` and verify DynamoDB tests pass.
10. Update `README.md` and documentation.
