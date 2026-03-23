import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  alpha,
  useTheme,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import SmartphoneIcon from '@mui/icons-material/Smartphone';

interface FigmaUploadProps {
  onFilesChange: (web: File | null, mobile: File | null) => void;
}

interface UploadZoneProps {
  label: string;
  icon: React.ReactNode;
  file: File | null;
  preview: string | null;
  onDrop: (e: React.DragEvent) => void;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  accept: string;
  inputId: string;
  color: string;
}

function UploadZone({ label, icon, file, preview, onDrop, onSelect, onClear, accept, inputId, color }: UploadZoneProps) {
  const theme = useTheme();
  const [dragging, setDragging] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ color: color, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={600}>
          {label}
        </Typography>
        {file && (
          <Chip
            label={file.name.length > 20 ? file.name.slice(0, 20) + '…' : file.name}
            size="small"
            onDelete={onClear}
            sx={{ ml: 'auto', maxWidth: 200 }}
          />
        )}
      </Box>

      <Paper
        variant="outlined"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { setDragging(false); onDrop(e); }}
        onClick={() => !file && document.getElementById(inputId)?.click()}
        sx={{
          border: `2px dashed`,
          borderColor: dragging
            ? color
            : file
            ? alpha(color, 0.5)
            : theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.15)'
            : 'rgba(0,0,0,0.15)',
          borderRadius: 2,
          bgcolor: dragging
            ? alpha(color, 0.06)
            : file
            ? alpha(color, 0.04)
            : 'transparent',
          cursor: file ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          '&:hover': !file
            ? {
                borderColor: color,
                bgcolor: alpha(color, 0.04),
              }
            : {},
        }}
      >
        {preview ? (
          <Box sx={{ width: '100%', position: 'relative' }}>
            <Box
              component="img"
              src={preview}
              alt={label}
              sx={{
                width: '100%',
                height: 140,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <Tooltip title="Remove image">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'error.dark' },
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
            <CloudUploadIcon sx={{ fontSize: 36, color: alpha(color, 0.7), mb: 1 }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Drop image here or{' '}
              <Box component="span" sx={{ color: color, fontWeight: 700 }}>
                browse
              </Box>
            </Typography>
            <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
              PNG, JPG, JPEG — Optional
            </Typography>
          </Box>
        )}
      </Paper>

      <input
        id={inputId}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onSelect}
      />
    </Box>
  );
}

export default function FigmaUpload({ onFilesChange }: FigmaUploadProps) {
  const [webFile, setWebFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [webPreview, setWebPreview] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(null);

  const handleFile = (
    file: File | undefined,
    setter: (f: File | null) => void,
    previewSetter: (p: string | null) => void,
    isWeb: boolean
  ) => {
    if (!file || !file.type.startsWith('image/')) return;
    setter(file);
    previewSetter(URL.createObjectURL(file));
    const newWeb = isWeb ? file : webFile;
    const newMobile = isWeb ? mobileFile : file;
    onFilesChange(newWeb, newMobile);
  };

  const clearFile = (isWeb: boolean) => {
    if (isWeb) {
      setWebFile(null);
      setWebPreview(null);
      onFilesChange(null, mobileFile);
    } else {
      setMobileFile(null);
      setMobilePreview(null);
      onFilesChange(webFile, null);
    }
  };

  const accept = 'image/png,image/jpeg,image/jpg,image/webp';

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <UploadZone
        label="Web / Desktop Design"
        icon={<DesktopWindowsIcon fontSize="small" />}
        file={webFile}
        preview={webPreview}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0], setWebFile, setWebPreview, true); }}
        onSelect={(e) => handleFile(e.target.files?.[0], setWebFile, setWebPreview, true)}
        onClear={() => clearFile(true)}
        accept={accept}
        inputId="figma-web-input"
        color="#6C63FF"
      />
      <UploadZone
        label="Mobile Design"
        icon={<SmartphoneIcon fontSize="small" />}
        file={mobileFile}
        preview={mobilePreview}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0], setMobileFile, setMobilePreview, false); }}
        onSelect={(e) => handleFile(e.target.files?.[0], setMobileFile, setMobilePreview, false)}
        onClear={() => clearFile(false)}
        accept={accept}
        inputId="figma-mobile-input"
        color="#FF6B9D"
      />
    </Box>
  );
}
