'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Box,
  Typography,
} from '@mui/material';
import ContactPageIcon from '@mui/icons-material/ContactPage';

export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  company: string;
  position?: string;
  cardImageUrl?: string;
}

interface CustomerFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (customer: CustomerData) => void;
  customer?: CustomerData | null;
}

const initialCustomerState: CustomerData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  position: '',
  cardImageUrl: '',
};

export default function CustomerFormDialog({
  open,
  onClose,
  onSave,
  customer,
}: CustomerFormDialogProps) {
  const [formData, setFormData] = useState<CustomerData>(initialCustomerState);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company: customer.company || '',
        position: customer.position || '',
        cardImageUrl: customer.cardImageUrl || '',
      });
    } else {
      setFormData(initialCustomerState);
    }
  }, [customer, open]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ContactPageIcon color="primary" /> {customer ? '고객 정보 수정' : '새 고객 정보 등록'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            name="name"
            label="성함 / 고객명 (Required)"
            type="text"
            fullWidth
            value={formData.name}
            onChange={handleChange}
            required
          />
          <TextField
            name="company"
            label="회사명 / 소속"
            type="text"
            fullWidth
            value={formData.company}
            onChange={handleChange}
          />
          <TextField
            name="position"
            label="직함 / 부서 (예: 대표이사, 수석연구원)"
            type="text"
            fullWidth
            value={formData.position}
            onChange={handleChange}
          />
          <TextField
            name="phone"
            label="전화번호 / 연락처"
            type="tel"
            fullWidth
            value={formData.phone}
            onChange={handleChange}
          />
          <TextField
            name="email"
            label="이메일 주소"
            type="email"
            fullWidth
            value={formData.email}
            onChange={handleChange}
          />
          {formData.cardImageUrl && (
            <Box sx={{ mt: 1, p: 1.5, border: '1px dashed #cbd5e1', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                📸 등록된 명함 이미지
              </Typography>
              <img
                src={formData.cardImageUrl}
                alt="Business Card"
                style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain' }}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSave} variant="contained">
          저장하기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
