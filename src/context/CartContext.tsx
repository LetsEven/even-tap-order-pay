"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { MenuItemData } from "../interfaces/menuItemData";
import { cartApi, CartItem as ApiCartItem } from "../services/cart.service";
import { useAuth } from "./AuthContext";
import { useRestaurant } from "./RestaurantContext";

// Interfaz para un item del carrito (frontend)
export interface CartItem extends MenuItemData {
  quantity: number;
  cartItemId?: string;
  specialInstructions?: string;
}

// Estado del carrito
interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  userName: string;
  isLoading: boolean;
  cartId: string | null;
}

// Acciones del carrito
type CartAction =
  | { type: "ADD_ITEM"; payload: MenuItemData }
  | { type: "REMOVE_ITEM"; payload: number }
  | { type: "UPDATE_QUANTITY"; payload: { id: number; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "SET_USER_NAME"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "SET_CART";
      payload: {
        items: CartItem[];
        totalItems: number;
        totalPrice: number;
        cartId: string | null;
      };
    };

// Estado inicial
const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
  userName: "",
  isLoading: false,
  cartId: null,
};

// Reducer del carrito
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_CART":
      return {
        ...state,
        items: action.payload.items,
        totalItems: action.payload.totalItems,
        totalPrice: action.payload.totalPrice,
        cartId: action.payload.cartId,
        isLoading: false,
      };

    case "SET_USER_NAME":
      return {
        ...state,
        userName: action.payload,
      };

    case "CLEAR_CART":
      return {
        ...initialState,
        userName: state.userName, // Mantener userName
      };

    // Las acciones ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY ahora son manejadas por el provider
    // usando la API, pero mantenemos los casos para actualización optimista
    case "ADD_ITEM":
    case "REMOVE_ITEM":
    case "UPDATE_QUANTITY":
      return state;

    default:
      return state;
  }
}

// Helper para convertir ApiCartItem a CartItem
function convertApiItemToCartItem(apiItem: ApiCartItem): CartItem {
  return {
    id: apiItem.menu_item_id,
    name: apiItem.name,
    description: apiItem.description || "",
    price: apiItem.price,
    images: apiItem.images || [],
    features: apiItem.features || [],
    discount: apiItem.discount || 0,
    customFields: (apiItem.customFields || []).map((field) => ({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      selectedOptions: field.selectedOptions.map((opt) => ({
        optionId: opt.optionId,
        optionName: opt.optionName,
        price: opt.price,
        quantity: opt.quantity ?? 0,
      })),
    })),
    extraPrice: apiItem.extraPrice || 0,
    quantity: apiItem.quantity,
    cartItemId: apiItem.id,
    specialInstructions: apiItem.specialInstructions,
  };
}

