"""Amazon Bedrock text generation for dynamic alert copy.

Disabled by default: when DEV_MODE (tests) or not USE_AI_ALERTS, invoke_claude
returns a static mock string and never touches the network, so the test suite
stays fully isolated from AWS (mirrors the notify.py / SNS pattern).

The configured model is GLM 5.3 (provider Z.AI on Bedrock), not an Anthropic
model, so we use the provider-agnostic Bedrock **Converse** API rather than an
Anthropic-specific invoke_model Messages payload. Converse normalises the
request/response shape across providers: system + user turns in, and the reply
text at output.message.content[0].text."""
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .. import config as C

log = logging.getLogger("bio.llm")

# Lazy-initialised client – created on first real invocation only.
_bedrock_client = None

# Returned when AI is disabled (tests / local) so callers can detect the mock
# path and fall back to their static templates without any special-casing.
MOCK_RESPONSE = "[AI alerts disabled - mock response]"
# Returned when a live Bedrock call errors out.
FALLBACK_RESPONSE = "[AI generation unavailable]"


def _get_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client("bedrock-runtime", region_name=C.BEDROCK_REGION)
    return _bedrock_client


def invoke_claude(system_prompt: str, user_prompt: str) -> str:
    """Generate text from the configured Bedrock model.

    Returns a mock string when AI alerts are disabled, and a safe fallback
    string if the live Bedrock call errors – callers must handle both so a
    model outage never blocks an emergency alert."""
    if C.DEV_MODE or not C.USE_AI_ALERTS:
        return MOCK_RESPONSE

    try:
        client = _get_client()
        resp = client.converse(
            modelId=C.BEDROCK_MODEL_ID,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={"maxTokens": 300},
        )
        return resp["output"]["message"]["content"][0]["text"].strip()
    except (ClientError, BotoCoreError, KeyError, IndexError, Exception) as exc:  # noqa: BLE001
        log.error("Bedrock invoke failed (%s): %s", C.BEDROCK_MODEL_ID, exc)
        return FALLBACK_RESPONSE
