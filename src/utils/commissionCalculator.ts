export interface CommissionRates {
  xquisitoTotal: number; // % total Xquisito
  clientPays: number; // % que paga el cliente
  restaurantPays: number; // % que paga el restaurante
}

export interface CommissionBreakdown {
  // Montos base
  baseAmount: number;
  tipAmount: number;
  ivaTip: number;

  // Subtotal para cálculo de comisiones
  subtotalForCommission: number;

  // Comisiones Xquisito (sin IVA)
  xquisitoCommissionTotal: number;
  xquisitoCommissionClient: number;
  xquisitoCommissionRestaurant: number;

  // IVA sobre comisiones Xquisito
  ivaXquisitoTotal: number;
  ivaXquisitoClient: number;
  ivaXquisitoRestaurant: number;

  // Comisión Xquisito con IVA (lo que realmente se cobra/paga)
  xquisitoClientCharge: number; // Lo que paga el cliente (comisión + IVA)
  xquisitoRestaurantCharge: number; // Lo que paga el restaurante (comisión + IVA)

  // Total cobrado al cliente
  totalAmountCharged: number;

  // Metadata
  rates: CommissionRates;
}

/**
 * Tasas de comisión según el monto de la transacción:
 *
 * - $20-$30: Xquisito 11.0% (Cliente 9.0%, Restaurante 2.0%)
 * - $31-$49: Xquisito 8.0% (Cliente 6.0%, Restaurante 2.0%)
 * - $50-$100: Xquisito 5.8% (Cliente 3.8%, Restaurante 2.0%)
 * - $100-$150: Xquisito 4.2% (Cliente 2.2%, Restaurante 2.0%)
 * - > $150: Xquisito 4.0% (Cliente 2.0%, Restaurante 2.0%)
 */
export function getCommissionRates(amount: number): CommissionRates {
  if (amount >= 20 && amount <= 30) {
    return {
      xquisitoTotal: 11.0,
      clientPays: 9.0,
      restaurantPays: 2.0,
    };
  } else if (amount >= 31 && amount <= 49) {
    return {
      xquisitoTotal: 8.0,
      clientPays: 6.0,
      restaurantPays: 2.0,
    };
  } else if (amount >= 50 && amount <= 100) {
    return {
      xquisitoTotal: 5.8,
      clientPays: 3.8,
      restaurantPays: 2.0,
    };
  } else if (amount >= 101 && amount <= 150) {
    return {
      xquisitoTotal: 4.2,
      clientPays: 2.2,
      restaurantPays: 2.0,
    };
  } else if (amount > 150) {
    return {
      xquisitoTotal: 4.0,
      clientPays: 2.0,
      restaurantPays: 2.0,
    };
  } else {
    return {
      xquisitoTotal: 11.0,
      clientPays: 9.0,
      restaurantPays: 2.0,
    };
  }
}

export function calculateCommissions(
  baseAmount: number,
  tipAmount: number,
): CommissionBreakdown {
  // IVA de propina (NO pagado por cliente)
  const ivaTip = tipAmount * 0.16;

  // Subtotal para cálculo de comisión Xquisito
  const subtotalForCommission = baseAmount + tipAmount;

  // Obtener tasas según el monto
  const rates = getCommissionRates(subtotalForCommission);

  // Comisiones Xquisito (sin IVA)
  const xquisitoCommissionTotal =
    subtotalForCommission * (rates.xquisitoTotal / 100);
  const xquisitoCommissionClient =
    subtotalForCommission * (rates.clientPays / 100);
  const xquisitoCommissionRestaurant =
    subtotalForCommission * (rates.restaurantPays / 100);

  // IVA sobre comisiones Xquisito (16%)
  const ivaXquisitoTotal = xquisitoCommissionTotal * 0.16;
  const ivaXquisitoClient = xquisitoCommissionClient * 0.16;
  const ivaXquisitoRestaurant = xquisitoCommissionRestaurant * 0.16;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Comisión Xquisito con IVA incluido
  const xquisitoClientCharge = r2(xquisitoCommissionClient + ivaXquisitoClient);
  const xquisitoRestaurantCharge = r2(
    xquisitoCommissionRestaurant + ivaXquisitoRestaurant,
  );

  // Total cobrado al cliente
  const totalAmountCharged = r2(baseAmount + tipAmount + xquisitoClientCharge);

  return {
    baseAmount,
    tipAmount,
    ivaTip,
    subtotalForCommission,
    xquisitoCommissionTotal,
    xquisitoCommissionClient,
    xquisitoCommissionRestaurant,
    ivaXquisitoTotal,
    ivaXquisitoClient,
    ivaXquisitoRestaurant,
    xquisitoClientCharge,
    xquisitoRestaurantCharge,
    totalAmountCharged,
    rates,
  };
}

export function formatMXN(amount: number): string {
  return `$${amount.toFixed(2)} MXN`;
}
