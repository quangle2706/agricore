-- AGRICORE SEED DATA --
INSERT INTO farms (name, location_region, capacity, supervisor_id) VALUES 
    ('Green Valley Farm', 'North Florida', 100, 101),
    ('Sunrise Farm', 'Central Florida', 150, 101),
    ('Riverbend Farm', 'South Florida', 120, 102),
    ('Meadowbrook Farm', 'North Florida', 80, 103),
    ('Willow Creek Farm', 'Central Florida', 90, 104),
    ('Sunny Acres Farm', 'South Florida', 110, 105),
    ('Harvest Hill Farm', 'North Florida', 130, 106),
    ('Cedar Grove Farm', 'Central Florida', 95, 107),
    ('Golden Fields Farm', 'South Florida', 140, 108),
    ('Maplewood Farm', 'North Florida', 85, 109),
    ('Pine Ridge Farm', 'Central Florida', 125, 110),
    ('Blueberry Hill Farm', 'South Florida', 105, 111),
    ('Silver Lake Farm', 'North Florida', 115, 112),
    ('Cloverfield Farm', 'Central Florida', 135, 113),
    ('Sunset Valley Farm', 'South Florida', 145, 114);

INSERT INTO equipments (serial_number, model, status, fuel_level, farm_id) VALUES
    ('AG-001', 'John Deere 5075E', 'Idle', 85,
        (SELECT id FROM farms WHERE name = 'Green Valley Farm')),
    ('AG-002', 'Kubota M7060', 'In-Use', 15,
        (SELECT id FROM farms WHERE name = 'Green Valley Farm')),
    ('AG-003', 'John Deere 5075E', 'Maintenance', 40,
        (SELECT id FROM farms WHERE name = 'Sunrise Farm')),
    ('AG-004', 'New Holland T5', 'In-Use', 65,
        (SELECT id FROM farms WHERE name = 'Sunrise Farm')),
    ('AG-005', 'Kubota M7060', 'Idle', 10,
        (SELECT id FROM farms WHERE name = 'Riverbend Farm')),
    ('AG-006', 'New Holland T5', 'Retired', 0,
        (SELECT id FROM farms WHERE name = 'Riverbend Farm')),
    ('AG-007', 'John Deere 5075E', 'Idle', 90,
        (SELECT id FROM farms WHERE name = 'Meadowbrook Farm')),
    ('AG-008', 'Kubota M7060', 'In-Use', 20,
        (SELECT id FROM farms WHERE name = 'Willow Creek Farm')),
    ('AG-009', 'New Holland T5', 'Maintenance', 50,
        (SELECT id FROM farms WHERE name = 'Sunny Acres Farm')),
    ('AG-010', 'John Deere 5075E', 'Idle', 75,
        (SELECT id FROM farms WHERE name = 'Harvest Hill Farm')),
    ('AG-011', 'Kubota M7060', 'In-Use', 30,
        (SELECT id FROM farms WHERE name = 'Cedar Grove Farm')),
    ('AG-012', 'New Holland T5', 'Maintenance', 55,
        (SELECT id FROM farms WHERE name = 'Golden Fields Farm')),
    ('AG-013', 'John Deere 5075E', 'Idle', 80,
        (SELECT id FROM farms WHERE name = 'Maplewood Farm')),
    ('AG-014', 'Kubota M7060', 'In-Use', 25,
        (SELECT id FROM farms WHERE name = 'Pine Ridge Farm')),
    ('AG-015', 'New Holland T5', 'Maintenance', 60,
        (SELECT id FROM farms WHERE name = 'Blueberry Hill Farm'));

