import { Container, Typography, Box, Snackbar, Alert, Divider } from "@mui/material";
import AppHeader from "../components/layout/AppHeader.jsx";

import { useAuth } from "../context/AuthContext.jsx";

//SideMenu
import SideMenu from "../components/menu/SideMenu.jsx";
import { useState } from "react";

import ActiveLowFuelEquipmentDataGrid from "../components/equipments/ActiveLowFuelEquipmentDataGrid.jsx";
import EquipmentWithFieldJobRatioDataGrid from "../components/equipments/EquipmentWithFieldJobRatioDataGrid.jsx";
import DiscrepancyDataGrid from "../components/field-jobs/DiscrepancyDataGrid.jsx";
import FarmMaintenanceDataGrid from "../components/farms/FarmMaintenanceDataGrid.jsx";
import ActiveOperatorDataGrid from "../components/operators/ActiveOperatorDataGrid.jsx";

//a main dashboard component that renders the application header and robot data grid to authenticated users
export default function DashBoard(){
  //stores the current user object and logout function from the global AuthContext
  const {user, logout} = useAuth();
  const [notification, setNotification] = useState(null);

  return (
    <>
      <SideMenu userRole={user?.role} />
      <Box sx={{ ml: { xs: 0, md: '240px', lg: '200px' } }}>
        <AppHeader username={user?.sub} role={user?.role} onLogout={logout} />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography gutterBottom sx={{  textAlign:'left',  mb: '1.5rem'}} variant="h6" component="h6">
            1. Active Equipment Units have low fuel level (below threshold)
          </Typography>
          <Box sx={{ mb: 4 }}>
            <ActiveLowFuelEquipmentDataGrid />
          </Box>
          <Divider sx={{ marginY: 5 }} />
          <Typography gutterBottom sx={{  textAlign:'left',  mb: '1.5rem'}} variant="h6" component="h6">
            2. Co-Location Discrepancies
          </Typography>
          <Box sx={{ mb: 4 }}>
            <DiscrepancyDataGrid />
          </Box>
          <Divider sx={{ marginY: 5 }} />
          <Typography gutterBottom sx={{  textAlign:'left',  mb: '1.5rem'}} variant="h6" component="h6">
            3. Completion/Failure Ratio by Equipment Model
          </Typography>
          <Box sx={{ mb: 4 }}>
            <EquipmentWithFieldJobRatioDataGrid />
          </Box>
          <Divider sx={{ marginY: 5 }} />
          <Typography gutterBottom sx={{  textAlign:'left',  mb: '1.5rem'}} variant="h6" component="h6">
            4. Farms have more than 30% equipments flagged as Maintenance
          </Typography>
          <Box sx={{ mb: 4 }}>
            <FarmMaintenanceDataGrid />
          </Box>
          <Divider sx={{ marginY: 5 }} />
          <Typography gutterBottom sx={{  textAlign:'left',  mb: '1.5rem'}} variant="h6" component="h6">
            5. Reporting Lines - Active Operators/Farmhands Under A Specific Supervisor
          </Typography>
          <Box sx={{ mb: 4 }}>
            <ActiveOperatorDataGrid />
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