import { AppBar, Toolbar, IconButton, Typography, Box } from "@mui/material";
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';

// TODO: SideMenuMobile
import SideMenuMobile from "../menu/SideMenuMobile";

import { useState } from "react";
import ThemeToggle from "../utilities/ThemeToggle";

function AppHeader({username, role, onLogout}) {
    const [open, setOpen] = useState(false);
    const toggleDrawer = (newOpen) => () => { setOpen(newOpen); };

    return (
        <AppBar position="static">
            <Toolbar>
                <IconButton color="inherit" aria-label="Open navigation menu" onClick={toggleDrawer(true)}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                        <MenuRoundedIcon />
                </IconButton>
                { username && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 2 }}>
                        <Typography variant="body2">{username.toUpperCase()} ({role})</Typography>
                    </Box>
                )}
                <ThemeToggle />
                <SideMenuMobile open={open} toggleDrawer={toggleDrawer} />
            </Toolbar>
        </AppBar>
    )
}

export default AppHeader;