#run: pytest -v tests/test_operators.py

from tests.conftest import auth_header, seeded_farm

async def test_list_operators_requires_authentication(client):
    response = await client.get("/operators")
    assert response.status_code == 401

async def test_list_operators_any_authenticated_role(client, seeded_users):
    response = await client.get("/operators", headers=auth_header(seeded_users["auditor"]))
    assert response.status_code == 200

async def test_create_operator_forbidden_for_field_hand(client, seeded_users, seeded_farm):
    payload = {
        "name": "Test Operator",
        "farm_id": seeded_farm.id
    }
    response = await client.post("/operators", json=payload, headers=auth_header(seeded_users["operator"]))
    assert response.status_code == 403

async def test_create_operator_succeeds_for_farm_operations_admin(client, seeded_users, seeded_farm):
    payload = {
        "name": "Test Operator",
        "farm_id": seeded_farm.id
    }
    response = await client.post("/operators", json=payload, headers=auth_header(seeded_users["admin"]))
    assert response.status_code == 201
    assert response.json()["name"] == "Test Operator"