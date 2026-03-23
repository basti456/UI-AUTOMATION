import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

interface ErrorSectionProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorSection({ message, onRetry }: ErrorSectionProps) {
  const theme = useTheme();
  return (
    <Card
      sx={{
        border: `2px solid ${alpha(theme.palette.error.main, 0.3)}`,
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.error.main, 0.08)
            : alpha(theme.palette.error.main, 0.04),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 4 }, textAlign: 'center' }}>
        <ErrorOutlineRoundedIcon
          sx={{ fontSize: 56, color: 'error.main', mb: 2 }}
        />
        <Typography variant="h5" fontWeight={700} color="error.main" mb={1}>
          Test Failed
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor:
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            mb: 3,
            fontFamily: 'monospace',
            textAlign: 'left',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<RefreshRoundedIcon />}
          onClick={onRetry}
          size="large"
        >
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
