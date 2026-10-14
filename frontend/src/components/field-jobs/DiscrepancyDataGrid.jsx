import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Alert, Box, CircularProgress, FormControl,
    InputLabel, MenuItem, Select,
    Typography
 } from "@mui/material";
import apiClient from "../../api/client.js";

//map data to the DataGrid from the backend
const columns = [
    {field: 'field_job_id', headerName: 'Field Job ID', width: 140},
    {field: 'title', headerName: 'Title', width: 240},
    {field: 'equipment_farm_id', headerName: 'Equipment Farm ID', width: 140, type: 'number'},
    {field: 'operator_farm_id', headerName: 'Operator Farm ID', width: 150, type: 'number'}
];

const PRIORITY_OPTIONS = ['', 'Low', 'Medium', 'Critical'];


//state variables for our table
function DiscrepancyDataGrid() {
    const [priority, setPriority] = useState('');
    const [discrepancies, setDiscrepancies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    //react hook for our fetch
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        //the fetch function get our data
        async function fetchDiscrepancies() {
            try {
                const response = await apiClient.get('/field-jobs/discrepancies', {
                    params: { priority: priority || undefined }
                });
                if (isMounted) setDiscrepancies(response.data);
            } catch {
                if (isMounted) setError('Could not load Discrepancy report');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchDiscrepancies();
        return () => {
            isMounted = false;
        }
    }, [priority]); 

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'left', gap: 1.5, mb: 2 }} >
                <Typography>Field Jobs with Priority Status</Typography>
                <FormControl size="small" sx={{ minWidth: 140, height: 40 }}>
                    <InputLabel
                        id="priority-filter-label"
                    >
                        Priority
                    </InputLabel>
                    <Select
                        labelId="priority-filter-label"
                        label="priority"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                    >
                        {PRIORITY_OPTIONS.map((option) => 
                            <MenuItem key={option || 'all'} value={option} sx={{ fontSize: '0.8rem' }}>
                                {option === '' ? 'All' : option}
                            </MenuItem>
                        )}
                    </Select>
                </FormControl>
            </Box>
            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                <Box sx={{ height: 300, width: '100%' }}>
                    <DataGrid
                        rows={discrepancies}
                        columns={columns}
                        getRowId={(row) => row.field_job_id} 
                    />
                </Box>
            )}
        </Box>
    );
}

export default DiscrepancyDataGrid;
