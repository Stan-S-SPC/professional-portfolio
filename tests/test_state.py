from pathlib import Path

from onedrive_obsidian_sync.state import FileState, SyncState


def test_round_trip(tmp_path: Path) -> None:
    state = SyncState()
    state.files["note.md"] = FileState(local_sha256="abc123", remote_etag="etag1")

    state_file = tmp_path / ".sync_state.json"
    state.save(state_file)

    loaded = SyncState.load(state_file)
    assert loaded.files["note.md"] == FileState(
        local_sha256="abc123", remote_etag="etag1"
    )


def test_load_missing_file_returns_empty_state(tmp_path: Path) -> None:
    loaded = SyncState.load(tmp_path / "does-not-exist.json")
    assert loaded.files == {}
