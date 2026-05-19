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
        menuItemId: number;
        customFieldsKey: string;
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
      const cfKey = JSON.stringify(newItem.customFields || []);
      const existing = state.items.find(
        (i) =>
          i.id === newItem.id &&
          JSON.stringify(i.customFields || []) === cfKey &&
          (i.extraPrice || 0) === (newItem.extraPrice || 0),
      );
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
      const newItems = state.items.filter(
        (i) => i.cartItemId !== action.payload,
      );
      return { ...state, ...computeTotals(newItems), items: newItems };
    }

    case "UPDATE_QUANTITY": {
      const { cartItemId, quantity } = action.payload;
      const newItems =
        quantity <= 0
          ? state.items.filter((i) => i.cartItemId !== cartItemId)
          : state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity } : i,
            );
      return { ...state, ...computeTotals(newItems), items: newItems };
    }

    case "SET_CART_ITEM_ID": {
      const { menuItemId, customFieldsKey, cartItemId } = action.payload;
      const newItems = state.items.map((i) =>
        i.id === menuItemId &&
        !i.cartItemId &&
        JSON.stringify(i.customFields || []) === customFieldsKey
          ? { ...i, cartItemId }
          : i,
      );
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
    const customFieldsKey = JSON.stringify(item.customFields || []);

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
            menuItemId: item.id,
            customFieldsKey,
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
