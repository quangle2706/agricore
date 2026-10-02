import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle
 } from "@mui/material";
import apiClient from "../../api/client";

const columns = [
    { field: 'id', headerName: 'ID', width: 50}, // default type is String
    { field: 'name', headerName: 'Operator Name', width: 180},
    { field: 'farm_id', headerName: 'Farm ID', width: 130, type: 'number'},
];

function OperatorDataGrid({ onSuccess }) {
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        farm_id: '',
    });

    async function fetchOperators() {
        setLoading(true);
        try {
            const response = await apiClient.get('/operators');
            setOperators(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchOperators();
    }, []);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    const openCreateDialog = () => {
        setSelectedOperator(null);
        setFormValues({ name: '', farm_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        setSelectedOperator(row);
        setFormValues({
            name: row.name,
            farm_id: row.farm_id,
        });
        setDialogOpen(true);
    }

    const handleCreate = async() => {
        try {
            await apiClient.post('/operators', {
                ...formValues
            });
            setDialogOpen(false);
            setFormValues({
                name: '',
                operator_id: '',
            });
            await fetchOperators(); 
            onSuccess?.(`Operator ${formValues.name} created.`);
        } catch {
            setError('Could not create operator');
        }
    }

    const handleUpdate = async () => {
        try {
            await apiClient.patch(`/operators/${selectedOperator.id}`, {
                ...formValues,
                farm_id: Number(formValues.farm_id),
            });
            setDialogOpen(false);
            setSelectedOperator(null);
            await fetchOperators();
            onSuccess?.(`Operator ${formValues.name} updated.`);
        } catch {
            setError('Could not update operator');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete operator ${selectedOperator.name}?`)) return;
        try {
            await apiClient.delete(`/operators/${selectedOperator.id}`);
            setDialogOpen(false);
            setSelectedOperator(null);
            await fetchOperators();
            onSuccess?.(`Operator ${selectedOperator.name} deleted.`);
        } catch {
            setError('Could not delete operator');
        }
    };

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={operators}
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
            <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Operator</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ color: 'black', textAlign: 'center' }}>{selectedOperator ? 'Edit Operator' : 'Add New Operator'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Name" value={formValues.name} onChange={handleFieldChange('name')} />
                        <TextField label="Farm ID" type="number" value={formValues.farm_id} onChange={handleFieldChange('farm_id')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {selectedOperator && <Button color="error" onClick={handleDelete}>Delete</Button>}
                    <Button variant="contained" onClick={selectedOperator ? handleUpdate : handleCreate}>
                        {selectedOperator ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default OperatorDataGrid;