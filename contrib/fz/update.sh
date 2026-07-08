#!/bin/bash
# update.sh — deploy InvenTree on the production EC2 instance.
#
# Lives at /home/ec2-user/inventree/update.sh (copy from contrib/fz/update.sh).
#
# Steps:
#   1. Pull the production branch
#   2. Download the matching frontend bundle built by the "FZ Frontend Build"
#      GitHub Actions workflow (the t3a.medium is too small to build it here)
#   3. Run the server update (install, backup, migrate, collectstatic)
#   4. Compile backend translations
#   5. Restart services
#
# Requirements on this machine (one-time setup):
#   - gh CLI, authenticated with a token that has Actions read access
#     on KaranLala/InvenTree (gh auth status to check)
#   - gettext (for backend translation compilation)

set -euo pipefail

REPO_DIR=/home/ec2-user/inventree/src
GH_REPO=KaranLala/InvenTree
WORKFLOW="FZ Frontend Build"
FRONTEND_DEST="$REPO_DIR/src/backend/InvenTree/web/static/web"

# Put the virtualenv first on PATH. tasks.py shells out to bare `pip3` and
# `python3`, so without this the system Python is used instead of the venv.
export PATH="$REPO_DIR/env/bin:$PATH"

cd "$REPO_DIR" || { echo "Directory not found: $REPO_DIR"; exit 1; }

echo "Pulling latest changes from git..."
git pull origin production

SHA=$(git rev-parse HEAD)
echo "Deploying commit $SHA"

# --- Frontend bundle (built by CI, not committed to git) ---
if [ -f "$FRONTEND_DEST/.vite/sha.txt" ] && [ "$(cat "$FRONTEND_DEST/.vite/sha.txt")" = "$SHA" ]; then
    echo "Frontend already up to date for $SHA - skipping download."
else
    echo "Locating frontend build for $SHA..."
    RUN_ID=$(gh run list --repo "$GH_REPO" --workflow "$WORKFLOW" \
        --commit "$SHA" --status success \
        --json databaseId --jq '.[0].databaseId // empty')

    if [ -z "$RUN_ID" ]; then
        echo "ERROR: No successful '$WORKFLOW' run found for commit $SHA."
        echo "CI may still be running - check with:"
        echo "  gh run list --repo $GH_REPO --workflow '$WORKFLOW'"
        echo "Then re-run this script once it has succeeded."
        exit 1
    fi

    echo "Downloading frontend-build artifact from run $RUN_ID..."
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TMP_DIR"' EXIT
    gh run download "$RUN_ID" --repo "$GH_REPO" -n frontend-build --dir "$TMP_DIR"

    # Sanity check before replacing the live frontend
    if [ ! -f "$TMP_DIR/index.html" ]; then
        echo "ERROR: Downloaded artifact looks wrong (no index.html) - aborting."
        exit 1
    fi

    rm -rf "$FRONTEND_DEST"
    mkdir -p "$(dirname "$FRONTEND_DEST")"
    mv "$TMP_DIR" "$FRONTEND_DEST"
    trap - EXIT
    chmod 755 "$FRONTEND_DEST"
    echo "Frontend bundle installed."
fi

# --- Backend update (install, backup, migrate, collectstatic) ---
echo "Running inv fz-updateServer..."
inv fz-updateServer

# --- Backend translations (.mo files are not in git) ---
<<<<<<< HEAD
echo "Compiling backend translations..."
inv int.backend-compilemessages
=======
# Invoked directly rather than via `inv int.backend-compilemessages`:
# production's tasks.py may predate that task.
echo "Compiling backend translations..."
(cd "$REPO_DIR/src/backend/InvenTree" && python3 -m django compilemessages -v 0)
>>>>>>> development

# --- Restart services ---
echo "Restarting inventree-server..."
sudo service inventree-server restart

echo "Restarting inventree-cluster..."
sudo service inventree-cluster restart

echo "Update complete! Deployed $SHA"
