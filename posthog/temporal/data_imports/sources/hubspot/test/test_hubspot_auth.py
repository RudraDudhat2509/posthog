from typing import Any

import pytest
from unittest.mock import MagicMock, patch

from posthog.temporal.data_imports.sources.hubspot.auth import HubspotRetryableError, hubspot_refresh_access_token


@pytest.fixture(autouse=True)
def _no_retry_sleep() -> Any:
    """Make tenacity's backoff a no-op so retry-exercising tests stay fast."""
    original = hubspot_refresh_access_token.retry.sleep
    hubspot_refresh_access_token.retry.sleep = lambda _: None
    yield
    hubspot_refresh_access_token.retry.sleep = original


def _make_response(status: int, payload: dict[str, Any] | None = None) -> MagicMock:
    response = MagicMock()
    response.status_code = status
    response.json.return_value = payload or {}
    return response


def _patch_post(response: MagicMock) -> Any:
    session = MagicMock()
    session.post.return_value = response
    return patch(
        "posthog.temporal.data_imports.sources.hubspot.auth.make_tracked_session",
        return_value=session,
    )


def _patch_post_sequence(responses: list[MagicMock]) -> Any:
    session = MagicMock()
    session.post.side_effect = responses
    return patch(
        "posthog.temporal.data_imports.sources.hubspot.auth.make_tracked_session",
        return_value=session,
    )


@pytest.mark.parametrize(
    "status,message",
    [
        (429, "You have reached your rate limit."),
        (500, "Internal server error"),
        (502, "Bad gateway"),
        (503, "Service unavailable"),
    ],
)
def test_transient_status_raises_retryable_error(status: int, message: str) -> None:
    with _patch_post(_make_response(status, {"message": message})):
        with pytest.raises(HubspotRetryableError, match=message):
            hubspot_refresh_access_token("refresh-token")


@pytest.mark.parametrize(
    "status,message",
    [
        (400, "missing or invalid refresh token"),
        (401, "unauthorized"),
        (403, "forbidden"),
    ],
)
def test_non_transient_status_raises_plain_exception(status: int, message: str) -> None:
    with _patch_post(_make_response(status, {"message": message})):
        with pytest.raises(Exception) as exc_info:
            hubspot_refresh_access_token("refresh-token")
        assert not isinstance(exc_info.value, HubspotRetryableError)
        assert message in str(exc_info.value)


def test_transient_status_with_non_json_body_still_retryable() -> None:
    response = MagicMock()
    response.status_code = 429
    response.json.side_effect = ValueError("not json")
    response.text = "<html>rate limited</html>"
    with _patch_post(response):
        with pytest.raises(HubspotRetryableError, match="rate limited"):
            hubspot_refresh_access_token("refresh-token")


def test_transient_status_with_message_less_body_still_retryable() -> None:
    response = MagicMock()
    response.status_code = 503
    response.json.return_value = {"error": "unavailable"}
    response.text = "service unavailable"
    with _patch_post(response):
        with pytest.raises(HubspotRetryableError, match="service unavailable"):
            hubspot_refresh_access_token("refresh-token")


def test_success_returns_access_token() -> None:
    with _patch_post(_make_response(200, {"access_token": "new-token"})):
        assert hubspot_refresh_access_token("refresh-token") == "new-token"


def test_transient_status_is_retried_then_reraised() -> None:
    """A persistent rate limit on the token endpoint is retried with backoff before giving up,
    rather than failing the sync on the first 429."""
    response = _make_response(429, {"message": "You have reached your rate limit."})
    session = MagicMock()
    session.post.return_value = response
    with patch(
        "posthog.temporal.data_imports.sources.hubspot.auth.make_tracked_session",
        return_value=session,
    ):
        with pytest.raises(HubspotRetryableError, match="You have reached your rate limit."):
            hubspot_refresh_access_token("refresh-token")
        assert session.post.call_count == 5


def test_transient_status_recovers_on_retry() -> None:
    """A momentary 429 followed by a success returns the refreshed token without failing."""
    with _patch_post_sequence(
        [
            _make_response(429, {"message": "You have reached your rate limit."}),
            _make_response(200, {"access_token": "new-token"}),
        ]
    ):
        assert hubspot_refresh_access_token("refresh-token") == "new-token"


def test_non_transient_status_is_not_retried() -> None:
    """A non-transient status (e.g. invalid_grant) must surface immediately, not be retried."""
    response = _make_response(400, {"message": "missing or invalid refresh token"})
    session = MagicMock()
    session.post.return_value = response
    with patch(
        "posthog.temporal.data_imports.sources.hubspot.auth.make_tracked_session",
        return_value=session,
    ):
        with pytest.raises(Exception) as exc_info:
            hubspot_refresh_access_token("refresh-token")
        assert not isinstance(exc_info.value, HubspotRetryableError)
        assert session.post.call_count == 1
