"use client";

import { useCart } from "@/context/CartContext";
import { useTableNavigation } from "@/hooks/useTableNavigation";
import { usePayment } from "@/context/PaymentContext";
import { useValidateAccess } from "@/hooks/useValidateAccess";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGuest } from "@/context/GuestContext";
import MenuHeaderBack from "@/components/headers/MenuHeaderBack";
import { Plus, Trash2, Loader2, CircleAlert, X } from "lucide-react";
import { getCardTypeIcon } from "@/utils/cardIcons";
import OrderAnimation from "@/components/UI/OrderAnimation";
import ValidationError from "@/components/ValidationError";
import { tapOrderService } from "@/services/taporders.service";
import { paymentService } from "@/services/payment.service";
import { calculateCommissions } from "@/utils/commissionCalculator";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";

export default function CardSelectionPage() {
  const {
    validationError,
    restaurantId: restaurantIdNum,
    branchNumber,
  } = useValidateAccess();
  const restaurantId = restaurantIdNum.toString();
  const { provider, isLoadingProvider } = usePaymentProvider(restaurantId);

  const { state: cartState, clearCart, orderNotes, setOrderNotes } = useCart();
  const { navigateWithTable, tableNumber } = useTableNavigation();
  const { paymentMethods, deletePaymentMethod } = usePayment();
  const { user, profile } = useAuth();
  const { guestId } = useGuest();

  // Tarjeta por defecto del sistema para todos los usuarios
  const defaultSystemCard = {
    id: "system-default-card",
    lastFourDigits: "1234",
    cardBrand: "amex",
    cardType: "credit",
    isDefault: true,
    isSystemCard: true,
  };

  // Combinar tarjetas del sistema con las del usuario
  const allPaymentMethods = [defaultSystemCard, ...paymentMethods];

  const baseAmount = cartState.totalPrice;
  const MINIMUM_AMOUNT = 20;

  // Estados para propina
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showPaymentOptionsModal, setShowPaymentOptionsModal] = useState(false);
  const [selectedMSI, setSelectedMSI] = useState<number | null>(null);

  // Estados para tarjetas
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Apple Pay
  const [applePayReady, setApplePayReady] = useState(false);
  const [applePayUnavailable, setApplePayUnavailable] = useState(false);
  const [isApplePayProcessing, setIsApplePayProcessing] = useState(false);
  const [applePayPaymentId, setApplePayPaymentId] = useState<string | null>(
    null,
  );
  const applePayListenersRef = useRef(false);

  // Google Pay
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [googlePayUnavailable, setGooglePayUnavailable] = useState(false);
  const [isGooglePayProcessing, setIsGooglePayProcessing] = useState(false);
  const [googlePayPaymentId, setGooglePayPaymentId] = useState<string | null>(
    null,
  );
  const googlePayListenersRef = useRef(false);

  // Animación de orden
  const [showAnimation, setShowAnimation] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedOrderItems, setCompletedOrderItems] = useState<
    typeof cartState.items
  >([]);
  const [completedUserName, setCompletedUserName] = useState<string>("");

  // Calcular propina
  const calculateTipAmount = () => {
    if (customTip && parseFloat(customTip) > 0) return parseFloat(customTip);
    return (baseAmount * tipPercentage) / 100;
  };
  const tipAmount = calculateTipAmount();

  const commissions = calculateCommissions(baseAmount, tipAmount);
  const {
    ivaTip,
    subtotalForCommission,
    xquisitoCommissionTotal,
    xquisitoCommissionClient,
    xquisitoCommissionRestaurant,
    ivaXquisitoClient,
    ivaXquisitoRestaurant,
    xquisitoClientCharge,
    xquisitoRestaurantCharge,
    totalAmountCharged: totalAmount,
  } = commissions;

  const handleTipPercentage = (percentage: number) => {
    setTipPercentage(percentage);
    setCustomTip("");
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTip(value);
    setTipPercentage(0);
  };

  // Set default payment method when payment methods are loaded
  useEffect(() => {
    if (!selectedPaymentMethodId && allPaymentMethods.length > 0) {
      const defaultMethod =
        allPaymentMethods.find((pm) => pm.isDefault) || allPaymentMethods[0];
      setSelectedPaymentMethodId(defaultMethod.id);
    }
    if (!cartState.isLoading) {
      setIsLoadingInitial(false);
    }
  }, [allPaymentMethods.length, selectedPaymentMethodId, cartState.isLoading]);

  // Log provider
  useEffect(() => {
    if (!isLoadingProvider) {
      console.log(
        `[PaymentProvider] Proveedor activo: ${provider ?? "null"} (restaurantId: ${restaurantId})`,
      );
      if (provider === "clip") {
        console.warn(
          "[PaymentProvider] Clip seleccionado — flujo no implementado aún, usando eCartPay como fallback",
        );
      }
    }
  }, [provider, isLoadingProvider, restaurantId]);

  // Cargar SDK de Ecart Pay para Apple Pay
  useEffect(() => {
    if (isLoadingProvider) return;
    if (provider !== null && provider !== "ecartpay") return;

    const ApplePaySession = (window as any).ApplePaySession;
    if (!ApplePaySession || !ApplePaySession.canMakePayments?.()) return;

    setApplePayUnavailable(false);
    const src = "https://ecartpay.com/sdk/pay.js";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [provider, isLoadingProvider]);

  // Helper para obtener teléfono del cliente
  const fetchCustomerPhone = async (): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const token = localStorage.getItem("xquisito_access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const result = await res.json();
      return result.success && result.data?.profile?.phone
        ? result.data.profile.phone
        : null;
    } catch {
      return null;
    }
  };

  // Helper para crear dish orders en tap order
  const createDishOrdersForTap = async (
    items: typeof cartState.items,
    customerName: string,
    customerPhone: string | null,
    customerEmail: string,
    clerkUserId: string | null,
  ): Promise<{ firstTapOrderId: string | null; dishOrderIds: string[] }> => {
    let firstTapOrderId: string | null = null;
    const dishOrderIds: string[] = [];

    for (const item of items) {
      const images =
        item.images && Array.isArray(item.images) && item.images.length > 0
          ? item.images.filter((img) => img && typeof img === "string")
          : [];
      const customFields =
        item.customFields &&
        Array.isArray(item.customFields) &&
        item.customFields.length > 0
          ? item.customFields
          : null;

      const dishOrderResult = await tapOrderService.createDishOrder(
        restaurantId,
        branchNumber.toString(),
        tableNumber!,
        {
          user_id: user?.id || null,
          guest_id: guestId || null,
          guest_name: customerName,
          item: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          branch_number: parseInt(branchNumber.toString()),
          customer_name: customerName,
          customer_phone: customerPhone ?? undefined,
          customer_email: customerEmail,
          clerk_user_id: clerkUserId,
          images,
          custom_fields: customFields,
          extra_price: item.extraPrice || 0,
          menu_item_id: item.id ? item.id.toString() : null,
          special_instructions: item.specialInstructions || null,
          order_notes: orderNotes.trim() || null,
        },
      );

      if (!dishOrderResult.success) {
        throw new Error(
          dishOrderResult.error || "Error al crear el dish order",
        );
      }

      const dishOrderId = dishOrderResult.data?.dish_order_id || null;
      if (dishOrderId) dishOrderIds.push(dishOrderId);

      if (!firstTapOrderId) {
        firstTapOrderId = dishOrderResult.data?.tap_order_id || null;
        if (firstTapOrderId) setCompletedOrderId(firstTapOrderId);
      }
    }

    return { firstTapOrderId, dishOrderIds };
  };

  const finalizeTapOrder = async (
    tapOrderId: string,
    dishOrderIds: string[],
    paymentMethodIdForRecord: string | null,
  ) => {
    await tapOrderService.updatePaymentStatus(tapOrderId, "paid");
    await tapOrderService.updateOrderStatus(tapOrderId, "completed");

    for (const id of dishOrderIds) {
      try {
        await tapOrderService.markDishOrderAsPaid(id);
      } catch {}
    }

    try {
      const xquisitoRateApplied =
        subtotalForCommission > 0
          ? (xquisitoCommissionTotal / subtotalForCommission) * 100
          : 0;
      await tapOrderService.recordPaymentTransaction({
        payment_method_id: paymentMethodIdForRecord,
        restaurant_id: parseInt(restaurantId),
        id_table_order: null,
        id_tap_orders_and_pay: tapOrderId,
        base_amount: baseAmount,
        tip_amount: tipAmount,
        iva_tip: ivaTip,
        xquisito_commission_total: xquisitoCommissionTotal,
        xquisito_commission_client: xquisitoCommissionClient,
        xquisito_commission_restaurant: xquisitoCommissionRestaurant,
        iva_xquisito_client: ivaXquisitoClient,
        iva_xquisito_restaurant: ivaXquisitoRestaurant,
        xquisito_client_charge: xquisitoClientCharge,
        xquisito_restaurant_charge: xquisitoRestaurantCharge,
        xquisito_rate_applied: xquisitoRateApplied,
        total_amount_charged: totalAmount,
        subtotal_for_commission: subtotalForCommission,
        currency: "MXN",
      });
    } catch (e) {
      console.error("Error recording payment transaction:", e);
    }
  };

  const savePaymentForSuccess = (
    tapOrderId: string | null,
    cardLast4: string,
    cardBrand: string,
    paymentMethodIdForRecord: string | null,
    customerName: string,
    customerEmail: string,
    customerPhone: string | null,
    items: typeof cartState.items,
  ) => {
    const userName = profile?.firstName || cartState.userName || "Usuario";
    const data = {
      orderId: tapOrderId,
      paymentId: tapOrderId,
      transactionId: tapOrderId,
      totalAmountCharged: totalAmount,
      amount: totalAmount,
      baseAmount,
      tipAmount,
      xquisitoCommissionClient,
      ivaXquisitoClient,
      xquisitoCommissionTotal,
      userName,
      customerName,
      customerEmail,
      customerPhone,
      cardLast4,
      cardBrand,
      orderStatus: "confirmed",
      paymentStatus: "paid",
      createdAt: new Date().toISOString(),
      dishOrders: items.map((item) => ({
        dish_order_id: item.id || Date.now(),
        item: item.name,
        quantity: item.quantity || 1,
        price: item.price,
        extra_price: item.extraPrice || 0,
        total_price: item.price * (item.quantity || 1),
        guest_name: customerName,
        custom_fields: item.customFields || null,
        images: item.images,
      })),
      restaurantId: parseInt(restaurantId),
      paymentMethodId: paymentMethodIdForRecord,
      timestamp: Date.now(),
      tableNumber,
    };

    localStorage.setItem("xquisito-completed-payment", JSON.stringify(data));
    const uniqueKey = `xquisito-payment-success-${tapOrderId}`;
    sessionStorage.setItem(uniqueKey, JSON.stringify(data));
    sessionStorage.setItem("xquisito-current-payment-key", uniqueKey);
    sessionStorage.setItem("xquisito-current-order-id", tapOrderId || "");
  };

  // Apple Pay SDK helper
  const getApplePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.ApplePay) {
        return resolve((window as any).Pay.ApplePay);
      }

      const interval = setInterval(() => {
        if ((window as any).Pay?.ApplePay) {
          clearInterval(interval);
          resolve((window as any).Pay.ApplePay);
        }
      }, 100);
    });

  // Inicializar Apple Pay SDK cuando los datos estén listos
  const initApplePay = useCallback(async () => {
    if (typeof window === "undefined" || !totalAmount) return;

    try {
      // Crear orden en Ecart Pay para obtener orderId
      const orderResult = await paymentService.createApplePayOrder({
        amount: totalAmount,
        currency: "MXN",
        tableNumber: undefined,
        restaurantId: restaurantId?.toString(),
      });

      const appleOrderId =
        (orderResult as any).orderId ?? orderResult.data?.orderId;
      if (!orderResult.success || !appleOrderId) {
        const orderErr = `[AP-ORDER] No se pudo crear la orden: ${JSON.stringify(orderResult.error ?? orderResult)}`;
        console.warn("⚠️ Apple Pay:", orderErr);
        setErrorMessage(orderErr);
        return;
      }

      const applePaySDK = await getApplePaySDK();
      if (!applePaySDK) {
        const sdkErr = "[AP-SDK] SDK no disponible en window.Pay.ApplePay";
        console.warn("⚠️", sdkErr);
        setErrorMessage(sdkErr);
        return;
      }

      console.log("ORDER RESULT:", orderResult);

      // Register listeners only once to avoid duplicates on re-renders
      if (!applePayListenersRef.current) {
        applePayListenersRef.current = true;
        applePaySDK.on("ready", () => {
          console.log("✅ Apple Pay botón listo");
          setApplePayReady(true);
        });
        applePaySDK.on("unavailable", () => {
          console.log("ℹ️ Apple Pay no disponible en este dispositivo/cuenta");
          setApplePayUnavailable(true);
        });
        applePaySDK.on("cancel", () => {
          console.log("🚫 Apple Pay cancelado por el usuario");
          setIsApplePayProcessing(false);
        });
        applePaySDK.on("error", (err: any) => {
          const errMsg = `[AP-ERROR] ${typeof err === "object" ? JSON.stringify(err) : String(err)}`;
          console.error("❌ Apple Pay error:", err);
          setIsApplePayProcessing(false);
          setApplePayUnavailable(true);
          setErrorMessage(errMsg);
        });
        applePaySDK.on("success", async () => {
          console.log("💳 Apple Pay: pago autorizado");
          const applePayId = `apple-pay-${Date.now()}`;
          setApplePayPaymentId(applePayId);
          setIsApplePayProcessing(true);
          setCompletedOrderItems([...cartState.items]);
          const userName =
            profile?.firstName || cartState.userName || "Usuario";
          setCompletedUserName(userName);
          setShowAnimation(true);
        });
      }

      applePaySDK.render({
        container: "#apple-pay-container",
        orderId: appleOrderId,
        amount: totalAmount,
        currency: "MXN",
        countryCode: "MX",
        supportedNetworks: ["visa", "masterCard", "amex"],
        merchantCapabilities: [
          "supports3DS",
          "supportsDebit",
          "supportsCredit",
        ],
        buttonStyle: "black",
        buttonType: "pay",
      });
    } catch (err) {
      const errMsg = `[AP-INIT] ${err instanceof Error ? err.message : JSON.stringify(err)}`;
      console.error("❌ Error inicializando Apple Pay:", err);
      setErrorMessage(errMsg);
    }
  }, [totalAmount, restaurantId, cartState.items, cartState.userName, profile]);

  const getGooglePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.GooglePay) {
        return resolve((window as any).Pay.GooglePay);
      }
      const interval = setInterval(() => {
        if ((window as any).Pay?.GooglePay) {
          clearInterval(interval);
          resolve((window as any).Pay.GooglePay);
        }
      }, 100);
    });

  const initGooglePay = useCallback(async () => {
    if (typeof window === "undefined" || !totalAmount) return;

    try {
      const orderResult = await paymentService.createGooglePayOrder({
        amount: totalAmount,
        currency: "MXN",
        tableNumber: undefined,
        restaurantId: restaurantId?.toString(),
      });

      const googleOrderId =
        (orderResult as any).orderId ?? orderResult.data?.orderId;
      if (!orderResult.success || !googleOrderId) {
        const orderErr = `[GP-ORDER] No se pudo crear la orden: ${JSON.stringify(orderResult.error ?? orderResult)}`;
        console.warn("⚠️ Google Pay:", orderErr);
        setErrorMessage(orderErr);
        return;
      }

      const googlePaySDK = await getGooglePaySDK();
      if (!googlePaySDK) {
        const sdkErr = "[GP-SDK] SDK no disponible en window.Pay.GooglePay";
        console.warn("⚠️", sdkErr);
        setErrorMessage(sdkErr);
        return;
      }

      if (!googlePayListenersRef.current) {
        googlePayListenersRef.current = true;
        googlePaySDK.on("ready", () => {
          console.log("✅ Google Pay botón listo");
          setGooglePayReady(true);
        });
        googlePaySDK.on("unavailable", () => {
          console.log(
            "ℹ️ Google Pay no disponible en este dispositivo/navegador",
          );
          setGooglePayUnavailable(true);
        });
        googlePaySDK.on("cancel", () => {
          console.log("🚫 Google Pay cancelado por el usuario");
          setIsGooglePayProcessing(false);
        });
        googlePaySDK.on("error", (err: any) => {
          const errMsg = `[GP-ERROR] ${err?.detail?.message || (typeof err === "object" ? JSON.stringify(err) : String(err))}`;
          console.error("❌ Google Pay error:", err);
          setIsGooglePayProcessing(false);
          setGooglePayUnavailable(true);
          setErrorMessage(errMsg);
        });
        googlePaySDK.on("success", async () => {
          console.log("💳 Google Pay: pago autorizado");
          const gpPayId = `google-pay-${Date.now()}`;
          setGooglePayPaymentId(gpPayId);
          setIsGooglePayProcessing(true);
          setCompletedOrderItems([...cartState.items]);
          const userName =
            profile?.firstName || cartState.userName || "Usuario";
          setCompletedUserName(userName);
          setShowAnimation(true);
        });
      }

      googlePaySDK.render({
        container: "#google-pay-container",
        orderId: googleOrderId,
        amount: totalAmount,
        currency: "MXN",
        countryCode: "MX",
        allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX"],
        allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
        buttonColor: "black",
        buttonType: "pay",
      });
    } catch (err) {
      const errMsg = `[GP-INIT] ${err instanceof Error ? err.message : JSON.stringify(err)}`;
      console.error("❌ Error inicializando Google Pay:", err);
      setErrorMessage(errMsg);
    }
  }, [totalAmount, restaurantId, cartState.items, cartState.userName, profile]);

  useEffect(() => {
    if (!isLoadingInitial && totalAmount > 0) {
      initApplePay();
    }
  }, [isLoadingInitial, totalAmount, initApplePay]);

  useEffect(() => {
    if (!isLoadingInitial && totalAmount > 0) initApplePay();
  }, [isLoadingInitial, totalAmount, initApplePay]);

  useEffect(() => {
    if (!isLoadingInitial && totalAmount > 0) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setGooglePayUnavailable(true);
        return;
      }
      initGooglePay();
    }
  }, [isLoadingInitial, totalAmount, initGooglePay]);

  const handleInitiatePayment = (): void => {
    if (!tableNumber) {
      setErrorMessage(
        "No se encontró el número de mesa. Por favor escanea el código QR nuevamente.",
      );
      return;
    }
    if (!selectedPaymentMethodId) {
      setErrorMessage("Por favor selecciona una tarjeta de pago");
      return;
    }
    setCompletedOrderItems([...cartState.items]);
    setCompletedUserName(profile?.firstName || cartState.userName || "Usuario");
    setShowAnimation(true);
  };

  const handleCancelPayment = () => {
    setShowAnimation(false);
    setCompletedOrderItems([]);
    setCompletedUserName("");
  };

  const handleConfirmPayment = async (): Promise<void> => {
    const clerkUserId = user?.id
      ? user.id
      : typeof window !== "undefined"
        ? localStorage.getItem("xquisito-guest-id")
        : null;

    // Apple Pay flow
    if (isApplePayProcessing) {
      setIsProcessing(true);
      try {
        const customerPhone = await fetchCustomerPhone();
        const customerName =
          profile?.firstName || cartState.userName || "Invitado";
        const customerEmail =
          profile?.email || user?.email || `${user?.id}@xquisito.ai`;

        if (!completedOrderItems.length)
          throw new Error("El carrito está vacío");

        const { firstTapOrderId, dishOrderIds } = await createDishOrdersForTap(
          completedOrderItems,
          customerName,
          customerPhone,
          customerEmail,
          clerkUserId,
        );

        if (firstTapOrderId) {
          await finalizeTapOrder(firstTapOrderId, dishOrderIds, null);
          savePaymentForSuccess(
            firstTapOrderId,
            "AP",
            "apple",
            null,
            customerName,
            customerEmail,
            customerPhone,
            completedOrderItems,
          );
          await clearCart();
          setOrderNotes("");
          setCompletedOrderId(firstTapOrderId);
        }
      } catch (error) {
        sessionStorage.removeItem("xquisito-current-order-id");
        sessionStorage.removeItem("xquisito-current-payment-key");
        setCompletedOrderId(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Error desconocido",
        );
        setShowAnimation(false);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Google Pay flow
    if (isGooglePayProcessing) {
      setIsProcessing(true);
      try {
        const customerPhone = await fetchCustomerPhone();
        const customerName =
          profile?.firstName || cartState.userName || "Invitado";
        const customerEmail =
          profile?.email || user?.email || `${user?.id}@xquisito.ai`;

        if (!completedOrderItems.length)
          throw new Error("El carrito está vacío");

        const { firstTapOrderId, dishOrderIds } = await createDishOrdersForTap(
          completedOrderItems,
          customerName,
          customerPhone,
          customerEmail,
          clerkUserId,
        );

        if (firstTapOrderId) {
          await finalizeTapOrder(firstTapOrderId, dishOrderIds, null);
          savePaymentForSuccess(
            firstTapOrderId,
            "GP",
            "google",
            null,
            customerName,
            customerEmail,
            customerPhone,
            completedOrderItems,
          );
          await clearCart();
          setOrderNotes("");
          setCompletedOrderId(firstTapOrderId);
        }
      } catch (error) {
        sessionStorage.removeItem("xquisito-current-order-id");
        sessionStorage.removeItem("xquisito-current-payment-key");
        setCompletedOrderId(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Error desconocido",
        );
        setShowAnimation(false);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (!tableNumber || !selectedPaymentMethodId) {
      setShowAnimation(false);
      return;
    }

    setIsProcessing(true);

    try {
      const customerPhone = await fetchCustomerPhone();
      const customerName =
        profile?.firstName || cartState.userName || "Invitado";
      const customerEmail =
        profile?.email || user?.email || `${user?.id}@xquisito.ai`;

      if (!cartState.items.length) throw new Error("El carrito está vacío");

      // Sistema card: skip EcartPay
      if (selectedPaymentMethodId === "system-default-card") {
        const { firstTapOrderId, dishOrderIds } = await createDishOrdersForTap(
          cartState.items,
          customerName,
          customerPhone,
          customerEmail,
          clerkUserId,
        );

        if (firstTapOrderId) {
          await finalizeTapOrder(firstTapOrderId, dishOrderIds, null);
          savePaymentForSuccess(
            firstTapOrderId,
            "1234",
            "amex",
            null,
            customerName,
            customerEmail,
            customerPhone,
            cartState.items,
          );
          await clearCart();
          setOrderNotes("");
          setCompletedOrderId(firstTapOrderId);
        }
        return;
      }

      // Tarjetas reales: EcartPay
      const paymentData = {
        paymentMethodId: selectedPaymentMethodId,
        amount: totalAmount,
        currency: "MXN",
        description: `Pago Mesa ${tableNumber} - ${customerName}`,
        orderId: `order-${Date.now()}`,
        tableNumber: tableNumber,
        restaurantId,
        installments: selectedMSI || undefined,
      };

      const paymentResult = await paymentService.processPayment(paymentData);
      if (!paymentResult.success) {
        throw new Error(
          paymentResult.error?.message || "Error al procesar el pago",
        );
      }

      const { firstTapOrderId, dishOrderIds } = await createDishOrdersForTap(
        cartState.items,
        customerName,
        customerPhone,
        customerEmail,
        clerkUserId,
      );

      if (firstTapOrderId) {
        await finalizeTapOrder(
          firstTapOrderId,
          dishOrderIds,
          selectedPaymentMethodId,
        );
        const selectedMethod = allPaymentMethods.find(
          (pm) => pm.id === selectedPaymentMethodId,
        );
        savePaymentForSuccess(
          firstTapOrderId,
          selectedMethod?.lastFourDigits || "****",
          selectedMethod?.cardBrand || "visa",
          selectedPaymentMethodId,
          customerName,
          customerEmail,
          customerPhone,
          cartState.items,
        );
        await clearCart();
        setOrderNotes("");
        setCompletedOrderId(firstTapOrderId);
      }
    } catch (error) {
      sessionStorage.removeItem("xquisito-current-order-id");
      sessionStorage.removeItem("xquisito-current-payment-key");
      setCompletedOrderId(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Error desconocido",
      );
      setShowAnimation(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCard = (): void => {
    navigateWithTable(
      `/add-card?amount=${totalAmount}&baseAmount=${baseAmount}&scan=false`,
    );
  };

  const handleDeleteCard = async (paymentMethodId: string) => {
    setDeletingCardId(paymentMethodId);
    try {
      await deletePaymentMethod(paymentMethodId);
    } catch (error) {
      setErrorMessage("Error al eliminar la tarjeta. Intenta de nuevo.");
    } finally {
      setDeletingCardId(null);
    }
  };

  // Calcular total con MSI
  const getDisplayTotal = () => {
    if (selectedMSI === null) return totalAmount;
    const selectedMethod = allPaymentMethods.find(
      (pm) => pm.id === selectedPaymentMethodId,
    );
    const cardBrand = selectedMethod?.cardBrand;
    const msiOptions =
      cardBrand === "amex"
        ? [
            { months: 3, rate: 3.25 },
            { months: 6, rate: 6.25 },
            { months: 9, rate: 8.25 },
            { months: 12, rate: 10.25 },
            { months: 15, rate: 13.25 },
            { months: 18, rate: 15.25 },
            { months: 21, rate: 17.25 },
            { months: 24, rate: 19.25 },
          ]
        : [
            { months: 3, rate: 4.26 },
            { months: 6, rate: 7.3 },
            { months: 9, rate: 8.5 },
            { months: 12, rate: 13.0 },
            { months: 18, rate: 18.25 },
          ];
    const selectedOption = msiOptions.find((opt) => opt.months === selectedMSI);
    if (!selectedOption) return totalAmount;
    return totalAmount / (1 - (selectedOption.rate / 100) * 1.16);
  };

  const displayTotal = getDisplayTotal();
  const isUnderMinimum = totalAmount < MINIMUM_AMOUNT;

  if (isLoadingInitial || isLoadingProvider) {
    return (
      <div className="min-h-dvh bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50">
          <MenuHeaderBack />
        </div>
        <div className="h-20" />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="bg-linear-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 px-8 flex flex-col justify-center">
              <div className="h-8 w-3/4 bg-white/20 rounded-full mt-2 mb-6 animate-pulse" />
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 flex flex-col px-8 overflow-hidden z-10">
              <div className="flex-1 overflow-y-auto py-8 pb-[120px] flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-36 bg-gray-200 rounded-full animate-pulse mt-1" />
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 bg-white mx-4 px-8 z-60 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3 mt-6 mb-2 justify-between items-center">
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-28 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="h-12 w-36 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  return (
    <>
      {showAnimation && (
        <OrderAnimation
          userName={completedUserName}
          orderedItems={completedOrderItems}
          onContinue={() => {
            let orderId =
              sessionStorage.getItem("xquisito-current-order-id") ||
              completedOrderId;
            if (!orderId) {
              try {
                const data = localStorage.getItem("xquisito-completed-payment");
                if (data) orderId = JSON.parse(data).orderId;
              } catch {}
            }
            navigateWithTable(
              `/payment-success?orderId=${orderId || "unknown"}&success=true`,
            );
          }}
          onCancel={handleCancelPayment}
          onConfirm={handleConfirmPayment}
        />
      )}

      <div className="min-h-dvh bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <MenuHeaderBack />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="bg-linear-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 px-8 flex flex-col justify-center">
              <h1 className="font-medium text-white text-3xl leading-7 mt-2 mb-6">
                Selecciona tu método de pago
              </h1>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 flex flex-col px-8 overflow-hidden z-50">
              <div className="flex-1 overflow-y-auto py-8 pb-[140px]">
                {/* Resumen del pedido */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      Subtotal
                    </span>
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      ${baseAmount.toFixed(2)} MXN
                    </span>
                  </div>
                </div>

                {/* Selección de propina */}
                <div className="mb-4">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl whitespace-nowrap">
                      Propina
                    </span>
                    <div className="grid grid-cols-5 gap-2 flex-1">
                      {[0, 10, 15, 20].map((percentage) => (
                        <button
                          key={percentage}
                          onClick={() => {
                            handleTipPercentage(percentage);
                            setShowCustomTipInput(false);
                          }}
                          className={`py-1 md:py-1.5 rounded-full border border-[#8e8e8e]/40 text-black transition-colors cursor-pointer ${
                            tipPercentage === percentage && !showCustomTipInput
                              ? "bg-[#eab3f4] text-white"
                              : "bg-[#f9f9f9] hover:border-gray-400"
                          }`}
                        >
                          {percentage === 0 ? "0%" : `${percentage}%`}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowCustomTipInput(true);
                          setTipPercentage(0);
                        }}
                        className={`py-1 md:py-1.5 rounded-full border border-[#8e8e8e]/40 text-black transition-colors cursor-pointer ${
                          showCustomTipInput
                            ? "bg-[#eab3f4] text-white"
                            : "bg-[#f9f9f9] hover:border-gray-400"
                        }`}
                      >
                        $
                      </button>
                    </div>
                  </div>

                  {showCustomTipInput && (
                    <div className="flex flex-col gap-2 mb-3">
                      <div className="relative w-full">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          value={customTip}
                          onChange={(e) =>
                            handleCustomTipChange(e.target.value)
                          }
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          autoFocus
                          className="w-full pl-8 pr-4 py-1 md:py-1.5 border border-[#8e8e8e]/40 rounded-full focus:outline-none focus:ring focus:ring-gray-400 text-black text-center bg-[#f9f9f9] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </div>
                    </div>
                  )}

                  {tipAmount > 0 && (
                    <div className="flex justify-end items-center mt-2 text-sm">
                      <span className="text-[#eab3f4] font-medium">
                        +${tipAmount.toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                </div>

                {/* Alerta de mínimo */}
                {isUnderMinimum && totalAmount > 0 && (
                  <div className="bg-linear-to-br from-red-50 to-red-100 px-6 py-3 -mx-8 rounded-lg mb-4">
                    <div className="flex justify-center items-center gap-3">
                      <X className="size-6 text-red-500 shrink-0" />
                      <p className="text-red-700 font-medium text-base md:text-lg">
                        ¡El mínimo de compra es de ${MINIMUM_AMOUNT.toFixed(2)}!
                      </p>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center border-t pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                        Total a pagar
                      </span>
                      <CircleAlert
                        className="size-4 cursor-pointer text-gray-500"
                        strokeWidth={2.3}
                        onClick={() => setShowTotalModal(true)}
                      />
                    </div>
                    <div className="text-right">
                      {selectedMSI !== null ? (
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${(displayTotal / selectedMSI).toFixed(2)} MXN x{" "}
                          {selectedMSI} meses
                        </span>
                      ) : (
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${displayTotal.toFixed(2)} MXN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pago a meses — solo tarjeta de crédito */}
                  {(() => {
                    const selectedMethod = allPaymentMethods.find(
                      (pm) => pm.id === selectedPaymentMethodId,
                    );
                    return selectedMethod?.cardType === "credit" ? (
                      <div
                        className="py-2 cursor-pointer"
                        onClick={() => setShowPaymentOptionsModal(true)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                            Pago a meses
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedMSI !== null ? "border-[#eab3f4] bg-[#eab3f4]" : "border-gray-300"}`}
                          >
                            {selectedMSI !== null && (
                              <div className="w-full h-full rounded-full bg-white scale-50" />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Métodos de pago */}
                <div className="mb-4">
                  <h3 className="text-black font-medium mb-3 text-base md:text-lg lg:text-xl">
                    Métodos de pago
                  </h3>
                  <div className="space-y-2.5">
                    {allPaymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`flex items-center py-1.5 px-5 pl-10 border rounded-full transition-colors ${
                          selectedPaymentMethodId === method.id
                            ? "border-teal-500 bg-teal-50"
                            : "border-black/50 bg-[#f9f9f9]"
                        }`}
                      >
                        <div
                          onClick={() => {
                            setSelectedPaymentMethodId(method.id);
                            setSelectedMSI(null);
                          }}
                          className="flex items-center justify-center gap-3 mx-auto cursor-pointer text-base md:text-lg lg:text-xl"
                        >
                          <div>{getCardTypeIcon(method.cardBrand)}</div>
                          <div>
                            <p className="text-black">
                              •••• •••• •••• {method.lastFourDigits}
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            setSelectedPaymentMethodId(method.id);
                            setSelectedMSI(null);
                          }}
                          className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                            selectedPaymentMethodId === method.id
                              ? "border-teal-500 bg-teal-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedPaymentMethodId === method.id && (
                            <div className="w-full h-full rounded-full bg-white scale-50" />
                          )}
                        </div>

                        {method.id !== "system-default-card" && (
                          <button
                            onClick={() => handleDeleteCard(method.id)}
                            disabled={deletingCardId === method.id}
                            className="pl-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {deletingCardId === method.id ? (
                              <Loader2 className="size-5 animate-spin" />
                            ) : (
                              <Trash2 className="size-5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Apple Pay */}
                    <div
                      id="apple-pay-container"
                      className={`w-full ${!applePayReady || applePayUnavailable ? "hidden" : ""}`}
                    />

                    {/* Google Pay */}
                    <div
                      id="google-pay-container"
                      className={`w-full ${!googlePayReady || googlePayUnavailable ? "hidden" : ""}`}
                    />
                  </div>
                </div>

                {/* Agregar tarjeta */}
                <div className="mb-4">
                  <button
                    onClick={handleAddCard}
                    className="border border-black/50 flex justify-center items-center gap-1 w-full text-black py-3 rounded-full cursor-pointer transition-colors bg-[#f9f9f9] hover:bg-gray-100 text-base md:text-lg lg:text-xl"
                  >
                    <Plus className="size-5 md:size-6 lg:size-7" />
                    Agregar método de pago
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior fija */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white mx-4 px-8 z-60 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mt-4">
            <button
              onClick={handleInitiatePayment}
              disabled={
                isProcessing || !selectedPaymentMethodId || isUnderMinimum
              }
              className={`w-full text-white py-3 rounded-full cursor-pointer transition-all active:scale-90 text-base md:text-lg lg:text-xl ${
                isProcessing || !selectedPaymentMethodId || isUnderMinimum
                  ? "bg-linear-to-r from-[#34808C] to-[#173E44] opacity-50 cursor-not-allowed"
                  : "bg-linear-to-r from-[#34808C] to-[#173E44] animate-pulse-button"
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Procesando pago...</span>
                </div>
              ) : !selectedPaymentMethodId ? (
                "Selecciona una tarjeta"
              ) : isUnderMinimum ? (
                "Mínimo no alcanzado"
              ) : (
                "Pagar y ordenar"
              )}
            </button>
          </div>
        </div>

        {/* Modal resumen del total */}
        {showTotalModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowTotalModal(false)}
            />
            <div className="relative bg-white rounded-t-4xl w-full mx-4 md:mx-6 lg:mx-8">
              <div className="px-6 md:px-8 pt-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg md:text-xl font-semibold text-black">
                    Resumen del total
                  </h3>
                  <button
                    onClick={() => setShowTotalModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="px-6 md:px-8 py-4 md:py-5">
                <p className="text-black mb-4 text-base md:text-lg">
                  El total se obtiene de la suma de:
                </p>
                <div className="space-y-3 md:space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium text-base md:text-lg">
                      + Consumo
                    </span>
                    <span className="text-black font-medium text-base md:text-lg">
                      ${baseAmount.toFixed(2)} MXN
                    </span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium text-base md:text-lg">
                        + Propina
                      </span>
                      <span className="text-black font-medium text-base md:text-lg">
                        ${tipAmount.toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                  {xquisitoClientCharge > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium text-base md:text-lg">
                        + Comisión de servicio
                      </span>
                      <span className="text-black font-medium text-base md:text-lg">
                        ${xquisitoClientCharge.toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal opciones de pago (MSI) */}
        {showPaymentOptionsModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowPaymentOptionsModal(false)}
            />
            <div className="relative bg-white rounded-t-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="px-6 pt-4 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg font-semibold text-black">
                    Opciones de pago
                  </h3>
                  <button
                    onClick={() => setShowPaymentOptionsModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-4">
                {(() => {
                  const selectedMethod = allPaymentMethods.find(
                    (pm) => pm.id === selectedPaymentMethodId,
                  );
                  const cardBrand = selectedMethod?.cardBrand;
                  const msiOptions =
                    cardBrand === "amex"
                      ? [
                          { months: 3, rate: 3.25, minAmount: 300 },
                          { months: 6, rate: 6.25, minAmount: 600 },
                          { months: 9, rate: 8.25, minAmount: 900 },
                          { months: 12, rate: 10.25, minAmount: 1200 },
                          { months: 15, rate: 13.25, minAmount: 1800 },
                          { months: 18, rate: 15.25, minAmount: 1800 },
                          { months: 21, rate: 17.25, minAmount: 1800 },
                          { months: 24, rate: 19.25, minAmount: 1800 },
                        ]
                      : [
                          { months: 3, rate: 4.26, minAmount: 300 },
                          { months: 6, rate: 7.3, minAmount: 600 },
                          { months: 9, rate: 8.5, minAmount: 900 },
                          { months: 12, rate: 13.0, minAmount: 1200 },
                          { months: 18, rate: 18.25, minAmount: 1800 },
                        ];
                  const availableOptions = msiOptions.filter(
                    (o) => totalAmount >= o.minAmount,
                  );
                  const minAmountNeeded = msiOptions[0]?.minAmount || 0;

                  return (
                    <div className="space-y-2.5">
                      <div
                        onClick={() => setSelectedMSI(null)}
                        className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${selectedMSI === null ? "border-teal-500 bg-teal-50" : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-black text-base md:text-lg">
                              Pago completo
                            </p>
                            <p className="text-xs md:text-sm text-gray-600">
                              ${totalAmount.toFixed(2)} MXN
                            </p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedMSI === null ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}
                          >
                            {selectedMSI === null && (
                              <div className="w-full h-full rounded-full bg-white scale-50" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            Pago a meses
                          </span>
                        </div>
                      </div>

                      {availableOptions.map((option) => {
                        const totalWithCommission =
                          totalAmount / (1 - (option.rate / 100) * 1.16);
                        const monthlyPayment =
                          totalWithCommission / option.months;
                        return (
                          <div
                            key={option.months}
                            onClick={() => setSelectedMSI(option.months)}
                            className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${selectedMSI === option.months ? "border-teal-500 bg-teal-50" : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-black text-base md:text-lg">
                                  ${monthlyPayment.toFixed(2)} MXN x{" "}
                                  {option.months} meses
                                </p>
                                <p className="text-xs md:text-sm text-gray-600">
                                  Total ${totalWithCommission.toFixed(2)} MXN
                                </p>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedMSI === option.months ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}
                              >
                                {selectedMSI === option.months && (
                                  <div className="w-full h-full rounded-full bg-white scale-50" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {availableOptions.length < msiOptions.length &&
                        totalAmount < minAmountNeeded && (
                          <p className="text-xs md:text-sm text-gray-500 text-center mt-2">
                            Monto mínimo ${minAmountNeeded.toFixed(2)} MXN para
                            pagos a meses
                          </p>
                        )}
                    </div>
                  );
                })()}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button
                  onClick={() => setShowPaymentOptionsModal(false)}
                  className="w-full bg-linear-to-r from-[#34808C] to-[#173E44] text-white py-3 rounded-full cursor-pointer transition-colors text-base"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de error */}
      {errorMessage && (
        <div
          className="fixed inset-0 z-99999 flex items-end justify-center bg-black/50"
          onClick={() => setErrorMessage(null)}
        >
          <div
            className="bg-white rounded-t-4xl w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 max-w-2xl mx-auto">
              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <CircleAlert
                    className="size-7 text-red-500"
                    strokeWidth={2}
                  />
                </div>
                <h2 className="text-xl font-semibold text-black text-center">
                  Error al procesar el pago
                </h2>
              </div>
              <div className="bg-[#f9f9f9] border border-[#bfbfbf]/50 rounded-xl p-4 mb-6">
                <p className="text-gray-700 text-sm text-center">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="w-full bg-linear-to-r from-[#34808C] to-[#173E44] text-white py-3 rounded-full text-base"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
