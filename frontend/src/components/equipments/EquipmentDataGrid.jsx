import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    LinearProgress, Typography, MenuItem, IconButton, Divider
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import apiClient from "../../api/client";
import usePermissions from "../../hooks/usePermissions";
import RecordHistoryDialog from "../audit/RecordHistoryDialog";

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
    { field: 'farm_id', headerName: 'Farm ID', width: 130, type: 'number'},
];

const STATUS_OPTIONS = ['Idle', 'In-Use', 'Maintenance', 'Retired'];

function EquipmentDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';
    
    const { hasPermission } = usePermissions();
    const canCreateEquipment = hasPermission("equipment:create");
    const canUpdateEquipment = hasPermission("equipment:update");
    const canDeleteEquipment = hasPermission("equipment:delete");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // pagination
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [inactiveRows, setInactiveRows] = useState([]);
    const [history, setHistory] = useState([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [historyEquipment, setHistoryEquipment] = useState(null);
    const [reload, setReload] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
        status: "",
        farmId: "",
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
                const response = await apiClient.get("/equipments", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
                        status: query.status || undefined,
                        farm_id: query.farmId || undefined,
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
                setError("Unable to load equipments");
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

    // load inactive
    useEffect(() => {
        if (!isAdmin) return undefined;

        const controller = new AbortController(); // to cancel the request if the component unmounts
        let active = true;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const response = await apiClient.get("/equipments/inactive", {
                    signal: controller.signal,
                });

                if (!active) return;
                setInactiveRows(response.data);
            } catch (err) {
                if (!active || controller.signal.aborted) return;
                setRows([]);
                setError("Unable to load equipments");
            } finally {
                if (active) setLoading(false);
            }
        }

        load();
        return () => {
            active = false;
            controller.abort();
        }        
    }, [reload]);


    // ----------

    function updateFilter(field, value) {
        setQuery((previous) => ({
            ...previous,
            [field]: value,
            page: 0,
        }));
    }

    // -----------

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [formValues, setFormValues] = useState({
        serial_number: '',
        model: '',
        status: 'Idle',
        fuel_level: '',
        farm_id: '',
    });

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
        if (!canUpdateEquipment) return;

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
            // await fetchEquipments(); 
            setReload((previous) => previous + 1);
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
            // await fetchEquipments();
            setReload((previous) => previous + 1);
            onSuccess?.(`Equipment ${formValues.serial_number} updated.`);
        } catch {
            setError('Could not update equipment');
        }
    };

    const handleDeleteRow = async (equipment) => {
        if (!window.confirm(`Delete equipment ${equipment.model}?`)) return;
        try {
            await apiClient.delete(`/equipments/${equipment.id}`);

            if (rows.length === 1 && query.page > 0) {
                setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                }));
            } else {
                setReload((previous) => previous + 1);
            }

            onSuccess?.(`Equipment ${equipment.serial_number} deleted.`);
        } catch {
            setError('Could not delete equipment');
        }
    };

    const handleRestoreRow = async (equipment) => {
        try {
            await apiClient.post(`/equipments/${equipment.id}/restore`);
            setReload((previous) => previous + 1);
        } catch {
            setError("Could not load inactive equipments");
        }
    }

    // load history
    async function loadHistory(id) {
        const response = await apiClient.get(`/equipments/${id}/history`);
        setHistory(response.data);
    }

    const showHistory = async (equipment) => {
        setHistoryEquipment(equipment);
        setHistory([]);
        setHistoryError("");
        setHistoryOpen(true);
        setHistoryLoading(true);

        try {
            await loadHistory(equipment.id);
        } catch {
            setHistoryError("Could not load history");
        } finally {
            setHistoryLoading(false);
        }
    }

    const gridColumns = [
        ...columns,
        (canDeleteEquipment && {
            field: 'actions',
            headerName: 'Actions',
            width: 80,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton
                        aria-label={`Delete equipment ${row.model}`}
                        color="error"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteRow(row);
                        }}
                    >
                        <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        aria-label={`Show history for equipment ${row.model}`}
                        color="default"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            showHistory(row);
                        }}
                    >
                        <HistoryToggleOffIcon fontSize="small" />
                    </IconButton>
                </Stack>
            ),
        }),
    ];

    const inactiveColumns = [
        ...columns,
        {
            field: 'actions',
            headerName: 'Actions',
            width: 80,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton
                        aria-label={`Restore equipment ${row.model}`}
                        color="default"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleRestoreRow(row);
                        }}
                    >
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        aria-label={`Show history for equipment ${row.model}`}
                        color="default"
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            showHistory(row);
                        }}
                    >
                        <HistoryToggleOffIcon fontSize="small" />
                    </IconButton>
                </Stack>
            ),
        }
    ]

    return (
        <>
            <Stack spacing={2} useFlexGap>
                <Typography>Equipments</Typography>
                <Button variant="outlined" disabled={loading || !canCreateEquipment} sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Equipment</Button>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField 
                        label="Search serial or model" 
                        value={searchInput} 
                        onChange={(event) => setSearchInput(event.target.value)}
                        size="small" fullWidth
                        />    
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
                        label="Farm ID"
                        type="number"
                        value={query.farmId}
                        onChange={(event) =>
                            updateFilter("farmId", event.target.value)
                        }
                        slotProps={{ htmlInput: { min: 1, step: 1 } }}
                        size="small"
                        sx={{ minWidth: 120 }}
                        />
                </Stack>
                {error && (
                    <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Retry</Button>} >{error}</Alert>
                )}
                <Box sx={{ height: 600, width: '100%' }}>
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
                <Divider sx={{ marginY: 5 }} />
                {isAdmin && (
                    <>
                        <Typography>Inactive Equipments</Typography>
                        <Box sx={{ height: 300, width: '100%' }}>
                            <DataGrid rows={inactiveRows} columns={inactiveColumns} loading={loading} pageSizeOptions={[10, 25, 50, 100]} />
                        </Box>
                    </>
                )}
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
                <RecordHistoryDialog
                    open={historyOpen}
                    onClose={() => setHistoryOpen(false)}
                    title={historyEquipment?.name}
                    entries={history}
                    loading={historyLoading}
                    error={historyError}
                />
            </Stack>
        </>
    )
}

export default EquipmentDataGrid;