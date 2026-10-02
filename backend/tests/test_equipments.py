from tests.conftest import auth_header, seeded_farm


async def test_list_equipments_requires_authentication(client):
    response = await client.get("/equipments")
    assert response.status_code == 401


async def test_list_equipments_any_authenticated_role(client, seeded_users):
    response = await client.get("/equipments", headers=auth_header(seeded_users["auditor"]))
    assert response.status_code == 200


async def test_create_equipment_forbidden_for_field_hand(client, seeded_users, seeded_farm):
    payload = {
        "serial_number": "TX-1001",
        "model": "Test-Bot",
        "fuel_level": 50,
        "farm_id": seeded_farm.id,
        "status": "Idle",
    }
    response = await client.post("/equipments", json=payload, headers=auth_header(seeded_users["operator"]))
    assert response.status_code == 403


async def test_create_equipment_succeeds_for_farm_operations_admin(client, seeded_users, seeded_farm):
    payload = {
        "serial_number": "TX-1001",
        "model": "Test-Bot",
        "fuel_level": 50,
        "farm_id": seeded_farm.id,
        "status": "Idle",
    }
    response = await client.post("/equipments", json=payload, headers=auth_header(seeded_users["admin"]))
    assert response.status_code == 201
    assert response.json()["serial_number"] == "TX-1001"


async def test_low_fuel_filter(client, seeded_users, seeded_farm):
    admin_headers = auth_header(seeded_users["admin"])
    low = {"serial_number": "LOW-01", "model": "Test-Bot", "fuel_level": 10, "farm_id": seeded_farm.id, "status": "Idle"}
    high = {"serial_number": "HIGH-01", "model": "Test-Bot", "fuel_level": 90, "farm_id": seeded_farm.id, "status": "Idle"}

    await client.post("/equipments", json=low, headers=admin_headers)
    await client.post("/equipments", json=high, headers=admin_headers)

    response = await client.get("/equipments/active?max_fuel_level=20", headers=admin_headers)
    serials = [equipment["serial_number"] for equipment in response.json()]

    assert "LOW-01" in serials
    assert "HIGH-01" not in serials