"use client";

import { UserCircle2, LogIn } from "lucide-react";
import { useTableNavigation } from "@/hooks/useTableNavigation";
import MenuHeaderBack from "@/components/headers/MenuHeaderBack";

export default function AuthSelectionPage() {
  const { navigateWithTable } = useTableNavigation();

  const handleContinue = () => {
    sessionStorage.removeItem("authFromMenu");
    sessionStorage.setItem("authFromPaymentFlow", "true");
    navigateWithTable("/auth");
  };

  return (
    <div className="min-h-new brand-evergreen flex flex-col">
      <MenuHeaderBack />

      <div className="flex-1 flex flex-col items-center justify-center px-5 md:px-8 lg:px-10 pb-12 md:py-10 lg:py-12">
        <div className="w-full max-w-md">
          {/* Text */}
          <div className="mb-6 md:mb-8 lg:mb-10 text-center">
            <h1 className="text-white text-xl md:text-2xl lg:text-3xl font-medium mb-2 md:mb-3 lg:mb-4">
              ¿Cómo deseas continuar?
            </h1>
            <p className="text-white/80 text-sm md:text-base lg:text-lg">
              Elige una opción para proceder con tu pedido
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3 md:space-y-4 lg:space-y-5">
            {/* Sign In Option */}
            <button
              onClick={handleContinue}
              className="w-full bg-white hover:bg-gray-50 text-black py-4 md:py-5 lg:py-6 px-4 md:px-5 lg:px-6 rounded-xl md:rounded-2xl transition-all duration-200 flex items-center gap-3 md:gap-4 lg:gap-5 active:scale-95"
            >
              <div className="bg-[#82E657] p-2 md:p-2.5 lg:p-3 rounded-full group-hover:scale-110 transition-transform">
                <LogIn className="size-5 md:size-6 lg:size-7 text-[#023828]" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-base md:text-lg lg:text-xl font-medium mb-0.5 md:mb-1">
                  Iniciar sesión
                </h2>
                <p className="text-xs md:text-sm lg:text-base text-gray-600">
                  Accede a tu cuenta y disfruta beneficios
                </p>
              </div>
            </button>

            {/* Guest Option */}
            <button
              onClick={() => navigateWithTable("/user")}
              className="w-full bg-white/10 hover:bg-white/20 border-2 border-white text-white py-4 md:py-5 lg:py-6 px-4 md:px-5 lg:px-6 rounded-xl md:rounded-2xl transition-all duration-200 flex items-center gap-3 md:gap-4 lg:gap-5 group active:scale-95"
            >
              <div className="bg-white/20 p-2 md:p-2.5 lg:p-3 rounded-full group-hover:scale-110 transition-transform">
                <UserCircle2 className="size-5 md:size-6 lg:size-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-base md:text-lg lg:text-xl font-medium mb-0.5 md:mb-1">
                  Continuar como invitado
                </h2>
                <p className="text-xs md:text-sm lg:text-base text-white/80">
                  Procede sin crear una cuenta
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
