import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useRestaurant } from "../context/RestaurantContext";
import { useTable } from "../context/TableContext";
import { restaurantService } from "../services/restaurant.service";

export function useValidateAccess() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { setRestaurantId, setBranchNumber } = useRestaurant();
  const { dispatch } = useTable();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const restaurantId = params?.restaurantId as string;
  const branchNumber = params?.branchNumber as string;
  const tableNumber = searchParams?.get("table");

  useEffect(() => {
    const validateAndSetup = async () => {
      // Validar restaurantId
      if (!restaurantId || isNaN(parseInt(restaurantId))) {
        console.error("❌ Error en restaurant ID");
        router.push("/");
        return;
      }

      // Validar branchNumber
      if (!branchNumber || isNaN(parseInt(branchNumber))) {
        console.error("❌ Error en número de sucursal");
        router.push("/");
        return;
      }

      // Validar tableNumber
      if (!tableNumber || isNaN(parseInt(tableNumber))) {
        console.error("❌ Error en número de mesa");
        router.push("/");
        return;
      }

      // Establecer contextos
      setRestaurantId(parseInt(restaurantId));
      setBranchNumber(parseInt(branchNumber));
      dispatch({ type: "SET_TABLE_NUMBER", payload: tableNumber });

      // Validar que el restaurante, sucursal y mesa existen y que el servicio "tap-order-and-pay" esté disponible
      try {
        const validation =
          await restaurantService.validateRestaurantBranchTable(
            parseInt(restaurantId),
            parseInt(branchNumber),
            parseInt(tableNumber),
            "tap-order-pay",
          );

        if (!validation.valid) {
          console.error("❌ Validation failed:", validation.error);
          setValidationError(validation.error || "VALIDATION_ERROR");
        } else {
          setValidationError(null);
        }
      } catch (err) {
        console.error("❌ Validation error:", err);
        setValidationError("VALIDATION_ERROR");
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSetup();
  }, [
    restaurantId,
    branchNumber,
    tableNumber,
    dispatch,
    setRestaurantId,
    setBranchNumber,
    router,
  ]);

  return {
    validationError,
    isValidating,
    restaurantId: parseInt(restaurantId || "0"),
    branchNumber: parseInt(branchNumber || "0"),
    tableNumber,
  };
}
