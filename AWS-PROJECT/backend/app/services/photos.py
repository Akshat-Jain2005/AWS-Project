"""Private report photos: bounded browser uploads and short-lived review URLs."""
import re
import uuid
from functools import lru_cache
import boto3
from .. import config as C

MAX_BYTES = 5 * 1024 * 1024
KEY = re.compile(r"reports/[a-f0-9]{32}\.(jpg|png|webp)\Z")


@lru_cache(maxsize=1)
def client():
    return boto3.client("s3", region_name=C.AWS_REGION)


def upload(content_type):
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    key = f"reports/{uuid.uuid4().hex}.{extension}"
    signed = client().generate_presigned_post(
        Bucket=C.REPORT_PHOTO_BUCKET, Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}, ["content-length-range", 1, MAX_BYTES]],
        ExpiresIn=300,
    )
    return {"photo_key": key, "upload_url": signed["url"], "fields": signed["fields"], "method": "POST"}


def review_url(key):
    if not C.REPORT_PHOTO_BUCKET or not key or not KEY.fullmatch(key):
        return None
    return client().generate_presigned_url("get_object", Params={"Bucket": C.REPORT_PHOTO_BUCKET, "Key": key}, ExpiresIn=300)
