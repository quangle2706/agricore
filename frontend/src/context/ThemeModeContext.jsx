import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import getTheme from '../theme';

const ThemeModeContext = createContext(null);
const STORAGE_KEY = "themeMode";

function readSavedMode() {
    try {
        const savedMode = localStorage.getItem(STORAGE_KEY);
        return savedMode === "light" || savedMode === "dark" ? savedMode : null;
    } catch {
        return null;
    }
}

export function ThemeModeProvider({ children }) {
    const prefersDarkMode = useMediaQuery(
        "(prefers-color-scheme: dark)"
    );

    const [savedMode, setSavedMode] = useState(readSavedMode);
    const mode = savedMode ?? (prefersDarkMode ? "dark" : "light");
    const theme = useMemo(() => getTheme(mode), [mode]);

    function toggleTheme() {
        const nextMode = mode === "light" ? "dark" : "light";
        setSavedMode(nextMode);
        try {
            localStorage.setItem(STORAGE_KEY, nextMode);
        } catch {

        }
    }

    return (
        <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    )
}

export function useThemeMode() {
    const context = useContext(ThemeModeContext);
    
    if (!context) {
        throw new Error(
            "useThemeMode must be used inside ThemeModeProvider"  
        );
    }

    return context;
}