// Contexto del carrito con funciones
interface CartContextType {
  state: CartState;
  addItem: (
    item: MenuItemData,
    quantity?: number,
    specialInstructions?: string | null,
  ) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  setUserName: (name: string) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  updateOrderNotes: (notes: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

// Provider del carrito
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [orderNotes, setOrderNotes] = useState("");
  const { user, isLoading, isAuthenticated } = useAuth();
  const { restaurantId, branchNumber } = useRestaurant();

  // Establecer user_id y restaurant_id en cartApi cuando cambien
  useEffect(() => {
    if (!isLoading) {
      cartApi.setSupabaseUserId(user?.id || null);
    }
  }, [user, isLoading]);

  useEffect(() => {
    cartApi.setRestaurantId(restaurantId);
  }, [restaurantId]);

  useEffect(() => {
    cartApi.setBranchNumber(branchNumber);
  }, [branchNumber]);

  // Migrar carrito cuando el usuario inicia sesión
  useEffect(() => {
    const migrateCartIfNeeded = async () => {
      console.log("🔍 Migration useEffect triggered:", {
        isLoading,
        hasUser: !!user?.id,
        userId: user?.id,
        restaurantId,
        isAuthenticated,
      });

      if (!isLoading && user?.id && restaurantId) {
        const guestId = cartApi.getGuestIdForUser();

        console.log("🔍 Migration check - detailed:", {
          isLoading: isLoading,
          userId: user.id,
          restaurantId,
          guestId,
          hasGuestId: !!guestId,
          localStorageGuestId:
            typeof window !== "undefined"
              ? localStorage.getItem("xquisito-guest-id")
              : null,
        });

        if (guestId) {
          console.log("🔄 Attempting to migrate guest cart to user...", {
            from_guest: guestId,
            to_user: user.id,
            restaurant: restaurantId,
          });
          try {
            const response = await cartApi.migrateGuestCart(guestId, user.id);
            console.log("📦 Migration response:", response);

            if (response.success && response.data) {
              console.log(
                `✅ Cart migrated successfully: ${response.data.items_migrated} items migrated`,
              );

              // NO eliminar el guest_id aquí - se eliminará después de que
              // TODAS las migraciones (cart + payment methods) se completen
              console.log(
                "ℹ️ Guest ID preserved for payment methods migration",
              );

              // Refrescar el carrito después de la migración
              await refreshCart();
              console.log("🔄 Cart refreshed after migration");
            } else {
              console.warn(
                "⚠️ Migration completed but no data returned:",
                response,
              );
              // Refrescar el carrito de todos modos
              await refreshCart();
            }
          } catch (error) {
            console.error("❌ Error migrating cart:", error);
          }
        } else {
          console.log(
            "ℹ️ No guest_id found in localStorage, skipping migration",
          );
        }
      } else {
        console.log("⏸️ Conditions not met for migration:", {
          isLoadingCheck: !isLoading,
          userCheck: !!user?.id,
          restaurantIdCheck: !!restaurantId,
        });
      }
    };

    migrateCartIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoading, restaurantId, isAuthenticated]);

  // Función para refrescar el carrito desde el backend
  const refreshCart = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await cartApi.getCart();

      if (response.success && response.data) {
        const items = response.data.items.map(convertApiItemToCartItem);
        dispatch({
          type: "SET_CART",
          payload: {
            items,
            totalItems: response.data.total_items,
            totalPrice: response.data.total_amount,
            cartId: response.data.cart_id,
          },
        });
        setOrderNotes(response.data.order_notes || "");
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error loading cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Agregar item al carrito
  const addItem = async (
    item: MenuItemData,
    quantity: number = 1,
    specialInstructions?: string | null,
  ) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await cartApi.addToCart(
        item.id,
        quantity,
        item.customFields || [],
        item.extraPrice || 0,
        item.price, // Pasar el precio base (ya con descuento aplicado si lo hay)
        specialInstructions ?? undefined,
      );

      if (response.success) {
        // Refrescar carrito después de agregar
        await refreshCart();
      } else {
        console.error("Error adding item to cart:", response.error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error adding item to cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Eliminar item del carrito
  const removeItem = async (itemId: number) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      // Buscar el cartItemId del item
      const item = state.items.find((i) => i.id === itemId);
      if (!item || !item.cartItemId) {
        console.error("Cart item not found");
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const response = await cartApi.removeFromCart(item.cartItemId);

      if (response.success) {
        await refreshCart();
      } else {
        console.error("Error removing item from cart:", response.error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error removing item from cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Actualizar cantidad de un item
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await cartApi.updateCartItemQuantity(
        cartItemId,
        quantity,
      );

      if (response.success) {
        await refreshCart();
      } else {
        console.error("Error updating quantity:", response.error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Limpiar carrito
  const clearCart = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await cartApi.clearCart();

      if (response.success) {
        dispatch({ type: "CLEAR_CART" });
        // Refrescar desde el backend para asegurar sincronización
        await refreshCart();
      } else {
        console.error("Error clearing cart:", response.error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Actualizar nombre de usuario
  const setUserName = (name: string) => {
    dispatch({ type: "SET_USER_NAME", payload: name });
  };

  // Actualizar notas de la orden (persiste en DB)
  const updateOrderNotes = async (notes: string) => {
    setOrderNotes(notes);
    try {
      await cartApi.updateOrderNotes(notes.trim() || null);
    } catch (error) {
      console.error("Error updating order notes:", error);
    }
  };

  const value: CartContextType = {
    state,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    refreshCart,
    setUserName,
    orderNotes,
    setOrderNotes,
    updateOrderNotes,
  };

  // Cargar carrito al montar el componente o cuando cambie el restaurante
  useEffect(() => {
    if (restaurantId && !isLoading) {
      refreshCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, isLoading]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Hook personalizado para usar el carrito
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
