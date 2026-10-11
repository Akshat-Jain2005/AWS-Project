"""Exercise Google's actual signature/claim verifier with local signing keys.

Only the certificate fetch is replaced; no Google account or network is used.
"""
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from google.auth import crypt, jwt
from google.oauth2 import id_token

from app import auth, config
from conftest import OP1, REPORTER, subscribe_and_verify


@pytest.fixture
def google_token(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
                                          serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = crypt.RSASigner.from_string(private, key_id="local-test-key")
    monkeypatch.setattr(id_token, "_fetch_certs", lambda *args, **kwargs: {"local-test-key": public})
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "test.apps.googleusercontent.com")
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", ["operator@gmail.com", "@ops.example.org"])

    def make(**changes):
        now = int(time.time())
        claims = dict(iss="https://accounts.google.com", aud=config.GOOGLE_CLIENT_ID,
                      sub="123456789", iat=now - 10, exp=now + 3600,
                      email="operator@gmail.com", email_verified=True, name="Operator")
        claims.update(changes)
        return {"Authorization": "Bearer " + jwt.encode(signer, claims).decode()}
    return make


def test_valid_google_login_and_stable_subject(client, google_token):
    headers = google_token()
    result = client.get("/me", headers=headers)
    assert result.json()["role"] == "operator"
    assert result.json()["id"] == "google:123456789"
    assert result.headers["cache-control"] == "no-store"
    assert client.get("/stations", headers=headers).status_code == 200
    renamed = google_token(email="renamed@ops.example.org", hd="ops.example.org")
    assert client.get("/me", headers=renamed).json()["id"] == result.json()["id"]


@pytest.mark.parametrize("claims", [
    {"aud": "attacker.apps.googleusercontent.com"},
    {"iss": "https://attacker.example.org"},
    {"exp": 1}, {"iat": 9999999999}, {"sub": ""}, {"sub": None},
])
def test_invalid_claims_cannot_access_operator_routes(client, google_token, claims):
    headers = google_token(**claims)
    assert client.get("/me", headers=headers).json()["role"] == "public"
    assert client.get("/stations", headers=headers).status_code == 401
    assert client.post("/gate-command", headers=headers,
                       json={"action": "SHUTDOWN", "rationale": "Attempt unauthorized shutdown"}).status_code == 401


def test_bad_signature_is_rejected(client, google_token):
    header = google_token()["Authorization"]
    signed, signature = header.rsplit(".", 1)
    forged = signed + "." + ("A" if signature[0] != "A" else "B") + signature[1:]
    assert client.get("/stations", headers={"Authorization": forged}).status_code == 401


@pytest.mark.parametrize("claims", [
    {"email_verified": False}, {"email_verified": "true"},
    {"email": "stranger@gmail.com"},
    {"email": "operator@ops.example.org"},
    {"email": "operator@ops.example.org", "hd": "attacker.example.org"},
    {"email": "operator@ops.example.org.attacker.example.org", "hd": "attacker.example.org"},
])
def test_unverified_or_unauthorized_users_are_refused(client, google_token, claims):
    headers = google_token(**claims)
    assert client.get("/me", headers=headers).json()["role"] == "authenticated"
    assert client.get("/stations", headers=headers).status_code == 403


def test_workspace_domain_requires_google_hosted_domain(client, google_token):
    headers = google_token(email="member@ops.example.org", hd="ops.example.org")
    assert client.get("/stations", headers=headers).status_code == 200


def test_third_party_email_is_not_enough_even_with_exact_allowlist(client, google_token, monkeypatch):
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", ["operator@third-party.example.org"])
    headers = google_token(email="operator@third-party.example.org")
    assert client.get("/stations", headers=headers).status_code == 403


def test_empty_allowlist_fails_closed(client, google_token, monkeypatch):
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", [])
    assert client.get("/stations", headers=google_token()).status_code == 403


def test_verification_failure_does_not_leak_credentials(client, google_token, monkeypatch, caplog):
    def fail(*args, **kwargs):
        raise ValueError("sensitive-token-do-not-log")
    monkeypatch.setattr(id_token, "verify_oauth2_token", fail)
    assert client.get("/stations", headers=google_token()).status_code == 401
    assert "sensitive-token-do-not-log" not in caplog.text


def test_development_credentials_disabled_in_production(client, monkeypatch):
    monkeypatch.setattr(config, "DEV_MODE", False)
    assert client.get("/auth/config").json()["dev_login_enabled"] is False
    for headers in (OP1, REPORTER):
        assert client.get("/me", headers=headers).json()["role"] == "public"
        assert client.get("/stations", headers=headers).status_code == 401


def test_public_configuration_contains_no_secrets(client):
    response = client.get("/auth/config")
    assert set(response.json()) == {"google_client_id", "dev_login_enabled",
                                    "password_login_enabled", "registration_enabled",
                                    "staff_login_enabled"}
    assert response.headers["cache-control"] == "no-store"


def test_google_identity_cannot_self_approve_after_email_change(client, google_token, monkeypatch):
    monkeypatch.setattr(config, "TWO_PERSON_THRESHOLD", 0)
    subscribe_and_verify(client)
    first = google_token()
    alert = client.post("/alerts/send", headers=first,
                        json={"wards": ["Civil Lines"], "message": "Test advisory"}).json()
    assert alert["status"] == "pending_approval"
    renamed = google_token(email="renamed@ops.example.org", hd="ops.example.org")
    assert client.post(f"/alerts/{alert['id']}/approve", headers=renamed).status_code == 403
    second = google_token(sub="987654321", email="second@ops.example.org", hd="ops.example.org")
    assert client.post(f"/alerts/{alert['id']}/approve", headers=second).status_code == 200
