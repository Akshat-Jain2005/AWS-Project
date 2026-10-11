from fastapi.testclient import TestClient
from app.main import app
from app import config as C
from app.services import photos, payments, notify

client = TestClient(app)


def test_photo_upload_requires_config(monkeypatch):
    monkeypatch.setattr(C, "REPORT_PHOTO_BUCKET", "")
    assert client.post('/reports/upload-url', json={"content_type": "image/jpeg"}).status_code == 503


def test_photo_upload_bounded_and_private(monkeypatch):
    monkeypatch.setattr(C, "REPORT_PHOTO_BUCKET", "private-reports")
    calls = []

    class S3:
        def generate_presigned_post(self, **kwargs):
            calls.append(kwargs)
            return {"url": "https://example.invalid", "fields": {"key": kwargs["Key"]}}

    monkeypatch.setattr(photos, "client", lambda: S3())
    result = client.post('/reports/upload-url', json={"content_type": "image/png"})
    assert result.status_code == 200
    assert result.json()['photo_key'].endswith('.png')
    assert calls[0]['ExpiresIn'] == 300
    assert ['content-length-range', 1, 5 * 1024 * 1024] in calls[0]['Conditions']
    assert 'acl' not in calls[0]['Fields']
    assert client.post('/reports/upload-url', json={"content_type": "text/html"}).status_code == 422


def test_unconfigured_production_services_fail_closed(monkeypatch):
    monkeypatch.setattr(C, "DEV_MODE", False)
    monkeypatch.setattr(C, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(C, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(C, "RAZORPAY_WEBHOOK_SECRET", "")
    monkeypatch.setattr(C, "USE_AWS_SNS", False)
    assert client.post('/donations/order', json={"amount_inr": 499, "donor_email": "test@example.com"}).status_code == 503
    assert not payments.signature_ok('order', 'payment', '')
    assert not payments.webhook_signature_ok(b'{}', 'forged')
    assert client.post('/subscribe', json={"phone": "9876543210", "ward": "Civil Lines", "consent": True}).status_code == 503


def test_failed_sms_does_not_claim_otp_sent(monkeypatch):
    monkeypatch.setattr(notify, 'send_sms', lambda *args: False)
    result = client.post('/subscribe', json={"phone": "9876543210", "ward": "Civil Lines", "consent": True})
    assert result.status_code == 502