INSERT INTO operators (name, farm_id) VALUES 
    ('James Carter',
        (SELECT id FROM farms WHERE name = 'Green Valley Farm')),
    ('Emma Wilson',
        (SELECT id FROM farms WHERE name = 'Green Valley Farm')),
    ('Noah Brown',
        (SELECT id FROM farms WHERE name = 'Sunrise Farm')),
    ('Olivia Davis',
        (SELECT id FROM farms WHERE name = 'Sunrise Farm')),
    ('Liam Taylor',
        (SELECT id FROM farms WHERE name = 'Riverbend Farm')),
    ('Sophia Martinez',
        (SELECT id FROM farms WHERE name = 'Riverbend Farm')),
    ('Mia Anderson',
        (SELECT id FROM farms WHERE name = 'Meadowbrook Farm')),
    ('William Thomas',
        (SELECT id FROM farms WHERE name = 'Pine Ridge Farm')),
    ('Ava Jackson',
        (SELECT id FROM farms WHERE name = 'Blueberry Hill Farm')),
    ('Ethan White',
        (SELECT id FROM farms WHERE name = 'Cedar Grove Farm'));

INSERT INTO field_jobs (title, priority, status, equipment_id, operator_id) VALUES 
    ('Prepare north field soil', 'Medium', 'Completed',
        (SELECT id FROM equipments WHERE serial_number = 'AG-001'),
        (SELECT id FROM operators WHERE name = 'James Carter')),

    ('Harvest corn field', 'Critical', 'In-Progress',
        (SELECT id FROM equipments WHERE serial_number = 'AG-002'),
        (SELECT id FROM operators WHERE name = 'Emma Wilson')),

    ('Repair tractor hydraulic system', 'Critical', 'Failed',
        (SELECT id FROM equipments WHERE serial_number = 'AG-003'),
        (SELECT id FROM operators WHERE name = 'Noah Brown')),

    ('Transport harvested crops', 'Medium', 'Completed',
        (SELECT id FROM equipments WHERE serial_number = 'AG-004'),
        (SELECT id FROM operators WHERE name = 'Olivia Davis')),

    ('Inspect low-fuel tractor', 'Low', 'Pending',
        (SELECT id FROM equipments WHERE serial_number = 'AG-005'),
        (SELECT id FROM operators WHERE name = 'Liam Taylor')),

    ('Document retired equipment', 'Low', 'Completed',
        (SELECT id FROM equipments WHERE serial_number = 'AG-006'),
        (SELECT id FROM operators WHERE name = 'Sophia Martinez')),

    -- Discrepancy 1: equipment at Sunrise, operator at Green Valley
    ('Prepare east field for planting', 'Medium', 'Pending',
        (SELECT id FROM equipments WHERE serial_number = 'AG-004'),
        (SELECT id FROM operators WHERE name = 'James Carter')),

    -- Discrepancy 2: equipment at Green Valley, operator at Riverbend
    ('Inspect tractor before field work', 'Low', 'Pending',
        (SELECT id FROM equipments WHERE serial_number = 'AG-001'),
        (SELECT id FROM operators WHERE name = 'Sophia Martinez'));

-- INSERT INTO service_reports (field_job_id, file_url, notes) VALUES 
--     ();
    
-- Resert Auto-Increment Sequences
SELECT setval('farms_id_seq', (SELECT MAX(id) FROM farms));
SELECT setval('equipments_id_seq', (SELECT MAX(id) FROM equipments));
SELECT setval('operators_id_seq', (SELECT MAX(id) FROM operators));
SELECT setval('field_jobs_id_seq', (SELECT MAX(id) FROM field_jobs));
SELECT setval('service_reports_id_seq', (SELECT MAX(id) FROM service_reports));

-- Create indexes for better filtering and sorting on frequently queried columns
CREATE INDEX IF NOT EXISTS ix_equipments_farm_id
ON equipments (farm_id);

CREATE INDEX IF NOT EXISTS ix_field_jobs_equipment_id
ON field_jobs (equipment_id);

CREATE INDEX IF NOT EXISTS ix_field_jobs_operator_id
ON field_jobs (operator_id);

CREATE INDEX IF NOT EXISTS ix_service_reports_field_job_id
ON service_reports (field_job_id);

