#run pytest -v tests/test_farms.py

from tests.conftest import auth_header, seeded_farm

async def test_list_farms_requires_authentication(client):
    response = await client.get("/farms")
    assert response.status_code == 401

async def test_list_farms_any_authenticated_role(client, seeded_users):
    response = await client.get("/farms", headers=auth_header(seeded_users["auditor"]))
    assert response.status_code == 200

async def test_create_farm_forbidden_for_field_hand(client, seeded_users):
    payload = {
        "name": "Test Farm",
        "location_region": "Test Location",
        "capacity": 100,
        "supervisor_id": 1
    }
    response = await client.post("/farms", json=payload, headers=auth_header(seeded_users["operator"]))
    assert response.status_code == 403

async def test_create_farm_succeeds_for_farm_operations_admin(client, seeded_users):
    payload = {
        "name": "Test Farm",
        "location_region": "Test Location",
        "capacity": 100,
        "supervisor_id": 1
    }
    response = await client.post("/farms", json=payload, headers=auth_header(seeded_users["admin"]))
    assert response.status_code == 201
    assert response.json()["name"] == "Test Farm"