'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  Paper,
  Stack,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useRouter } from 'next/navigation';
import CustomerFormDialog, { CustomerData } from '@/components/CustomerFormDialog';
import BusinessCardScannerDialog from '@/components/BusinessCardScannerDialog';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  cardImageUrl: string | null;
}

export default function CustomersPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  
  // Full Card Image Viewer Modal
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('고객 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      setError('고객 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchCustomers();
    }
  }, [token, authLoading, router, fetchCustomers]);

  const handleOpenDialog = (customer: Customer | null = null) => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleSaveCustomer = async (customerData: CustomerData) => {
    const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    const method = editingCustomer ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(customerData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '고객 정보 저장 실패');
      }

      handleCloseDialog();
      await fetchCustomers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('정말로 이 고객 정보를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('고객 삭제 실패');

      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError('고객 삭제 중 오류가 발생했습니다.');
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Box sx={{ my: 4 }}>
        {/* Header Ribbon */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
          }}
        >
          <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <ContactPageIcon sx={{ fontSize: 42, color: '#3b82f6' }} />
                <Box>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: '#ffffff' }}>
                    고객 & 명함 디렉토리 (Customers)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                    명함 사진 촬영/업로드 시 Gemini AI가 고객 정보(성함, 회사, 직함, 연락처)를 자동 등록합니다.
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Button
                  variant="contained"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => setScannerOpen(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' },
                    borderRadius: 2,
                    px: 2.2,
                    py: 1.2,
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  }}
                >
                  📸 명함 사진으로 등록
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  sx={{
                    color: '#ffffff',
                    borderColor: 'rgba(255,255,255,0.4)',
                    '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
                    borderRadius: 2,
                    px: 2,
                    py: 1.2,
                    fontWeight: 600,
                  }}
                >
                  수동 등록
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        {/* Customer Cards Grid */}
        {customers.length === 0 ? (
          <Box
            sx={{
              p: 6,
              textAlign: 'center',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
              borderRadius: 3,
              border: '1px dashed',
              borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
            }}
          >
            <ContactPageIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              등록된 고객 정보가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              명함 사진을 찍어 올리거나 수동으로 첫 고객을 등록해 보세요!
            </Typography>
            <Button
              variant="contained"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setScannerOpen(true)}
              sx={{ fontWeight: 700 }}
            >
              📸 명함 촬영 / 등록하기
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {customers.map((customer) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={customer.id}>
                <Card
                  elevation={2}
                  sx={{
                    borderRadius: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                  }}
                >
                  <CardContent sx={{ p: 3, flexGrow: 1 }}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: '#2563eb',
                          width: 48,
                          height: 48,
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
                        }}
                      >
                        {customer.name.slice(0, 1)}
                      </Avatar>
                      <Box sx={{ overflow: 'hidden' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                            {customer.name}
                          </Typography>
                          {customer.position && (
                            <Chip
                              label={customer.position}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                        {customer.company && (
                          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }} noWrap>
                            <BusinessIcon fontSize="inherit" color="action" /> {customer.company}
                          </Typography>
                        )}
                      </Box>
                    </Stack>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9'),
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                          <PhoneIcon fontSize="small" color="primary" />
                          {customer.phone || '연락처 미등록'}
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }} noWrap>
                          <EmailIcon fontSize="small" color="primary" />
                          {customer.email || '이메일 미등록'}
                        </Typography>
                      </Stack>
                    </Paper>

                    {/* Card Image Thumbnail if available */}
                    {customer.cardImageUrl && (
                      <Box
                        onClick={() => setViewCardUrl(customer.cardImageUrl)}
                        sx={{
                          mt: 2,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff'),
                          border: '1px dashed #3b82f6',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.25)' : '#dbeafe') },
                        }}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <BadgeIcon color="primary" fontSize="small" />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            📸 등록된 명함 이미지 보기
                          </Typography>
                        </Stack>
                        <VisibilityIcon fontSize="small" color="primary" />
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 3, pb: 2.5, pt: 0, justifyContent: 'flex-end' }}>
                    <IconButton size="small" onClick={() => handleOpenDialog(customer)} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteCustomer(customer.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Manual Add / Edit Dialog */}
      <CustomerFormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveCustomer}
        customer={
          editingCustomer
            ? {
                name: editingCustomer.name,
                email: editingCustomer.email || '',
                phone: editingCustomer.phone || '',
                company: editingCustomer.company || '',
                position: editingCustomer.position || '',
                cardImageUrl: editingCustomer.cardImageUrl || '',
              }
            : null
        }
      />

      {/* Business Card Scanner Modal */}
      <BusinessCardScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={fetchCustomers}
        token={token}
      />

      {/* Full-size Card Image Viewer Modal */}
      <Dialog open={!!viewCardUrl} onClose={() => setViewCardUrl(null)} maxWidth="md">
        <DialogTitle sx={{ fontWeight: 'bold' }}>📸 고객 명함 이미지 원본</DialogTitle>
        <DialogContent dividers sx={{ p: 2, textAlign: 'center' }}>
          {viewCardUrl && (
            <img
              src={viewCardUrl}
              alt="Business Card Large View"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
