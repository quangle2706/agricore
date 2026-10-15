ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "Farm Operations Admin": frozenset({
        "farm:read",
        "farm:create",
        "farm:update",
        "farm:delete",

        "equipment:read",
        "equipment:create",
        "equipment:update",
        "equipment:delete",

        "operator:read",
        "operator:create",
        "operator:update",
        "operator:delete",

        "field_job:read",
        "field_job:create",
        "field_job:update",
        "field_job:delete",
        "field_job:update_status",
        
        "service_report:read",
        "service_report:create",
        "service_report:update",
        "service_report:delete",
        
        "user:read",
        "user:create",
        "user:update",
        "user:delete",
        
        "role:read",
        "health:read_detail"
    }),
    "Field Hand": frozenset({
        "farm:read",
        "equipment:read",
        "operator:read",
        "field_job:read",
        "field_job:update_status",
        "service_report:read",
        "service_report:create",
    }),
    "Auditor": frozenset({
        "farm:read",
        "equipment:read",
        "operator:read",
        "field_job:read",
        "service_report:read",
    }),
    "Tester": frozenset({
        "farm:read",
        "equipment:read",
        "operator:read",
        "field_job:read",
        "service_report:read",
        "role:read",
    }),
}

def get_role_name(role) -> str:
    return role.value if hasattr(role, "value") else role

def get_role_permissions(role) -> frozenset[str]:
    role_name = get_role_name(role)
    return ROLE_PERMISSIONS.get(role_name, frozenset())

