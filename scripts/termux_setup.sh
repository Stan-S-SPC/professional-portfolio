#!/data/data/com.termux/files/usr/bin/bash
# One-time setup to run onedrive_obsidian_sync on Android under Termux.
# Run this from inside the cloned repo, e.g.:
#   bash scripts/termux_setup.sh
set -e

pkg update -y
pkg install -y python git cronie termux-services termux-api

# Grants Termux access to shared storage (~/storage/shared), where Obsidian
# on Android can actually see the vault. Prompts for an Android permission.
termux-setup-storage

pip install --upgrade pip
pip install -r requirements.txt

# Run crond as a Termux service so scheduled syncs survive Termux restarts.
# (Install Termux:Boot from F-Droid too if you want crond to start on reboot.)
sv-enable crond 2>/dev/null || true
sv up crond 2>/dev/null || true

echo
echo "Setup done. Next steps:"
echo "1. Copy config.example.yaml to config.yaml and edit it."
echo "2. Run: python -m onedrive_obsidian_sync login"
echo "3. Add a scheduled sync with: crontab -e"
echo "   e.g. every 30 minutes:"
echo "   */30 * * * * cd $(pwd) && python -m onedrive_obsidian_sync sync >> sync.log 2>&1"
echo "4. Trigger a sync manually any time with: bash scripts/sync_now.sh"
