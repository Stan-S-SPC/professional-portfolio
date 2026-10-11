# OneDrive ↔ Obsidian Sync

Bidirectional synchronization between a folder in OneDrive (e.g.
`journaldebord`) and a local [Obsidian](https://obsidian.md) vault,
designed to run unattended on Android (via [Termux](https://termux.dev/))
or on a desktop, on a schedule or on demand.

## Why

Obsidian's own sync is a paid add-on, and pointing Obsidian straight at a
OneDrive-synced folder on Android is unreliable because OneDrive's
"available offline" files aren't always visible to other apps in real
time.

There are two ways to solve that in this repo:

- **Option A — `onedrive_obsidian_sync` (Python, Microsoft Graph API).**
  Talks to OneDrive directly, so it controls exactly when files move and
  resolves conflicts explicitly (keep-both, nothing silently lost). Needs
  a one-time Azure app registration and an OAuth login.
- **Option B — `scripts/local_mirror_sync.sh` (shell, `rsync`).** No
  Microsoft account or app registration at all: it relies on the OneDrive
  Android app to handle the actual cloud sync, and just mirrors OneDrive's
  local copy of the folder with your Obsidian vault folder using
  last-modified-wins. Much simpler, but doesn't propagate deletions (see
  its section below) and has no real conflict handling.

Start with **Option B** if you just want something working quickly;
move to **Option A** if you want proper conflict handling or don't want
to rely on the OneDrive app's own local caching behavior.

## Option A: Graph API sync — how it works

```
onedrive_obsidian_sync/
├── auth.py          # OAuth2 device-code login against Microsoft Graph
├── graph_client.py  # Minimal OneDrive API wrapper (list/download/upload/delete)
├── state.py         # Manifest of what was in sync as of the last run
├── sync.py          # plan_sync() (pure diff logic) + run() (applies it)
└── cli.py           # `login` / `sync` / `status` commands
```

Each run:
1. Hashes every local file and lists every remote file (skipping
   dotfiles/dirs like `.obsidian`, `.git`, `.trash`).
2. Compares both against the manifest recorded after the last successful
   sync to work out, per file, whether the **local** side, the **remote**
   side, both, or neither changed since then (a three-way diff).
3. Applies the matching action: upload, download, delete on the side that
   didn't change, or — if both sides changed — resolve the conflict.

**Conflict policy (keep-both):** if the same file was edited on both
sides since the last sync, nothing is silently discarded. The local edit
is renamed to `name (conflict 2024-01-01 120000).md`, uploaded to OneDrive
under that name, and the original path is restored to OneDrive's version.
If one side edited a file while the other deleted it, the edit wins and is
restored on both sides.

`plan_sync()` has no I/O in it at all, so the diff logic is unit-tested
without mocking anything (`tests/test_plan_sync.py`); `tests/test_sync_integration.py`
exercises `run()` end-to-end against an in-memory fake of the Graph API.

## Option A: setup

### 1. Register an Azure AD app (one-time)

The Graph API needs an app registration to authenticate as you.

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active
   Directory** → **App registrations** → **New registration**.
2. Name it anything (e.g. "obsidian-sync"). Under **Supported account
   types**, pick "Personal Microsoft accounts" if this is for a personal
   OneDrive, or the option matching your organization account otherwise.
   Leave Redirect URI empty.
3. Open the new app → **Authentication** → under **Advanced settings**,
   set **Allow public client flows** to **Yes**. Save.
4. Open **API permissions** → **Add a permission** → **Microsoft Graph**
   → **Delegated permissions** → add `Files.ReadWrite`.
5. Copy the **Application (client) ID** from the Overview page — you'll
   need it in `config.yaml`.

No client secret is needed: this tool uses the device-code flow, which is
for public clients only.

### 2. Install

**On a PC:**
```bash
pip install -r requirements.txt
cp config.example.yaml config.yaml   # then edit it
```

**On Android, via Termux** ([install Termux](https://termux.dev/) from
F-Droid, not the unmaintained Play Store build):
```bash
pkg install git
git clone <this-repo-url>
cd professional-portfolio
bash scripts/termux_setup.sh
cp config.example.yaml config.yaml   # then edit it
```
`termux_setup.sh` installs Python and `cronie` (for scheduling), and runs
`termux-setup-storage` so Termux — and this script — can read/write
`~/storage/shared`, which is where Obsidian for Android can actually see
files.

### 3. Configure

Edit `config.yaml` (gitignored — it's local to each device):
- `client_id`: the Application ID from step 1.
- `tenant`: `consumers` for a personal Microsoft account (the common
  case), `organizations` for a work/school tenant.
- `remote_folder`: the OneDrive folder to sync, e.g. `journaldebord`.
- `local_vault_path`: the local Obsidian vault folder, e.g.
  `~/storage/shared/Obsidian/journaldebord` on Termux.

### 4. Log in (once per device)

```bash
python -m onedrive_obsidian_sync login
```
This prints a short code and a URL. Open the URL on any device, sign in,
and enter the code. The resulting token is cached in `.token_cache.json`
(gitignored) and refreshed automatically afterwards.

### Usage

```bash
python -m onedrive_obsidian_sync sync     # run one sync pass now
python -m onedrive_obsidian_sync status   # show what the next sync would do, without doing it
```

### Manual trigger

```bash
bash scripts/sync_now.sh
```
On Termux, add a [Termux:Widget](https://wiki.termux.com/wiki/Termux:Widget)
shortcut to this script for a one-tap home-screen sync button.

### Scheduled sync

**Termux (cron via `cronie`, installed by `termux_setup.sh`):**
```bash
crontab -e
# every 30 minutes:
*/30 * * * * cd ~/professional-portfolio && python -m onedrive_obsidian_sync sync >> sync.log 2>&1
```

**Linux/macOS:** same crontab syntax. **Windows:** use Task Scheduler to
run `python -m onedrive_obsidian_sync sync` with the working directory set
to the repo.

### Known limitations

- Simple upload only, so individual files over 4 MB (unusual for Markdown
  notes, possible for embedded images/attachments) aren't supported.
- Each sync lists the whole remote folder rather than using Graph delta
  queries, which is simpler and fine for a journal-sized folder but not
  for very large vaults.
- One conflict strategy (keep-both); it isn't configurable per-file.

### Running the tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Option B: simple local mirror

This just mirrors two local folders with `rsync`, relying on the OneDrive
Android app to do the actual cloud sync. No code to install beyond
`rsync`, no login.

### 1. Find OneDrive's local folder on your phone

In the OneDrive app, mark `journaldebord` as "Always keep on this
device" (or "Available offline"). Then, in Termux, look for it under:

```bash
find ~/storage/shared -iname journaldebord -type d 2>/dev/null
```

It's commonly under something like
`~/storage/shared/Android/media/com.microsoft.skydrive/OneDrive/journaldebord`
— the exact path depends on your OneDrive app version. If `find` turns up
nothing, open the OneDrive app's own file browser, use its "share" or
"open with" action on a file inside the folder, and check what path a
file manager app shows for it.

### 2. Configure

```bash
cp local_mirror.conf.example local_mirror.conf
```
Edit `local_mirror.conf` (gitignored) and set `ONEDRIVE_DIR` to the path
found above, and `VAULT_DIR` to your Obsidian vault folder (e.g.
`~/storage/shared/Obsidian/journaldebord`).

### 3. Run it

```bash
bash scripts/local_mirror_sync.sh   # manual trigger any time
```

Schedule it the same way as Option A:
```bash
crontab -e
# every 15 minutes:
*/15 * * * * bash ~/professional-portfolio/scripts/local_mirror_sync.sh >> ~/professional-portfolio/mirror.log 2>&1
```
Or add a [Termux:Widget](https://wiki.termux.com/wiki/Termux:Widget)
shortcut to `scripts/local_mirror_sync.sh` for a one-tap sync button.

### Known limitations

- **Deletions aren't propagated.** Delete a note on one side and the next
  run just recopies it back from the other side — delete it on both sides
  by hand, or switch to Option A.
- **No real conflict detection.** If the same file is edited on both sides
  between two runs, whichever copy has the newer modification time wins
  and the other edit is lost. Fine for a journal one person edits from one
  device at a time; risky if you edit the same note from two devices
  around the same time.
- Depends on the OneDrive app's own sync actually having pulled the
  latest cloud version into its local folder before this script runs.
