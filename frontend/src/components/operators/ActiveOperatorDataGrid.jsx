import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Alert, Box, CircularProgress, TextField, Typography } from "@mui/material";
import apiClient from "../../api/client";

const columns = [
    { field: 'operator_name', headerName: 'Operator', width: 180 },
    { field: 'farm_name', headerName: 'Farm', width: 180 },
    { field: 'active_jobs', headerName: 'Active Jobs', width: 130, type: 'number' },
    { field: 'pending_jobs', headerName: 'Pending', width: 110, type: 'number' },
    { field: 'in_progress_jobs', headerName: 'In Progress', width: 130, type: 'number' },
    { field: 'supervisor_id', headerName: 'Supervisor ID', width: 110, type: 'number'},
];

function ActiveOperatorDataGrid() {
    const [supervisorId, setSupervisorId] = useState("");
    const [activeOperatorsCount, setActiveOperatorsCount] = useState("");
    const [activeOperators, setActiveOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const params = supervisorId === '' ? {} : { supervisor_id: Number(supervisorId) };

        async function fetchActiveOperators() {
            try {
                setLoading(true);
                setError(null);
                const [countResponse, listResponse] = await Promise.all([
                    apiClient.get('/operators/active-field-jobs', { params }),
                    apiClient.get('/operators/active-field-jobs-list', { params }),
                ]);
                if (isMounted) {
                    setActiveOperatorsCount(countResponse.data.active_operator_count);
                    setActiveOperators(listResponse.data);
                }
            } catch {
                if (isMounted) setError('Could not load active field jobs');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchActiveOperators();
        return () => {
            isMounted = false;
        };
    }, [supervisorId]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <TextField
                    label="Supervisor ID"
                    type="number"
                    value={supervisorId}
                    onChange={(event) => setSupervisorId(event.target.value)}
                    size="small"
                    sx={{
                        width: 150,
                        '& .MuiInputBase-root': { height: 40 },
                        '& .MuiInputBase-input, & .MuiInputLabel-root': { fontSize: '0.8rem' },
                    }}
                />
                <Typography sx={{ fontSize: '0.8rem' }}>
                    Active operators: {activeOperatorsCount}
                </Typography>
            </Box>

            {loading && <CircularProgress size={24} />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                        rows={activeOperators}
                        columns={columns}
                        getRowId={(row) => row.operator_id}
                        rowHeight={44}
                        columnHeaderHeight={42}
                        sx={{
                            '& .MuiDataGrid-cell': { fontSize: '0.8rem' },
                            '& .MuiDataGrid-columnHeaderTitle': {
                                fontSize: '0.8rem',
                                fontWeight: 700,
                            },
                        }}
                    />
                </Box>
            )}
        </Box>
    );

}

export default ActiveOperatorDataGrid;