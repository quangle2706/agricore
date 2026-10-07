import { Container, Typography, Box, Snackbar, Alert } from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import { useAuth } from "../context/AuthContext";
import EquipmentDataGrid from "../components/equipments/EquipmentDataGrid";
import { useState } from "react";

// TODO: add SideMenu
import SideMenu from "../components/menu/SideMenu";

function Equipments() {
    const {user, logout} = useAuth(); 
    const [notification, setNotification] = useState(null);

    return (
        <>
            <SideMenu userRole={user?.role} />
            <Box sx={{ ml: { xs: 0, md: '240px', lg: '200px' } }}>
                <AppHeader username={user?.sub} role={user?.role} onLogout={logout} />
                <Container maxWidth="lg" sx={{ mt: 4 }}>
                    <Typography gutterBottom sx={{  textAlign:'left',  mb: '1rem', fontSize: '0.9rem', fontWeight: '600' }}>
                        Equipments
                    </Typography>
                    <Box sx={{ mb: 4 }}>
                        <EquipmentDataGrid onSuccess={setNotification} userRole={user?.role} />
                    </Box>
                </Container>
                <Snackbar open={Boolean(notification)} autoHideDuration={7000} onClose={() => setNotification(null)}>
                    <Alert severity="success" onClose={() => setNotification(null)} >{notification}</Alert>
                </Snackbar>
            </Box>
        </>
    )
}

export default Equipments;

