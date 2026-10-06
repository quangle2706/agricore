from enum import Enum

#EquipmentStatus (Idle/In-Use/Maintenance/Retired)
#FieldJobPriority (Low/Medium/Critical)
#FieldJobStatus (Pending/In-Progress/Completed/Failed)

class EquipmentStatus(str, Enum):
    IDLE = "Idle"
    IN_USE = "In-Use"
    MAINTENANCE = "Maintenance"
    RETIRED = "Retired"

class FieldJobPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    CRITICAL = "Critical"

class FieldJobStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In-Progress"
    COMPLETED = "Completed"
    FAILED = "Failed"

class UserRole(str, Enum):
    FARM_OPERATIONS_ADMIN = "Farm Operations Admin"
    FIELD_HAND = "Field Hand"
    AUDITOR = "Auditor"