# pytest -v tests/test_pagination.py

from tests.conftest import auth_header

async def test_list_equipments_with_pagination(client, seeded_users):
    params = {
        "page": 1,
        "size": 2,
        "sort_by": "id",
        "sort_dir": "asc",
    }

    response = await client.get("/equipments", headers=auth_header(seeded_users["auditor"]), params=params)
    assert response.status_code == 200
