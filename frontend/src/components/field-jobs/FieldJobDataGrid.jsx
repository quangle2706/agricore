import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, IconButton, Typography
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import apiClient from "../../api/client";
import usePermissions from "../../hooks/usePermissions";
import RecordHistoryDialog from "../audit/RecordHistoryDialog";

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
    // const canUpdateStatus = isAdmin || userRole === 'Field Hand';
    const { hasPermission } = usePermissions();
    const canCreateFieldJob = hasPermission("field_job:create");
    const canUpdateFieldJob = hasPermission("field_job:update");
    const canDeleteFieldJob = hasPermission("field_job:delete");
    const canUpdateStatusFJ = hasPermission("field_job:update_status");
    const canUpdate = canUpdateFieldJob || canUpdateStatusFJ;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // pagination
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [inactiveRows, setInactiveRows] = useState([]);
    const [reload, setReload] = useState(0);
    const [history, setHistory] = useState([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [historyFieldJob, setHistoryFieldJob] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
        priority: "",
        status: "",
        equipmentId: "",
        operatorId: "",
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
                const response = await apiClient.get("/field-jobs", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
                        priority: query.priority || undefined,
                        status: query.status || undefined,
                        equipment_id: query.equipmentId || undefined,
                        operator_id: query.operatorId || undefined,
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
                setError("Unable to load field jobs");
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

    useEffect(() => {
        if (!isAdmin) return undefined;

        const controller = new AbortController();
        let active = true;
        async function loadInactive() {
            try {
                const response = await apiClient.get("/field-jobs/inactive", { signal: controller.signal });
                if (active) setInactiveRows(response.data);
            } catch {
                if (active && !controller.signal.aborted) setError("Unable to load inactive field jobs");
            }
        }

        loadInactive();
        return () => {
            active = false;
            controller.abort();
        };
    }, [isAdmin, reload]);

    function updateFilter(field, value) {
        setQuery((previous) => ({
            ...previous,
            [field]: value,
            page: 0,
        }));
    }

    // -------------

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

    if (loading) return <CircularProgress />
    const openCreateDialog = () => {
        setSelectedFieldJob(null);
        setFormValues({ title: '', priority: '', status: '', equipment_id: '', operator_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!canUpdateFieldJob) return;

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
            setReload((previous) => previous + 1);
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
            setReload((previous) => previous + 1);
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
            setReload((previous) => previous + 1);
            onSuccess?.(`Field Job ${selectedFieldJob.title} status updated.`);
        } catch {
            setError('Could not update field job status');
        }
    };


    const handleDeleteRow = async (job) => {
        if (!window.confirm(`Delete field job ${job.title}?`)) return;
        try {
            await apiClient.delete(`/field-jobs/${job.id}`);

            // await fetchFieldJobs();
            if (rows.length === 1 && query.page > 0) {
                setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                }));
            } else {
                setReload((previous) => previous + 1);
            }

            onSuccess?.(`Field job ${job.title} deleted.`);
        } catch {
            setError('Could not delete field job');
        }
    };

    const handleRestoreRow = async (job) => {
        try {
            await apiClient.post(`/field-jobs/${job.id}/restore`);
            setReload((previous) => previous + 1);
            onSuccess?.(`Field job ${job.title} restored.`);
        } catch {
            setError('Could not restore field job');
        }
    };

    const showHistory = async (job) => {
        setHistoryFieldJob(job);
        setHistory([]);
        setHistoryError("");
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const response = await apiClient.get(`/field-jobs/${job.id}/history`);
            setHistory(response.data);
        } catch {
            setHistoryError("Could not load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const gridColumns = [
        ...columns,
        ...(canUpdate || canDeleteFieldJob ? [{
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    {canUpdateStatusFJ && (<IconButton
                        aria-label={`Update status for field job ${row.title}`}
                        title="Update status"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            openStatusDialog(row);
                        }}
                    >
                        <EditOutlinedIcon fontSize="small" />
                    </IconButton>)}
                    {canDeleteFieldJob && (
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
                    {canDeleteFieldJob && (
                        <IconButton aria-label={`Show history for field job ${row.title}`} size="small" onClick={(event) => {
                            event.stopPropagation();
                            showHistory(row);
                        }}>
                            <HistoryToggleOffIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            ),
        }] : []),
    ];

    const inactiveColumns = [
        ...columns,
        {
            field: 'actions',
            headerName: 'Actions',
            width: 100,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Restore field job ${row.title}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleRestoreRow(row);
                    }}>
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for field job ${row.title}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        showHistory(row);
                    }}>
                        <HistoryToggleOffIcon fontSize="small" />
                    </IconButton>
                </Stack>
            ),
        },
    ];

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField 
                    label="Search title" 
                    value={searchInput} 
                    onChange={(event) => setSearchInput(event.target.value)}
                    size="small" fullWidth
                    />    
                <TextField 
                    select
                    label="Priority"
                    value={query.priority}
                    onChange={(event) => updateFilter("priority", event.target.value)}
                    size="small"
                    sx={{ minWidth: 170 }}>
                        <MenuItem value="">All</MenuItem>
                        {PRIORITY_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                </TextField>
                <TextField 
                    select
                    label="Status"
                    value={query.status}
                    onChange={(event) => updateFilter("status", event.target.value)}
                    size="small"
                    sx={{ minWidth: 170 }}>
                        <MenuItem value="">All</MenuItem>
                        {STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                </TextField>
                <TextField
                    label="Equipment ID"
                    type="number"
                    value={query.equipmentId}
                    onChange={(event) =>
                        updateFilter("equipmentId", event.target.value)
                    }
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    size="small"
                    sx={{ minWidth: 120 }}
                    />
                <TextField
                    label="Operator ID"
                    type="number"
                    value={query.operatorId}
                    onChange={(event) =>
                        updateFilter("operatorId", event.target.value)
                    }
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    size="small"
                    sx={{ minWidth: 120 }}
                    />
            </Stack>
            {error && (
                <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Retry</Button>} >{error}</Alert>
            )}
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid 
                    rows={rows}
                    columns={gridColumns}
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
                    onRowClick={handleRowClick}
                />
            </Box>
            {isAdmin && (
                <>
                    <Typography>Inactive Field Jobs</Typography>
                    <Box sx={{ height: 300, width: '100%' }}>
                        <DataGrid rows={inactiveRows} columns={inactiveColumns} loading={loading} pageSizeOptions={[10, 25, 50, 100]} />
                    </Box>
                </>
            )}
            <Button disabled={loading || !canCreateFieldJob} variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Field Job</Button>
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
            <RecordHistoryDialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyFieldJob?.title}
                entries={history}
                loading={historyLoading}
                error={historyError}
            />
        </Stack>
    )
}

export default FieldJobDataGrid;