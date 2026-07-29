'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  TextField,
  Paper,
  Grid,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface BusinessCardScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
}

export default function BusinessCardScannerDialog({
  open,
  onClose,
  onSuccess,
  token,
}: BusinessCardScannerDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Extracted editable form state
  const [extractedForm, setExtractedForm] = useState({
    name: '',
    company: '',
    position: '',
    phone: '',
    email: '',
  });

  const [scanned, setScanned] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCardImageUrl(null);
      setScanned(false);
      setExtractedForm({ name: '', company: '', position: '', phone: '', email: '' });
      setError('');
      setSuccessMsg('');
    }
  };

  const handleScan = async () => {
    if (!selectedFile || !token) return;
    setScanning(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s client timeout

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('saveDirectly', 'false');

      const res = await fetch('/api/customers/scan-card', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '명함 스캔 실패');
      }

      setCardImageUrl(data.cardImageUrl);
      setExtractedForm({
        name: data.extracted?.name || '',
        company: data.extracted?.company || '',
        position: data.extracted?.position || '',
        phone: data.extracted?.phone || '',
        email: data.extracted?.email || '',
      });
      setScanned(true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('명함 스캔 시간이 초과되었습니다.');
      } else {
        setError(err?.message || '명함 인식 중 오류가 발생했습니다.');
      }
      setExtractedForm({
        name: '',
        company: '',
        position: '',
        phone: '',
        email: '',
      });
      setScanned(true);
    } finally {
      clearTimeout(timeoutId);
      setScanning(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!extractedForm.name.trim() || !token) {
      setError('성함(고객명)을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: extractedForm.name.trim(),
          company: extractedForm.company.trim() || null,
          position: extractedForm.position.trim() || null,
          phone: extractedForm.phone.trim() || null,
          email: extractedForm.email.trim() || null,
          cardImageUrl: cardImageUrl || previewUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '고객 저장 실패');
      }

      setSuccessMsg('고객 정보가 성공적으로 저장되었습니다!');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || '고객 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCardImageUrl(null);
    setScanned(false);
    setExtractedForm({ name: '', company: '', position: '', phone: '', email: '' });
    setError('');
    setSuccessMsg('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        <PhotoCameraIcon color="primary" /> 명함 사진 등록 및 AI 정보 추출
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {successMsg && (
            <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">
              {successMsg}
            </Alert>
          )}

          {/* STEP 1: Upload Photo */}
          {!previewUrl ? (
            <Box
              component="label"
              sx={{
                p: 5,
                border: '2px dashed #3b82f6',
                borderRadius: 3,
                bgcolor: '#f0f9ff',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#e0f2fe', borderColor: '#2563eb' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <PhotoCameraIcon sx={{ fontSize: 56, color: '#3b82f6', mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                명함 사진 업로드 또는 카메라 촬영
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                PNG, JPG, WEBP 지원 (Gemini Vision AI가 명함 텍스트를 자동 분석합니다)
              </Typography>
              <input type="file" accept="image/*" capture="environment" hidden onChange={handleFileChange} />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Left Column: Image Preview */}
              <Grid size={{ xs: 12, md: 5 }} sx={{ textAlign: 'center' }}>
                <Paper elevation={3} sx={{ p: 1, borderRadius: 2, display: 'inline-block', mb: 1.5, width: '100%' }}>
                  <img
                    src={cardImageUrl || previewUrl}
                    alt="Uploaded Card"
                    style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, objectFit: 'contain' }}
                  />
                </Paper>
                <Button variant="outlined" size="small" component="label">
                  다른 사진 선택
                  <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                </Button>
              </Grid>

              {/* Right Column: AI Extraction & Editable Form */}
              <Grid size={{ xs: 12, md: 7 }}>
                {!scanned ? (
                  <Box
                    sx={{
                      p: 4,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                      borderRadius: 2,
                      border: '1px dashed',
                      borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                      textAlign: 'center',
                    }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 1.5 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      사진이 업로드되었습니다!
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                      'AI 명함 분석' 버튼을 누르면 성함, 회사, 직함, 연락처가 자동 입력됩니다.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleScan}
                      disabled={scanning}
                      startIcon={scanning ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        fontWeight: 700,
                        px: 3,
                        py: 1,
                      }}
                    >
                      {scanning ? 'Gemini AI 명함 분석 중...' : '✨ AI 명함 정보 분석하기'}
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={1.8}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      ✨ AI 추출 고객 정보 (확인 및 수정 가능):
                    </Typography>
                    <TextField
                      label="성함 / 고객명 (Required)"
                      size="small"
                      value={extractedForm.name}
                      onChange={(e) => setExtractedForm((prev) => ({ ...prev, name: e.target.value }))}
                      fullWidth
                      required
                    />
                    <TextField
                      label="회사명 / 소속"
                      size="small"
                      value={extractedForm.company}
                      onChange={(e) => setExtractedForm((prev) => ({ ...prev, company: e.target.value }))}
                      fullWidth
                      placeholder="예: norara (노라라)"
                    />
                    <TextField
                      label="직함 / 부서"
                      size="small"
                      value={extractedForm.position}
                      onChange={(e) => setExtractedForm((prev) => ({ ...prev, position: e.target.value }))}
                      fullWidth
                      placeholder="예: 이사 / COO / Co-Founder"
                    />
                    <TextField
                      label="전화번호 / 연락처"
                      size="small"
                      value={extractedForm.phone}
                      onChange={(e) => setExtractedForm((prev) => ({ ...prev, phone: e.target.value }))}
                      fullWidth
                      placeholder="예: 010-4227-4717"
                    />
                    <TextField
                      label="이메일 주소"
                      size="small"
                      value={extractedForm.email}
                      onChange={(e) => setExtractedForm((prev) => ({ ...prev, email: e.target.value }))}
                      fullWidth
                      placeholder="예: jeff.ahn@norara.life"
                    />
                  </Stack>
                )}
              </Grid>
            </Grid>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} disabled={scanning || saving}>
          취소
        </Button>
        {scanned && (
          <Button
            onClick={handleSaveCustomer}
            variant="contained"
            disabled={saving || !extractedForm.name.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              fontWeight: 700,
              px: 3,
            }}
          >
            {saving ? '고객 정보 저장 중...' : '💾 고객 정보 저장'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
