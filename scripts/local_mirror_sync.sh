#!/data/data/com.termux/files/usr/bin/bash
# Simple alternative to the onedrive_obsidian_sync Python tool: no Microsoft
# account, Azure app registration, or API calls needed at all.
#
# It relies on the OneDrive Android app to handle the actual cloud
# upload/download (that's what "available offline" does), and just mirrors
# OneDrive's local copy of the folder with your Obsidian vault folder, in
# both directions, using modification time to decide which copy wins.
#
# Limitation: deletions are NOT propagated. If you delete a note on one
# side, the next run will just recopy it back from the other side. Delete
# the file on both sides by hand, or use the Python tool in this repo
# (onedrive_obsidian_sync) if you need real deletion handling.
#
# Configure ONEDRIVE_DIR and VAULT_DIR below, or export them before running
# (e.g. from local_mirror.conf, see local_mirror.conf.example).
set -euo pipefail

CONFIG_FILE="$(dirname "$0")/../local_mirror.conf"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

: "${ONEDRIVE_DIR:?Set ONEDRIVE_DIR to the OneDrive apps local synced folder (see README.md)}"
: "${VAULT_DIR:?Set VAULT_DIR to the Obsidian vault folder}"

if [ ! -d "$ONEDRIVE_DIR" ]; then
  echo "ONEDRIVE_DIR does not exist: $ONEDRIVE_DIR" >&2
  exit 1
fi

mkdir -p "$VAULT_DIR"

# -a: preserve attributes/recurse, -u: skip files newer at the destination,
# so running both directions merges whichever side has the newer edit.
rsync -au --exclude ".obsidian" --exclude ".trash" "$ONEDRIVE_DIR"/ "$VAULT_DIR"/
rsync -au --exclude ".obsidian" --exclude ".trash" "$VAULT_DIR"/ "$ONEDRIVE_DIR"/

echo "Mirror sync done: $(date)"
