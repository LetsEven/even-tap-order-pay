"use client";

import { useCart } from "@/context/CartContext";
import { useTableNavigation } from "@/hooks/useTableNavigation";
import { usePayment } from "@/context/PaymentContext";
import { useValidateAccess } from "@/hooks/useValidateAccess";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGuest } from "@/context/GuestContext";
import MenuHeaderBack from "@/components/headers/MenuHeaderBack";
import HighDemandBanner from "@/components/modals/HighDemandBanner";
import { Plus, Trash2, Loader2, CircleAlert, X } from "lucide-react";
import { getCardTypeIcon } from "@/utils/cardIcons";
import OrderAnimation from "@/components/UI/OrderAnimation";
import ValidationError from "@/components/ValidationError";
import { tapOrderService } from "@/services/taporders.service";
import { paymentService } from "@/services/payment.service";
import { calculateCommissions } from "@/utils/commissionCalculator";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { useMsiConfig } from "@/hooks/useMsiConfig";
import { useRestaurant } from "@/context/RestaurantContext";

export default function CardSelectionPage() {
  const {
    validationError,
    restaurantId: restaurantIdNum,
    branchNumber,
  } = useValidateAccess();
  const restaurantId = restaurantIdNum.toString();
  const { provider, isLoadingProvider } = usePaymentProvider(restaurantId);
  const { isAgentRequired } = useAgentStatus(restaurantIdNum, branchNumber);
  const { msiConfig } = useMsiConfig();
  const { restaurant } = useRestaurant();

  const { state: cartState, clearCart, orderNotes, setOrderNotes } = useCart();
  const { navigateWithTable, tableNumber } = useTableNavigation();
  const { paymentMethods, deletePaymentMethod } = usePayment();
  const { user, profile } = useAuth();
  const { guestId, guestName } = useGuest();
  const searchParams = useSearchParams();

  const isDev = process.env.NODE_ENV === "development";

  const defaultSystemCard = {
    id: "system-default-card",
    lastFourDigits: "1234",
    cardBrand: "amex",
    cardType: "credit",
    isDefault: true,
    isSystemCard: true,
  };

  const allPaymentMethods = [
    //...(isDev ? [defaultSystemCard] : []),
    defaultSystemCard,
    ...paymentMethods,
  ];

  const baseAmount = cartState.totalPrice;
  const MINIMUM_AMOUNT = 20;

  // Propina desde URL
  const tipAmountFromParam = parseFloat(searchParams.get("tipAmount") || "0");
  const tipAmount = tipAmountFromParam;

  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showPaymentOptionsModal, setShowPaymentOptionsModal] = useState(false);
  const [selectedMSI, setSelectedMSI] = useState<number | null>(null);

  // Tarjetas
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

  // Google Pay — detección iOS como lazy initializer para evitar re-render
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [googlePayUnavailable, setGooglePayUnavailable] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      const ua = navigator.userAgent;
      return (
        /iPhone|iPad|iPod/.test(ua) ||
        (ua.includes("Macintosh") &&
          navigator.vendor === "Apple Computer, Inc.")
      );
    },
  );
  const [isGooglePayProcessing, setIsGooglePayProcessing] = useState(false);
  const [googlePayToken, setGooglePayToken] = useState<string | null>(null);
  const [googlePayPaymentId, setGooglePayPaymentId] = useState<string | null>(
    null,
  );
  const googlePayListenersRef = useRef(false);

  // Refs para valores frescos en success handlers sin stale closures
  const cartItemsRef = useRef(cartState.items);
  const cartUserNameRef = useRef(cartState.userName);
  const profileRef = useRef(profile);
  const guestNameRef = useRef(guestName);
  useEffect(() => {
    cartItemsRef.current = cartState.items;
  }, [cartState.items]);
  useEffect(() => {
    cartUserNameRef.current = cartState.userName;
  }, [cartState.userName]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    guestNameRef.current = guestName;
  }, [guestName]);

  // Banner de alta demanda
  const [showHighDemandBanner, setShowHighDemandBanner] = useState(false);

  useEffect(() => {
    if (!restaurantId || !branchNumber) return;
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    fetch(
      `${API_BASE}/restaurants/${restaurantId}/${branchNumber}/order-flow-status`,
    )
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.is_high_demand) setShowHighDemandBanner(true);
      })
      .catch(() => {});
  }, [restaurantId, branchNumber]);

  // Animación de orden
  const [showAnimation, setShowAnimation] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedOrderItems, setCompletedOrderItems] = useState<
    typeof cartState.items
  >([]);
  const [completedUserName, setCompletedUserName] = useState<string>("");

  const commissions = calculateCommissions(baseAmount, tipAmount);
  const {
    ivaTip,
    subtotalForCommission,
    evenCommissionTotal,
    evenCommissionClient,
    evenCommissionRestaurant,
    ivaEvenClient,
    ivaEvenRestaurant,
    evenClientCharge,
    evenRestaurantCharge,
    totalAmountCharged: totalAmount,
  } = commissions;

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

  // Cargar SDK de Apple Pay
  useEffect(() => {
    if (isLoadingProvider) return;
    if (provider !== null && provider !== "ecartpay") return;

    const ApplePaySession = (window as any).ApplePaySession;
    if (!ApplePaySession || !ApplePaySession.canMakePayments?.()) return;

    setApplePayUnavailable(false);
    const src = "https://ecartpay.com/sdk/pay.js?v=2";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [provider, isLoadingProvider]);

  // Cargar SDK de Google Pay
  useEffect(() => {
    if (isLoadingProvider) return;
    if (provider !== null && provider !== "ecartpay") return;
    if (googlePayUnavailable) return;

    const src = "https://ecartpay.com/sdk/pay.js?v=2";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [provider, isLoadingProvider, googlePayUnavailable]);

  const getApplePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.ApplePay)
        return resolve((window as any).Pay.ApplePay);
      const interval = setInterval(() => {
        if ((window as any).Pay?.ApplePay) {
          clearInterval(interval);
          resolve((window as any).Pay.ApplePay);
        }
      }, 100);
    });

  const getGooglePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.GooglePay)
        return resolve((window as any).Pay.GooglePay);
      const interval = setInterval(() => {
        if ((window as any).Pay?.GooglePay) {
          clearInterval(interval);
          resolve((window as any).Pay.GooglePay);
        }
      }, 100);
    });

  // Inicializar Apple Pay SDK
  useEffect(() => {
    if (isLoadingInitial || totalAmount <= 0 || typeof window === "undefined")
      return;
    if (applePayListenersRef.current) return;
    applePayListenersRef.current = true;

    (async () => {
      try {
        const orderResult = await paymentService.createApplePayOrder({
          amount: totalAmount,
          currency: "MXN",
          restaurantId: restaurantId,
          customerName: profileRef.current
            ? [profileRef.current.firstName, profileRef.current.lastName]
                .filter(Boolean)
                .join(" ") || undefined
            : guestNameRef.current || cartUserNameRef.current || undefined,
          baseAmount,
          tipAmount,
          items: cartState.items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity || 1,
            extraPrice: (i.extraPrice || 0) * (i.quantity || 1),
          })),
        });

        const appleOrderId =
          (orderResult as any).orderId ?? orderResult.data?.orderId;
        if (!orderResult.success || !appleOrderId) {
          console.warn(
            "⚠️ [AP-ORDER] No se pudo crear la orden:",
            orderResult.error ?? orderResult,
          );
          applePayListenersRef.current = false;
          return;
        }

        const sdkAlreadyLoaded = !!(window as any).Pay?.ApplePay;
        const applePaySDK = await getApplePaySDK();
        if (!applePaySDK) {
          console.warn("⚠️ [AP-SDK] SDK no disponible en window.Pay.ApplePay");
          applePayListenersRef.current = false;
          return;
        }

        applePaySDK.on("ready", () =>
          setTimeout(() => setApplePayReady(true), 2800),
        );
        applePaySDK.on("unavailable", () => setApplePayUnavailable(true));
        applePaySDK.on("cancel", () => setIsApplePayProcessing(false));
        applePaySDK.on("error", (err: any) => {
          console.error("❌ Apple Pay error:", err);
          setIsApplePayProcessing(false);
          setApplePayUnavailable(true);
        });
        applePaySDK.on("success", (event: any) => {
          sessionStorage.removeItem("even-current-order-id");
          sessionStorage.removeItem("even-current-payment-key");
          setApplePayPaymentId(event?.detail?.id || appleOrderId);
          setIsApplePayProcessing(true);
          setCompletedOrderItems([...cartItemsRef.current]);
          setCompletedUserName(
            profileRef.current
              ? [profileRef.current.firstName, profileRef.current.lastName]
                  .filter(Boolean)
                  .join(" ") || "Usuario"
              : guestNameRef.current || cartUserNameRef.current || "Usuario",
          );
          setShowAnimation(true);
        });

        applePaySDK.render({
          container: "#apple-pay-container",
          orderId: appleOrderId,
          amount: totalAmount,
          currency: "MXN",
          countryCode: "MX",
          label: restaurant?.name || "Even",
          buttonStyle: "black",
          buttonType: "pay",
          borderRadius: "8px",
          supportedNetworks: ["visa", "masterCard", "amex"],
        });

        if (sdkAlreadyLoaded) setTimeout(() => setApplePayReady(true), 2800);
      } catch (err) {
        applePayListenersRef.current = false;
        console.error("❌ Error inicializando Apple Pay:", err);
      }
    })();
  }, [isLoadingInitial, totalAmount]);

  // Inicializar Google Pay SDK
  useEffect(() => {
    if (isLoadingInitial || totalAmount <= 0 || typeof window === "undefined")
      return;
    if (googlePayUnavailable) return;
    if (googlePayListenersRef.current) return;
    googlePayListenersRef.current = true;

    (async () => {
      try {
        const orderResult = await paymentService.createGooglePayOrder({
          amount: totalAmount,
          currency: "MXN",
          restaurantId: restaurantId,
          customerName: profileRef.current
            ? [profileRef.current.firstName, profileRef.current.lastName]
                .filter(Boolean)
                .join(" ") || undefined
            : guestNameRef.current || cartUserNameRef.current || undefined,
          baseAmount,
          tipAmount,
          items: cartState.items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity || 1,
            extraPrice: (i.extraPrice || 0) * (i.quantity || 1),
          })),
        });

        const googleOrderId =
          (orderResult as any).orderId ?? orderResult.data?.orderId;
        if (!orderResult.success || !googleOrderId) {
          console.warn(
            "⚠️ [GP-ORDER] No se pudo crear la orden:",
            orderResult.error ?? orderResult,
          );
          googlePayListenersRef.current = false;
          return;
        }

        const sdkAlreadyLoaded = !!(window as any).Pay?.GooglePay;
        const googlePaySDK = await getGooglePaySDK();
        if (!googlePaySDK) {
          console.warn("⚠️ [GP-SDK] SDK no disponible en window.Pay.GooglePay");
          googlePayListenersRef.current = false;
          return;
        }

        googlePaySDK.on("ready", () =>
          setTimeout(() => setGooglePayReady(true), 2800),
        );
        googlePaySDK.on("unavailable", () => setGooglePayUnavailable(true));
        googlePaySDK.on("cancel", () => setIsGooglePayProcessing(false));
        googlePaySDK.on("error", (err: any) => {
          console.error("❌ Google Pay error:", err);
          setIsGooglePayProcessing(false);
          setGooglePayUnavailable(true);
        });
        googlePaySDK.on("success", (event: any) => {
          sessionStorage.removeItem("even-current-order-id");
          sessionStorage.removeItem("even-current-payment-key");
          setGooglePayToken(event?.detail?.token || null);
          setGooglePayPaymentId(event?.detail?.activity_id || googleOrderId);
          setIsGooglePayProcessing(true);
          setCompletedOrderItems([...cartItemsRef.current]);
          setCompletedUserName(
            profileRef.current
              ? [profileRef.current.firstName, profileRef.current.lastName]
                  .filter(Boolean)
                  .join(" ") || "Usuario"
              : guestNameRef.current || cartUserNameRef.current || "Usuario",
          );
          setShowAnimation(true);
        });

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

        if (sdkAlreadyLoaded) setTimeout(() => setGooglePayReady(true), 2800);
      } catch (err) {
        googlePayListenersRef.current = false;
        console.error("❌ Error inicializando Google Pay:", err);
      }
    })();
  }, [isLoadingInitial, totalAmount, googlePayUnavailable]);

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
    setCompletedUserName(
      profile
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            "Usuario"
        : guestNameRef.current || cartState.userName || "Usuario",
    );
    setShowAnimation(true);
  };

  const handleCancelPayment = () => {
    setShowAnimation(false);
    setCompletedOrderItems([]);
    setCompletedUserName("");
  };

  const handleConfirmPayment = async (): Promise<void> => {
    const items =
      completedOrderItems.length > 0 ? completedOrderItems : cartState.items;

    if (!items || items.length === 0) {
      setErrorMessage("El carrito está vacío");
      setShowAnimation(false);
      return;
    }

    const userId = user?.id || guestId || null;
    const customerName = profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        "Invitado"
      : guestName || cartState.userName || "Invitado";
    const customerEmail = profile?.email || user?.email || null;
    const customerPhone = user?.phone || null;
    const isGuest = !user?.id && !!guestId;
    const evenRateApplied =
      subtotalForCommission > 0
        ? (evenCommissionTotal / subtotalForCommission) * 100
        : 0;

    const mappedItems = items.map((item) => ({
      item: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      images:
        item.images && Array.isArray(item.images) && item.images.length > 0
          ? item.images.filter((img) => typeof img === "string")
          : [],
      custom_fields:
        item.customFields &&
        Array.isArray(item.customFields) &&
        item.customFields.length > 0
          ? item.customFields
          : null,
      extra_price: item.extraPrice || 0,
      menu_item_id: item.id ? item.id.toString() : null,
      special_instructions: item.specialInstructions || null,
    }));

    const commonBody = {
      clerk_user_id: userId,
      guest_id: guestId || null,
      user_id: userId,
      is_guest: isGuest,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      restaurant_id: parseInt(restaurantId),
      branch_number: parseInt(branchNumber.toString()),
      table_number: tableNumber!,
      order_notes: orderNotes.trim() || null,
      items: mappedItems,
      base_amount: baseAmount,
      tip_amount: tipAmount,
      total_amount_charged: totalAmount,
      currency: "MXN",
      transaction_by: customerName,
      iva_tip: ivaTip,
      even_commission_total: evenCommissionTotal,
      even_commission_client: evenCommissionClient,
      even_commission_restaurant: evenCommissionRestaurant,
      iva_even_client: ivaEvenClient,
      iva_even_restaurant: ivaEvenRestaurant,
      even_client_charge: evenClientCharge,
      even_restaurant_charge: evenRestaurantCharge,
      even_rate_applied: evenRateApplied,
    };

    const saveAndFinalize = (
      tapOrderId: string,
      paymentId: string,
      transactionId: string,
      cardLast4: string,
      cardBrand: string,
      paymentMethodId: string | null,
    ) => {
      const userName = profile
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          "Usuario"
        : guestName || cartState.userName || "Usuario";
      const chargedAmount = selectedMSI ? displayTotal : totalAmount;
      const data = {
        orderId: tapOrderId,
        paymentId,
        transactionId,
        totalAmountCharged: chargedAmount,
        amount: chargedAmount,
        baseAmount,
        tipAmount,
        installments: selectedMSI || null,
        installmentBaseAmount: selectedMSI ? totalAmount : null,
        evenCommissionClient,
        ivaEvenClient,
        evenCommissionTotal,
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
        paymentMethodId,
        timestamp: Date.now(),
        tableNumber,
      };

      localStorage.setItem("even-completed-payment", JSON.stringify(data));
      const uniqueKey = `even-payment-success-${tapOrderId}`;
      sessionStorage.setItem(uniqueKey, JSON.stringify(data));
      sessionStorage.setItem("even-current-payment-key", uniqueKey);
      sessionStorage.setItem("even-current-order-id", tapOrderId);
    };

    setIsProcessing(true);

    try {
      // ── Apple Pay ──────────────────────────────────────────────────────────
      if (isApplePayProcessing) {
        const result = await tapOrderService.confirmOrder({
          ...commonBody,
          payment_method_id: null,
          payment_source: "apple_pay",
          ecartpay_order_id: applePayPaymentId,
        });

        if (!result.success || !result.data?.order) {
          throw new Error(
            (result.error as any)?.message ||
              result.error ||
              "Error al confirmar la orden",
          );
        }

        const orderId = result.data.order.id;
        saveAndFinalize(
          orderId,
          `apple-pay-${orderId}`,
          orderId,
          "AP",
          "apple",
          null,
        );
        setOrderNotes("");
        await clearCart();
        setCompletedOrderId(orderId);
        return;
      }

      // ── Google Pay ─────────────────────────────────────────────────────────
      if (isGooglePayProcessing) {
        const result = await tapOrderService.confirmOrder({
          ...commonBody,
          payment_method_id: null,
          payment_source: "google_pay",
          ecartpay_order_id: googlePayPaymentId,
          google_pay_token: googlePayToken,
        });

        if (!result.success || !result.data?.order) {
          throw new Error(
            (result.error as any)?.message ||
              result.error ||
              "Error al confirmar la orden",
          );
        }

        const orderId = result.data.order.id;
        saveAndFinalize(
          orderId,
          `google-pay-${orderId}`,
          orderId,
          "GP",
          "google",
          null,
        );
        setOrderNotes("");
        await clearCart();
        setCompletedOrderId(orderId);
        return;
      }

      if (!tableNumber || !selectedPaymentMethodId) {
        setShowAnimation(false);
        return;
      }

      // ── Tarjeta del sistema (sin EcartPay) ─────────────────────────────────
      if (selectedPaymentMethodId === "system-default-card") {
        const result = await tapOrderService.confirmOrder({
          ...commonBody,
          payment_method_id: null,
          payment_source: "dev",
        });

        if (!result.success || !result.data?.order) {
          throw new Error(
            (result.error as any)?.message ||
              result.error ||
              "Error al confirmar la orden",
          );
        }

        const orderId = result.data.order.id;
        saveAndFinalize(
          orderId,
          `pick-go-${orderId}`,
          orderId,
          "1234",
          "amex",
          null,
        );
        setOrderNotes("");
        await clearCart();
        setCompletedOrderId(orderId);
        return;
      }

      // ── Tarjeta guardada (EcartPay primero) ────────────────────────────────
      const paymentResult = await paymentService.processPayment({
        paymentMethodId: selectedPaymentMethodId,
        amount: totalAmount,
        currency: "MXN",
        description: `Pago Mesa ${tableNumber} - ${customerName}`,
        orderId: `order-${Date.now()}`,
        tableNumber: tableNumber,
        restaurantId,
        installments: selectedMSI || undefined,
        baseAmount,
        tipAmount,
        items: selectedMSI
          ? undefined
          : items.map((i) => ({
              name: i.name,
              price: i.price,
              quantity: i.quantity || 1,
              extraPrice: (i.extraPrice || 0) * (i.quantity || 1),
            })),
      });

      if (!paymentResult.success) {
        throw new Error(
          paymentResult.error?.message || "Error al procesar el pago",
        );
      }

      const confirmResult = await tapOrderService.confirmOrder({
        ...commonBody,
        total_amount_charged: selectedMSI ? displayTotal : totalAmount,
        payment_method_id: selectedPaymentMethodId,
        payment_source: "saved_card",
        ecartpay_order_id: (paymentResult as any).payment?.id ?? null,
        installments: selectedMSI || null,
      });

      if (!confirmResult.success || !confirmResult.data?.order) {
        throw new Error(
          (confirmResult.error as any)?.message ||
            confirmResult.error ||
            "Error al confirmar la orden",
        );
      }

      const orderId = confirmResult.data.order.id;
      const selectedMethod = allPaymentMethods.find(
        (pm) => pm.id === selectedPaymentMethodId,
      );
      saveAndFinalize(
        orderId,
        paymentResult.data?.paymentId || `tap-order-${orderId}`,
        paymentResult.data?.transactionId || orderId,
        selectedMethod?.lastFourDigits || "****",
        selectedMethod?.cardBrand || "visa",
        selectedPaymentMethodId,
      );
      setOrderNotes("");
      await clearCart();
      setCompletedOrderId(orderId);
    } catch (error) {
      sessionStorage.removeItem("even-current-order-id");
      sessionStorage.removeItem("even-current-payment-key");
      setCompletedOrderId(null);
      const rawMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorTranslations: Record<string, string> = {
        "Transaction rejected by your bank, please try another card.":
          "Tu banco rechazó la transacción. Por favor intenta con otra tarjeta.",
        "Insufficient funds":
          "Fondos insuficientes. Por favor intenta con otra tarjeta.",
        "Card expired":
          "Tu tarjeta está vencida. Por favor agrega una tarjeta vigente.",
        "Invalid card number": "Número de tarjeta inválido.",
        "An unknown error occurred":
          "Ocurrió un error al procesar el pago. Por favor intenta de nuevo.",
      };
      setErrorMessage(errorTranslations[rawMessage] ?? rawMessage);
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
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarjeta?")) return;
    setDeletingCardId(paymentMethodId);
    try {
      await deletePaymentMethod(paymentMethodId);
    } catch {
      setErrorMessage("Error al eliminar la tarjeta. Intenta de nuevo.");
    } finally {
      setDeletingCardId(null);
    }
  };

  const getDisplayTotal = () => {
    if (selectedMSI === null) return totalAmount;
    const selectedMethod = allPaymentMethods.find(
      (pm) => pm.id === selectedPaymentMethodId,
    );
    const cardBrand = selectedMethod?.cardBrand;
    const msiOptions = cardBrand === "amex" ? msiConfig.amex : msiConfig.visaMc;
    const selectedOption = msiOptions.find((opt) => opt.months === selectedMSI);
    if (!selectedOption) return totalAmount;
    return totalAmount / (1 - (selectedOption.rate / 100) * 1.16);
  };

  const displayTotal = getDisplayTotal();
  const isUnderMinimum = totalAmount < MINIMUM_AMOUNT;

  if (isLoadingInitial || isLoadingProvider) {
    return (
      <div className="min-h-dvh brand-evergreen flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50">
          <MenuHeaderBack />
        </div>
        <div className="h-20" />
        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="bg-even-evergreen rounded-t-4xl translate-y-7 z-0">
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
      {showHighDemandBanner && (
        <HighDemandBanner onDismiss={() => setShowHighDemandBanner(false)} />
      )}

      {showAnimation && (
        <OrderAnimation
          userName={completedUserName}
          orderedItems={completedOrderItems}
          onContinue={() => {
            let orderId = sessionStorage.getItem("even-current-order-id");

            if (!orderId) {
              orderId = completedOrderId;
            }

            if (!orderId) {
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith("even-payment-success-")) {
                  try {
                    const data = sessionStorage.getItem(key);
                    if (data) {
                      orderId = JSON.parse(data).orderId;
                      break;
                    }
                  } catch {}
                }
              }
            }

            if (!orderId) {
              try {
                const data = localStorage.getItem("even-completed-payment");
                if (data) orderId = JSON.parse(data).orderId;
              } catch {}
            }

            if (!orderId || orderId === "unknown") return;

            navigateWithTable(
              `/payment-success?orderId=${orderId}&success=true`,
            );
          }}
          onCancel={handleCancelPayment}
          onConfirm={handleConfirmPayment}
        />
      )}

      <div className="min-h-dvh brand-evergreen flex flex-col">
        <MenuHeaderBack />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="bg-even-evergreen rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 px-8 flex flex-col justify-center">
              <h1 className="font-medium text-white text-3xl leading-7 mt-2 mb-6">
                Selecciona tu método de pago
              </h1>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 flex flex-col px-8 overflow-hidden z-50">
              <div
                className={`flex-1 overflow-y-auto py-8 ${isAgentRequired ? "pb-[160px]" : "pb-[120px]"}`}
              >
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

                {/* Alerta de mínimo */}
                {isUnderMinimum && totalAmount > 0 && (
                  <div className="bg-red-50 px-6 py-3 -mx-8 rounded-lg mb-4">
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
                    return selectedMethod?.cardType === "credit" &&
                      msiConfig.isActive &&
                      totalAmount >= 300 ? (
                      <div
                        className="py-2 cursor-pointer"
                        onClick={() => setShowPaymentOptionsModal(true)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                            Pago a meses
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI !== null
                                ? "border-even-grass bg-even-grass"
                                : "border-gray-300"
                            }`}
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
                <div className="mb-2.5">
                  <h3 className="text-black font-medium mb-3">
                    Métodos de pago
                  </h3>
                  <div className="space-y-2.5">
                    {allPaymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`flex items-center py-1.5 px-5 pl-10 border rounded-full transition-colors ${
                          selectedPaymentMethodId === method.id
                            ? "border-even-grass bg-even-grass/10"
                            : "border-black/50 bg-surface"
                        }`}
                      >
                        <div
                          onClick={() => {
                            setSelectedPaymentMethodId(method.id);
                            setSelectedMSI(null);
                          }}
                          className="flex items-center justify-center gap-3 mx-auto cursor-pointer"
                        >
                          <div>{getCardTypeIcon(method.cardBrand)}</div>
                          <div>
                            <p className="text-black">
                              **** {method.lastFourDigits}
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
                              ? "border-even-grass bg-even-grass"
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
                    {!applePayUnavailable && !isAgentRequired && (
                      <div className="relative w-full h-[48px]">
                        <div id="apple-pay-container" className="w-full" />
                        {!applePayReady && (
                          <div className="absolute inset-0 rounded-full bg-black flex items-center justify-center gap-2">
                            <span
                              className="text-white text-xl leading-none"
                              style={{
                                fontFamily:
                                  "-apple-system, BlinkMacSystemFont, sans-serif",
                              }}
                              aria-hidden="true"
                            >
                              {""}
                            </span>
                            <span className="text-white font-medium text-base tracking-wide">
                              Pay
                            </span>
                            <Loader2 className="size-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Google Pay */}
                    {!googlePayUnavailable && !isAgentRequired && (
                      <div className="relative w-full h-[48px]">
                        <div id="google-pay-container" className="w-full" />
                        {!googlePayReady && (
                          <div className="absolute inset-0 rounded-full bg-black flex items-center justify-center gap-2">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 18 18"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                                fill="#4285F4"
                              />
                              <path
                                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                                fill="#34A853"
                              />
                              <path
                                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                                fill="#FBBC05"
                              />
                              <path
                                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                                fill="#EA4335"
                              />
                            </svg>
                            <span className="text-white font-medium text-base tracking-wide">
                              Pay
                            </span>
                            <Loader2 className="size-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agregar tarjeta */}
                <div className="mb-2.5">
                  <button
                    onClick={handleAddCard}
                    className="border border-black/50 flex justify-center items-center gap-1 w-full text-black py-3 rounded-full cursor-pointer transition-colors bg-surface hover:bg-gray-100"
                  >
                    <Plus className="size-5" />
                    Agregar método de pago
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior fija */}
        <div className="fixed bottom-0 left-0 right-0 bg-white mx-4 px-8 z-90 py-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {isAgentRequired && (
            <p className="text-red-500 text-xs text-center mb-6">
              El sistema de caja no está disponible en este momento. Intenta más
              tarde.
            </p>
          )}
          <button
            onClick={handleInitiatePayment}
            disabled={
              isProcessing ||
              !selectedPaymentMethodId ||
              isUnderMinimum ||
              isAgentRequired
            }
            className={`py-3 text-even-evergreen rounded-full cursor-pointer font-normal h-fit w-full flex items-center justify-center text-base active:scale-95 transition-transform ${
              isProcessing ||
              !selectedPaymentMethodId ||
              isUnderMinimum ||
              isAgentRequired
                ? "bg-even-grass opacity-50 cursor-not-allowed px-10"
                : "bg-even-grass px-10 animate-pulse-button"
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
                <div className="flex items-center justify-between pb-4 border-b border-stroke">
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
                  {evenClientCharge > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium text-base md:text-lg">
                        + Comisión de servicio
                      </span>
                      <span className="text-black font-medium text-base md:text-lg">
                        ${evenClientCharge.toFixed(2)} MXN
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
                <div className="flex items-center justify-between pb-4 border-b border-stroke">
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
                    cardBrand === "amex" ? msiConfig.amex : msiConfig.visaMc;
                  const availableOptions = msiOptions.filter(
                    (o) => totalAmount >= o.minAmount,
                  );
                  const minAmountNeeded = msiOptions[0]?.minAmount || 0;

                  return (
                    <div className="space-y-2.5">
                      <div
                        onClick={() => setSelectedMSI(null)}
                        className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                          selectedMSI === null
                            ? "border-even-grass bg-even-grass/10"
                            : "border-black/50 bg-surface hover:border-gray-400"
                        }`}
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
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI === null
                                ? "border-even-grass bg-even-grass"
                                : "border-gray-300"
                            }`}
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
                            className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                              selectedMSI === option.months
                                ? "border-even-grass bg-even-grass/10"
                                : "border-black/50 bg-surface hover:border-gray-400"
                            }`}
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
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  selectedMSI === option.months
                                    ? "border-even-grass bg-even-grass"
                                    : "border-gray-300"
                                }`}
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
                  className="w-full bg-even-grass text-even-evergreen py-3 rounded-full cursor-pointer transition-colors text-base"
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
              <div className="bg-surface border border-stroke-soft/50 rounded-xl p-4 mb-6">
                <p className="text-gray-700 text-sm text-center">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="w-full bg-even-grass text-even-evergreen py-3 rounded-full text-base"
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
