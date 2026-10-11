"""Email/password accounts, exercised against a mocked DynamoDB (moto).

Account storage requires DynamoDB; moto stands up an in-process table so these
tests need no AWS credentials or network. conftest already sets DEV_MODE=1, so
SESSION_SECRET has its development default and password sign-in is enabled.
"""
import boto3
import pytest
from moto import mock_aws
from fastapi.testclient import TestClient

from app import accounts, config, sessions, totp
from app.main import app


@pytest.fixture
def ddb(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setattr(config, "DDB_ENDPOINT_URL", None)
    accounts._resource = None
    with mock_aws():
        c = boto3.client("dynamodb", region_name=config.AWS_REGION)
        c.create_table(
            TableName=config.DDB_TABLE_NAME,
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"},
                       {"AttributeName": "sk", "KeyType": "RANGE"}],
            AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"},
                                  {"AttributeName": "sk", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        c.get_waiter("table_exists").wait(TableName=config.DDB_TABLE_NAME)
        yield
    accounts._resource = None


@pytest.fixture
def client(ddb):  # overrides conftest.client, adding the mocked table
    return TestClient(app)


def register(client, email="member@example.com", name="Member", password="hunter2hunter"):
    return client.post("/auth/register", json={"email": email, "name": name, "password": password})


def test_register_signs_in_as_member(client):
    r = register(client)
    assert r.status_code == 201
    token = r.json()["token"]
    assert token.startswith("bst1.")
    assert r.json()["user"]["role"] == "authenticated"
    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "authenticated"
    assert me.json()["email"] == "member@example.com"


def test_member_cannot_reach_operator_routes(client):
    token = register(client).json()["token"]
    assert client.get("/stations", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_duplicate_registration_is_rejected(client):
    assert register(client).status_code == 201
    assert register(client, name="Impostor").status_code == 409


@pytest.mark.parametrize("payload", [
    {"email": "not-an-email", "name": "X", "password": "longenough1"},
    {"email": "ok@example.com", "name": "X", "password": "short"},
    {"email": "ok@example.com", "name": "", "password": "longenough1"},
])
def test_registration_validation(client, payload):
    assert client.post("/auth/register", json=payload).status_code == 422


def test_login_round_trip(client):
    register(client)
    r = client.post("/auth/login", json={"email": "member@example.com", "password": "hunter2hunter"})
    assert r.status_code == 200
    assert client.get("/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).json()["role"] == "authenticated"


@pytest.mark.parametrize("creds", [
    {"email": "member@example.com", "password": "wrongpassword"},  # wrong password
    {"email": "ghost@example.com", "password": "hunter2hunter"},   # unknown email
])
def test_bad_login_is_generic(client, creds):
    register(client)
    r = client.post("/auth/login", json=creds)
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect email or password"


def test_tampered_or_expired_token_is_public(client):
    token = register(client).json()["token"]
    forged = token[:-1] + ("A" if token[-1] != "A" else "B")
    assert client.get("/me", headers={"Authorization": f"Bearer {forged}"}).json()["role"] == "public"
    expired = sessions.mint("member@example.com", ttl=-10)
    assert client.get("/me", headers={"Authorization": f"Bearer {expired}"}).json()["role"] == "public"


def test_self_registration_cannot_claim_operator(client, monkeypatch):
    # Even if the email is on the allowlist, a self-registered account stays a
    # member — it is not operator-eligible until ownership is proven.
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", ["member@example.com"])
    token = register(client).json()["token"]
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).json()["role"] == "authenticated"
    assert client.get("/stations", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_operator_eligible_allowlisted_account_gets_operator(client, monkeypatch):
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", ["op@example.com"])
    accounts.set_password("op@example.com", "Op", "operatorpass1", operator_eligible=True)
    token = sessions.mint("op@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/me", headers=headers).json()["role"] == "operator"
    assert client.get("/stations", headers=headers).status_code == 200
    # Dropping the email from the allowlist revokes operator access immediately.
    monkeypatch.setattr(config, "OPERATOR_ALLOWLIST", [])
    assert client.get("/me", headers=headers).json()["role"] == "authenticated"


def test_set_password_requires_google_operator(client):
    # A member (or anonymous) may not bind an operator password.
    token = register(client).json()["token"]
    assert client.post("/auth/set-password", json={"password": "operatorpass1"},
                       headers={"Authorization": f"Bearer {token}"}).status_code == 403
    assert client.post("/auth/set-password", json={"password": "operatorpass1"}).status_code == 403


def test_config_advertises_password_login(client):
    body = client.get("/auth/config").json()
    assert body["password_login_enabled"] is True
    assert body["registration_enabled"] is True
    assert body["staff_login_enabled"] is True


def test_totp_round_trip():
    secret = totp.generate_secret()
    assert totp.verify(secret, totp.now_code(secret)) is True
    assert totp.verify(secret, "000000") is False
    assert totp.verify(secret, totp.now_code(secret, now=0)) is False  # stale counter
    assert totp.verify(secret, "12345") is False  # wrong length


def _provision(role="operator", email="ops@djb.example", password="operatorpass1"):
    record, secret = accounts.create_staff(email, "Staff", password, role)
    return email, password, secret


def test_staff_login_requires_password_and_code(client):
    email, password, secret = _provision()
    ok = client.post("/auth/staff-login", json={
        "role": "operator", "email": email, "password": password, "code": totp.now_code(secret)})
    assert ok.status_code == 200
    headers = {"Authorization": f"Bearer {ok.json()['token']}"}
    assert client.get("/me", headers=headers).json()["role"] == "operator"
    assert client.get("/stations", headers=headers).status_code == 200


@pytest.mark.parametrize("bad", [
    {"code": "000000"},                 # wrong code
    {"password": "wrongpassword"},      # wrong password
    {"role": "reporter"},               # wrong role for this account
])
def test_staff_login_rejects_bad_factors(client, bad):
    email, password, secret = _provision()
    payload = {"role": "operator", "email": email, "password": password, "code": totp.now_code(secret)}
    payload.update(bad)
    r = client.post("/auth/staff-login", json=payload)
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect email, password, or authenticator code"


def test_staff_account_cannot_use_citizen_login(client):
    # A staff account must go through MFA — the citizen password login refuses it,
    # so no operator session can be minted without the authenticator code.
    email, password, secret = _provision()
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 403


def test_reporter_is_not_operator(client):
    email, password, secret = _provision(role="reporter", email="rep@djb.example")
    ok = client.post("/auth/staff-login", json={
        "role": "reporter", "email": email, "password": password, "code": totp.now_code(secret)})
    headers = {"Authorization": f"Bearer {ok.json()['token']}"}
    assert client.get("/me", headers=headers).json()["role"] == "reporter"
    assert client.get("/stations", headers=headers).status_code == 403  # operator-only route
