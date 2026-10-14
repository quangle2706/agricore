import { Alert, Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Button, Stack, Typography } from "@mui/material";

function RecordHistoryDialog({ open, onClose, title, entries, loading, error }) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>History{title ? ` · ${title}` : ""}</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={28} aria-label="Loading record history" />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : entries.length === 0 ? (
                    <Typography color="text.secondary">No history available.</Typography>
                ) : (
                    <Stack spacing={2}>
                        {entries.map((entry) => (
                            <Box key={entry.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 2 }}>
                                <Typography fontWeight={600}>
                                    {entry.action} · {entry.actor_name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {new Date(entry.occurred_at).toLocaleString()}
                                </Typography>
                                {Object.entries(entry.changes ?? {}).map(([field, change]) => (
                                    <Typography key={field} variant="body2">
                                        {field}: {String(change.before ?? "—")} → {String(change.after ?? "—")}
                                    </Typography>
                                ))}
                            </Box>
                        ))}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

export default RecordHistoryDialog;
