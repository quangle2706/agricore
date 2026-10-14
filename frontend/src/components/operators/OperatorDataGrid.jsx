import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, Divider
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import apiClient from "../../api/client";
import usePermissions from "../../hooks/usePermissions";
import RecordHistoryDialog from "../audit/RecordHistoryDialog";

const columns = [
    { field: 'id', headerName: 'ID', width: 50}, // default type is String
    { field: 'name', headerName: 'Operator Name', width: 180},
    { field: 'farm_id', headerName: 'Farm ID', width: 130, type: 'number'},
];

function OperatorDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';
    const { hasPermission } = usePermissions();
    const canCreateOperator = hasPermission("operator:create");
    const canUpdateOperator = hasPermission("operator:update");
    const canDeleteOperator = hasPermission("operator:delete");

    const [operators, setOperators] = useState([]);
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
    const [historyOperator, setHistoryOperator] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
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
                const response = await apiClient.get("/operators", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
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
                setError("Unable to load operators");
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
                const response = await apiClient.get("/operators/inactive", { signal: controller.signal });
                if (active) setInactiveRows(response.data);
            } catch {
                if (active && !controller.signal.aborted) setError("Unable to load inactive operators");
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
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        farm_id: '',
    });

    if (loading) return <CircularProgress />
    const openCreateDialog = () => {
        setSelectedOperator(null);
        setFormValues({ name: '', farm_id: '' });
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!canUpdateOperator) return;

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
            setReload((previous) => previous + 1);
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
            setReload((previous) => previous + 1);
            onSuccess?.(`Operator ${formValues.name} updated.`);
        } catch {
            setError('Could not update operator');
        }
    };

    const handleDeleteRow = async (operator) => {
        if (!window.confirm(`Delete operator ${operator.name}?`)) return;
        try {
            await apiClient.delete(`/operators/${operator.id}`);
            
            if (rows.length === 1 && query.page > 0) {
                setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                }));
            } else {
                setReload((previous) => previous + 1);
            }

            onSuccess?.(`Operator ${operator.name} deleted.`);
        } catch {
            setError('Could not delete operator');
        }
    };

    const handleRestoreRow = async (operator) => {
        try {
            await apiClient.post(`/operators/${operator.id}/restore`);
            setReload((previous) => previous + 1);
            onSuccess?.(`Operator ${operator.name} restored.`);
        } catch {
            setError('Could not restore operator');
        }
    };

    const showHistory = async (operator) => {
        setHistoryOperator(operator);
        setHistory([]);
        setHistoryError("");
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const response = await apiClient.get(`/operators/${operator.id}/history`);
            setHistory(response.data);
        } catch {
            setHistoryError("Could not load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const gridColumns = [
        ...columns,
        ...(canDeleteOperator ? [{
            field: 'actions',
            headerName: 'Actions',
            width: 110,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Delete operator ${row.name}`} color="error" size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRow(row);
                    }}>
                        <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for operator ${row.name}`} size="small" onClick={(event) => {
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
                    <IconButton aria-label={`Restore operator ${row.name}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleRestoreRow(row);
                    }}>
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for operator ${row.name}`} size="small" onClick={(event) => {
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
            <Button disabled={loading || !canCreateOperator} variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add Operator</Button>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField 
                    label="Search name" 
                    value={searchInput} 
                    onChange={(event) => setSearchInput(event.target.value)}
                    size="small" fullWidth
                    />    
                <TextField
                    label="Farm ID"
                    type="text"
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
            <Divider />
            {isAdmin && (
                <>
                    <Typography>Inactive Operators</Typography>
                    <Box sx={{ height: 300, width: '100%' }}>
                        <DataGrid rows={inactiveRows} columns={inactiveColumns} loading={loading} pageSizeOptions={[10, 25, 50, 100]} />
                    </Box>
                </>
            )}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>{selectedOperator ? 'Edit Operator' : 'Add New Operator'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        <TextField label="Name" value={formValues.name} onChange={handleFieldChange('name')} />
                        <TextField label="Farm ID" type="number" value={formValues.farm_id} onChange={handleFieldChange('farm_id')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {/* {selectedOperator && <Button color="error" onClick={handleDelete}>Delete</Button>} */}
                    <Button variant="contained" onClick={selectedOperator ? handleUpdate : handleCreate}>
                        {selectedOperator ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
            <RecordHistoryDialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyOperator?.name}
                entries={history}
                loading={historyLoading}
                error={historyError}
            />
        </Stack>
    )
}

export default OperatorDataGrid;