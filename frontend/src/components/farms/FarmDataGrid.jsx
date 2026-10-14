import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Typography, Divider
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import apiClient from "../../api/client";
import usePermissions from "../../hooks/usePermissions";
import RecordHistoryDialog from "../audit/RecordHistoryDialog";

const columns = [
    { field: 'id', headerName: 'ID', width: 50}, // default type is String
    { field: 'name', headerName: 'Farm Name', width: 180},
    { field: 'location_region', headerName: 'Location Region', width: 250},
    { field: 'capacity', headerName: 'Capacity', width: 130, type: 'number'},
    { field: 'supervisor_id', headerName: 'Supervisor ID', width: 130, type: 'number'},
];

function FarmDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';
    const { hasPermission } = usePermissions();
    const canCreateFarm = hasPermission("farm:create");
    const canUpdateFarm = hasPermission("farm:update");
    const canDeleteFarm = hasPermission("farm:delete");

    // const [farms, setFarms] = useState([]);
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
    const [historyFarm, setHistoryFarm] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
        supervisorId: "",
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
                const response = await apiClient.get("/farms", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
                        supervisor_id: query.supervisorId || undefined,
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
                setError("Unable to load farms");
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
                const response = await apiClient.get("/farms/inactive", { signal: controller.signal });
                if (active) setInactiveRows(response.data);
            } catch {
                if (active && !controller.signal.aborted) setError("Unable to load inactive farms");
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
    const [selectedFarm, setSelectedFarm] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        location_region: '',
        capacity: '',
        supervisor_id: '',
    });

    if (loading) return <CircularProgress />
    const openCreateDialog = () => {
        setSelectedFarm(null);
        setFormValues({ name: '', location_region: '', capacity: '', supervisor_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!canUpdateFarm) return;
        
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
            // await fetchFarms(); 
            setReload((previous) => previous + 1);
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
            // await fetchFarms();
            setReload((previous) => previous + 1);
            onSuccess?.(`Farm ${formValues.name} updated.`);
        } catch {
            setError('Could not update farm');
        }
    };

    const handleDeleteRow = async (farm) => {
        if (!window.confirm(`Delete farm ${farm.name}?`)) return;
        try {
            await apiClient.delete(`/farms/${farm.id}`);

            // await fetchFarms();
            if (rows.length === 1 && query.page > 0) {
                setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                }));
            } else {
                setReload((previous) => previous + 1);
            }
            
            onSuccess?.(`Farm ${farm.name} deleted.`);
        } catch {
            setError('Could not delete farm');
        }
    };

    const handleRestoreRow = async (farm) => {
        try {
            await apiClient.post(`/farms/${farm.id}/restore`);
            setReload((previous) => previous + 1);
            onSuccess?.(`Farm ${farm.name} restored.`);
        } catch {
            setError('Could not restore farm');
        }
    };

    const showHistory = async (farm) => {
        setHistoryFarm(farm);
        setHistory([]);
        setHistoryError("");
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const response = await apiClient.get(`/farms/${farm.id}/history`);
            setHistory(response.data);
        } catch {
            setHistoryError("Could not load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const gridColumns = [
        ...columns,
        ...(canDeleteFarm ? [{
            field: 'actions',
            headerName: 'Actions',
            width: 110,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Delete farm ${row.name}`} color="error" size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRow(row);
                    }}>
                        <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for farm ${row.name}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        showHistory(row);
                    }}>
                        <HistoryToggleOffIcon fontSize="small" />
                    </IconButton>
                </Stack>
            ),
        }] : []),
    ];

    const inactiveColumns = [
        ...columns,
        {
            field: 'actions',
            headerName: 'Actions',
            width: 110,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Restore farm ${row.name}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleRestoreRow(row);
                    }}>
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for farm ${row.name}`} size="small" onClick={(event) => {
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
            <Button disabled={loading || !canCreateFarm} variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Farm</Button>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField 
                    label="Search name or location region" 
                    value={searchInput} 
                    onChange={(event) => setSearchInput(event.target.value)}
                    size="small" fullWidth
                    />    
                <TextField
                    label="Supervisor ID"
                    type="text"
                    value={query.supervisorId}
                    onChange={(event) =>
                        updateFilter("supervisorId", event.target.value)
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
            <Divider />
            {isAdmin && (
                <>
                    <Typography>Inactive Farms</Typography>
                    <Box sx={{ height: 300, width: '100%' }}>
                        <DataGrid rows={inactiveRows} columns={inactiveColumns} loading={loading} pageSizeOptions={[10, 25, 50, 100]} />
                    </Box>
                </>
            )}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>{selectedFarm ? 'Edit Farm' : 'Add New Farm'}</DialogTitle>
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
                    {/* {selectedFarm && <Button color="error" onClick={handleDelete}>Delete</Button>} */}
                    <Button variant="contained" onClick={selectedFarm ? handleUpdate : handleCreate}>
                        {selectedFarm ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
            <RecordHistoryDialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyFarm?.name}
                entries={history}
                loading={historyLoading}
                error={historyError}
            />
        </Stack>
    )
}

export default FarmDataGrid;