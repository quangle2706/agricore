import { Container, Typography, Box, Snackbar, Alert } from "@mui/material";
import AppHeader from "../components/layout/AppHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SideMenu from "../components/menu/SideMenu.jsx";
import { useState } from "react";
import ServiceReportDataGrid from "../components/service-reports/ServiceReportDataGrid.jsx";

export default function ServiceReports(){
  const {user, logout} = useAuth();
  const [notification, setNotification] = useState(null);

  return (
    <>
      <SideMenu />
      <Box sx={{ ml: { xs: 0, md: '240px', lg: '200px' } }}>
        <AppHeader username={user?.sub} role={user?.role} onLogout={logout} />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography gutterBottom sx={{  textAlign:'left', color: 'black',  mb: '1rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Service Reports
          </Typography>
          <Box sx={{ mb: 4 }}>
            <ServiceReportDataGrid onSuccess={setNotification} />
          </Box>
        </Container>
        <Snackbar
          open={Boolean(notification)}
          autoHideDuration={4000}
          onClose={() => setNotification(null)}
        >
          <Alert severity="success" onClose={() => setNotification(null)} >{notification}</Alert>
        </Snackbar>
      </Box>
    </>
  );
}