import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, 
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tooltip
 } from "@mui/material";
import apiClient from '../../api/client';

function DownloadFileButton({ serviceReportId }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const handleDownload = async () => {
        setLoading(true);
        setError(false);
        try {
            const response = await apiClient.get(`/service-reports/${serviceReportId}/download-url`);
            const link = document.createElement('a');
            link.href = response.data.url;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip title={error ? 'Download failed. Try again.' : 'Download file'}>
            <span>
                <Button size="small" disabled={loading} onClick={handleDownload}>
                    {loading ? 'Preparing...' : 'Download'}
                </Button>
            </span>
        </Tooltip>
    );
}

const columns = [
    {field: 'id', headerName: 'ID', width: 70}, // default type is String
    {field: 'field_job_id', headerName: "Field Job ID", width: 120, type: 'number'},
    {
        field: 'file_url',
        headerName: "File",
        width: 310,
        renderCell: ({ row }) => (
            <DownloadFileButton serviceReportId={row.id} />
        ),
    },
    {field: 'notes', headerName: "Notes", width: 310},
];


function ServiceReportDataGrid({ onSuccess, userRole }) {
    const canAddNew = userRole === 'Farm Operations Admin' || userRole === 'Field Hand';

    const [serviceReports, setServiceReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [formValues, setFormValues] = useState({
        field_job_id: '',
        notes: '',
    });
    const [selectedFile, setSelectedFile] = useState(null);

    async function fetchServiceReports() {
        setLoading(true);
        try {
            const response = await apiClient.get('/service-reports');
            setServiceReports(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchServiceReports();
    }, []);

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }))
    }

    const handleCreate = async() => {
        if (!selectedFile) return;

        try {
            const payload = new FormData();
            payload.append('field_job_id', formValues.field_job_id);
            payload.append('note', formValues.notes);
            payload.append('file', selectedFile);

            await apiClient.post('/service-reports', payload);
            setDialogOpen(false);
            setFormValues({ field_job_id: '', notes: '' });
            setSelectedFile(null);
            await fetchServiceReports();
            onSuccess?.(`Service report created.`);
        } catch {
            setError('Could not create a service report');
        }
    }

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={serviceReports}
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
            {canAddNew && <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={() => setDialogOpen(true)}>Add Service Report</Button>}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ color: 'black', textAlign: 'center' }} >Add New Service Report</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Field Job ID" type="number" value={formValues.field_job_id} onChange={handleFieldChange('field_job_id')} />
                        <Button component="label" variant="outlined">
                            {selectedFile ? selectedFile.name : 'Choose file'}
                            <input
                                type="file"
                                hidden
                                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                            />
                        </Button>
                        <TextField label="Notes" value={formValues.notes} onChange={handleFieldChange('notes')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate}>Create</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default ServiceReportDataGrid;
