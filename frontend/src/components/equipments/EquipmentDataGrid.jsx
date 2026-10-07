import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    LinearProgress, Typography, MenuItem, IconButton
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
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
    { field: 'serial_number', headerName: 'Serial Number', width: 120},
    { field: 'model', headerName: 'Model', width: 160},
    { field: 'status', headerName: 'Status', width: 130},
    { field: 'fuel_level', headerName: 'Fuel Level %', width: 180, type: 'number', renderCell: (params) => <FuelLevelCell value={params.value} /> }, 
    { field: 'farm_id', headerName: 'Supervisor ID', width: 130, type: 'number'},
];

const STATUS_OPTIONS = ['Idle', 'In-Use', 'Maintenance', 'Retired'];

function EquipmentDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';

    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [formValues, setFormValues] = useState({
        serial_number: '',
        model: '',
        status: 'Idle',
        fuel_level: '',
        farm_id: '',
    });

    async function fetchEquipments() {
        setLoading(true);
        try {
            const response = await apiClient.get('/equipments');
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
    }, []);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    const openCreateDialog = () => {
        setSelectedEquipment(null);
        setFormValues({ serial_number: '', model: '', status: '', fuel_level: '', farm_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!isAdmin) return;

        setSelectedEquipment(row);
        setFormValues({
            serial_number: row.serial_number,
            model: row.model,
            status: row.status,
            fuel_level: row.fuel_level,
            farm_id: row.farm_id
        });
        setDialogOpen(true);
    }

    const handleCreate = async() => {
        try {
            await apiClient.post('/equipments', {
                ...formValues,
                fuel_level: Number(formValues.fuel_level),
                farm_id: Number(formValues.farm_id),
            });
            setDialogOpen(false);
            setFormValues({
                serial_number: '',
                model: '',
                status: '',
                fuel_level: '',
                farm_id: ''
            });
            await fetchEquipments(); 
            onSuccess?.(`Equipment ${formValues.serial_number} created.`);
        } catch {
            setError('Could not create equipment');
        }
    }

    const handleUpdate = async () => {
        try {
            await apiClient.patch(`/equipments/${selectedEquipment.id}`, {
                ...formValues,
                fuel_level: Number(formValues.fuel_level),
                farm_id: Number(formValues.farm_id),
            });
            setDialogOpen(false);
            setSelectedEquipment(null);
            await fetchEquipments();
            onSuccess?.(`Equipment ${formValues.serial_number} updated.`);
        } catch {
            setError('Could not update equipment');
        }
    };

    // const handleDelete = async () => {
    //     if (!window.confirm(`Delete equipment ${selectedEquipment.serial_number}?`)) return;
    //     try {
    //         await apiClient.delete(`/equipments/${selectedEquipment.id}`);
    //         setDialogOpen(false);
    //         setSelectedEquipment(null);
    //         await fetchEquipments();
    //         onSuccess?.(`Equipment ${selectedEquipment.serial_number} deleted.`);
    //     } catch {
    //         setError('Could not delete equipment');
    //     }
    // };

    const handleDeleteRow = async (equipment) => {
        if (!window.confirm(`Delete equipment ${equipment.name}?`)) return;
        try {
            await apiClient.delete(`/equipments/${equipment.id}`);
            await fetchEquipments();
            onSuccess?.(`Equipment ${equipment.serial_number} deleted.`);
        } catch {
            setError('Could not delete equipment');
        }
    };

    const gridColumns = [
        ...columns,
        (isAdmin && {
            field: 'actions',
            headerName: 'Actions',
            width: 80,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <IconButton
                    aria-label={`Delete farm ${row.name}`}
                    color="error"
                    size="small"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRow(row);
                    }}
                >
                    <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
            ),
        }),
    ];

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={equipments}
                    columns={gridColumns}
                    getRowId={(row) => row.id}
                    onRowClick={handleRowClick}
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
            {isAdmin && <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Equipment</Button>}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>{selectedEquipment ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Serial Number" value={formValues.serial_number} onChange={handleFieldChange('serial_number')} />
                        <TextField label="Model" value={formValues.model} onChange={handleFieldChange('model')} />
                        <TextField select label="Status" value={formValues.status} onChange={handleFieldChange('status')}>
                            {STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Fuel Level" type="number" value={formValues.fuel_level} onChange={handleFieldChange('fuel_level')} />
                        <TextField label="Farm ID" type="number" value={formValues.farm_id} onChange={handleFieldChange('farm_id')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {/* {selectedEquipment && <Button color="error" onClick={handleDelete}>Delete</Button>} */}
                    <Button variant="contained" onClick={selectedEquipment ? handleUpdate : handleCreate}>
                        {selectedEquipment ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default EquipmentDataGrid;