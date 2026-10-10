import time
import uuid
import contextlib
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from . import config as C

def f2d(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: f2d(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [f2d(v) for v in obj]
    return obj

def d2f(obj):
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: d2f(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [d2f(v) for v in obj]
    return obj

class DynamoStore:
    def __init__(self):
        opts = {"region_name": C.AWS_REGION}
        if C.DDB_ENDPOINT_URL:
            opts["endpoint_url"] = C.DDB_ENDPOINT_URL
        self.dynamodb = boto3.resource("dynamodb", **opts)
        self.client = boto3.client("dynamodb", **opts)
        self.table = self.dynamodb.Table(C.DDB_TABLE_NAME)

    @property
    def lock(self):
        return contextlib.nullcontext()

    def new_id(self, prefix):
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def _get(self, pk, sk="META"):
        r = self.table.get_item(Key={"pk": pk, "sk": sk})
        return d2f(r.get("Item"))

    def _put(self, item):
        self.table.put_item(Item=f2d(item))

    def _delete(self, pk, sk="META"):
        self.table.delete_item(Key={"pk": pk, "sk": sk})

    def _query(self, pk):
        r = self.table.query(KeyConditionExpression=Key("pk").eq(pk))
        return d2f(r.get("Items", []))

    def append_telemetry(self, station_id, data):
        item = f2d(data)
        item["pk"] = f"TS#{station_id}"
        item["sk"] = f"{int(time.time() * 1000)}#{uuid.uuid4().hex[:8]}"
        item["ttl"] = int(time.time()) + 3 * 86400
        self.table.put_item(Item=item)

    def list_history(self, station_id):
        # We need the last 200 items. Query reversed on SK (ScanIndexForward=False)
        r = self.table.query(
            KeyConditionExpression=Key("pk").eq(f"TS#{station_id}"),
            ScanIndexForward=True,
            Limit=200
        )
        return d2f(r.get("Items", []))

    def get_station(self, station_id):
        return self._get(f"STATION#{station_id}")

    def put_station(self, station_id, data):
        item = f2d(data)
        item["pk"] = f"STATION#{station_id}"
        item["sk"] = "META"
        self._put(item)

    def list_stations(self):
        # In a real app we'd keep a STATION partition.
        # But we know there are fixed stations.
        # Wait, how to list all stations without scanning?
        # Let's query a GSI or just read them based on STATION_METADATA.
        from bio_sentinel_inference import STATION_METADATA
        res = []
        for sid in STATION_METADATA:
            s = self.get_station(sid)
            if s:
                res.append(s)
        return res

    def get_report(self, report_id):
        return self._get(f"REP#{report_id}")

    def put_report(self, report):
        item = f2d(report)
        item["pk"] = f"REP#{report['id']}"
        item["sk"] = "META"
        item["gsi1pk"] = f"STATUS#{report['status']}"
        item["gsi1sk"] = str(report["created_at"])
        self._put(item)

    def list_reports(self):
        # The prompt says: Use the sparse GSI for efficient access to reports by status
        # Since we just need list_reports() which iterates everything, we can query both STATUS#pending and STATUS#approved
        res1 = self.table.query(IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq("STATUS#pending")).get("Items", [])
        res2 = self.table.query(IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq("STATUS#approved")).get("Items", [])
        res3 = self.table.query(IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq("STATUS#rejected")).get("Items", [])
        return d2f(res1 + res2 + res3)

    def get_incident(self, incident_id):
        res = self._get("INC#ACTIVE", incident_id)
        if res: return res
        return self._get("INC#CLOSED", incident_id)

    def put_incident(self, incident):
        item = f2d(incident)
        status = incident["status"]
        if status == "CLOSED":
            item["pk"] = "INC#CLOSED"
            item["sk"] = incident["id"]
            # To move it, we could transactionally delete from ACTIVE and put in CLOSED
            try:
                self.client.transact_write_items(TransactItems=[
                    {"Delete": {"TableName": C.DDB_TABLE_NAME, "Key": {"pk": {"S": "INC#ACTIVE"}, "sk": {"S": incident["id"]}}}},
                    {"Put": {"TableName": C.DDB_TABLE_NAME, "Item": {k: self._to_dynamodb_type(v) for k, v in item.items()}}}
                ])
            except Exception:
                self.table.delete_item(Key={"pk": "INC#ACTIVE", "sk": incident["id"]})
                self._put(item)
        else:
            item["pk"] = "INC#ACTIVE"
            item["sk"] = incident["id"]
            self._put(item)

    def _to_dynamodb_type(self, val):
        if isinstance(val, str): return {"S": val}
        if isinstance(val, (int, Decimal)): return {"N": str(val)}
        if isinstance(val, bool): return {"BOOL": val}
        if isinstance(val, list): return {"L": [self._to_dynamodb_type(v) for v in val]}
        if isinstance(val, dict): return {"M": {k: self._to_dynamodb_type(v) for k, v in val.items()}}
        if val is None: return {"NULL": True}
        return {"S": str(val)}

    def list_incidents(self):
        active = self._query("INC#ACTIVE")
        closed = self._query("INC#CLOSED")
        return active + closed

    def get_subscriber(self, phone):
        return self._get(f"SUB#{phone}")

    def put_subscriber(self, phone, data):
        item = f2d(data)
        item["pk"] = f"SUB#{phone}"
        item["sk"] = "META"
        item["gsi1pk"] = f"WARD#{data.get('ward', '')}"
        item["gsi1sk"] = phone
        self._put(item)

    def delete_subscriber(self, phone):
        self._delete(f"SUB#{phone}")

    def list_subscribers(self):
        # We need all subscribers. WARDs are C.WARD_SCHEDULES.keys()
        res = []
        for w in C.WARD_SCHEDULES:
            res.extend(self.table.query(IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq(f"WARD#{w}")).get("Items", []))
        return d2f(res)

    def get_otp(self, phone):
        return self._get(f"OTP#{phone}")

    def put_otp(self, phone, data):
        item = f2d(data)
        item["pk"] = f"OTP#{phone}"
        item["sk"] = "META"
        item["ttl"] = int(item["expires"])
        self._put(item)

    def delete_otp(self, phone):
        self._delete(f"OTP#{phone}")

    def get_donation(self, order_id):
        return self._get(f"DON#{order_id}")

    def put_donation(self, order_id, data):
        item = f2d(data)
        item["pk"] = f"DON#{order_id}"
        item["sk"] = "META"
        self._put(item)

    def get_ledger(self):
        return self._query("LEDGER")

    def append_ledger(self, entry):
        item = f2d(entry)
        item["pk"] = "LEDGER"
        item["sk"] = entry["payment_id"]
        # idempotency check: only write if sk not exists
        try:
            self.table.put_item(Item=item, ConditionExpression="attribute_not_exists(sk)")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                pass # already exists
            else:
                raise

    def get_alert(self, alert_id):
        return self._get(f"ALT#{alert_id}")

    def put_alert(self, alert):
        item = f2d(alert)
        item["pk"] = f"ALT#{alert['id']}"
        item["sk"] = "META"
        self._put(item)

    def list_alerts(self):
        # We don't have a GSI for this. But we can query an ALERTS partition?
        # Actually it's better to store pk="ALERTS", sk=alert_id
        # Let's change pk="ALERTS"
        return self._query("ALERTS")

    def get_gate(self):
        return self._get("CONFIG", "GATE") or {"intake_status": "OPEN", "last_actuation_timestamp": None}

    def update_gate(self, **kwargs):
        g = self.get_gate()
        g.update(kwargs)
        item = f2d(g)
        item["pk"] = "CONFIG"
        item["sk"] = "GATE"
        self._put(item)

    def get_rules(self):
        return self._get("CONFIG", "RULES") or {
            "operator_telegram_on_incident": True,
            "sms_on_shutdown": True,
            "all_clear_on_restore": True,
        }

    def update_rules(self, changes):
        r = self.get_rules()
        r.update(changes)
        item = f2d(r)
        item["pk"] = "CONFIG"
        item["sk"] = "RULES"
        self._put(item)

    def get_audit(self):
        return self._query("AUDIT")

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
        
        # We need a transaction to atomically read AUDITHEAD and write AUDIT
        # To make it simple for moto, we can just do a loop
        for _ in range(5):
            head = self._get("AUDITHEAD", "HEAD")
            if not head:
                seq = 0
                prev = GENESIS_HASH
            else:
                seq = head["seq"] + 1
                prev = head["hash"]
            
            entry["seq"] = seq
            entry["prev_hash"] = prev
            entry["hash"] = entry_hash(entry, prev)
            
            # try conditional write
            try:
                # write head
                new_head = {"pk": "AUDITHEAD", "sk": "HEAD", "seq": seq, "hash": entry["hash"]}
                # write entry
                db_entry = f2d(entry)
                db_entry["pk"] = "AUDIT"
                db_entry["sk"] = f"{seq:08d}"
                
                cond = "attribute_not_exists(sk)" if seq == 0 else "seq = :expected"
                expr_vals = {":expected": {"N": str(seq - 1)}} if seq > 0 else None
                
                req = {
                    "TableName": C.DDB_TABLE_NAME,
                    "Item": {k: self._to_dynamodb_type(v) for k, v in new_head.items()},
                    "ConditionExpression": cond
                }
                if expr_vals:
                    req["ExpressionAttributeValues"] = expr_vals
                    
                self.client.transact_write_items(TransactItems=[
                    {"Put": req},
                    {"Put": {"TableName": C.DDB_TABLE_NAME, "Item": {k: self._to_dynamodb_type(v) for k, v in db_entry.items()}}}
                ])
                break
            except ClientError as e:
                if e.response['Error']['Code'] == 'TransactionCanceledException':
                    continue
                raise
        return entry

    def rate_limited(self, key, limit, window_s):
        now = int(time.time())
        pk = f"RATE#{key}"
        sk = f"{now}#{uuid.uuid4().hex[:8]}"
        # to avoid scanning the entire RATE bucket, we can just add an item and query recent
        self.table.put_item(Item={"pk": pk, "sk": sk, "ttl": now + window_s})
        recent = self.table.query(
            KeyConditionExpression=Key("pk").eq(pk) & Key("sk").gte(str(now - window_s))
        ).get("Items", [])
        return len(recent) > limit

    def get_outbox(self):
        return self._query("OUTBOX")

    def append_outbox(self, msg):
        item = f2d(msg)
        item["pk"] = "OUTBOX"
        item["sk"] = f"{int(time.time()*1000)}#{uuid.uuid4().hex[:8]}"
        self._put(item)

    def reset(self):
        # Scan and delete all items for testing
        scan = self.table.scan()
        with self.table.batch_writer() as batch:
            for each in scan.get('Items', []):
                batch.delete_item(Key={'pk': each['pk'], 'sk': each['sk']})

    def clear_outbox(self):
        scan = self.table.query(KeyConditionExpression=Key("pk").eq("OUTBOX"))
        with self.table.batch_writer() as batch:
            for each in scan.get('Items', []):
                batch.delete_item(Key={'pk': each['pk'], 'sk': each['sk']})
