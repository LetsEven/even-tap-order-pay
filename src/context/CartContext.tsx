"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { MenuItemData } from "../interfaces/menuItemData";
import { cartApi, CartItem as ApiCartItem } from "../services/cart.service";
import { useAuth } from "./AuthContext";
import { useRestaurant } from "./RestaurantContext";

export interface CartItem extends MenuItemData {
  quantity: number;
  cartItemId?: string;
  specialInstructions?: string;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  userName: string;
  isLoading: boolean;
  cartId: string | null;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string } // cartItemId
  | {
      type: "UPDATE_QUANTITY";
      payload: { cartItemId: string; quantity: number };
    }
  | {
      type: "SET_CART_ITEM_ID";
      payload: {
        signature: string;
        cartItemId: string;
      };
    }
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

const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
  userName: "",
  isLoading: false,
  cartId: null,
};

// Firma estable que identifica una "línea" del carrito independientemente de
// la forma del objeto customFields (el dish page incluye fieldType, el backend
// no). Solo usa lo que define la identidad: id + extraPrice + optionIds.
function lineSignature(item: {
  id: number;
  extraPrice?: number;
  customFields?: CartItem["customFields"];
}) {
  const fields = (item.customFields || [])
    .map((f: any) => ({
      fieldId: f.fieldId,
      options: ((f.selectedOptions || []) as any[])
        .map((o) => o.optionId)
        .sort(),
    }))
    .sort((a, b) => String(a.fieldId).localeCompare(String(b.fieldId)));
  return JSON.stringify({ id: item.id, extra: item.extraPrice || 0, fields });
}

function computeTotals(items: CartItem[]) {
  return {
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: items.reduce(
      (s, i) => s + (i.price + (i.extraPrice || 0)) * i.quantity,
      0,
    ),
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

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
      return { ...state, userName: action.payload };

    case "CLEAR_CART":
      return { ...initialState, userName: state.userName };

    case "ADD_ITEM": {
      const newItem = action.payload;
      const sig = lineSignature(newItem);
      const existing = state.items.find((i) => lineSignature(i) === sig);
      const newItems = existing
        ? state.items.map((i) =>
            i === existing
              ? { ...i, quantity: i.quantity + newItem.quantity }
              : i,
          )
        : [...state.items, { ...newItem, cartItemId: undefined }];
      return { ...state, ...computeTotals(newItems), items: newItems };
    }

    case "REMOVE_ITEM": {
      // Un cartItemId vacío haría match con todos los items pendientes (los
      // que aún no reciben id del backend) — no hacer nada en ese caso.
      if (!action.payload) return state;
      const newItems = state.items.filter(
        (i) => i.cartItemId !== action.payload,
      );
      return { ...state, ...computeTotals(newItems), items: newItems };
    }

    case "UPDATE_QUANTITY": {
      const { cartItemId, quantity } = action.payload;
      // Idem: un cartItemId vacío afectaría a varios items pendientes.
      if (!cartItemId) return state;
      const newItems =
        quantity <= 0
          ? state.items.filter((i) => i.cartItemId !== cartItemId)
          : state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity } : i,
            );
      return { ...state, ...computeTotals(newItems), items: newItems };
    }

    case "SET_CART_ITEM_ID": {
      const { signature, cartItemId } = action.payload;
      // Sellar solo el primer pendiente que coincida — evita asignar el mismo
      // cartItemId a varias filas (lo que haría que + las mueva juntas).
      let stamped = false;
      const newItems = state.items.map((i) => {
        if (!stamped && !i.cartItemId && lineSignature(i) === signature) {
          stamped = true;
          return { ...i, cartItemId };
        }
        return i;
      });
      return { ...state, items: newItems };
    }

    default:
      return state;
  }
}

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

