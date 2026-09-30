import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle
 } from "@mui/material";
import apiClient from "../../api/client";

const columns = [
    { field: 'id', headerName: 'ID', width: 50}, // default type is String
    { field: 'name', headerName: 'Farm Name', width: 180},
    { field: 'location_region', headerName: 'Location Region', width: 250},
    { field: 'capacity', headerName: 'Capacity', width: 130, type: 'number'},
    { field: 'supervisor_id', headerName: 'Supervisor ID', width: 130, type: 'number'},
];

function FarmDataGrid({ onSuccess }) {
    const [farms, setFarms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedFarm, setSelectedFarm] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        location_region: '',
        capacity: '',
        supervisor_id: '',
    });

    async function fetchFarms() {
        setLoading(true);
        try {
            const response = await apiClient.get('/farms');
            setFarms(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchFarms();
    }, []);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    const openCreateDialog = () => {
        setSelectedFarm(null);
        setFormValues({ name: '', location_region: '', capacity: '', supervisor_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        setSelectedFarm(row);
        setFormValues({
            name: row.name,
            location_region: row.location_region,
            capacity: row.capacity,
            supervisor_id: row.supervisor_id,
        });
        setDialogOpen(true);
    }

    const handleCreate = async() => {
        try {
            await apiClient.post('/farms', {
                ...formValues
            });
            setDialogOpen(false);
            setFormValues({
                name: '',
                location_region: '',
                capacity: '',
                supervisor_id: '',
            });
            await fetchFarms(); 
            onSuccess?.(`Farm ${formValues.name} created.`);
        } catch {
            setError('Could not create farm');
        }
    }

    const handleUpdate = async () => {
        try {
            await apiClient.patch(`/farms/${selectedFarm.id}`, {
                ...formValues,
                capacity: Number(formValues.capacity),
                supervisor_id: Number(formValues.supervisor_id),
            });
            setDialogOpen(false);
            setSelectedFarm(null);
            await fetchFarms();
            onSuccess?.(`Farm ${formValues.name} updated.`);
        } catch {
            setError('Could not update farm');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete farm ${selectedFarm.name}?`)) return;
        try {
            await apiClient.delete(`/farms/${selectedFarm.id}`);
            setDialogOpen(false);
            setSelectedFarm(null);
            await fetchFarms();
            onSuccess?.(`Farm ${selectedFarm.name} deleted.`);
        } catch {
            setError('Could not delete farm');
        }
    };

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={farms}
                    columns={columns}
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
            <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Farm</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ color: 'black', textAlign: 'center' }}>{selectedFarm ? 'Edit Farm' : 'Add New Farm'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Name" value={formValues.name} onChange={handleFieldChange('name')} />
                        <TextField label="Location Region" value={formValues.location_region} onChange={handleFieldChange('location_region')} />
                        <TextField label="Capacity" type="number" value={formValues.capacity} onChange={handleFieldChange('capacity')} />
                        <TextField label="Supervisor ID" type="number" value={formValues.supervisor_id} onChange={handleFieldChange('supervisor_id')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {selectedFarm && <Button color="error" onClick={handleDelete}>Delete</Button>}
                    <Button variant="contained" onClick={selectedFarm ? handleUpdate : handleCreate}>
                        {selectedFarm ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default FarmDataGrid;