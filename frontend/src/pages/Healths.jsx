import { useEffect, useState } from "react";
import { Box, Card, CardContent, Chip, CircularProgress, IconButton,
    Stack, Tooltip, Typography,
 } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import apiClient from "../api/client";
import SideMenu from "../components/menu/SideMenu";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/layout/AppHeader";

const checks = [
    { title: "API Health", path: "/health" },
    { title: "Database Readiness", path: "/health/ready" },
    { title: "Detailed Health", path: "/health/detail", adminOnly: true },
];

export default function Healths() {
    const {user, logout} = useAuth(); 
    const isAdmin = user?.role === 'Farm Operations Admin';
    const [results, setResults] = useState({});
    const [loading, setLoading] = useState(false);

    async function loadHealth() {
        setLoading(true);
        const availableChecks = checks.filter((check) => !check.adminOnly || isAdmin);
        const entries = await Promise.all(
            availableChecks.map(async (check) => {
                try {
                    const response = await apiClient.get(check.path, {
                        timeout: 10000,
                    });
                    return [check.path, {status: response.status, data: response.data}];
                } catch (err) {
                    return [check.path, {status: err.response?.status ?? null, data: err.response?.data ?? "Unable to reach the API."},];
                }
            })
        )

        setResults(Object.fromEntries(entries));
        setLoading(false);
    }

    useEffect(() => {
        loadHealth();
    }, [isAdmin]);

    return (
        <>
            <SideMenu userRole={user?.role} />
            <Box sx={{ ml: { xs: 0, md: '240px', lg: '200px' } }}>
                <AppHeader username={user?.sub} role={user?.role} onLogout={logout} />
                <Box sx={{ mt: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h6">System Health</Typography>
                        <Tooltip title="Refresh health checks">
                            <span>
                                <IconButton
                                    onClick={loadHealth}
                                    disabled={loading}
                                    aria-label="Refresh health checks"
                                    color="primary"
                                >
                                    {loading ? <CircularProgress size={22} /> : <RefreshIcon />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                    <Stack spacing={2}>
                        {
                            checks.filter((check) => !check.adminOnly || isAdmin).map((check) => {
                                const result = results[check.path];
                                const isHealthy = result?.status >= 200 && result?.status < 300;
                                return (
                                    <Card
                                        key={check.path}
                                        variant="outlined"
                                        sx={{ borderRadius: 2, textAlign: "left" }}
                                    >
                                        <CardContent>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                sx={{ mb: 1.5 }}
                                            >
                                                <Typography variant="subtitle1" fontWeight={600}>
                                                    {check.title}
                                                </Typography>
                                                {result && (
                                                    <Chip
                                                        size="small"
                                                        color={isHealthy ? "success" : "error"}
                                                        label={result.status ?? "Unavailable"}
                                                    />
                                                )}
                                            </Stack>
                                            <Box
                                                component="pre"
                                                sx={{ m: 0, p: 2, borderRadius: 1, bgcolor: "action.hover", fontSize: 13, }}
                                            >
                                                {result
                                                    ? JSON.stringify(result.data, null, 2)
                                                    : "Waiting for response..."}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        }
                    </Stack>
                </Box>
            </Box>
        </>
    );
}