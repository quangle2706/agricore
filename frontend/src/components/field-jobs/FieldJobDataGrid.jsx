import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, IconButton
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import apiClient from "../../api/client";

const columns = [
    { field: 'id', headerName: 'ID', width: 70}, // default type is String
    { field: 'title', headerName: "Title", width: 180},
    { field: 'priority', headerName: "Priority", width: 130},
    { field: 'status', headerName: "Status", width: 130},
    { field: 'equipment_id', headerName: "Equipment ID", width: 110, type: 'number'},
    { field: 'operator_id', headerName: "Operator ID", width: 110, type: 'number'},
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'Critical'];
const STATUS_OPTIONS = ['Pending', 'In-Progress', 'Completed', 'Failed'];

function FieldJobDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';
    const canUpdateStatus = isAdmin || userRole === 'Field Hand';

    const [fieldJobs, setFieldJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedFieldJob, setSelectedFieldJob] = useState(null);
    const [statusValue, setStatusValue] = useState('');
    const [formValues, setFormValues] = useState({
        title: '',
        priority: '',
        status: '',
        equipment_id: '',
        operator_id: '',
    });

    async function fetchFieldJobs() {
        setLoading(true);
        try {
            const response = await apiClient.get('/field-jobs');
            setFieldJobs(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchFieldJobs();
    }, []);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    const openCreateDialog = () => {
        setSelectedFieldJob(null);
        setFormValues({ title: '', priority: '', status: '', equipment_id: '', operator_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!isAdmin) return;

        setSelectedFieldJob(row);
        setFormValues({
            title: row.title,
            priority: row.priority,
            status: row.status,
            equipment_id: row.equipment_id,
            operator_id: row.operator_id,
        });
        setDialogOpen(true);
    }

    const handleCreate = async() => {
        try {
            await apiClient.post('/field-jobs', {
                ...formValues
            });
            setDialogOpen(false);
            setFormValues({
                title: '',
                priority: '',
                status: '',
                equipment_id: '',
                operator_id: '',
            });
            await fetchFieldJobs(); 
            onSuccess?.(`Field Job ${formValues.title} created.`);
        } catch {
            setError('Could not create field job');
        }
    }

    const handleUpdate = async () => {
        try {
            await apiClient.patch(`/field-jobs/${selectedFieldJob.id}`, {
                ...formValues,
                equipment_id: Number(formValues.equipment_id),
                operator_id: Number(formValues.operator_id),
            });
            setDialogOpen(false);
            setSelectedFieldJob(null);
            await fetchFieldJobs();
            onSuccess?.(`Field Job ${formValues.title} updated.`);
        } catch {
            setError('Could not update field job');
        }
    };

    const openStatusDialog = (job) => {
        setSelectedFieldJob(job);
        setStatusValue(job.status);
        setStatusDialogOpen(true);
    };

    const handleStatusUpdate = async () => {
        try {
            await apiClient.patch(`/field-jobs/${selectedFieldJob.id}/status`, {
                status: statusValue,
            });
            setStatusDialogOpen(false);
            setSelectedFieldJob(null);
            await fetchFieldJobs();
            onSuccess?.(`Field Job ${selectedFieldJob.title} status updated.`);
        } catch {
            setError('Could not update field job status');
        }
    };

    // const handleDelete = async () => {
    //     if (!window.confirm(`Delete field job ${selectedFieldJob.title}?`)) return;
    //     try {
    //         await apiClient.delete(`/field-jobs/${selectedFieldJob.id}`);
    //         setDialogOpen(false);
    //         setSelectedFieldJob(null);
    //         await fetchFieldJobs();
    //         onSuccess?.(`Field Job ${selectedFieldJob.title} deleted.`);
    //     } catch {
    //         setError('Could not delete farm');
    //     }
    // };

    const handleDeleteRow = async (job) => {
        if (!window.confirm(`Delete field job ${job.title}?`)) return;
        try {
            await apiClient.delete(`/field-jobs/${job.id}`);
            await fetchFieldJobs();
            onSuccess?.(`Field job ${job.title} deleted.`);
        } catch {
            setError('Could not delete field job');
        }
    };

    const gridColumns = [
        ...columns,
        ...(canUpdateStatus ? [{
            field: 'actions',
            headerName: 'Actions',
            width: isAdmin ? 100 : 60,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton
                        aria-label={`Update status for field job ${row.title}`}
                        title="Update status"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            openStatusDialog(row);
                        }}
                    >
                        <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    {isAdmin && (
                        <IconButton
                            aria-label={`Delete field job ${row.title}`}
                            color="error"
                            size="small"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteRow(row);
                            }}
                        >
                            <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            ),
        }] : []),
    ];

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={fieldJobs}
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
            {isAdmin && <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Field Job</Button>}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>{selectedFieldJob ? 'Edit Field Job' : 'Add New Field Job'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Title" value={formValues.title} onChange={handleFieldChange('title')} />
                        <TextField select label="Priority" value={formValues.priority} onChange={handleFieldChange('priority')}>
                            {PRIORITY_OPTIONS.map((option) => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                            ))}
                        </TextField>
                        <TextField select label="Status" value={formValues.status} onChange={handleFieldChange('status')}>
                            {STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Equipment ID" type="number" value={formValues.equipment_id} onChange={handleFieldChange('equipment_id')} />
                        <TextField label="Operator ID" type="number" value={formValues.operator_id} onChange={handleFieldChange('operator_id')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {/* {selectedFieldJob && <Button color="error" onClick={handleDelete}>Delete</Button>} */}
                    <Button variant="contained" onClick={selectedFieldJob ? handleUpdate : handleCreate}>
                        {selectedFieldJob ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>Update Field Job Status</DialogTitle>
                <DialogContent>
                    <TextField
                        select
                        fullWidth
                        label="Status"
                        value={statusValue}
                        onChange={(event) => setStatusValue(event.target.value)}
                        sx={{ mt: 1, minWidth: 300 }}
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleStatusUpdate}>Update Status</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default FieldJobDataGrid;