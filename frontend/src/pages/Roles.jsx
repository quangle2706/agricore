import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Typography,
    List, ListItemButton, ListItemText, Paper, 
    Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import apiClient from "../api/client";
import AppHeader from "../components/layout/AppHeader";
import SideMenu from "../components/menu/SideMenu";
import { useAuth } from "../context/AuthContext";

const resources = [
    { key: "farm", label: "Farms" },
    { key: "equipment", label: "Equipment" },
    { key: "operator", label: "Operators" },
    { key: "field_job", label: "Field Jobs" },
    { key: "service_report", label: "Service Report" },
    { key: "role", label: "Roles" },
];

export default function Roles() {
    const {user, logout} = useAuth(); 
    const [roles, setRoles] = useState([]);
    const [selectedRoleName, setSelectedRoleName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadRoles() {
            try {
                const response = await apiClient.get("/roles");

                if (active) {
                    setRoles(response.data);
                    setSelectedRoleName(response.data[0]?.name ?? null);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err.response?.status === 403
                            ? "You do not have permission to view roles."
                            : "Unable to load roles."
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadRoles();

        return () => {
            active = false;
        };
    }, []);

    const selectedRole = roles.find(
        (role) => role.name === selectedRoleName
    );

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!roles.length) {
        return <Alert severity="info">No roles available.</Alert>;
    }

    return (
        <>
            <SideMenu userRole={user?.role} />
            <Box sx={{ ml: { xs: 0, md: '240px', lg: '200px' } }}>
                <AppHeader username={user?.sub} role={user?.role} onLogout={logout} />
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Roles & Permissions
                    </Typography>

                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        View the permissions assigned to each role.
                    </Typography>

                    <Box
                        sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "280px minmax(0, 1fr)",
                        },
                        gap: 3,
                        }}
                    >
                    <Paper variant="outlined">
                        <List>
                            {roles.map((role) => (
                            <ListItemButton
                                key={role.name}
                                selected={role.name === selectedRoleName}
                                onClick={() => setSelectedRoleName(role.name)}
                            >
                                <ListItemText
                                primary={role.name}
                                secondary={`${role.permissions.length} permissions`}
                                />
                            </ListItemButton>
                            ))}
                        </List>
                    </Paper>

                    {selectedRole && (
                    <Paper variant="outlined" sx={{ p: 3, overflowX: "auto" }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                        {selectedRole.name}
                        </Typography>

                        <Table aria-label="Role permissions">
                        <TableHead>
                            <TableRow>
                            <TableCell>Resource</TableCell>
                            <TableCell align="center">Read</TableCell>
                            <TableCell align="center">Create</TableCell>
                            <TableCell align="center">Update</TableCell>
                            <TableCell align="center">Delete</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {resources.map((resource) => (
                            <TableRow key={resource.key}>
                                <TableCell>{resource.label}</TableCell>

                                {["read", "create", "update", "delete"].map((action) => {
                                const allowed =
                                    selectedRole.permissions.includes(
                                    `${resource.key}:${action}`
                                    );

                                return (
                                    <TableCell key={action} align="center">
                                    {allowed ? "✓" : "—"}
                                    </TableCell>
                                );
                                })}
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </Paper>
                    )}
                </Box>
            </Box>
        </Box>
    </>
  );
}