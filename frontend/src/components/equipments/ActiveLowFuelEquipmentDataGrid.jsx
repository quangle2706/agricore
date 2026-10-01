import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    LinearProgress, Typography, MenuItem
 } from "@mui/material";
import apiClient from "../../api/client";

function FuelLevelCell({ value }) {
    const fuelLevel = Math.min(Math.max(Number(value) || 0, 0), 100);
    const color = fuelLevel < 30 ? '#ff2d2d' : fuelLevel < 60 ? '#ed6c02' : '#12a019';

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', height: '100%' }}>
            <LinearProgress variant="determinate" value={fuelLevel} aria-label={`Fuel level ${fuelLevel}%`}
                sx={{ flex: 1, height: 5, borderRadius: 4, 
                    backgroundColor: 'action.hover', '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 4 }  }} />
            <Typography variant="body2" sx={{ minWidth: 38, textAlign: 'right', fontSize: '0.8rem' }}>{ fuelLevel }%</Typography>
        </Box>
    );
}

const columns = [
    { field: 'id', headerName: 'ID', width: 50}, // default type is String
    { field: 'serial_number', headerName: 'Serial Number', width: 150},
    { field: 'model', headerName: 'Model', width: 160},
    { field: 'status', headerName: 'Status', width: 130},
    { field: 'fuel_level', headerName: 'Fuel Level %', width: 250, type: 'number', renderCell: (params) => <FuelLevelCell value={params.value} /> }, 
    { field: 'farm_id', headerName: 'Supervisor ID', width: 130, type: 'number'},
];

const STATUS_OPTIONS = ['Idle', 'In-Use', 'Maintenance', 'Retired'];

function ActiveLowFuelEquipmentDataGrid({ onSuccess }) {
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [threshold, setThreshold] = useState(20);

    async function fetchEquipments() {
        setLoading(true);
        try {
            const response = await apiClient.get('/equipments/active', {
                params: { max_fuel_level: threshold === '' ? undefined : Number(threshold) }
            });
            setEquipments(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchEquipments();
    }, [threshold]);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>
                    Fuel Level Threshold (%)
                </Typography>

                <TextField
                    label="Max Fuel Level %"
                    type="number"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    size="small"
                    slotProps={{
                    htmlInput: {
                        min: 0,
                        max: 100,
                    },
                    }}
                    sx={{
                        width: 140,
                        '& .MuiInputBase-root': { height: 40 },
                        '& .MuiInputBase-input': { fontSize: '0.8rem' },
                        '& .MuiInputLabel-root': { fontSize: '0.9rem' },
                        '& input[type=number]': { colorScheme: 'light' },
                    }}
                />
            </Box>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={equipments}
                    columns={columns}
                    getRowId={(row) => row.id}
                    rowHeight={44}
                    columnHeaderHeight={45}
                    sx={{
                        '& .MuiDataGrid-cell': {
                            fontSize: '0.8rem',
                            alignItems: 'center',
                        },
                        '& .MuiDataGrid-columnHeaderTitle': {
                            fontSize: '0.8rem',
                            fontWeight: 700,
                        },
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: '#f4f6f8',
                            borderBottom: '2px solid #d7dce2',
                        },
                    }}
                />
            </Box>
        </>
    )
}

export default ActiveLowFuelEquipmentDataGrid;