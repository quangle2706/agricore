#!/usr/bin/env bash
# this file activates the backend venv, ensures agricore_test exists
#and creates it if it doesn't and runs the full pytest suite

#bash bin/test.sh

set -e

echo "== Agricore Test Runner =="

cd backend
source .venv/Scripts/activate

#tAc runs a query and returns just the raw value (no headers, no alignment padding)
DB_EXISTS=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='agricore_test'")

if [ $DB_EXISTS != "1" ]; then
    echo "agricore_test db not found - creating it..."
    psql -U postgres -c "CREATE DATABASE agricore_test;"
fi

echo "Running tests..."
pytest -v

echo "Test run complete."