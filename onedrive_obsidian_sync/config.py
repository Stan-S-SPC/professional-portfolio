"""Configuration loading for the OneDrive <-> Obsidian sync tool."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_CONFIG_PATH = Path(os.environ.get("ONEDRIVE_SYNC_CONFIG", "config.yaml"))


@dataclass
class Config:
    client_id: str
    tenant: str
    remote_folder: str
    local_vault_path: Path
    state_file: Path
    token_cache_file: Path
    conflict_strategy: str = "keep-both"

    @classmethod
    def load(cls, path: Path = DEFAULT_CONFIG_PATH) -> "Config":
        if not path.exists():
            raise FileNotFoundError(
                f"Config file not found: {path}. Copy config.example.yaml to "
                f"{path} and fill in your details."
            )
        with path.open("r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}

        try:
            client_id = raw["client_id"]
            remote_folder = raw["remote_folder"]
            local_vault_path = raw["local_vault_path"]
        except KeyError as exc:
            raise ValueError(f"Missing required config key: {exc}") from exc

        return cls(
            client_id=client_id,
            tenant=raw.get("tenant", "consumers"),
            remote_folder=remote_folder.strip("/"),
            local_vault_path=Path(local_vault_path).expanduser(),
            state_file=Path(raw.get("state_file", ".sync_state.json")).expanduser(),
            token_cache_file=Path(
                raw.get("token_cache_file", ".token_cache.json")
            ).expanduser(),
            conflict_strategy=raw.get("conflict_strategy", "keep-both"),
        )

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant}"
