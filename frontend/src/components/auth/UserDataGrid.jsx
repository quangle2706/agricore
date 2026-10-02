import { useEffect, useState } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Alert, Box, TextField, CircularProgress, Stack,
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem
 } from "@mui/material";
import apiClient from "../../api/client";

const columns = [
    { field: 'id', headerName: 'ID', width: 70}, // default type is String
    { field: 'username', headerName: 'Username', width: 250},
    { field: 'role', headerName: 'Role', width: 250},
];

const ROLE_OPTIONS = ['Farm Operations Admin', 'Field Hand', 'Auditor'];

function UserDataGrid({ onSuccess }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formError, setFormError] = useState(null);
    const [formValues, setFormValues] = useState({
        username: '',
        password: '',
        role: '',
    });

    async function fetchUsers() {
        setLoading(true);
        try {
            const response = await apiClient.get('/auth/users');
            setUsers(response.data);
            setError(null);
        } catch {
            setError('Could not load data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchUsers();
    }, []);

    if (loading) return <CircularProgress />
    if (error) return <Alert severity="error">{error}</Alert>

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
            await fetchUsers(); 
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
            await fetchUsers();
            onSuccess?.(`User ${formValues.username} updated.`);
        } catch {
            setError('Could not update user');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete user ${selectedUser.name}?`)) return;
        try {
            await apiClient.delete(`/auth/users/${selectedUser.id}`);
            setDialogOpen(false);
            setSelectedUser(null);
            await fetchUsers();
            onSuccess?.(`User ${selectedUser.username} deleted.`);
        } catch {
            setError('Could not delete user');
        }
    };

    return (
        <>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    loading={loading}
                    rows={users}
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
            <Button variant="outlined" sx={{ mb: 2, mt: 2 }} onClick={openCreateDialog}>Add User</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle sx={{ color: 'black', textAlign: 'center' }}>{selectedUser ? 'Edit User' : 'Add New User'}</DialogTitle>
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
                    {selectedUser && <Button color="error" onClick={handleDelete}>Delete</Button>}
                    <Button variant="contained" onClick={selectedUser ? handleUpdate : handleCreate}>
                        {selectedUser ? 'Save changes' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default UserDataGrid;