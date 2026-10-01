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
                <Typography sx={{ fontSize: '0.8rem' }}>Field Jobs with Priority Status</Typography>
                <FormControl size="small" sx={{ minWidth: 140, height: 40 }}>
                    <InputLabel
                        id="priority-filter-label"
                        sx={{
                            fontSize: '0.8rem',
                            lineHeight: 1.2,
                            top: '50%',
                            transform: 'translate(14px, -50%) scale(1)',
                            '&.MuiInputLabel-shrink': {
                                top: 0,
                                transform: 'translate(14px, -9px) scale(0.75)',
                            },
                        }}
                    >
                        Priority
                    </InputLabel>
                    <Select
                        labelId="priority-filter-label"
                        label="priority"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        sx={{
                            height: 40,
                            '& .MuiSelect-select': { fontSize: '0.8rem' },
                            textAlign: 'left'
                        }}
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
                <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                        rows={discrepancies}
                        columns={columns}
                        getRowId={(row) => row.field_job_id} 
                        sx={{
                            '& .MuiDataGrid-cell': {
                                fontSize: '0.8rem',
                                alignItems: 'center',
                            },
                            '& .MuiDataGrid-columnHeaderTitle': {
                                fontSize: '0.8rem',
                                fontWeight: 700,
                            },
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: '#f4f6f8',
                                borderBottom: '2px solid #d7dce2',
                            },
                        }}
                    />
                </Box>
            )}
        </Box>
    );
}

export default DiscrepancyDataGrid;
