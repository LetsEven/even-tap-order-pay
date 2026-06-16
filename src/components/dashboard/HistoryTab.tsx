"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ChevronRight, X, Calendar, Utensils } from "lucide-react";
import { getCardTypeIcon } from "@/utils/cardIcons";

interface OrderHistoryItem {
  orderType?:
    | "flex-bill"
    | "tap-order-and-pay"
    | "pick-and-go"
    | "tap-and-pay"
    | "room-service"; // Tipo de orden
  dishOrderId: number;
  item: string;
  quantity: number;
  price: number;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  images: string[];
  customFields: any;
  extraPrice: number;
  createdAt: string;
  tableNumber?: number;
  roomNumber?: number;
  tableOrderId: number;
  tableOrderStatus: string;
  tableOrderDate: string;
  restaurantId: number | null;
  restaurantName: string;
  restaurantLogo: string | null;
  // Payment method info
  paymentMethodId?: number | null;
  paymentCardLastFour?: string | null;
  paymentCardType?: string | null;
  paymentCardBrand?: string | null;
}

export default function HistoryTab() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [displayCount, setDisplayCount] = useState(5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "preparing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ready":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "preparing":
        return "Preparando";
      case "ready":
        return "Listo";
      case "delivered":
        return "Entregado";
      default:
        return status;
    }
  };

  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    if (selectedOrderDetails) {
      // Bloquear scroll en body y html para móviles
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        // Restaurar scroll
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [selectedOrderDetails]);

  useEffect(() => {
    const fetchOrderHistory = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/order-history`,
        );

        if (!response.ok) {
          throw new Error("Error al cargar el historial");
        }

        const data = await response.json();
        setOrders(data.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderHistory();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 md:py-16 lg:py-20">
        <Loader2 className="size-8 md:size-10 lg:size-12 animate-spin text-[#299E66]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-500 text-base md:text-lg lg:text-xl">{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl md:text-7xl lg:text-8xl mb-4 md:mb-5 lg:mb-6">
            📋
          </div>
          <p className="text-gray-500 text-base md:text-lg lg:text-xl">
            No tienes pedidos aún
          </p>
        </div>
      </div>
    );
  }

  // Las órdenes ya vienen agrupadas por transacción desde el backend
  // Cada orden tiene sus platillos en el array "dishes"
  const groupedOrders = orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Órdenes visibles según displayCount
  const visibleOrders = groupedOrders.slice(0, displayCount);
  const hasMore = displayCount < groupedOrders.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 5);
  };

  return (
    <>
      <h1 className="text-gray-700 text-xl md:text-2xl lg:text-3xl mb-3 md:mb-4 lg:mb-5">
        Ordenes previas
      </h1>
      <div className="space-y-3 md:space-y-4 lg:space-y-5">
        {visibleOrders.map((order: any) => {
          return (
            <div
              key={order.transactionId}
              onClick={() => {
                setSelectedOrderDetails(order);
              }}
              className="border border-gray-200 rounded-lg md:rounded-xl p-4 md:p-5 lg:p-6 cursor-pointer"
            >
              {/* Header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                  {/* Logo */}
                  {order.restaurantLogo ? (
                    <img
                      src={order.restaurantLogo}
                      alt={order.restaurantName}
                      className="size-16 md:size-20 lg:size-24 object-cover rounded-lg md:rounded-xl"
                    />
                  ) : (
                    <div className="size-16 md:size-20 lg:size-24 bg-[#82E657]/20 rounded-lg md:rounded-xl flex items-center justify-center">
                      <span className="text-2xl md:text-3xl lg:text-4xl">
                        🍽️
                      </span>
                    </div>
                  )}

                  {/* Order Info */}
                  <div className="flex-1">
                    <h3 className="text-black mb-1 text-base md:text-lg lg:text-xl">
                      {order.restaurantName}
                    </h3>
                    <p className="text-sm md:text-base lg:text-lg text-gray-600 mb-1">
                      {order.totalQuantity}{" "}
                      {order.totalQuantity === 1 ? "articulo" : "articulos"} - $
                      {order.totalAmount.toFixed(2)}
                    </p>
                    <p className="text-xs md:text-sm lg:text-base text-gray-400">
                      {new Date(order.tableOrderDate).toLocaleDateString(
                        "es-MX",
                        {
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                        },
                      )}{" "}
                    </p>
                  </div>
                </div>

                {/* Order Type Badge */}
                <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
                  {/*
                  <div className="text-right">
                    <span
                      className={`text-xs md:text-sm lg:text-base px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2 rounded-full font-medium truncate ${
                        order.orderType === "tap-order-and-pay"
                          ? "bg-[#82E657]/20 text-[#023828]"
                          : order.orderType === "pick-and-go"
                            ? "bg-green-100 text-green-700"
                            : order.orderType === "room-service"
                              ? "bg-orange-100 text-orange-700"
                              : order.orderType === "tap-and-pay"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-[#C3FEFF] text-[#023828]"
                      }`}
                    >
                      {order.orderType === "tap-order-and-pay"
                        ? "Pick & Go"
                        : order.orderType === "room-service"
                          ? "Room Service"
                          : order.orderType === "tap-and-pay"
                            ? "Tap & Pay"
                            : "Flex Bill"}
                    </span>
                  </div>*/}
                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-gray-400 shrink-0" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón "Ver más" */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          className="mt-4 md:mt-5 lg:mt-6 border border-black/50 flex justify-center items-center gap-1 md:gap-1.5 lg:gap-2 w-full text-black text-base md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-full cursor-pointer transition-colors bg-[#f9f9f9] hover:bg-gray-100"
        >
          Ver más órdenes
        </button>
      )}

      {/* Modal */}
      {selectedOrderDetails && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-xs z-999 flex items-center justify-center"
          onClick={() => {
            setSelectedOrderDetails(null);
          }}
        >
          <div
            className="bg-[#023828]/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] w-full mx-4 md:mx-12 lg:mx-28 rounded-4xl z-999 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="shrink-0">
              <div className="w-full flex justify-end">
                <button
                  onClick={() => {
                    setSelectedOrderDetails(null);
                  }}
                  className="p-2 md:p-3 lg:p-4 hover:bg-white/10 rounded-lg md:rounded-xl transition-colors justify-end flex items-end mt-3 md:mt-4 lg:mt-5 mr-3 md:mr-4 lg:mr-5"
                >
                  <X className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
                </button>
              </div>
              <div className="px-6 md:px-8 lg:px-10 flex items-center justify-center mb-4 md:mb-5 lg:mb-6">
                <div className="flex flex-col justify-center items-center gap-3 md:gap-4 lg:gap-5">
                  {selectedOrderDetails.restaurantLogo ? (
                    <img
                      src={selectedOrderDetails.restaurantLogo}
                      alt={selectedOrderDetails.restaurantName}
                      className="size-20 md:size-24 lg:size-28 object-cover rounded-lg md:rounded-xl"
                    />
                  ) : (
                    <div className="size-20 md:size-24 lg:size-28 bg-[#82E657]/20 rounded-lg md:rounded-xl flex items-center justify-center">
                      <span className="text-2xl md:text-3xl lg:text-4xl">
                        🍽️
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center">
                    <h2 className="text-xl md:text-2xl lg:text-3xl text-white font-bold">
                      {selectedOrderDetails.restaurantName}
                    </h2>
                    {selectedOrderDetails.orderType === "room-service" ? (
                      <p className="text-sm md:text-base lg:text-lg text-white/80">
                        Habitación {selectedOrderDetails.roomNumber}
                      </p>
                    ) : selectedOrderDetails.orderType !== "pick-and-go" ? (
                      <p className="text-sm md:text-base lg:text-lg text-white/80">
                        Mesa {selectedOrderDetails.tableNumber}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Order Info - Fixed */}
              <div className="px-6 md:px-8 lg:px-10 border-t border-white/20 pt-4 md:pt-5 lg:pt-6 pb-4 md:pb-5 lg:pb-6">
                <h3 className="font-medium text-xl md:text-2xl lg:text-3xl text-white mb-3 md:mb-4 lg:mb-5">
                  Tu orden
                </h3>
                <div className="space-y-2 md:space-y-3 lg:space-y-4">
                  <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                    <div className="bg-[#C3FEFF] p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-[#023828]" />
                    </div>
                    <span className="text-sm md:text-base lg:text-lg">
                      {new Date(selectedOrderDetails.tableOrderDate)
                        .toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })
                        .replace(/\//g, "/")}
                    </span>
                  </div>
                  {selectedOrderDetails.orderType === "room-service" ? (
                    <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                      <div className="bg-orange-100 p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                        <Utensils className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-orange-600" />
                      </div>
                      <span className="text-sm md:text-base lg:text-lg">
                        Habitación {selectedOrderDetails.roomNumber}
                      </span>
                    </div>
                  ) : selectedOrderDetails.orderType !== "pick-and-go" ? (
                    <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                      <div className="bg-orange-100 p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                        <Utensils className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-orange-600" />
                      </div>
                      <span className="text-sm md:text-base lg:text-lg">
                        Mesa {selectedOrderDetails.tableNumber}
                      </span>
                    </div>
                  ) : null}
                  {selectedOrderDetails.paymentCardBrand && (
                    <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                      <div className="bg-green-100 px-1 py-1.5 md:py-2 md:px-1.5 lg:py-2.5 lg:px-2 rounded-xl flex items-center justify-center">
                        {getCardTypeIcon(
                          selectedOrderDetails.paymentCardBrand,
                          "small",
                          32,
                          20,
                        )}
                      </div>
                      <span className="text-sm md:text-base lg:text-lg">
                        ****{" "}
                        {selectedOrderDetails.paymentCardLastFour.slice(-3)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de platillos - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 border-t border-white/20 pt-4 md:pt-5 lg:pt-6">
              <h3 className="font-medium text-xl md:text-2xl lg:text-3xl text-white mb-3 md:mb-4 lg:mb-5">
                Items de la orden
              </h3>
              <div className="space-y-3 md:space-y-4 lg:space-y-5 pb-4 md:pb-5 lg:pb-6">
                {selectedOrderDetails.dishes?.map((dish: any) => (
                  <div
                    key={dish.dishOrderId}
                    className="flex justify-between items-center gap-3 md:gap-4 lg:gap-5"
                  >
                    <div className="size-14 md:size-16 lg:size-20 bg-gray-300 rounded-sm md:rounded-md flex items-center justify-center hover:scale-105 transition-transform duration-200">
                      <img
                        src={dish.images[0]}
                        alt="Dish preview"
                        className="w-full h-full object-cover rounded-sm md:rounded-md"
                      />
                    </div>
                    {/* Dish Info */}
                    <div className="flex-1">
                      <p className="text-white font-medium text-base md:text-lg lg:text-xl capitalize">
                        {dish.quantity}x {dish.item}
                      </p>
                      <p className="text-xs md:text-sm lg:text-base text-white/60">
                        ${dish.price?.toFixed(2)} MXN c/u
                      </p>
                      {dish.extraPrice > 0 && (
                        <p className="text-xs md:text-sm lg:text-base text-white/60">
                          + Extras: ${dish.extraPrice?.toFixed(2)} MXN
                        </p>
                      )}
                      {/* Status Badge */}
                      {dish.status && (
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(dish.status)}`}
                        >
                          {getStatusText(dish.status)}
                        </span>
                      )}
                    </div>

                    {/* Total Price */}
                    <div className="text-right">
                      <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                        ${dish.totalPrice?.toFixed(2)} MXN
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary - Fixed */}
            <div className="shrink-0 px-6 md:px-8 lg:px-10 flex justify-between items-center border-t border-white/20 pt-4 md:pt-5 lg:pt-6 pb-6 md:pb-8 lg:pb-10">
              <span className="text-lg md:text-xl lg:text-2xl font-medium text-white">
                Total
              </span>
              <span className="text-lg md:text-xl lg:text-2xl font-medium text-white">
                ${selectedOrderDetails.totalAmount?.toFixed(2)} MXN
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
