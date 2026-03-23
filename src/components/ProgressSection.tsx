import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { getTestStatus, TestProgress } from '../api';

interface ProgressSectionProps {
  testId: string;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export default function ProgressSection({ testId, onComplete, onError }: ProgressSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [progress, setProgress] = useState<TestProgress>({
    testId,
    status: 'running',
    totalDevices: 0,
    completedDevices: 0,
    progress: 0,
    message: 'Initializing…',
  });
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageRef = useRef<string>('');

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getTestStatus(testId);
        setProgress(data);
        if (data.message && data.message !== lastMessageRef.current) {
          lastMessageRef.current = data.message;
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${data.message}`]);
        }
        if (data.status === 'completed') {
          clearInterval(pollRef.current!);
          setTimeout(onComplete, 800);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!);
          onError(data.message || 'Test failed');
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [testId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const pct = Math.round(progress.progress);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>

        {/* ─── Header ─── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          {/* Animated bolt icon */}
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.25)}, ${alpha(theme.palette.warning.dark, 0.15)})`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: 'glow 2s ease-in-out infinite',
              '@keyframes glow': {
                '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0)}` },
                '50%': { boxShadow: `0 0 12px 3px ${alpha(theme.palette.warning.main, 0.25)}` },
              },
            }}
          >
            <BoltRoundedIcon sx={{ color: 'warning.main', fontSize: 22 }} />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Analysis Running
            </Typography>
            <Typography variant="caption" color="text.secondary">
              AI is scanning your website for issues…
            </Typography>
          </Box>

          <Chip
            label={progress.currentDevice?.replace(/_/g, ' ') || 'Initializing'}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 24,
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              color: theme.palette.warning.main,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
              borderRadius: '6px',
            }}
          />
        </Box>

        {/* ─── Progress bar ─── */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
              {progress.message}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={800}
              sx={{
                fontSize: '0.85rem',
                color: theme.palette.primary.main,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 6,
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
              },
            }}
          />
        </Box>

        {/* ─── Stats row ─── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            mb: 3,
          }}
        >
          {[
            { label: 'Tested',    value: progress.completedDevices, color: theme.palette.success.main },
            { label: 'Total',     value: progress.totalDevices,     color: theme.palette.primary.main },
            { label: 'Remaining', value: Math.max(0, progress.totalDevices - progress.completedDevices), color: 'text.secondary' },
          ].map((s) => (
            <Box
              key={s.label}
              sx={{
                textAlign: 'center',
                p: 1.5,
                borderRadius: '9px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h5" fontWeight={800} sx={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ─── Activity log ─── */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: theme.palette.success.main, boxShadow: `0 0 6px ${theme.palette.success.main}`, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Activity Log
            </Typography>
          </Box>
          <Box
            ref={logRef}
            sx={{
              maxHeight: 160,
              overflowY: 'auto',
              p: 1.5,
              borderRadius: '9px',
              bgcolor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.03)',
              border: '1px solid',
              borderColor: 'divider',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: '0.73rem',
              color: 'text.secondary',
              lineHeight: 1.8,
            }}
          >
            {logs.length === 0 ? (
              <Box sx={{ color: 'text.disabled' }}>Warming up engines…</Box>
            ) : (
              logs.map((log, i) => (
                <Box
                  key={i}
                  sx={{
                    opacity: i === logs.length - 1 ? 1 : 0.55,
                    color: i === logs.length - 1 ? (isDark ? '#A0FFD0' : '#0A6640') : 'text.secondary',
                  }}
                >
                  {log}
                </Box>
              ))
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
