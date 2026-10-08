import axios from 'axios';

// Save 2 token in an entry
const STORAGE_KEY = "agricore_auth";
export const AUTH_CHANGE_EVENT = "agricore-auth-changed";

export const authClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
});

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
});

let refreshPromise = null;
let sessionVersion = 0;

export function getTokens() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    } catch {
        return {};
    }
}

function writeTokens(tokens) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
        })
    );

    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT)); // Dispatch an event to notify about auth change
}

// run after login successfully
export function setSession(tokens) {
    sessionVersion += 1;
    writeTokens(tokens);
}

// run after logout
export function clearSession() {
    sessionVersion += 1;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function redirectToLogin() {
    if (window.location.pathname !== '/login') {
        window.location.replace("/login");
    }
}

function refreshOnce() {
    if (refreshPromise) {
        return refreshPromise;
    }

    const version = sessionVersion;
    const refreshToken = getTokens().refresh_token;

    const operation = (async () => {
        try {
            if (!refreshToken) {
                throw new Error("Missing refresh token");
            }

            const { data } = await authClient.post("/auth/refresh", {
                refresh_token: refreshToken,
            });

            if (!data.access_token || !data.refresh_token) {
                throw new Error("Invalid refresh response");
            }

            // when logout/login occurs while running a request
            if (version !== sessionVersion) {
                throw new Error("Session changed");
            }

            writeTokens(data);
            return data.access_token;
        } catch (error) {
            if (version === sessionVersion) {
                clearSession();
                redirectToLogin();
            }

            throw error;
        }
    })();

    const shared = operation.finally(() => {
        if (refreshPromise === shared) {
            refreshPromise = null;
        }
    });

    refreshPromise = shared;
    return shared;
}

export function refreshSession() {
    return refreshOnce();
}

apiClient.interceptors.request.use((config) => {
    // const token = localStorage.getItem('agricoreToken');
    // if (token) {
    //     config.headers.Authorization = `Bearer ${token}`;
    // }
    // return config;

    const accessToken = getTokens().access_token;
    config._accessToken = accessToken;
    config._sessionVersion = sessionVersion;

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    } else {
        config.headers.delete("Authorization");
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        if (
            error.response?.status !== 401 || !original || original._retry || original.skipAuthRefresh
        ) {
            return Promise.reject(error);
        }

        if (original._sessionVersion !== sessionVersion) {
            return Promise.reject(error);
        }

        original._retry = true;
        const version = sessionVersion;

        try {
            const currentAccessToken = getTokens().access_token;
            if (!currentAccessToken || currentAccessToken === original._accessToken) {
                await refreshOnce();
            }

            if (version !== sessionVersion) {
                throw new Error("Session changed");
            }

            return apiClient(original);
        } catch (refreshError) {
            return Promise.reject(refreshError);
        }
    },
);

export async function logoutSession() {
    if (refreshPromise) {
        try {
            await refreshPromise;
        } catch {

        }
    }

    const refreshToken = getTokens().refresh_token;
    clearSession();

    try {
        if (refreshToken) {
            await authClient.post("/auth/logout", {
                refresh_token: refreshToken,
            });
        }
    } finally {
        redirectToLogin();
    }
}

export default apiClient;
