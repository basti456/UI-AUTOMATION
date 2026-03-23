import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  alpha,
  useTheme,
  Divider,
  Skeleton,
  Chip,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import { getReportJson } from '../api';

interface ResultsSectionProps {
  testId: string;
  onNewTest: () => void;
}

export default function ResultsSection({ testId, onNewTest }: ResultsSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [reportMeta, setReportMeta] = useState<{
    testId: string;
    url: string;
    reportUrl: string;
    viewUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReportJson(testId)
      .then(({ data }) => setReportMeta(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [testId]);

  const handleView = () => {
    if (reportMeta) window.open(reportMeta.viewUrl, '_blank');
  };

  return (
    <Card
      sx={{
        border: `1.5px solid ${alpha(theme.palette.success.main, 0.35)}`,
        background: isDark
          ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>

        {/* ─── Success header ─── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 44, height: 44,
              borderRadius: '11px',
              bgcolor: alpha(theme.palette.success.main, 0.15),
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.2)}`,
            }}
          >
            <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, color: 'success.main' }}>
              Test Complete
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Full report is ready to review
            </Typography>
          </Box>
          <Chip
            label="✓ Passed"
            size="small"
            sx={{
              ml: 'auto',
              fontWeight: 700,
              fontSize: '0.72rem',
              height: 24,
              bgcolor: alpha(theme.palette.success.main, 0.12),
              color: theme.palette.success.main,
              border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              borderRadius: '6px',
            }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <Box>
            <Skeleton variant="rounded" height={56} sx={{ mb: 1.5, borderRadius: '9px' }} />
            <Skeleton variant="rounded" height={44} sx={{ borderRadius: '9px' }} />
          </Box>
        ) : reportMeta ? (
          <Box>
            {/* Test ID badge */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                mb: 2.5,
                borderRadius: '9px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 30, height: 30,
                  borderRadius: '7px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FingerprintRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.67rem', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block' }}>
                  Test ID
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {reportMeta.testId}
                </Typography>
              </Box>
            </Box>

            {/* Primary CTA */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              endIcon={<OpenInNewRoundedIcon />}
              onClick={handleView}
              sx={{ mb: 1.5, py: 1.4, borderRadius: '10px' }}
            >
              View Full Report
            </Button>
          </Box>
        ) : (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            Could not load report details.
          </Typography>
        )}

        {/* Secondary CTA */}
        <Button
          variant="outlined"
          size="large"
          fullWidth
          startIcon={<AddRoundedIcon />}
          onClick={onNewTest}
          sx={{ borderRadius: '10px', py: 1.25 }}
        >
          New Test
        </Button>
      </CardContent>
    </Card>
  );
}
