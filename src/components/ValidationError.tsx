import { Home } from "lucide-react";
import { useRouter } from "next/navigation";

interface ValidationErrorProps {
  errorType:
    | "RESTAURANT_NOT_FOUND"
    | "BRANCH_NOT_FOUND"
    | "TABLE_NOT_FOUND"
    | "NO_BRANCHES"
    | "SERVICE_NOT_AVAILABLE"
    | "VALIDATION_ERROR";
}

export default function ValidationError({ errorType }: ValidationErrorProps) {
  const router = useRouter();

  const errorMessages = {
    RESTAURANT_NOT_FOUND: {
      title: "Restaurante no encontrado",
      description: "Este restaurante no está disponible",
      detail: "Por favor verifica el código QR",
    },
    BRANCH_NOT_FOUND: {
      title: "Sucursal no encontrada",
      description: "Esta sucursal no existe",
      detail: "Por favor verifica el código QR de tu mesa",
    },
    TABLE_NOT_FOUND: {
      title: "Mesa no encontrada",
      description: "El número de mesa no es válido",
      detail: "Por favor escanea el código QR de tu mesa",
    },
    NO_BRANCHES: {
      title: "Sin sucursales disponibles",
      description: "Este restaurante no tiene sucursales activas",
      detail: "Por favor contacta al restaurante",
    },
    SERVICE_NOT_AVAILABLE: {
      title: "Servicio no disponible",
      description:
        "Este restaurante no tiene habilitado el servicio Tap Order & Pay",
      detail: "Por favor contacta al restaurante para más información",
    },
    VALIDATION_ERROR: {
      title: "Error de validación",
      description: "No pudimos validar tu información",
      detail: "Por favor intenta nuevamente",
    },
  };

  const errorInfo = errorMessages[errorType];

  return (
    <div className="min-h-new brand-evergreen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 md:px-8 lg:px-10 pb-12 md:py-10 lg:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 md:mb-8 lg:mb-10 text-center">
            <img
              src="/brand/even-asterisk-grass.svg"
              alt="Even"
              className="size-24 md:size-28 lg:size-32 mx-auto mb-6 md:mb-8"
            />
            <h1 className="text-white text-xl md:text-2xl lg:text-3xl font-medium mb-2 md:mb-3 lg:mb-4">
              {errorInfo.title}
            </h1>
            <p className="text-white/80 text-sm md:text-base lg:text-lg mb-2">
              {errorInfo.description}
            </p>
            <p className="text-white/60 text-xs md:text-sm lg:text-base">
              {errorInfo.detail}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3 md:space-y-4 lg:space-y-5">
            {/* Go Home Option */}
            <button
              onClick={() => router.push("/")}
              className="w-full bg-white hover:bg-gray-50 text-black py-4 md:py-5 lg:py-6 px-4 md:px-5 lg:px-6 rounded-xl md:rounded-2xl transition-all duration-200 flex items-center gap-3 md:gap-4 lg:gap-5 active:scale-95"
            >
              <div className="bg-[#82E657] p-2 md:p-2.5 lg:p-3 rounded-full group-hover:scale-110 transition-transform">
                <Home className="size-5 md:size-6 lg:size-7 text-[#023828]" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-base md:text-lg lg:text-xl font-medium mb-0.5 md:mb-1">
                  Volver al inicio
                </h2>
                <p className="text-xs md:text-sm lg:text-base text-gray-600">
                  Regresar a la página principal
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
