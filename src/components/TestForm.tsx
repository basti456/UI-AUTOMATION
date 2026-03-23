import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  FormControl,
  Switch,
  Button,
  Typography,
  Collapse,
  Divider,
  Alert,
  alpha,
  useTheme,
  Chip,
  CircularProgress,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import DevicesIcon from '@mui/icons-material/Devices';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import AccessibilityNewRoundedIcon from '@mui/icons-material/AccessibilityNewRounded';
import FigmaUpload from './FigmaUpload';
import { uploadFigma } from '../api';

interface TestFormProps {
  onTestStart: (testId: string) => void;
  onError: (message: string) => void;
}

const deviceOptions = [
  {
    value: 'desktop',
    label: 'Desktop',
    sub: '1280 – 1920px',
    icon: <DesktopWindowsIcon sx={{ fontSize: 20 }} />,
  },
  {
    value: 'mobile',
    label: 'Mobile',
    sub: '320 – 768px',
    icon: <SmartphoneIcon sx={{ fontSize: 20 }} />,
  },
  {
    value: 'both',
    label: 'All Devices',
    sub: 'Full coverage',
    icon: <DevicesIcon sx={{ fontSize: 20 }} />,
  },
];

/** Feature badges shown in the info strip */
const features = [
  { icon: <AccessibilityNewRoundedIcon sx={{ fontSize: 14 }} />, label: 'WCAG 2.1' },
  { icon: <PaletteRoundedIcon sx={{ fontSize: 14 }} />, label: 'Visual QA' },
  { icon: <SpeedRoundedIcon sx={{ fontSize: 14 }} />, label: 'Performance' },
  { icon: <SecurityRoundedIcon sx={{ fontSize: 14 }} />, label: 'Best Practices' },
];

