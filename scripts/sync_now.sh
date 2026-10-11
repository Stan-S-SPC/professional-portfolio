#!/usr/bin/env bash
# Manually trigger a single sync pass. Works the same on Termux and on a PC.
set -e
cd "$(dirname "$0")/.."
python -m onedrive_obsidian_sync sync
