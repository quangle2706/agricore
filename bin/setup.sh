#!/usr/bin/env bash

#this file gets a brand-new clone of this application running with a single command.
#it creates the backend .venv if it doesn't already exist, it installs python dependencies,
#creates backend/.env from the template if it doesn't already exist, then it installs
#our frontend dependencies.

##NOTE this must be run a GitBash terminal!!
##command to run this file in the agricore directory:
## bash bin/setup.sh

set -euo pipefail

echo "== Agricore Setup =="

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if command -v python3 >/dev/null 2>&1; then
    PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON="python"
else
    echo "Error: missing prerequisite: Python 3." >&2
    exit 1
fi

if ! "$PYTHON" -c \
    "import sys, venv, ensurepip; assert sys.version_info.major == 3" \
    >/dev/null 2>&1; then
    echo "Error: Python 3 with venv and ensurepip is required." >&2
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "Error: missing prerequisite: npm." >&2
    exit 1
fi

for file in \
    "$BACKEND/requirements.txt" \
    "$FRONTEND/package.json" \
    "$FRONTEND/package-lock.json"; do
    if [[ ! -f "$file" ]]; then
        echo "Error: missing prerequisite file: $file." >&2
        exit 1
    fi
done

if [[ ! -e "$BACKEND/.venv" ]]; then
    echo "Creating virtual environment..."

    if ! "$PYTHON" -m venv "$BACKEND/.venv" >/dev/null 2>&1; then
        echo "Error: virtual environment creation failed." >&2
        exit 1
    fi
else
    echo "Virtual environment already exists."
fi

if [[ -f "$BACKEND/.venv/Scripts/python.exe" ]]; then
    VENV_PYTHON="$BACKEND/.venv/Scripts/python.exe"
elif [[ -x "$BACKEND/.venv/bin/python" ]]; then
    VENV_PYTHON="$BACKEND/.venv/bin/python"
else
    echo "Error: existing virtual environment is invalid." >&2
    exit 1
fi

echo "Installing backend dependencies..."

if ! "$VENV_PYTHON" -m pip install \
    -r "$BACKEND/requirements.txt" >/dev/null 2>&1; then
    echo "Error: backend dependency installation failed." >&2
    exit 1
fi

if [[ -e "$BACKEND/.env" ]]; then
    echo "backend/.env already exists; keeping it."
else
    if ! (
        set -o noclobber
        umask 077
        printf '%s\n' "DATABASE_URL=''" > "$BACKEND/.env"
    ) 2>/dev/null; then
        echo "Error: could not create backend/.env." >&2
        exit 1
    fi

    echo "Created backend/.env. Configure DATABASE_URL before seeding."
fi

echo "Installing frontend dependencies..."

cd "$FRONTEND"

if ! npm ci >/dev/null 2>&1; then
    echo "Error: frontend dependency installation failed." >&2
    exit 1
fi

echo "Setup complete."