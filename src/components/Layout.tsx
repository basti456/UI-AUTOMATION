import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Container,
  alpha,
  useTheme,
  Button,
} from '@mui/material';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface LayoutProps {
  children: React.ReactNode;
  page: 'home' | 'reports';
  onNavigate: (page: 'home' | 'reports') => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

export default function Layout({ children, page, onNavigate, onToggleTheme, mode }: LayoutProps) {
  const theme = useTheme();
  const isDark = mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        // Mesh gradient background — professional tool aesthetic
        background: isDark
          ? `
              radial-gradient(ellipse 60% 40% at 70% -10%, ${alpha(theme.palette.primary.main, 0.18)} 0%, transparent 70%),
              radial-gradient(ellipse 50% 35% at -5% 80%, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 65%),
              radial-gradient(ellipse 40% 30% at 50% 110%, ${alpha(theme.palette.primary.dark, 0.12)} 0%, transparent 60%),
              #0F0F14`
          : `
              radial-gradient(ellipse 60% 40% at 70% -10%, ${alpha(theme.palette.primary.main, 0.09)} 0%, transparent 70%),
              radial-gradient(ellipse 50% 35% at -5% 80%, ${alpha(theme.palette.secondary.main, 0.06)} 0%, transparent 65%),
              #F7F7FB`,
        transition: 'background 0.4s ease',
      }}
    >
      {/* ─── Navigation ─── */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: isDark ? 'rgba(15,15,20,0.8)' : 'rgba(247,247,251,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          color: 'text.primary',
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar sx={{ gap: 2, height: 56, minHeight: '56px !important' }}>
          {/* ─ Logo ─ */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              flexGrow: 1,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            onClick={() => onNavigate('home')}
          >
            {/* Icon mark */}
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.45)}`,
                flexShrink: 0,
              }}
            >
              <AutoAwesomeIcon sx={{ color: 'white', fontSize: 16 }} />
            </Box>

            {/* Brand text */}
            <Box>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'text.primary',
                }}
              >
                UITest<Box component="span" sx={{ color: 'primary.main' }}>AI</Box>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1, fontSize: '0.65rem' }}>
                VISUAL TESTING
              </Typography>
            </Box>
          </Box>

          {/* ─ Nav links ─ */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {([
              { id: 'home', label: 'Test', icon: <HomeRoundedIcon sx={{ fontSize: 16 }} /> },
              { id: 'reports', label: 'Reports', icon: <AssessmentRoundedIcon sx={{ fontSize: 16 }} /> },
            ] as const).map((nav) => (
              <Button
                key={nav.id}
                startIcon={nav.icon}
                onClick={() => onNavigate(nav.id)}
                size="small"
                disableElevation
                sx={{
                  fontWeight: page === nav.id ? 600 : 500,
                  fontSize: '0.82rem',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '7px',
                  bgcolor: page === nav.id
                    ? isDark ? 'rgba(91,108,248,0.15)' : 'rgba(91,108,248,0.1)'
                    : 'transparent',
                  color: page === nav.id ? 'primary.main' : 'text.secondary',
                  border: page === nav.id
                    ? `1px solid ${alpha(theme.palette.primary.main, 0.25)}`
                    : '1px solid transparent',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    color: 'text.primary',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  },
                  transition: 'all 0.15s ease',
                  gap: 0.5,
                }}
              >
                {nav.label}
              </Button>
            ))}

            {/* Divider */}
            <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

            {/* Theme toggle */}
            <Tooltip title={isDark ? 'Light mode' : 'Dark mode'} arrow>
              <IconButton
                onClick={onToggleTheme}
                size="small"
                sx={{
                  color: 'text.secondary',
                  width: 32,
                  height: 32,
                  borderRadius: '7px',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: 'text.primary' },
                }}
              >
                {isDark ? <LightModeRoundedIcon sx={{ fontSize: 17 }} /> : <DarkModeRoundedIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ─── Hero banner — only on home page ─── */}
      {page === 'home' && (
        <Box
          sx={{
            textAlign: 'center',
            pt: { xs: 5, md: 8 },
            pb: { xs: 4, md: 6 },
            px: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative glow blobs */}
          <Box sx={{
            position: 'absolute', top: '10%', left: '8%',
            width: 280, height: 280,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08)} 0%, transparent 70%)`,
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />
          <Box sx={{
            position: 'absolute', top: '-5%', right: '10%',
            width: 220, height: 220,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, isDark ? 0.12 : 0.07)} 0%, transparent 70%)`,
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />

          {/* Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              mb: 3,
              borderRadius: '99px',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.07),
              backdropFilter: 'blur(8px)',
            }}
          >
            <Box
              sx={{
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: theme.palette.secondary.main,
                boxShadow: `0 0 6px ${theme.palette.secondary.main}`,
                animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.45 },
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: theme.palette.primary.light, letterSpacing: '0.03em' }}
            >
              AI-Powered · Playwright · Qwen3 Vision
            </Typography>
          </Box>

          {/* Headline */}
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.035em',
              mb: 1.5,
              fontSize: { xs: '1.9rem', md: '2.75rem' },
              background: isDark
                ? `linear-gradient(135deg, #F1F1F8 0%, ${alpha('#F1F1F8', 0.55)} 100%)`
                : `linear-gradient(135deg, #111118 0%, #333348 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Automated UI Testing
            <br />
            <Box component="span" sx={{
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              in seconds
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', lineHeight: 1.7, fontSize: { xs: '0.9rem', md: '1rem' } }}
          >
            Enter any URL and get a comprehensive visual, accessibility and UX report — powered by computer vision and large AI models.
          </Typography>
        </Box>
      )}

      {/* ─── Page content ─── */}
      <Container maxWidth="md" sx={{ pb: { xs: 4, md: 7 } }}>
        {children}
      </Container>

      {/* ─── Footer ─── */}
      <Box
        sx={{
          textAlign: 'center',
          py: 2.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem', letterSpacing: '0.02em' }}>
          UITest<Box component="span" sx={{ color: 'primary.main' }}>AI</Box>
          {' '}· Playwright · Qwen3 VL · Ollama
          {' '}·{' '}
          <Box component="span" sx={{ color: 'success.main' }}>●</Box> Live
        </Typography>
      </Box>
    </Box>
  );
}
