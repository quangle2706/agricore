import { useEffect, useState } from "react";
import apiClient from "../api/client";

export default function usePermissions() {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadPermissions() {
            try {
                const response = await apiClient.get("/auth/me");
                if (active) {
                    setPermissions(response.data.permissions);
                }
            } catch {
                if (active) {
                    setError("Unable to load your permissions.");
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadPermissions();

        return () => {
            active = false;
        };

    }, [])

    const hasPermission = (permission) => permissions.includes(permission);
    return { hasPermission, loading, error };
}