import { IconButton, Tooltip } from "@mui/material";
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useThemeMode } from "../../context/ThemeModeContext";

export default function ThemeToggle() {
    const { mode, toggleTheme } = useThemeMode();

    const label = mode === "light" ? "Switch to dark mode" : "Switch to light mode";

    return (
        <Tooltip title={label}>
            <IconButton onClick={toggleTheme} color="inherit" aria-label={label}>
                {mode === "light" ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
            </IconButton>
        </Tooltip>
    );
}