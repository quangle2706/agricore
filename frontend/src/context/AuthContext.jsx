import { createContext, useContext, useMemo, useState, useEffect } from "react";
import apiClient from "../api/client";
import { AUTH_CHANGE_EVENT, authClient, getTokens, setSession, logoutSession, refreshSession } from "../api/client";

const AuthContext = createContext(null);

function decodeToken(token) {
    const payloadSegment = token.split('.')[1];
    return JSON.parse(atob(payloadSegment));
}

export function AuthProvider({children}) {
    // const [token, setToken] = useState(() => localStorage.getItem('agricoreToken'));
    const [token, setToken] = useState(() => getTokens().access_token ?? null,);

    // synchronize React state when login, refresh or logout -> change token.
    useEffect(() => {
        const syncToken = () => {
            setToken(getTokens().access_token ?? null);
        };

        window.addEventListener(AUTH_CHANGE_EVENT, syncToken);
        window.addEventListener("storage", syncToken);

        syncToken();

        return () => {
            window.removeEventListener(AUTH_CHANGE_EVENT, syncToken);
            window.removeEventListener("storage", syncToken);
        };
    }, []);

    const user = useMemo(() => (token ? decodeToken(token) : null), [token]);

    useEffect(() => {
        if (!token || typeof user?.exp !== "number") {
            return;
        }

        const refreshDelay = Math.max(user.exp * 1000 - Date.now() - 30_000, 0);
        const timeoutId = window.setTimeout(() => {
            refreshSession().catch((error) => {
                console.error("Failed to refresh authentication session", error);
            });
        }, refreshDelay);

        return () => window.clearTimeout(timeoutId);
    }, [token, user?.exp]);

    const login = async (username, password) => {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await authClient.post('/auth/token', formData, {
            headers: {"Content-Type": 'application/x-www-form-urlencoded'},
        });

        // localStorage.setItem('agricoreToken', response.data.access_token);
        // setToken(response.data.access_token);

        if (!response.data.access_token || !response.data.refresh_token) {
            throw new Error("Login response is missing tokens");
        }

        setSession(response.data);
    }

    const logout = async () => {
        // localStorage.removeItem('agricoreToken');
        // setToken(null);
        await logoutSession();
    }

    const value = {token, user, isAuthenticated: Boolean(token), login, logout};
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
