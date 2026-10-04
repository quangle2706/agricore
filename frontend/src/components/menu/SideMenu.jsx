import { styled } from '@mui/material/styles';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuContent from './MenuContent';
import { Typography } from '@mui/material';
// import appHeading from '../../assets/app-heading.png';

const drawerWidth = 240;

const Drawer = styled(MuiDrawer)({
  width: drawerWidth, flexShrink: 0, boxSizing: 'border-box', mt: 10,
  [`& .${drawerClasses.paper}`]: {
    width: drawerWidth,
    boxSizing: 'border-box',
  },
});

export default function SideMenu({ userRole }) {
  const isAdmin = userRole === 'Farm Operations Admin';
  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        [`& .${drawerClasses.paper}`]: {
            backgroundColor: 'primary.main',
            color: '#FFFFFF',
        },
      }}
    >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%',
            mt: 'calc(var(--template-frame-height, 0px) + 4px)', p: 1.5, }}>
              <Typography>AGRICORE</Typography>
            {/* Logo Icon + Heading */}
            {/* <Box component="img" src={appHeading} alt="AppHeading" sx={{ height: 60, objectFit: 'contain', }} /> */}
        </Box>
        <Divider />
        <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', }}>
            <MenuContent isAdmin={isAdmin} />
        </Box>
    </Drawer>
  );
}
