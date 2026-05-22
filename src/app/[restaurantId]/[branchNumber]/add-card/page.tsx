"use client";

// NOTE: This page is maintained for users who want to manage payment methods separately
// Main payment flows now use EcartPay SDK directly in payment/page.tsx and add-tip/page.tsx

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@/context/TableContext";
import { useTableNavigation } from "@/hooks/useTableNavigation";
import { useGuest, useIsGuest } from "@/context/GuestContext";
import { usePayment } from "@/context/PaymentContext";
import { useRestaurant } from "@/context/RestaurantContext";
import { useEffect, useState } from "react";
import { paymentService } from "@/services/payment.service";
import MenuHeaderBack from "@/components/headers/MenuHeaderBack";
import CardScanner from "@/components/CardScanner";
import Loader from "@/components/UI/Loader";
import { useAuth } from "@/context/AuthContext";
import { Camera } from "lucide-react";

function AddCardContent() {
  const params = useParams();
  const { setRestaurantId, setBranchNumber } = useRestaurant();
  const restaurantId = params?.restaurantId as string;
  const branchNumber = params?.branchNumber as string;

  useEffect(() => {
    if (restaurantId && !isNaN(parseInt(restaurantId))) {
      setRestaurantId(parseInt(restaurantId));
    }
    if (branchNumber && !isNaN(parseInt(branchNumber))) {
      setBranchNumber(parseInt(branchNumber));
    }
  }, [restaurantId, branchNumber, setRestaurantId, setBranchNumber]);

  const { state } = useTable();
  const { goBack, navigateWithTable } = useTableNavigation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGuest = useIsGuest();
  const { guestId, tableNumber } = useGuest();
  const { addPaymentMethod, refreshPaymentMethods, paymentMethods } =
    usePayment();
  const { user, isAuthenticated } = useAuth();

  // Refresh payment methods on mount to ensure we have the latest data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    refreshPaymentMethods();
  }, []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isLoadingParams, setIsLoadingParams] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const handleScanClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const textOnlyRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]*$/;

    if (textOnlyRegex.test(value)) {
      setFullName(value);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const emailCharsRegex = /^[a-zA-Z0-9@._-]*$/;

    if (emailCharsRegex.test(value)) {
      setEmail(value);
    }
  };

  const fillTestCard = () => {
    setFullName("Test User");
    setEmail("test@example.com");
    setCardNumber("4242 4242 4242 4242");
    setExpDate("12/26");
    setCvv("123");
  };

  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      alert("Please enter your full name");
      return;
    }
    if (!email.trim()) {
      alert("Please enter your email address");
      return;
    }
    if (!validateEmail(email)) {
      alert("Please enter a valid email address");
      return;
    }
    if (!cardNumber.trim()) {
      alert("Please enter card number");
      return;
    }
    if (!expDate.trim()) {
      alert("Please enter expiration date");
      return;
    }
    if (!cvv.trim()) {
      alert("Please enter CVV");
      return;
    }

    // Validar tarjeta repetida
    const lastFourDigits = cardNumber
      .replace(/\s+/g, "")
      .slice(-4)
      .substring(0, 3);
    const isDuplicate = paymentMethods.some(
      (method) => method.lastFourDigits === lastFourDigits,
    );

    if (isDuplicate) {
      alert(`Ya existe una tarjeta terminada en ${lastFourDigits}`);
      return;
    }

    setIsLoading(true);

    try {
      // Log user type for debugging
      if (user) {
        console.log("💳 Adding card for registered user:", user.id);
      } else if (isGuest && guestId && tableNumber) {
        console.log("💳 Adding card for guest:", guestId);
      }

      const result = await paymentService.addPaymentMethod({
        cardholderName: fullName,
        cardNumber,
        expiryDate: expDate,
        cvv,
      });

      if (result.success) {
        // Add the new payment method to the context if it exists
        if (result.data?.paymentMethod) {
          addPaymentMethod(result.data.paymentMethod);
        } else {
          // Fallback: refresh payment methods from API
          await refreshPaymentMethods();
        }
        alert("Card added successfully!");

        // Check if we came from saved-cards page
        const fromSavedCards = document.referrer.includes("/saved-cards");

        if (fromSavedCards) {
          navigateWithTable("/saved-cards");
        } else {
          router.back();
        }
      } else {
        alert(result.error?.message || "Failed to add card. Please try again.");
      }
    } catch (error) {
      console.error("Error saving card:", error);
      alert("Failed to add card. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpDate = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numbersOnlyRegex = /^[0-9\s]*$/;

    if (numbersOnlyRegex.test(value)) {
      const formatted = formatCardNumber(value);
      setCardNumber(formatted);
    }
  };

  const handleExpDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Solo permitir números y "/" para la fecha de expiración
    const expDateRegex = /^[0-9/]*$/;

    if (expDateRegex.test(value)) {
      const formatted = formatExpDate(value);
      setExpDate(formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numbersOnlyRegex = /^[0-9]*$/;

    if (numbersOnlyRegex.test(value)) {
      setCvv(value.substring(0, 4)); // Máximo 4 dígitos
    }
  };

  const handleScanSuccess = (result: {
    cardNumber: string;
    expiryDate: string;
    cardholderName: string;
  }) => {
    // Auto-completar campos con datos escaneados
    setCardNumber(formatCardNumber(result.cardNumber));
    setExpDate(result.expiryDate);
    setFullName(result.cardholderName);
    setShowScanner(false);
  };

  // Auto-abrir scanner si viene el parámetro scan=true
  useEffect(() => {
    const shouldAutoScan = searchParams.get("scan") === "true";
    if (shouldAutoScan) {
      setShowScanner(true);
    }
    // Marcar que ya terminó de leer los parámetros
    setIsLoadingParams(false);
  }, [searchParams]);

  // Mostrar loader mientras lee los parámetros
  if (isLoadingParams) {
    return <Loader />;
  }

  return (
    <>
      {showScanner && (
        <CardScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in-out">
          <div className="bg-gray-900 text-white px-5 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <Camera className="size-6 text-gray-400" />
            <span className="text-sm">
              Esta función no está disponible por el momento
            </span>
          </div>
        </div>
      )}

      <div className="min-h-new bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <MenuHeaderBack />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col justify-end">
          <div className="left-4 right-4 bg-linear-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="pt-6 md:pt-7 lg:pt-8 pb-12 md:pb-14 lg:pb-16 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h2 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 mt-2 md:mt-3 lg:mt-4 mb-2 md:mb-3 lg:mb-4">
                Agrega tu tarjeta para continuar
              </h2>
              <p className="text-white/80 text-sm md:text-base lg:text-lg">
                Tu tarjeta se guardará de forma segura para pagos futuros
              </p>
            </div>
          </div>

          <div className="flex-1 h-full flex flex-col">
            <div className="min-h-full bg-white rounded-t-4xl flex-1 z-5 flex flex-col px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10">
              {/* Test Card Helper */}
              {process.env.NODE_ENV === "development" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 font-medium text-sm">
                        Development Mode
                      </p>
                      <p className="text-blue-600 text-xs">
                        Use eCartpay test card data
                      </p>
                    </div>
                    <button
                      onClick={fillTestCard}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Fill Test Card
                    </button>
                  </div>
                </div>
              )}
              {/* Card Scanner */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleScanClick}
                  className="w-full bg-black hover:bg-stone-950 text-white py-4 px-6 rounded-full font-medium cursor-pointer transition-colors flex items-center justify-center gap-3"
                >
                  <Camera className="size-6" />
                  <span className="text-base md:text-lg lg:text-xl">
                    Escanear Tarjeta
                  </span>
                </button>
              </div>

              {/* Add Card Form */}
              <div className="space-y-4 md:space-y-5 text-sm md:text-base lg:text-lg">
                <div>
                  <label className="block text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={handleFullNameChange}
                    placeholder="John Doe"
                    className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    Número de tarjeta
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="**** 2098"
                    maxLength={19}
                    className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 text-black bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Exp Date Field */}
                <div>
                  <label className="block text-gray-700 mb-2">
                    Fecha de expiración
                  </label>
                  <input
                    type="text"
                    value={expDate}
                    onChange={handleExpDateChange}
                    placeholder="02/24"
                    maxLength={5}
                    className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent text-black"
                  />
                </div>

                {/* CVV Field */}
                <div>
                  <label className="block text-gray-700 mb-2">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    Correo Electronico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="john@example.com"
                    className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="bg-black hover:bg-stone-950 text-base md:text-lg lg:text-xl w-full text-white py-3 md:py-4 lg:py-5 rounded-full cursor-pointer transition-colors mt-8 disabled:bg-stone-600 disabled:cursor-not-allowed"
              >
                {isLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AddCardPage() {
  return (
    <Suspense fallback={<Loader />}>
      <AddCardContent />
    </Suspense>
  );
}
