"""Bidirectional sync engine.

The design splits "decide what to do" from "do it":

- ``plan_sync`` is a pure function: given the current local file hashes,
  current remote etags, and the state recorded after the last successful
  sync, it returns the list of actions needed. It touches no network or
  filesystem, which makes it straightforward to unit test.
- ``run`` performs the actual filesystem/Graph API calls described by the
  plan, using a keep-both strategy for genuine conflicts (same file
  touched on both sides since the last sync) so nothing is silently lost.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .graph_client import GraphClient, RemoteItem
from .state import FileState, SyncState

EXCLUDED_PREFIXES = (".",)  # skip dotfiles/dirs, e.g. .obsidian, .git, .trash


@dataclass
class PlannedAction:
    rel_path: str
    kind: str  # upload_new, upload_update, download_new, download_update,
    # delete_remote, delete_local, conflict, forget
    local_exists: bool
    remote_exists: bool


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def scan_local(vault_path: Path) -> dict[str, str]:
    """Return {relative_path: sha256} for every file under vault_path."""
    hashes: dict[str, str] = {}
    if not vault_path.exists():
        return hashes
    for file_path in vault_path.rglob("*"):
        if not file_path.is_file():
            continue
        rel_parts = file_path.relative_to(vault_path).parts
        if any(part.startswith(EXCLUDED_PREFIXES) for part in rel_parts):
            continue
        rel_path = "/".join(rel_parts)
        hashes[rel_path] = sha256_bytes(file_path.read_bytes())
    return hashes


def plan_sync(
    local_hashes: dict[str, str],
    remote_etags: dict[str, str],
    state: SyncState,
) -> list[PlannedAction]:
    actions: list[PlannedAction] = []
    all_paths = set(local_hashes) | set(remote_etags) | set(state.files)

    for rel_path in sorted(all_paths):
        prev = state.files.get(rel_path, FileState())
        local_exists = rel_path in local_hashes
        remote_exists = rel_path in remote_etags
        remote_existed = prev.remote_etag != ""
        local_existed = prev.local_sha256 != ""

        local_changed = (local_hashes.get(rel_path, "")) != prev.local_sha256
        remote_changed = (remote_etags.get(rel_path, "")) != prev.remote_etag

        if not local_changed and not remote_changed:
            continue

        if not local_exists and not remote_exists:
            actions.append(PlannedAction(rel_path, "forget", False, False))
            continue

        if local_changed and not remote_changed:
            if local_exists:
                kind = "upload_update" if remote_existed else "upload_new"
            else:
                kind = "delete_remote"
            actions.append(PlannedAction(rel_path, kind, local_exists, remote_exists))
            continue

        if remote_changed and not local_changed:
            if remote_exists:
                kind = "download_update" if local_existed else "download_new"
            else:
                kind = "delete_local"
            actions.append(PlannedAction(rel_path, kind, local_exists, remote_exists))
            continue

        # Both sides changed since the last sync: genuine conflict.
        actions.append(
            PlannedAction(rel_path, "conflict", local_exists, remote_exists)
        )

    return actions


def _conflict_copy_name(rel_path: str) -> str:
    p = Path(rel_path)
    stamp = datetime.now().strftime("%Y-%m-%d %H%M%S")
    new_name = f"{p.stem} (conflict {stamp}){p.suffix}"
    return str(p.with_name(new_name)).replace("\\", "/")


def run(
    graph_client: GraphClient,
    vault_path: Path,
    remote_folder: str,
    state: SyncState,
) -> list[PlannedAction]:
    """Run one full sync pass and return the actions that were applied."""
    local_hashes = scan_local(vault_path)
    remote_items = {
        item.path: item
        for item in graph_client.list_folder_recursive(remote_folder)
        if not item.is_folder
    }
    remote_etags = {path: item.etag for path, item in remote_items.items()}

    actions = plan_sync(local_hashes, remote_etags, state)

    for action in actions:
        local_path = vault_path / action.rel_path

        if action.kind == "forget":
            state.files.pop(action.rel_path, None)
            continue

        if action.kind in ("upload_new", "upload_update"):
            content = local_path.read_bytes()
            parent = str(Path(action.rel_path).parent)
            if parent != ".":
                graph_client.ensure_folder(remote_folder, parent)
            remote_item = graph_client.upload(remote_folder, action.rel_path, content)
            state.files[action.rel_path] = FileState(
                local_sha256=sha256_bytes(content), remote_etag=remote_item.etag
            )
            continue

        if action.kind in ("download_new", "download_update"):
            remote_item = remote_items[action.rel_path]
            content = graph_client.download(remote_item.id)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(content)
            state.files[action.rel_path] = FileState(
                local_sha256=sha256_bytes(content), remote_etag=remote_item.etag
            )
            continue

        if action.kind == "delete_remote":
            remote_item = remote_items.get(action.rel_path)
            if remote_item is not None:
                graph_client.delete(remote_item.id)
            state.files.pop(action.rel_path, None)
            continue

        if action.kind == "delete_local":
            if local_path.exists():
                local_path.unlink()
            state.files.pop(action.rel_path, None)
            continue

        if action.kind == "conflict":
            _resolve_conflict(
                graph_client, vault_path, remote_folder, action, state, remote_items
            )
            continue

    return actions


def _resolve_conflict(
    graph_client: GraphClient,
    vault_path: Path,
    remote_folder: str,
    action: PlannedAction,
    state: SyncState,
    remote_items: dict[str, RemoteItem],
) -> None:
    """Keep-both resolution: never silently discard either side's edit."""
    local_path = vault_path / action.rel_path

    if action.local_exists and action.remote_exists:
        # Both sides edited the file differently: rename the local version
        # aside, restore the original path from the remote copy, and also
        # push the renamed local version to OneDrive so neither edit is lost.
        local_content = local_path.read_bytes()
        conflict_rel_path = _conflict_copy_name(action.rel_path)
        conflict_path = vault_path / conflict_rel_path
        conflict_path.parent.mkdir(parents=True, exist_ok=True)
        conflict_path.write_bytes(local_content)

        remote_item = remote_items[action.rel_path]
        remote_content = graph_client.download(remote_item.id)
        local_path.write_bytes(remote_content)

        parent = str(Path(conflict_rel_path).parent)
        if parent != ".":
            graph_client.ensure_folder(remote_folder, parent)
        uploaded = graph_client.upload(remote_folder, conflict_rel_path, local_content)

        state.files[action.rel_path] = FileState(
            local_sha256=sha256_bytes(remote_content), remote_etag=remote_item.etag
        )
        state.files[conflict_rel_path] = FileState(
            local_sha256=sha256_bytes(local_content), remote_etag=uploaded.etag
        )

    elif action.local_exists and not action.remote_exists:
        # Edited locally, deleted remotely: local edit wins, restore remote.
        content = local_path.read_bytes()
        parent = str(Path(action.rel_path).parent)
        if parent != ".":
            graph_client.ensure_folder(remote_folder, parent)
        remote_item = graph_client.upload(remote_folder, action.rel_path, content)
        state.files[action.rel_path] = FileState(
            local_sha256=sha256_bytes(content), remote_etag=remote_item.etag
        )

    else:
        # Deleted locally, edited remotely: remote edit wins, restore local.
        remote_item = remote_items[action.rel_path]
        content = graph_client.download(remote_item.id)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)
        state.files[action.rel_path] = FileState(
            local_sha256=sha256_bytes(content), remote_etag=remote_item.etag
        )
