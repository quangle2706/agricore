import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, IconButton, Typography, Divider
 } from "@mui/material";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import apiClient from "../../api/client";
import usePermissions from "../../hooks/usePermissions";
import RecordHistoryDialog from "../audit/RecordHistoryDialog";

const columns = [
    { field: 'id', headerName: 'ID', width: 70}, // default type is String
    { field: 'username', headerName: 'Username', width: 250},
    { field: 'role', headerName: 'Role', width: 250},
];

const ROLE_OPTIONS = ['Farm Operations Admin', 'Field Hand', 'Auditor'];

function UserDataGrid({ onSuccess, userRole }) {
    const isAdmin = userRole === 'Farm Operations Admin';
    const { hasPermission } = usePermissions();
    const canCreateUser = hasPermission("user:create");
    const canUpdateUser = hasPermission("user:update");
    const canDeleteUser = hasPermission("user:delete");

    const [users, setUsers] = useState([]);
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
    const [historyUser, setHistoryUser] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState({
        page: 0,
        pageSize: 10,
        search: "",
        role: "",
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
                const response = await apiClient.get("/auth/users", {
                    signal: controller.signal,
                    params: {
                        page: query.page + 1,
                        size: query.pageSize,
                        search: query.search.trim() || undefined,
                        role: query.role || undefined,
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
                setError("Unable to load users");
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
                const response = await apiClient.get("/auth/inactive", { signal: controller.signal });
                if (active) setInactiveRows(response.data);
            } catch {
                if (active && !controller.signal.aborted) setError("Unable to load inactive users");
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
    const [selectedUser, setSelectedUser] = useState(null);
    const [formError, setFormError] = useState(null);
    const [formValues, setFormValues] = useState({
        username: '',
        password: '',
        role: '',
    });

    if (loading) return <CircularProgress />
    const openCreateDialog = () => {
        setSelectedUser(null);
        setFormError(null);
        setFormValues({ username: '', password: '', role: ''});
        setDialogOpen(true);
    }

    const handleFieldChange = (field) => (event) => {
        setFormError(null);
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    }

    const handleRowClick = ({ row }) => {
        if (!canUpdateUser) return;

        setSelectedUser(row);
        setFormValues({
            username: row.username,
            password: '',
            role: row.role,
        });
        setDialogOpen(true);
    }

    const handleCreate = async() => {
        setFormError(null);
        if (formValues.username.trim().length < 3) {
            setFormError('Username must be at least 3 characters long.');
            return;
        }
        if (formValues.password.length < 8) {
            setFormError('Password must be at least 8 characters long.');
            return;
        }
        if (!formValues.role) {
            setFormError('Select a role for this user.');
            return;
        }

        try {
            await apiClient.post('/auth/register', {
                ...formValues
            });
            setDialogOpen(false);
            setFormValues({
                username: '',
                password: '',
                role: '',
            });
            setReload((previous) => previous + 1);
            onSuccess?.(`User ${formValues.username} created.`);
        } catch (requestError) {
            const detail = requestError.response?.data?.detail;
            const message = Array.isArray(detail)
                ? detail.map((item) => item.msg).join('. ')
                : detail;
            setFormError(message || 'Could not create user. Check your access and try again.');
        }
    }

    const handleUpdate = async () => {
        try {
            const payload = { username: formValues.username, role: formValues.role };
            if (formValues.password) payload.password = formValues.password;
            await apiClient.patch(`/auth/users/${selectedUser.id}`, payload);
            setDialogOpen(false);
            setSelectedUser(null);
            setReload((previous) => previous + 1);
            onSuccess?.(`User ${formValues.username} updated.`);
        } catch {
            setError('Could not update user');
        }
    };

    const handleDeleteRow = async (user) => {
        if (!window.confirm(`Delete user ${user.username}?`)) return;
        try {
            await apiClient.delete(`/auth/users/${user.id}`);
            
            if (rows.length === 1 && query.page > 0) {
                setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                }));
            } else {
                setReload((previous) => previous + 1);
            }

            onSuccess?.(`User ${user.username} deleted.`);
        } catch {
            setError('Could not delete user');
        }
    };

    const handleRestoreRow = async (user) => {
        try {
            await apiClient.post(`/auth/${user.id}/restore`);
            setReload((previous) => previous + 1);
            onSuccess?.(`User ${user.username} restored.`);
        } catch {
            setError('Could not restore user');
        }
    };

    const showHistory = async (user) => {
        setHistoryUser(user);
        setHistory([]);
        setHistoryError("");
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const response = await apiClient.get(`/auth/${user.id}/history`);
            setHistory(response.data);
        } catch {
            setHistoryError("Could not load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const gridColumns = [
        ...columns,
        ...(canDeleteUser ? [{
            field: 'actions',
            headerName: 'Actions',
            width: 110,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Delete user ${row.username}`} color="error" size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRow(row);
                    }}>
                        <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for user ${row.username}`} size="small" onClick={(event) => {
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
                    <IconButton aria-label={`Restore user ${row.username}`} size="small" onClick={(event) => {
                        event.stopPropagation();
                        handleRestoreRow(row);
                    }}>
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Show history for user ${row.username}`} size="small" onClick={(event) => {
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
            <Button disabled={loading || !canCreateUser} variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add User</Button>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField 
                    label="Search username" 
                    value={searchInput} 
                    onChange={(event) => setSearchInput(event.target.value)}
                    size="small" fullWidth
                    />    
                 <TextField 
                    select
                    label="Role"
                    value={query.role}
                    onChange={(event) => updateFilter("role", event.target.value)}
                    size="small"
                    sx={{ minWidth: 170 }}>
                        <MenuItem value="">All</MenuItem>
                        {ROLE_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                </TextField>
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
                    <Typography>Inactive Users</Typography>
                    <Box sx={{ height: 300, width: '100%' }}>
                        <DataGrid rows={inactiveRows} columns={inactiveColumns} loading={loading} pageSizeOptions={[10, 25, 50, 100]} />
                    </Box>
                </>
            )}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ textAlign: 'center' }}>{selectedUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
                        {formError && <Alert severity="error">{formError}</Alert>}
                        <TextField label="Username" required inputProps={{ minLength: 3, maxLength: 50 }} value={formValues.username} onChange={handleFieldChange('username')} />
                        <TextField label="Password" type="password" required inputProps={{ minLength: 8 }} value={formValues.password} onChange={handleFieldChange('password')} />
                        <TextField label="Role" select required value={formValues.role} onChange={handleFieldChange('role')}>
                            {ROLE_OPTIONS.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    {/* {selectedUser && <Button color="error" onClick={handleDelete}>Delete</Button>} */}
                    <Button variant="contained" onClick={selectedUser ? handleUpdate : handleCreate}>
                        {selectedUser ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
            <RecordHistoryDialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyUser?.username}
                entries={history}
                loading={historyLoading}
                error={historyError}
            />
        </Stack>
    )
}

export default UserDataGrid;