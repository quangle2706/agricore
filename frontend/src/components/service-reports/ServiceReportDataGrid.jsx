import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, 
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tooltip
 } from "@mui/material";
import apiClient from '../../api/client';
import usePermissions from "../../hooks/usePermissions";

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
    // const canAddNew = userRole === 'Farm Operations Admin' || userRole === 'Field Hand';
    const { hasPermission } = usePermissions();
    const canCreateReport = hasPermission("service_report:create");

    const [serviceReports, setServiceReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // pagination
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [reload, setReload] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
        fieldJobId: "",
        sortModel: [{ field: "id", sort: "asc" }],
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(
                (previous) => previous.search === searchInput 
                ? previous : {...previous, search: searchInput, page: 0});
        }, 300);

        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const controller = new AbortController(); // to cancel the request if the component unmounts
        let active = true;

        async function load() {
            setLoading(true);
            setError("");

            const sort = query.sortModel[0];
            try {
                const response = await apiClient.get("/service-reports", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
                        field_job_id: query.fieldJobId || undefined,
                        sort_by: sort?.field ?? "id",
                        sort_dir: sort?.sort ?? "asc",
                    },
                });

                if (!active) return;
                setRows(response.data.items);
                setTotal(response.data.total);
            } catch (err) {
                if (!active || controller.signal.aborted) return;
                setRows([]);
                setError("Unable to load service reports");
            } finally {
                if (active) setLoading(false);
            }
        }

        load();
        return () => {
            active = false;
            controller.abort();
        }
    }, [query, reload]);

    function updateFilter(field, value) {
        setQuery((previous) => ({
            ...previous,
            [field]: value,
            page: 0,
        }));
    }

    // -------------    


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
            setReload((previous) => previous + 1);
            onSuccess?.(`Service report created.`);
        } catch {
            setError('Could not create a service report');
        }
    }

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                    label="Field Job ID"
                    type="number"
                    value={query.fieldJobId}
                    onChange={(event) =>
                        updateFilter("fieldJobId", event.target.value)
                    }
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    size="small"
                    sx={{ minWidth: 120 }}
                    />
                <TextField 
                    label="Search notes" 
                    value={searchInput} 
                    onChange={(event) => setSearchInput(event.target.value)}
                    size="small" fullWidth
                    />    
            </Stack>
            {error && (
                <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Retry</Button>} >{error}</Alert>
            )}
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid 
                    rows={rows}
                    columns={columns}
                    rowCount={total}
                    loading={loading}
                    pagination
                    paginationMode="server"
                    sortingMode="server"
                    filterMode="server"
                    disableColumnFilter
                    pageSizeOptions={[10, 25, 50, 100]}
                    paginationModel={{
                        page: query.page,
                        pageSize: query.pageSize,
                    }}
                    onPaginationModelChange={(model) => 
                        setQuery((previous) => ({
                            ...previous,
                            page: model.pageSize !== previous.pageSize ? 0 : model.page,
                            pageSize: model.pageSize,
                        }))
                    }
                    sortModel={query.sortModel}
                    onSortModelChange={(sortModel) => 
                        setQuery((previous) => ({
                            ...previous,
                            sortModel,
                            page: 0,
                        }))
                    }
                />
            </Box>
            <Button disabled={loading || !canCreateReport} variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={() => setDialogOpen(true)}>Add Service Report</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }} >Add New Service Report</DialogTitle>
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
        </Stack>
    )
}

export default ServiceReportDataGrid;
