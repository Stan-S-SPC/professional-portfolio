"""Thin wrapper around the Microsoft Graph OneDrive API.

Only the operations needed to sync a single folder tree are implemented:
recursive listing, content download/upload (simple upload, so files above
4MB such as large attachments are not supported), delete, and folder
creation. Markdown notes are small enough that the simple upload endpoint
is sufficient.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


@dataclass
class RemoteItem:
    id: str
    path: str  # relative to the synced root folder, '/'-separated
    is_folder: bool
    etag: str = ""
    size: int = 0


class GraphClient:
    def __init__(self, access_token: str):
        self._session = requests.Session()
        self._session.headers["Authorization"] = f"Bearer {access_token}"

    def list_folder_recursive(self, root_path: str) -> list[RemoteItem]:
        """Return every file and folder under root_path, paths relative to it."""
        items: list[RemoteItem] = []
        self._walk(f"{GRAPH_BASE}/me/drive/root:/{root_path}:/children", "", items)
        return items

    def _walk(self, url: str | None, prefix: str, items: list[RemoteItem]) -> None:
        while url:
            resp = self._session.get(url)
            resp.raise_for_status()
            data = resp.json()
            for entry in data.get("value", []):
                rel_path = f"{prefix}{entry['name']}"
                is_folder = "folder" in entry
                items.append(
                    RemoteItem(
                        id=entry["id"],
                        path=rel_path,
                        is_folder=is_folder,
                        etag=entry.get("eTag", ""),
                        size=entry.get("size", 0),
                    )
                )
                if is_folder:
                    self._walk(
                        f"{GRAPH_BASE}/me/drive/items/{entry['id']}/children",
                        f"{rel_path}/",
                        items,
                    )
            url = data.get("@odata.nextLink")

    def download(self, item_id: str) -> bytes:
        resp = self._session.get(f"{GRAPH_BASE}/me/drive/items/{item_id}/content")
        resp.raise_for_status()
        return resp.content

    def upload(self, root_path: str, rel_path: str, content: bytes) -> RemoteItem:
        url = f"{GRAPH_BASE}/me/drive/root:/{root_path}/{rel_path}:/content"
        resp = self._session.put(url, data=content)
        resp.raise_for_status()
        entry = resp.json()
        return RemoteItem(
            id=entry["id"],
            path=rel_path,
            is_folder=False,
            etag=entry.get("eTag", ""),
            size=entry.get("size", 0),
        )

    def delete(self, item_id: str) -> None:
        resp = self._session.delete(f"{GRAPH_BASE}/me/drive/items/{item_id}")
        if resp.status_code not in (204, 404):
            resp.raise_for_status()

    def ensure_folder(self, root_path: str, rel_dir: str) -> None:
        """Create rel_dir (and any missing parents) under root_path."""
        if not rel_dir:
            return
        current = root_path
        for part in rel_dir.split("/"):
            resp = self._session.post(
                f"{GRAPH_BASE}/me/drive/root:/{current}:/children",
                json={
                    "name": part,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "replace",
                },
            )
            resp.raise_for_status()
            current = f"{current}/{part}"
