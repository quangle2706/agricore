"""
From \backend: run pytest -v tests/test_field_jobs.py
"""

import pytest_asyncio
from app.models import FieldJob, FieldJobStatus, FieldJobPriority, Operator, Equipment, EquipmentStatus
from tests.conftest import auth_header

@pytest_asyncio.fixture
async def seeded_field_job(db_session, seeded_farm):
    # Create an operator
    operator = Operator(name="Test Operator", farm_id=seeded_farm.id)
    db_session.add(operator)
    await db_session.commit()

    # Create equipment
    equipment = Equipment(
        serial_number="EQ-001",
        model="Test Model",
        fuel_level=100,
        farm_id=seeded_farm.id,
        status=EquipmentStatus.IDLE,
    )
    db_session.add(equipment)
    await db_session.commit()

    # Create field job
    field_job = FieldJob(
        title="Field Job",
        status=FieldJobStatus.PENDING,
        priority=FieldJobPriority.MEDIUM,
        operator_id=operator.id,
        equipment_id=equipment.id,
    )
    db_session.add(field_job)
    await db_session.commit()

    return field_job

async def test_admin_can_update_status(client, seeded_users, seeded_field_job):
    response = await client.patch(
        f"/field-jobs/{seeded_field_job.id}/status",
        headers=auth_header(seeded_users["admin"]),
        json={"status": FieldJobStatus.IN_PROGRESS}
    )
    assert response.status_code == 200
    updated_field_job = response.json()
    assert updated_field_job["status"] == FieldJobStatus.IN_PROGRESS

async def test_field_hand_can_update_status(client, seeded_users, seeded_field_job):
    response = await client.patch(
        f"/field-jobs/{seeded_field_job.id}/status",
        headers=auth_header(seeded_users["operator"]),
        json={"status": FieldJobStatus.COMPLETED}
    )
    assert response.status_code == 200
    updated_field_job = response.json()
    assert updated_field_job["status"] == FieldJobStatus.COMPLETED

async def test_auditor_cannot_update_status(client, seeded_users, seeded_field_job):
    response = await client.patch(
        f"/field-jobs/{seeded_field_job.id}/status",
        headers=auth_header(seeded_users["auditor"]),
        json={"status": FieldJobStatus.COMPLETED}
    )
    assert response.status_code == 403