interface CartContextType {
  state: CartState;
  addItem: (
    item: MenuItemData,
    quantity?: number,
    specialInstructions?: string | null,
  ) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  decrementItem: (itemId: number) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  setUserName: (name: string) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  updateOrderNotes: (notes: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [orderNotes, setOrderNotes] = useState("");
  const { user, isLoading, isAuthenticated } = useAuth();
  const { restaurantId, branchNumber } = useRestaurant();

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
      if (!isLoading && user?.id && restaurantId) {
        const guestId = cartApi.getGuestIdForUser();
        if (guestId) {
          try {
            const response = await cartApi.migrateGuestCart(guestId, user.id);
            if (response.success && response.data) {
              await refreshCart();
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("even:cartMigrationComplete"),
                );
              }
            } else {
              await refreshCart();
            }
          } catch (error) {
            console.error("❌ Error migrating cart:", error);
          }
        }
      }
    };
    migrateCartIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoading, restaurantId, isAuthenticated]);

  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      refreshCart();
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, isLoading]);

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
            ...computeTotals(items),
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

  // Agregar item — optimistic update instantáneo, sin bloquear UI
  const addItem = async (
    item: MenuItemData,
    quantity: number = 1,
    specialInstructions?: string | null,
  ) => {
    const previousItems = state.items;
    const previousCartId = state.cartId;
    const signature = lineSignature(item);

    dispatch({
      type: "ADD_ITEM",
      payload: {
        ...item,
        quantity,
        cartItemId: undefined,
        specialInstructions: specialInstructions || undefined,
      } as CartItem,
    });

    try {
      const response = await cartApi.addToCart(
        item.id,
        quantity,
        item.customFields || [],
        item.extraPrice || 0,
        item.price,
        specialInstructions ?? undefined,
      );

      if (response.success && response.data) {
        dispatch({
          type: "SET_CART_ITEM_ID",
          payload: {
            signature,
            cartItemId: response.data.cart_item_id,
          },
        });
      } else {
        console.error("Error adding item to cart:", response.error);
        dispatch({
          type: "SET_CART",
          payload: {
            items: previousItems,
            ...computeTotals(previousItems),
            cartId: previousCartId,
          },
        });
      }
    } catch (error) {
      console.error("Error adding item to cart:", error);
      dispatch({
        type: "SET_CART",
        payload: {
          items: previousItems,
          ...computeTotals(previousItems),
          cartId: previousCartId,
        },
      });
    }
  };

  // Eliminar item — optimistic update instantáneo con rollback en error
  const removeItem = async (itemId: number) => {
    let item = state.items.find((i) => i.id === itemId);
    if (!item?.cartItemId) {
      // cartItemId aún no llegó — fetch fresco para obtenerlo
      const fresh = await cartApi.getCart();
      if (fresh.success && fresh.data) {
        const freshItems = fresh.data.items.map(convertApiItemToCartItem);
        dispatch({
          type: "SET_CART",
          payload: {
            items: freshItems,
            ...computeTotals(freshItems),
            cartId: fresh.data.cart_id,
          },
        });
        item = freshItems.find((i) => i.id === itemId);
      }
      if (!item?.cartItemId) return;
    }

    const previousItems = state.items;
    const previousCartId = state.cartId;
    dispatch({ type: "REMOVE_ITEM", payload: item.cartItemId });

    try {
      const response = await cartApi.removeFromCart(item.cartItemId);
      if (!response.success) {
        console.error("Error removing item from cart:", response.error);
        dispatch({
          type: "SET_CART",
          payload: {
            items: previousItems,
            ...computeTotals(previousItems),
            cartId: previousCartId,
          },
        });
      }
    } catch (error) {
      console.error("Error removing item from cart:", error);
      dispatch({
        type: "SET_CART",
        payload: {
          items: previousItems,
          ...computeTotals(previousItems),
          cartId: previousCartId,
        },
      });
    }
  };

  // Actualizar cantidad — optimistic update instantáneo con rollback en error
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    const previousItems = state.items;
    const previousCartId = state.cartId;
    dispatch({ type: "UPDATE_QUANTITY", payload: { cartItemId, quantity } });

    try {
      const response = await cartApi.updateCartItemQuantity(
        cartItemId,
        quantity,
      );
      if (!response.success) {
        console.error("Error updating quantity:", response.error);
        dispatch({
          type: "SET_CART",
          payload: {
            items: previousItems,
            ...computeTotals(previousItems),
            cartId: previousCartId,
          },
        });
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      dispatch({
        type: "SET_CART",
        payload: {
          items: previousItems,
          ...computeTotals(previousItems),
          cartId: previousCartId,
        },
      });
    }
  };

  const decrementItem = async (itemId: number) => {
    let item = state.items.find((i) => i.id === itemId);
    if (!item?.cartItemId) {
      const fresh = await cartApi.getCart();
      if (fresh.success && fresh.data) {
        const freshItems = fresh.data.items.map(convertApiItemToCartItem);
        dispatch({
          type: "SET_CART",
          payload: {
            items: freshItems,
            ...computeTotals(freshItems),
            cartId: fresh.data.cart_id,
          },
        });
        item = freshItems.find((i) => i.id === itemId);
      }
      if (!item?.cartItemId) return;
    }

    const cartItemId = item.cartItemId;
    const newQuantity = item.quantity - 1;
    const previousItems = state.items;
    const previousCartId = state.cartId;

    if (newQuantity <= 0) {
      dispatch({ type: "REMOVE_ITEM", payload: cartItemId });
      try {
        const response = await cartApi.removeFromCart(cartItemId);
        if (!response.success) {
          dispatch({
            type: "SET_CART",
            payload: {
              items: previousItems,
              ...computeTotals(previousItems),
              cartId: previousCartId,
            },
          });
        }
      } catch {
        dispatch({
          type: "SET_CART",
          payload: {
            items: previousItems,
            ...computeTotals(previousItems),
            cartId: previousCartId,
          },
        });
      }
    } else {
      dispatch({
        type: "UPDATE_QUANTITY",
        payload: { cartItemId, quantity: newQuantity },
      });
      try {
        const response = await cartApi.updateCartItemQuantity(
          cartItemId,
          newQuantity,
        );
        if (!response.success) {
          dispatch({
            type: "SET_CART",
            payload: {
              items: previousItems,
              ...computeTotals(previousItems),
              cartId: previousCartId,
            },
          });
        }
      } catch {
        dispatch({
          type: "SET_CART",
          payload: {
            items: previousItems,
            ...computeTotals(previousItems),
            cartId: previousCartId,
          },
        });
      }
    }
  };

  const clearCart = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await cartApi.clearCart();
      if (response.success) {
        dispatch({ type: "CLEAR_CART" });
      } else {
        console.error("Error clearing cart:", response.error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const setUserName = (name: string) => {
    dispatch({ type: "SET_USER_NAME", payload: name });
  };

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
    decrementItem,
    updateQuantity,
    clearCart,
    refreshCart,
    setUserName,
    orderNotes,
    setOrderNotes,
    updateOrderNotes,
  };

  // Cargar carrito al montar o cuando cambie la identidad/restaurante
  useEffect(() => {
    if (restaurantId && !isLoading) {
      refreshCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, isLoading]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
