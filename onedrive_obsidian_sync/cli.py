"""Command-line entrypoint.

Usage (from the repo root, after `pip install -r requirements.txt` and
creating config.yaml from config.example.yaml):

    python -m onedrive_obsidian_sync login   # one-time device-code auth
    python -m onedrive_obsidian_sync sync     # run one sync pass
    python -m onedrive_obsidian_sync status   # show what the next sync would do

`sync` is what both cron (scheduled) and a manual run should call.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import auth, config as config_module
from .graph_client import GraphClient
from .state import SyncState
from .sync import plan_sync, run, scan_local


def _build_graph_client(config: config_module.Config) -> GraphClient:
    token = auth.get_access_token(config)
    return GraphClient(token)


def cmd_login(config: config_module.Config) -> int:
    auth.login(config)
    return 0


def cmd_sync(config: config_module.Config) -> int:
    client = _build_graph_client(config)
    state = SyncState.load(config.state_file)
    actions = run(client, config.local_vault_path, config.remote_folder, state)
    state.save(config.state_file)

    if not actions:
        print("Already in sync, nothing to do.")
    else:
        for action in actions:
            print(f"{action.kind:16s} {action.rel_path}")
        print(f"\n{len(actions)} change(s) applied.")
    return 0


def cmd_status(config: config_module.Config) -> int:
    client = _build_graph_client(config)
    state = SyncState.load(config.state_file)
    local_hashes = scan_local(config.local_vault_path)
    remote_items = client.list_folder_recursive(config.remote_folder)
    remote_etags = {i.path: i.etag for i in remote_items if not i.is_folder}

    actions = plan_sync(local_hashes, remote_etags, state)
    if not actions:
        print("Already in sync.")
    else:
        print(f"{len(actions)} change(s) would be applied on next sync:")
        for action in actions:
            print(f"  {action.kind:16s} {action.rel_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="onedrive-obsidian-sync")
    parser.add_argument(
        "--config", default=None, help="Path to config.yaml (default: ./config.yaml)"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("login", help="Authenticate with Microsoft Graph")
    sub.add_parser("sync", help="Run one bidirectional sync pass")
    sub.add_parser("status", help="Show pending changes without applying them")

    args = parser.parse_args(argv)
    config_path = (
        config_module.DEFAULT_CONFIG_PATH
        if args.config is None
        else Path(args.config)
    )
    config = config_module.Config.load(config_path)

    commands = {"login": cmd_login, "sync": cmd_sync, "status": cmd_status}
    return commands[args.command](config)


if __name__ == "__main__":
    sys.exit(main())
