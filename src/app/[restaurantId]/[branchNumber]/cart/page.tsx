"use client";

import { useValidateAccess } from "@/hooks/useValidateAccess";
import ValidationError from "@/components/ValidationError";
import CartView from "@/components/CartView";
import { useEffect } from "react";

export default function CartPage() {
  const { validationError } = useValidateAccess();

  useEffect(() => {
    document.title = "Mi Carrito | Tap Order & Pay";
    return () => {
      document.title = "Even Tap Order & Pay";
    };
  }, []);

  // Mostrar error de validación
  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  return <CartView />;
}
