#!/usr/bin/env bash
# Seed the configured database: schema, business data, then demo users.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"

RESET_MODE=false
AUTO_CONFIRM=false

for argument in "$@"; do
    case "$argument" in
        --help)
            echo "Usage: bash bin/seed.sh [--reset] [--yes]"
            exit 0
            ;;
        --reset)
            RESET_MODE=true
            ;;
        --yes)
            AUTO_CONFIRM=true
            ;;
        *)
            echo "Error: unsupported argument: $argument. Use --help." >&2
            exit 1
            ;;
    esac
done

if [[ "$AUTO_CONFIRM" == "true" && "$RESET_MODE" != "true" ]]; then
    echo "Error: --yes can only be used with --reset." >&2
    exit 1
fi

# Locate the virtual environment's Python.
if [[ -f "$BACKEND/.venv/Scripts/python.exe" ]]; then
    VENV_PYTHON="$BACKEND/.venv/Scripts/python.exe"
elif [[ -x "$BACKEND/.venv/bin/python" ]]; then
    VENV_PYTHON="$BACKEND/.venv/bin/python"
else
    echo "Error: virtual environment is missing or invalid. Run bin/setup.sh." >&2
    exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
    echo "Error: missing prerequisite: psql." >&2
    exit 1
fi

# Load and export configuration without printing secrets.
if [[ -f "$BACKEND/.env" ]]; then
    set -a

    if ! source "$BACKEND/.env" >/dev/null 2>&1; then
        echo "Error: could not load backend/.env. Check its syntax." >&2
        exit 1
    fi

    set +a
fi

for variable in \
    DATABASE_URL PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do

    if [[ -z "${!variable:-}" ]]; then
        echo "Error: required environment variable $variable is missing or empty." >&2
        exit 1
    fi
done

for file in \
    "$BACKEND/scripts/create_tables.py" \
    "$BACKEND/scripts/seed_users.py" \
    "$ROOT/db/sql/seed.sql"; do

    if [[ ! -f "$file" ]]; then
        echo "Error: required file is missing: $file." >&2
        exit 1
    fi
done

export PGCONNECT_TIMEOUT=3

# Check the database before making changes.
echo "Checking database connection..."

if ! psql -X -w -v ON_ERROR_STOP=1 \
    -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    -c "SELECT 1" >/dev/null; then
    echo "Error: cannot connect to PostgreSQL. Check database availability and configuration." >&2
    exit 1
fi

if [[ "$RESET_MODE" == "true" ]]; then
    if [[ "$AUTO_CONFIRM" != "true" ]]; then
        if ! read -r -p "This will delete all data in the configured database. Continue? [y/N] " response; then
            echo "Reset cancelled."
            exit 1
        fi

        case "$response" in
            [Yy]|[Yy][Ee][Ss])
                ;;
            *)
                echo "Reset cancelled."
                exit 1
                ;;
        esac
    fi

    echo "Resetting database schema and data..."

    RESET_SQL="DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;"

    if ! psql -X -w -v ON_ERROR_STOP=1 \
        -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -c "$RESET_SQL" >/dev/null 2>&1; then
        echo "Error: database reset failed." >&2
        exit 1
    fi
fi

cd "$BACKEND"

# Step 1: Create tables.
echo "Creating tables..."

if ! "$VENV_PYTHON" -m scripts.create_tables >/dev/null 2>&1; then
    echo "Error: table creation failed." >&2
    exit 1
fi

# Step 2: Load seed data.
echo "Loading seed data..."

if ! psql -X -w -v ON_ERROR_STOP=1 \
    -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    --single-transaction \
    -f "$ROOT/db/sql/seed.sql" >/dev/null 2>&1; then
    echo "Error: data seeding failed." >&2
    exit 1
fi

# Step 3: Load demo users.
echo "Loading demo users..."

if ! "$VENV_PYTHON" -m scripts.seed_users >/dev/null 2>&1; then
    echo "Error: demo user seeding failed." >&2
    exit 1
fi

echo "Seed complete."
