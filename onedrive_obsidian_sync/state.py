"""Local manifest tracking the last-synced state of each file.

This is the baseline for the 3-way diff: by comparing the current local
and remote state against what was recorded here after the last successful
sync, the sync engine can tell which side(s) changed since then.

An empty string in either field means "did not exist on that side as of
the last sync" -- real hashes/etags are never empty, so this is a safe
sentinel.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path


@dataclass
class FileState:
    local_sha256: str = ""
    remote_etag: str = ""


@dataclass
class SyncState:
    files: dict[str, FileState] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path) -> "SyncState":
        if not path.exists():
            return cls()
        raw = json.loads(path.read_text(encoding="utf-8"))
        return cls(files={k: FileState(**v) for k, v in raw.get("files", {}).items()})

    def save(self, path: Path) -> None:
        payload = {"files": {k: asdict(v) for k, v in self.files.items()}}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8"
        )
