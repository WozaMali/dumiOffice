// Validation utilities

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // South African phone number format: +27 XX XXX XXXX or 0XX XXX XXXX
  const phoneRegex = /^(\+27|0)[6-8][0-9]{8}$/;
  const cleanPhone = phone.replace(/\s/g, '');
  return phoneRegex.test(cleanPhone);
};

export const validateAddress = (address: string): boolean => {
  return address.trim().length >= 10;
};

export const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\s/g, '');
  if (clean.startsWith('+27')) {
    return `+27 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.startsWith('0')) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return phone;
};

export const validateStockAvailability = (quantity: number, stockOnHand: number): { valid: boolean; message?: string } => {
  if (quantity <= 0) {
    return { valid: false, message: 'Quantity must be greater than 0' };
  }
  if (quantity > stockOnHand) {
    return { valid: false, message: `Only ${stockOnHand} items in stock` };
  }
  return { valid: true };
};
