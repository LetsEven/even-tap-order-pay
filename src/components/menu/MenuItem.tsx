"use client";

import {
  MenuItem as MenuItemDB,
  MenuItemData,
  CustomField,
} from "../../interfaces/menuItemData";
import { useCart } from "../../context/CartContext";
import { useTableNavigation } from "../../hooks/useTableNavigation";
import { useFlyToCart } from "../../hooks/useFlyToCart";
import { useRestaurant } from "../../context/RestaurantContext";
import { Plus, Minus } from "lucide-react";
import { useRef, useState, useEffect, useMemo, memo } from "react";

interface MenuItemProps {
  item: MenuItemDB | MenuItemData;
  onRestaurantClosed?: () => void;
}

function MenuItem({ item, onRestaurantClosed }: MenuItemProps) {
  // Adaptar el item de BD al formato legacy
  const adaptedItem: MenuItemData = useMemo(() => {
    // Si ya tiene el formato legacy, devolverlo tal cual
    if ("images" in item && "features" in item) {
      return item as MenuItemData;
    }

    // Convertir de formato BD a formato legacy
    const dbItem = item as MenuItemDB;
    return {
      id: dbItem.id,
      name: dbItem.name,
      description: dbItem.description || "",
      price: Number(dbItem.price),
      images: dbItem.image_url ? [dbItem.image_url] : [],
      discount: dbItem.discount,
      features: [], // Los custom_fields podrían mapearse aquí si es necesario
    };
  }, [item]);
  const { state: cartState, addItem, removeItem, updateQuantity } = useCart();
  const { navigateWithTable } = useTableNavigation();
  const { flyToCart } = useFlyToCart();
  const { isOpen } = useRestaurant();
  const plusButtonRef = useRef<HTMLDivElement>(null);
  const isAddingRef = useRef(false);
  const isRemovingRef = useRef(false);
  const [localQuantity, setLocalQuantity] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);

  // Verificar si el item tiene custom fields obligatorios
  const hasRequiredCustomFields = useMemo(() => {
    const dbItem = item as MenuItemDB;
    if (dbItem.custom_fields) {
      let fields: CustomField[] = [];
      if (typeof dbItem.custom_fields === "string") {
        try {
          fields = JSON.parse(dbItem.custom_fields);
        } catch {
          return false;
        }
      } else if (Array.isArray(dbItem.custom_fields)) {
        fields = dbItem.custom_fields;
      }
      // Solo retorna true si hay al menos un campo obligatorio
      return fields.some((field: CustomField) => field.required === true);
    }
    return false;
  }, [item]);

  const handleImageClick = () => {
    navigateWithTable(`/dish/${adaptedItem.id}`);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Evitar clicks múltiples mientras se está agregando (usando ref para check síncrono)
    if (isAddingRef.current) {
      return;
    }

    // Verificar si el restaurante está abierto
    if (!isOpen) {
      onRestaurantClosed?.();
      return;
    }

    // Si tiene custom fields obligatorios, verificar si hay un último item guardado
    if (hasRequiredCustomFields) {
      const lastItemKey = `lastItem_${adaptedItem.id}`;
      const lastItemData = localStorage.getItem(lastItemKey);

      if (lastItemData) {
        // Si hay un último item guardado, agregarlo al carrito
        try {
          const lastItem = JSON.parse(lastItemData);

          isAddingRef.current = true;
          setLocalQuantity((prev) => prev + 1);
          setIsPulsing(true);

          try {
            if (plusButtonRef.current) {
              flyToCart(plusButtonRef.current, async () => {
                await addItem(lastItem);
              });
            } else {
              await addItem(lastItem);
            }
          } finally {
            isAddingRef.current = false;
          }
        } catch (error) {
          console.error("Error parsing last item:", error);
          navigateWithTable(`/dish/${adaptedItem.id}`);
        }
      } else {
        // Si no hay último item, navegar a la página de detalle
        navigateWithTable(`/dish/${adaptedItem.id}`);
      }
      return;
    }

    // Calcular precio con descuento aplicado
    const finalPrice =
      adaptedItem.discount > 0
        ? adaptedItem.price * (1 - adaptedItem.discount / 100)
        : adaptedItem.price;

    // Crear item con precio con descuento
    const itemWithDiscount = {
      ...adaptedItem,
      price: finalPrice,
    };

    // Si no tiene custom fields, agregar directamente al carrito
    // Bloquear SÍNCRONAMENTE con ref antes de cualquier async
    isAddingRef.current = true;
    setLocalQuantity((prev) => prev + 1);
    setIsPulsing(true);

    try {
      if (plusButtonRef.current) {
        flyToCart(plusButtonRef.current, async () => {
          await addItem(itemWithDiscount);
        });
      } else {
        await addItem(itemWithDiscount);
      }
    } finally {
      isAddingRef.current = false;
    }
  };

  // Reset pulse animation
  useEffect(() => {
    if (isPulsing) {
      const timer = setTimeout(() => setIsPulsing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isPulsing]);

  const handleRemoveFromCart = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Evitar clicks múltiples mientras se está removiendo (usando ref para check síncrono)
    if (isRemovingRef.current) {
      return;
    }

    // Si hay múltiples variaciones, navegar al carrito
    const itemsWithSameId = cartState.items.filter(
      (cartItem) => cartItem.id === adaptedItem.id,
    );
    if (itemsWithSameId.length > 1) {
      navigateWithTable("/cart");
      return;
    }

    // Bloquear SÍNCRONAMENTE con ref antes de cualquier async
    isRemovingRef.current = true;

    // Update local quantity
    setLocalQuantity((prev) => Math.max(0, prev - 1));

    try {
      const cartItem = cartState.items.find(
        (cartItem) => cartItem.id === adaptedItem.id,
      );
      if (cartItem && cartItem.quantity > 1) {
        await updateQuantity(adaptedItem.id, cartItem.quantity - 1);
      } else if (cartItem && cartItem.quantity === 1) {
        await removeItem(adaptedItem.id);
      }
    } finally {
      isRemovingRef.current = false;
    }
  };

  // Sumar todas las cantidades de items con el mismo id (considerando diferentes custom fields)
  const currentQuantity = cartState.items
    .filter((cartItem) => cartItem.id === adaptedItem.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  // Sync local quantity with state
  const displayQuantity = Math.max(localQuantity, currentQuantity);

  return (
    <div
      className="border-b border-gray-300 py-4 md:py-6 lg:py-7 relative"
      onClick={handleImageClick}
    >
      <div className="flex items-center gap-4 md:gap-5 lg:gap-6">
        {/* Image */}
        <div className="shrink-0 cursor-pointer">
          <div className="size-36 md:size-40 lg:size-44 bg-gray-300 rounded-xl md:rounded-2xl flex items-center justify-center hover:scale-105 transition-transform duration-200">
            {adaptedItem.images[0] ? (
              <img
                src={adaptedItem.images[0]}
                alt="Dish preview"
                className="w-full h-full object-cover rounded-xl md:rounded-2xl"
              />
            ) : (
              <img
                src={"/logos/logo-short-green.webp"}
                alt="Logo Xquisito"
                className="size-18 md:size-20 lg:size-22 object-contain"
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <h3 className="text-lg md:text-xl lg:text-2xl font-medium text-black leading-tight capitalize line-clamp-2 wrap-break-word">
              {adaptedItem.name}
            </h3>
            <div
              className={`flex gap-1.5 md:gap-2 px-3 md:px-4 lg:px-5 py-0.5 md:py-1 h-fit rounded-full border items-center justify-center border-[#8e8e8e]/50 text-black transition-all ${isPulsing ? "bg-[#eab3f4]/50" : "bg-[#f9f9f9]"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Minus
                className={`size-4 md:size-5 lg:size-6 ${displayQuantity > 0 ? "cursor-pointer" : "cursor-no-drop"}`}
                onClick={displayQuantity > 0 ? handleRemoveFromCart : undefined}
              />
              <p className="font-normal text-base md:text-lg lg:text-xl">
                {displayQuantity}
              </p>
              <div ref={plusButtonRef}>
                <Plus
                  className="size-4 md:size-5 lg:size-6 cursor-pointer"
                  onClick={handleAddToCart}
                />
              </div>
            </div>
          </div>
          {adaptedItem.features.length > 0 && (
            <div className="flex gap-1 md:gap-1.5 mt-1 md:mt-2 mb-3 md:mb-4">
              {adaptedItem.features.map((feature, index) => (
                <div
                  key={index}
                  className="text-sm md:text-base lg:text-lg text-black font-medium border border-[#bfbfbf]/50 rounded-3xl px-3 md:px-4 py-1 md:py-1.5 shadow-sm"
                >
                  {feature}
                </div>
              ))}
            </div>
          )}
          <p className="text-base md:text-lg lg:text-xl line-clamp-3 leading-4 md:leading-5 lg:leading-6 bg-linear-to-b from-black to-black/30 bg-clip-text text-transparent">
            {adaptedItem.description}
          </p>
          <div className="flex items-center justify-between mt-2 md:mt-3">
            {adaptedItem.discount > 0 ? (
              <div className="text-base md:text-lg lg:text-xl text-black flex flex-col">
                <div>
                  <span className="text-black line-through text-xs md:text-sm lg:text-base">
                    ${adaptedItem.price} MXN
                  </span>
                </div>
                <div className="-translate-y-1">
                  $
                  {(
                    adaptedItem.price *
                    (1 - adaptedItem.discount / 100)
                  ).toFixed(2)}{" "}
                  MXN
                </div>
              </div>
            ) : (
              <span className="text-base md:text-lg lg:text-xl text-black">
                ${adaptedItem.price.toFixed(2)} MXN
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MenuItem);
