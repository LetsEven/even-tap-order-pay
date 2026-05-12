import { requestWithAuth } from "./request-helper";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    type?: string;
    message: string;
    details?: any;
  };
}

export interface PaymentMethod {
  id: string;
  lastFourDigits: string;
  cardBrand: string;
  cardType: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  isDefault: boolean;
  isSystemCard?: boolean;
  createdAt?: string;
}

export interface AddPaymentMethodRequest {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

export interface ProcessPaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  tableNumber: string;
  restaurantId: string;
  installments?: number;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  date: string;
  status: string;
}

class PaymentService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    // Usar el helper con refresh automático
    const result = await requestWithAuth<T>(endpoint, options);

    // Adaptar el formato de error al esperado por PaymentService
    if (!result.success && result.error && typeof result.error === 'string') {
      return {
        success: false,
        error: {
          type: "api_error",
          message: result.error,
        },
      };
    }

    return result as ApiResponse<T>;
  }

  // Añadir método de pago
  async addPaymentMethod(
    paymentData: AddPaymentMethodRequest
  ): Promise<ApiResponse<{ paymentMethod: PaymentMethod }>> {
    // Obtener email del usuario autenticado o usar un email temporal para guests
    let userEmail = "guest@xquisito.com"; // Fallback

    if (typeof window !== "undefined") {
      // Intentar obtener email del localStorage (si está disponible)
      const storedEmail = localStorage.getItem("xquisito_user_email");
      if (storedEmail) {
        userEmail = storedEmail;
      }
    }

    // Mapear los campos al formato esperado por el backend
    const backendPayload = {
      fullName: paymentData.cardholderName,
      email: userEmail,
      cardNumber: paymentData.cardNumber,
      expDate: paymentData.expiryDate,
      cvv: paymentData.cvv,
    };

    return this.request("/payment-methods", {
      method: "POST",
      body: JSON.stringify(backendPayload),
    });
  }

  // Obtener métodos de pago del usuario
  async getPaymentMethods(): Promise<
    ApiResponse<{ paymentMethods: PaymentMethod[] }>
  > {
    return this.request("/payment-methods", {
      method: "GET",
    });
  }

  // Eliminar método de pago
  async deletePaymentMethod(
    paymentMethodId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/payment-methods/${paymentMethodId}`, {
      method: "DELETE",
    });
  }

  // Establecer método de pago como predeterminado
  async setDefaultPaymentMethod(
    paymentMethodId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/payment-methods/${paymentMethodId}/default`, {
      method: "PUT",
    });
  }

  // Procesar pago
  async processPayment(
    paymentData: ProcessPaymentRequest
  ): Promise<ApiResponse<any>> {
    return this.request("/payments", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  // Obtener historial de pagos
  async getPaymentHistory(): Promise<ApiResponse<PaymentHistory[]>> {
    return this.request("/payments/history", {
      method: "GET",
    });
  }

  // Crea una orden en Ecart Pay para Apple Pay y regresa el orderId
  async createApplePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    customerName?: string;
  }): Promise<ApiResponse<{ orderId: string }>> {
    return this.request("/payments/apple-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Crea una orden en Ecart Pay para Google Pay y regresa el orderId
  async createGooglePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    customerName?: string;
  }): Promise<ApiResponse<{ orderId: string }>> {
    return this.request("/payments/google-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Migrar métodos de pago de guest a usuario autenticado
  async migrateGuestPaymentMethods(
    guestId: string
  ): Promise<ApiResponse<{ migratedCount: number }>> {
    return this.request("/payment-methods/migrate-from-guest", {
      method: "POST",
      body: JSON.stringify({ guestId }),
    });
  }
}

export const paymentService = new PaymentService();
