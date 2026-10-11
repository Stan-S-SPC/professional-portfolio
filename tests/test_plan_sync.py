"""plan_sync is a pure function, so these tests need no mocking at all."""

from onedrive_obsidian_sync.state import FileState, SyncState
from onedrive_obsidian_sync.sync import PlannedAction, plan_sync


def _state(**files: FileState) -> SyncState:
    return SyncState(files=dict(files))


def test_no_changes_produces_no_actions() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h1"}, {"note.md": "e1"}, state)
    assert actions == []


def test_new_local_file_uploads() -> None:
    actions = plan_sync({"note.md": "h1"}, {}, SyncState())
    assert len(actions) == 1
    assert actions[0].kind == "upload_new"
    assert actions[0].rel_path == "note.md"


def test_new_remote_file_downloads() -> None:
    actions = plan_sync({}, {"note.md": "e1"}, SyncState())
    assert len(actions) == 1
    assert actions[0].kind == "download_new"


def test_local_edit_uploads_update() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h2"}, {"note.md": "e1"}, state)
    assert actions == [PlannedAction("note.md", "upload_update", True, True)]


def test_remote_edit_downloads_update() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h1"}, {"note.md": "e2"}, state)
    assert actions[0].kind == "download_update"


def test_local_deletion_propagates_as_delete_remote() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({}, {"note.md": "e1"}, state)
    assert actions[0].kind == "delete_remote"


def test_remote_deletion_propagates_as_delete_local() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h1"}, {}, state)
    assert actions[0].kind == "delete_local"


def test_both_sides_deleted_is_forgotten_not_a_conflict() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({}, {}, state)
    assert actions[0].kind == "forget"


def test_concurrent_edits_are_a_conflict() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h2"}, {"note.md": "e2"}, state)
    assert actions[0].kind == "conflict"
    assert actions[0].local_exists is True
    assert actions[0].remote_exists is True


def test_edited_locally_but_deleted_remotely_is_a_conflict() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({"note.md": "h2"}, {}, state)
    assert actions[0].kind == "conflict"
    assert actions[0].local_exists is True
    assert actions[0].remote_exists is False


def test_deleted_locally_but_edited_remotely_is_a_conflict() -> None:
    state = _state(**{"note.md": FileState(local_sha256="h1", remote_etag="e1")})
    actions = plan_sync({}, {"note.md": "e2"}, state)
    assert actions[0].kind == "conflict"
    assert actions[0].local_exists is False
    assert actions[0].remote_exists is True
