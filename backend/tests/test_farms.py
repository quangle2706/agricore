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


#test delete farm with audit log
async def test_delete_farm_succeeds_for_farm_operations_admin(client, seeded_users, seeded_farm):
    response = await client.delete(f"/farms/{seeded_farm.id}", headers=auth_header(seeded_users["admin"]))
    assert response.status_code == 204

    farm_history_response = await client.get(f"/farms/{seeded_farm.id}/history", headers=auth_header(seeded_users["admin"]))
    assert farm_history_response.status_code == 200
    assert farm_history_response.json()[0]["action"] == "DELETE"
    assert farm_history_response.json()[0]["actor_name"] == seeded_users["admin"].username