export default function TestForm({ onTestStart, onError }: TestFormProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [url, setUrl] = useState('');
  const [deviceType, setDeviceType] = useState('desktop');
  const [enableInteractive, setEnableInteractive] = useState(false);
  const [showFigma, setShowFigma] = useState(false);
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [webFigmaFile, setWebFigmaFile] = useState<File | null>(null);
  const [mobileFigmaFile, setMobileFigmaFile] = useState<File | null>(null);

  const handleFigmaChange = (web: File | null, mobile: File | null) => {
    setWebFigmaFile(web);
    setMobileFigmaFile(mobile);
  };

  const validateUrl = (value: string) => {
    if (!value) return 'URL is required';
    try { new URL(value); return ''; }
    catch { return 'Enter a valid URL — e.g. https://example.com'; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUrl(url.trim());
    if (err) { setUrlError(err); return; }
    setUrlError('');
    setLoading(true);
    try {
      if (webFigmaFile || mobileFigmaFile) {
        const fd = new FormData();
        if (webFigmaFile)   fd.append('web',    webFigmaFile);
        if (mobileFigmaFile) fd.append('mobile', mobileFigmaFile);
        await uploadFigma(fd);
      }
      const res = await fetch('/api/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), enableInteractive, deviceType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start test');
      onTestStart(data.testId);
    } catch (err: any) {
      onError(err.message || 'Failed to start test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>

          {/* ─── URL input ─── */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Website URL
            </Typography>
            <TextField
              fullWidth
              placeholder="https://your-website.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(''); }}
              error={!!urlError}
              helperText={urlError}
              required
              type="url"
              autoComplete="url"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkRoundedIcon sx={{ color: url ? 'primary.main' : 'text.disabled', fontSize: 20, transition: 'color 0.2s' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.97rem',
                  fontWeight: 500,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                },
              }}
            />
          </Box>

          {/* ─── Device selection ─── */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Target Device
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              {deviceOptions.map((opt) => {
                const selected = deviceType === opt.value;
                return (
                  <Box
                    key={opt.value}
                    onClick={() => setDeviceType(opt.value)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 1.75,
                      px: 1,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: '1.5px solid',
                      borderColor: selected
                        ? theme.palette.primary.main
                        : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
                      bgcolor: selected
                        ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.07)
                        : 'transparent',
                      color: selected ? theme.palette.primary.main : 'text.secondary',
                      transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                      userSelect: 'none',
                      position: 'relative',
                      boxShadow: selected
                        ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`
                        : 'none',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.07),
                        color: theme.palette.primary.main,
                      },
                    }}
                  >
                    {opt.icon}
                    <Typography variant="body2" fontWeight={selected ? 700 : 500} sx={{ fontSize: '0.82rem' }}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
                      {opt.sub}
                    </Typography>
                    {/* Active indicator dot */}
                    {selected && (
                      <Box sx={{
                        position: 'absolute', top: 8, right: 8,
                        width: 7, height: 7, borderRadius: '50%',
                        bgcolor: theme.palette.primary.main,
                        boxShadow: `0 0 6px ${theme.palette.primary.main}`,
                      }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ─── Options ─── */}
          <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Interactive Testing toggle */}
            <OptionRow
              icon={<AutoFixHighIcon sx={{ fontSize: 19 }} />}
              label="Interactive Testing"
              description="Detect clickable elements & test UI state transitions automatically"
              active={enableInteractive}
              accentColor={theme.palette.secondary.main}
              control={
                <Switch
                  checked={enableInteractive}
                  onChange={(e) => setEnableInteractive(e.target.checked)}
                  color="secondary"
                  size="small"
                />
              }
              isDark={isDark}
              theme={theme}
            />

            {/* Figma upload toggle */}
            <Box
              sx={{
                border: '1.5px solid',
                borderColor: showFigma ? alpha(theme.palette.primary.main, 0.35) : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                borderRadius: '10px',
                overflow: 'hidden',
                transition: 'border-color 0.2s ease',
              }}
            >
              <OptionRow
                icon={<ImageSearchIcon sx={{ fontSize: 19 }} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Figma Design Reference
                    <Chip label="Optional" size="small" sx={{ height: 17, fontSize: '0.62rem', px: 0.5, bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: 'text.secondary' }} />
                  </Box>
                }
                description="Compare live site against Figma mockups for pixel-level accuracy"
                active={showFigma}
                accentColor={theme.palette.primary.main}
                control={
                  <ExpandMoreIcon sx={{
                    color: 'text.secondary',
                    fontSize: 20,
                    transform: showFigma ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }} />
                }
                onClick={() => setShowFigma((s) => !s)}
                isDark={isDark}
                theme={theme}
                noRadius
                noBorder
              />
              <Collapse in={showFigma}>
                <Divider />
                <Box sx={{ p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                  <FigmaUpload onFilesChange={handleFigmaChange} />
                </Box>
              </Collapse>
            </Box>
          </Box>

          {/* No Figma hint */}
          {!showFigma && (
            <Alert
              severity="info"
              icon={false}
              sx={{
                mb: 3,
                py: 1,
                px: 1.75,
                fontSize: '0.8rem',
                bgcolor: isDark ? 'rgba(91,108,248,0.08)' : 'rgba(91,108,248,0.06)',
                color: 'text.secondary',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                borderRadius: '9px',
                '& .MuiAlert-message': { lineHeight: 1.5 },
              }}
            >
              <strong style={{ color: theme.palette.primary.light }}>No Figma?</strong>{' '}
              Tests run against WCAG 2.1, Nielsen's 10 Usability Heuristics &amp; responsive best practices automatically.
            </Alert>
          )}

          {/* ─── CTA ─── */}
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading}
            endIcon={loading ? <CircularProgress size={17} color="inherit" /> : <PlayArrowRoundedIcon />}
            sx={{
              py: 1.5,
              fontSize: '0.97rem',
              letterSpacing: '-0.01em',
              borderRadius: '10px',
            }}
          >
            {loading ? 'Starting Test…' : 'Run Test'}
          </Button>

          {/* ─── Feature badge strip ─── */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 0.75,
              mt: 2.5,
              pt: 2.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            {features.map((f) => (
              <Box
                key={f.label}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: '99px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  color: 'text.secondary',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
              >
                {f.icon}
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  {f.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

/* ─────────────────────────────────────────────
   Reusable option row sub-component
───────────────────────────────────────────── */
interface OptionRowProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  description: string;
  active: boolean;
  accentColor: string;
  control: React.ReactNode;
  onClick?: () => void;
  isDark: boolean;
  theme: any;
  noRadius?: boolean;
  noBorder?: boolean;
}

function OptionRow({
  icon, label, description, active, accentColor, control, onClick, isDark, theme, noRadius, noBorder,
}: OptionRowProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.75,
        borderRadius: noRadius ? 0 : '10px',
        cursor: onClick ? 'pointer' : 'default',
        border: noBorder ? 'none' : '1.5px solid',
        borderColor: active
          ? alpha(accentColor, 0.3)
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        bgcolor: active
          ? alpha(accentColor, isDark ? 0.08 : 0.05)
          : 'transparent',
        transition: 'all 0.18s ease',
        ...(onClick && {
          '&:hover': {
            bgcolor: alpha(accentColor, 0.07),
          },
        }),
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          bgcolor: active ? alpha(accentColor, isDark ? 0.18 : 0.12) : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          color: active ? accentColor : 'text.disabled',
          transition: 'all 0.18s ease',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.875rem', color: active ? 'text.primary' : 'text.primary', lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {description}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{control}</Box>
    </Box>
  );
}
