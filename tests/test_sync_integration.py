"""End-to-end tests for run(), using a fake Graph client backed by an
in-memory dict instead of real network calls.
"""

from pathlib import Path

from onedrive_obsidian_sync.graph_client import RemoteItem
from onedrive_obsidian_sync.state import SyncState
from onedrive_obsidian_sync.sync import run


class FakeGraphClient:
    """Mimics the subset of GraphClient's interface that sync.run() uses."""

    def __init__(self) -> None:
        self._files: dict[str, bytes] = {}
        self._etags: dict[str, str] = {}
        self._next_etag = 0

    def _bump_etag(self, path: str) -> str:
        self._next_etag += 1
        etag = f"etag-{self._next_etag}"
        self._etags[path] = etag
        return etag

    def seed(self, path: str, content: bytes) -> None:
        self._files[path] = content
        self._bump_etag(path)

    def list_folder_recursive(self, root_path: str) -> list[RemoteItem]:
        return [
            RemoteItem(id=path, path=path, is_folder=False, etag=self._etags[path])
            for path in self._files
        ]

    def download(self, item_id: str) -> bytes:
        return self._files[item_id]

    def upload(self, root_path: str, rel_path: str, content: bytes) -> RemoteItem:
        self._files[rel_path] = content
        etag = self._bump_etag(rel_path)
        return RemoteItem(id=rel_path, path=rel_path, is_folder=False, etag=etag)

    def delete(self, item_id: str) -> None:
        self._files.pop(item_id, None)
        self._etags.pop(item_id, None)

    def ensure_folder(self, root_path: str, rel_dir: str) -> None:
        pass  # flat in-memory store, no real folders needed


def test_new_local_file_is_uploaded(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "note.md").write_text("hello")

    client = FakeGraphClient()
    state = SyncState()
    run(client, vault, "journaldebord", state)

    assert client._files["note.md"] == b"hello"
    assert "note.md" in state.files


def test_new_remote_file_is_downloaded(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()

    client = FakeGraphClient()
    client.seed("note.md", b"from onedrive")
    state = SyncState()
    run(client, vault, "journaldebord", state)

    assert (vault / "note.md").read_text() == "from onedrive"


def test_two_consecutive_syncs_are_idempotent(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "note.md").write_text("hello")

    client = FakeGraphClient()
    state = SyncState()
    run(client, vault, "journaldebord", state)
    second_pass_actions = run(client, vault, "journaldebord", state)

    assert second_pass_actions == []


def test_concurrent_edit_keeps_both_versions(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "note.md").write_text("original")

    client = FakeGraphClient()
    state = SyncState()
    run(client, vault, "journaldebord", state)  # establish baseline on both sides

    # Edit on both sides since the baseline sync.
    (vault / "note.md").write_text("edited on phone")
    client.upload("journaldebord", "note.md", b"edited on PC")

    run(client, vault, "journaldebord", state)

    # Original path now mirrors OneDrive's version.
    assert (vault / "note.md").read_text() == "edited on PC"

    # The phone's edit was preserved as a conflict copy, uploaded too.
    conflict_files = list(vault.glob("note (conflict *).md"))
    assert len(conflict_files) == 1
    assert conflict_files[0].read_text() == "edited on phone"
    assert conflict_files[0].name in client._files


def test_delete_on_one_side_propagates(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "note.md").write_text("hello")

    client = FakeGraphClient()
    state = SyncState()
    run(client, vault, "journaldebord", state)

    (vault / "note.md").unlink()
    run(client, vault, "journaldebord", state)

    assert "note.md" not in client._files
    assert "note.md" not in state.files
