import { createTheme } from "@mui/material/styles";

const getTheme = (mode) => createTheme({
    palette: {
        mode: mode,
        primary: {
            main: mode === "light" ? '#0da13e' : '#66bb6a'
        },
        secondary: {
            main: '#ff6f00'
        },
    },
    shape: {
        borderRadius: 8,
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Arial", sans-serif',
    },
});

export default getTheme;