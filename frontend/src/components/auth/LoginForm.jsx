import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../utilities/ThemeToggle";

function LoginForm() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setIsLoggingIn(true);
        try {
            await login(username, password);
            navigate('/', { replace: true });
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Incorrect Username or Password');
            } else {
                setError('Something went wrong logging in, please try again shortly');
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <Box sx={{display: 'flex', justifyContent: 'center', mt: 8}}>
            <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: 4, width: 320 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6" gutterBottom>
                        Agricore Login
                    </Typography>
                    <ThemeToggle />
                </Box>
                {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
                <TextField label="Username" fullWidth margin="normal" value={username} disabled={isLoggingIn}
                    onChange={(event) => setUsername(event.target.value)}
                    />
                <TextField label="Password" type="password" fullWidth margin="normal" value={password} disabled={isLoggingIn}
                    onChange={(event) => setPassword(event.target.value)}
                    />
                <Button type="submit" variant="contained" fullWidth disabled={isLoggingIn} sx={{ mt: 2 }}
                    startIcon={isLoggingIn ? <CircularProgress size={18} color="inherit" /> : null}>
                    {isLoggingIn ? 'Waiting for login...' : 'Log In'}
                </Button>
            </Paper>
        </Box>
    );
}

export default LoginForm;