"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Restaurant ID y Branch por defecto para testing
const DEFAULT_RESTAURANT_ID = 15;
const DEFAULT_BRANCH_NUMBER = 1;
const DEFAULT_TABLE = 2;

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Check if user just signed in/up and has context
    const storedTable = sessionStorage.getItem("pendingTableRedirect");
    const storedRestaurant = sessionStorage.getItem("pendingRestaurantId");
    const authFromPaymentFlow = sessionStorage.getItem("authFromPaymentFlow");
    const authFromMenu = sessionStorage.getItem("authFromMenu");

    // Determinar restaurantId
    const restaurantParam = searchParams.get("restaurant");
    const restaurantId =
      restaurantParam || storedRestaurant || DEFAULT_RESTAURANT_ID;

    if (isAuthenticated && storedTable) {
      // User signed in/up from cart (CartView), redirect to card-selection
      sessionStorage.removeItem("pendingTableRedirect");
      sessionStorage.removeItem("pendingRestaurantId");
      router.replace(
        `/${restaurantId}/${DEFAULT_BRANCH_NUMBER}/card-selection?table=${storedTable}`,
      );
      return;
    }

    if (isAuthenticated && storedTable && authFromMenu) {
      // User signed in from MenuView settings, redirect to dashboard with table
      sessionStorage.removeItem("authFromMenu");
      sessionStorage.removeItem("pendingTableRedirect");
      sessionStorage.removeItem("pendingRestaurantId");
      router.replace(
        `/${restaurantId}/${DEFAULT_BRANCH_NUMBER}/dashboard?table=${storedTable}`,
      );
      return;
    }

    if (isAuthenticated && storedTable && authFromPaymentFlow) {
      // User signed up during payment flow, redirect to card-selection
      sessionStorage.removeItem("pendingTableRedirect");
      sessionStorage.removeItem("authFromPaymentFlow");
      sessionStorage.removeItem("pendingRestaurantId");
      router.replace(
        `/${restaurantId}/${DEFAULT_BRANCH_NUMBER}/card-selection?table=${storedTable}`,
      );
      return;
    }

    // Check for table parameter in current URL
    const tableParam = searchParams.get("table");
    if (tableParam) {
      router.replace(
        `/${restaurantId}/${DEFAULT_BRANCH_NUMBER}/menu?table=${tableParam}`,
      );
      return;
    }

    // Default redirect
    router.replace(
      `/${DEFAULT_RESTAURANT_ID}/${DEFAULT_BRANCH_NUMBER}/menu?table=${DEFAULT_TABLE}`,
    );
  }, [router, searchParams, isAuthenticated, isLoading]);

  return (
    <div className="min-h-new bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 md:px-8 lg:px-10 pb-12 md:py-10 lg:py-12">
        <div className="w-full max-w-md">
          {/* Logo and QR Code side by side */}
          <div className="mb-6 md:mb-8 lg:mb-10 text-center">
            <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 mb-4 md:mb-5 lg:mb-6">
              <img
                src="/logos/logo-short-green.webp"
                alt="Xquisito Logo"
                className="size-16 md:size-20 lg:size-24"
              />
            </div>
            <h1 className="text-white text-xl md:text-2xl lg:text-3xl font-medium mb-2 md:mb-3 lg:mb-4">
              Bienvenido a Xquisito
            </h1>
            <p className="text-white/80 text-sm md:text-base lg:text-lg">
              Por favor tapee la tarjeta o escanee el código QR de su mesa para
              comenzar
            </p>
          </div>

          {/* Additional Info */}
          <div className="mt-6 md:mt-7 lg:mt-8 text-center">
            <p className="text-white/70 text-xs md:text-sm lg:text-base">
              Encontrará la tarjeta en su mesa. Cada tarjeta tiene un código
              único para acceder al menú digital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
