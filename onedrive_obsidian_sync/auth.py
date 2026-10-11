"""Microsoft Graph authentication via the OAuth2 device code flow.

Device code flow is used (rather than an interactive browser redirect)
because it works on devices with no local browser to receive a redirect,
such as a headless server or a phone running the sync job under Termux.
"""

from __future__ import annotations

import json
from pathlib import Path

import msal

from .config import Config

SCOPES = ["Files.ReadWrite"]


def get_access_token(config: Config) -> str:
    """Return a valid access token, refreshing or re-authenticating as needed."""
    cache = msal.SerializableTokenCache()
    if config.token_cache_file.exists():
        cache.deserialize(config.token_cache_file.read_text(encoding="utf-8"))

    app = msal.PublicClientApplication(
        config.client_id, authority=config.authority, token_cache=cache
    )

    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])

    if not result:
        flow = app.initiate_device_flow(scopes=SCOPES)
        if "user_code" not in flow:
            raise RuntimeError(f"Failed to start device flow: {flow}")
        print(flow["message"])
        result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        raise RuntimeError(
            f"Authentication failed: {result.get('error_description', result)}"
        )

    if cache.has_state_changed:
        _save_cache(config.token_cache_file, cache)

    return result["access_token"]


def _save_cache(path: Path, cache: "msal.SerializableTokenCache") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(cache.serialize(), encoding="utf-8")
    path.chmod(0o600)


def login(config: Config) -> None:
    """Force an interactive device-code login and persist the resulting token cache."""
    get_access_token(config)
    print("Login successful. Token cache saved to", config.token_cache_file)
