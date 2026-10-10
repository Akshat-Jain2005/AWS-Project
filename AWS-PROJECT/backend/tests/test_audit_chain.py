# tests/test_audit_chain.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.services.audit import GENESIS_HASH, entry_hash, verify_chain


def _chain(n):
    entries, prev = [], GENESIS_HASH
    for i in range(n):
        e = {"seq": i, "audit_id": f"a{i}", "timestamp": 100 + i,
             "actor": "op", "actor_id": None, "action": "ACT", "detail": {"i": i},
             "prev_hash": prev}
        e["hash"] = entry_hash(e, prev)
        entries.append(e); prev = e["hash"]
    return entries


def test_entry_hash_is_deterministic_and_content_sensitive():
    e = {"seq": 0, "audit_id": "a", "timestamp": 1, "actor": "op",
         "actor_id": None, "action": "ACT", "detail": {"x": 1}}
    assert entry_hash(e, GENESIS_HASH) == entry_hash(dict(e), GENESIS_HASH)
    assert entry_hash({**e, "action": "OTHER"}, GENESIS_HASH) != entry_hash(e, GENESIS_HASH)


def test_verify_chain_intact_and_empty():
    assert verify_chain(_chain(3))["intact"] is True
    empty = verify_chain([])
    assert empty["intact"] is True and empty["entries"] == 0 and empty["head_hash"] == GENESIS_HASH


def test_verify_chain_detects_edit_and_reorder():
    c = _chain(3); c[1]["detail"] = {"tampered": True}
    assert verify_chain(c) == {"intact": False, "entries": 3, "broken_at": 1}
    c2 = _chain(3); c2[0], c2[1] = c2[1], c2[0]
    assert verify_chain(c2)["intact"] is False
