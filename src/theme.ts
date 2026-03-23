import { createTheme, alpha } from '@mui/material/styles';

// Professional color palette inspired by Linear, Vercel, Datadog
const BRAND = {
  ink: '#0F0F14',          // near-black background
  navy: '#13131F',         // card background dark
  navyLight: '#1C1C30',    // elevated surface dark
  blue: '#5B6CF8',         // primary brand blue (Linear-style)
  blueBright: '#7C8BFF',   // hover variation
  blueDark: '#3D4ED8',     // pressed
  cyan: '#22D3EE',         // accent / highlight
  green: '#10B981',        // success
  amber: '#F59E0B',        // warning
  red: '#EF4444',          // error
  // light mode counterparts
  lBg: '#F7F7FB',
  lPaper: '#FFFFFF',
  lNavy: '#EEF0FD',
};

export const getTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: {
        main:  BRAND.blue,
        light: BRAND.blueBright,
        dark:  BRAND.blueDark,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main:  BRAND.cyan,
        light: '#67E8F9',
        dark:  '#0891B2',
        contrastText: '#000000',
      },
      success:  { main: BRAND.green },
      warning:  { main: BRAND.amber },
      error:    { main: BRAND.red },
      ...(mode === 'dark'
        ? {
            background: { default: BRAND.ink, paper: BRAND.navy },
            text: { primary: '#F1F1F8', secondary: '#8888AA', disabled: '#4A4A66' },
            divider: 'rgba(255,255,255,0.07)',
          }
        : {
            background: { default: BRAND.lBg, paper: BRAND.lPaper },
            text: { primary: '#111118', secondary: '#55556A', disabled: '#AAAAAAC0' },
            divider: 'rgba(0,0,0,0.07)',
          }),
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      h1: { fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontWeight: 700, letterSpacing: '-0.015em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      body1: { lineHeight: 1.65 },
      body2: { lineHeight: 1.6 },
      caption: { letterSpacing: '0.01em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(128,128,200,0.2); border-radius: 99px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,200,0.4); }
        `,
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            padding: '9px 20px',
            fontSize: '0.9rem',
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
          },
          contained: ({ theme }) => ({
            background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.blueDark} 100%)`,
            boxShadow: `0 2px 12px ${alpha(BRAND.blue, 0.35)}, 0 0 0 0 ${alpha(BRAND.blue, 0)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${BRAND.blueBright} 0%, ${BRAND.blue} 100%)`,
              boxShadow: `0 4px 20px ${alpha(BRAND.blue, 0.5)}, 0 0 0 3px ${alpha(BRAND.blue, 0.15)}`,
              transform: 'translateY(-1px)',
            },
            '&:active': { transform: 'translateY(0)' },
            '&.Mui-disabled': { opacity: 0.45 },
          }),
          outlined: ({ theme }) => ({
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            color: 'inherit',
            '&:hover': {
              borderColor: BRAND.blue,
              background: alpha(BRAND.blue, 0.06),
              boxShadow: `0 0 0 3px ${alpha(BRAND.blue, 0.1)}`,
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'dark'
              ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.5)'
              : '0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 24px rgba(0,0,0,0.07)',
            border: mode === 'dark'
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(0,0,0,0.06)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              fontSize: '0.95rem',
              transition: 'all 0.18s ease',
              '& fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                transition: 'border-color 0.18s ease',
              },
              '&:hover fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)',
              },
              '&.Mui-focused fieldset': {
                borderColor: BRAND.blue,
                borderWidth: 1.5,
              },
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(BRAND.blue, 0.15)}`,
                borderRadius: 10,
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6, fontSize: '0.78rem' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99, backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' },
          bar: { borderRadius: 99 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            fontSize: '0.78rem',
            fontWeight: 500,
            padding: '5px 10px',
            background: mode === 'dark' ? '#2A2A40' : '#1E1E30',
            color: '#F1F1F8',
          },
          arrow: { color: mode === 'dark' ? '#2A2A40' : '#1E1E30' },
        },
      },
    },
  });
