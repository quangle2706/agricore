import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AtmIcon from '@mui/icons-material/Atm'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import CallIcon from '@mui/icons-material/Call';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import LogoutIcon from '@mui/icons-material/Logout'

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext.jsx";

const mainListItems = [
  { text: 'Dashboard', icon: <HomeOutlinedIcon />, route: '/' },
  { text: 'Farms', icon: <AccountTreeOutlinedIcon />, route: '/farms' },
  { text: 'Equipments', icon: <AtmIcon />, route: '/equipments' },
  { text: 'Field Jobs', icon: <CallIcon />, route: '/field-jobs' },
  { text: 'Operators', icon: <CallIcon />, route: '/operators' },
  { text: 'Service Reports', icon: <AnalyticsOutlinedIcon />, route: '/service-reports' },  
  { text: 'Users', icon: <PeopleRoundedIcon />, route: '/users' },
];

export default function MenuContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const {logout} = useAuth();

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item, index) => (
          <ListItem key={index} disablePadding sx={{ display: 'block', mb: 2, }}>
            <ListItemButton selected={location.pathname === item.route} onClick={() => navigate(item.route)}
              sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  color: 'rgb(255, 255, 255)',

                  '& .MuiListItemIcon-root': {
                    color: 'rgba(255,255,255,0.7)',
                  },

                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  },

                  '&.Mui-selected': {
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    color: '#FFFFFF',

                    '& .MuiListItemIcon-root': {
                      color: '#FFFFFF',
                    },

                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.18)',
                    },
                  },
                }}
              >
              <ListItemIcon sx={{ color: '#CBD5E1' }} >{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List dense>
        {/* {secondaryListItems.map((item, index) => ( */}
          <ListItem key='0' disablePadding sx={{ display: 'block', mb: 2, }}>
            <ListItemButton onClick={logout} 
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: 'rgba(255,255,255,0.7)',

                '& .MuiListItemIcon-root': {
                  color: 'rgba(255,255,255,0.7)',
                },

                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.08)',
                },

                '&.Mui-selected': {
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  color: '#FFFFFF',

                  '& .MuiListItemIcon-root': {
                    color: '#FFFFFF',
                  },

                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.18)',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: '#CBD5E1' }} ><LogoutIcon /></ListItemIcon>
              <ListItemText primary='Logout' />
            </ListItemButton>
          </ListItem>
        {/* // ))} */}
      </List>
    </Stack>
  );
}
