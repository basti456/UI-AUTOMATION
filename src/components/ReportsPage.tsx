import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Button,
  Skeleton,
  Alert,
  alpha,
  useTheme,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { listReports, ReportMeta } from '../api';

export default function ReportsPage() {
  const theme = useTheme();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listReports();
      setReports(data);
    } catch {
      setError('Could not load reports. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
            }}
          >
            <AssessmentRoundedIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>Test Reports</Typography>
            <Typography variant="caption" color="text.secondary">
              Last 3 reports are retained automatically
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchReports} color="primary">
            <RefreshRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <AssessmentRoundedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600}>
              No Reports Yet
            </Typography>
            <Typography variant="body2" color="text.disabled" mt={1}>
              Run your first visual test to generate a report
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {reports.map((report, idx) => (
            <Card
              key={report.testId}
              sx={{
                border: '1px solid',
                borderColor: idx === 0
                  ? alpha(theme.palette.primary.main, 0.3)
                  : 'divider',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 8px 32px rgba(0,0,0,0.5)'
                    : '0 8px 32px rgba(0,0,0,0.12)',
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {idx === 0 && (
                        <Chip label="Latest" size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          color: 'text.disabled',
                          fontSize: '0.7rem',
                        }}
                      >
                        {report.testId.slice(0, 8)}…
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                      <LinkRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'primary.main',
                          maxWidth: 400,
                        }}
                      >
                        {report.url || 'Unknown URL'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <AccessTimeRoundedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(report.timestamp)}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="outlined"
                    size="small"
                    endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                    onClick={() => window.open(report.reportUrl, '_blank')}
                    sx={{ flexShrink: 0, alignSelf: 'center' }}
                  >
                    View Report
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}

          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              Only the last 3 reports are kept. Older reports are automatically removed.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
