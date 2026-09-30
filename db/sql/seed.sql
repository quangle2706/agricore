-- AGRICORE SEED DATA --
INSERT INTO farms (name, location_region, capacity, supervisor_id) VALUES 
    ('Green Valley Farm', 'North Florida', 100, 101),
    ('Sunrise Farm', 'Central Florida', 150, 101),
    ('Riverbend Farm', 'South Florida', 120, 102);

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
        (SELECT id FROM farms WHERE name = 'Riverbend Farm'));

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
        (SELECT id FROM farms WHERE name = 'Riverbend Farm'));

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