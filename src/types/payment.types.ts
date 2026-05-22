/**
 * Tipos relacionados con pagos y métodos de pago
 */

export interface PaymentMethod {
  id: string;
  lastFourDigits: string;
  cardType: string;
  cardBrand: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  isDefault: boolean;
  isSystemCard?: boolean;
  createdAt?: string;
}

export interface AddPaymentMethodRequest {
  fullName: string;
  email: string;
  cardNumber: string;
  expDate: string;
  cvv: string;
}

export interface CartItemForPayment {
  name: string;
  price: number;
  quantity: number;
  extraPrice?: number;
}

export interface ProcessPaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency?: string;
  description?: string;
  orderId?: string;
  tableNumber?: string;
  restaurantId?: string;
  baseAmount?: number;
  tipAmount?: number;
  items?: CartItemForPayment[];
}

export interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description?: string;
}
