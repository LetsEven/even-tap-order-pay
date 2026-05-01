"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Phone, User, ChevronDown } from "lucide-react";
import Flag from "react-world-flags";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/context/AuthContext";

type Step = "phone" | "verify" | "profile";

interface Country {
  code: string;
  flag: string;
  name: string;
}

const countries: Country[] = [
  { code: "+52", flag: "MX", name: "México" },
  { code: "+1", flag: "US", name: "Estados Unidos" },
  { code: "+34", flag: "ES", name: "España" },
  { code: "+54", flag: "AR", name: "Argentina" },
  { code: "+57", flag: "CO", name: "Colombia" },
  { code: "+58", flag: "VE", name: "Venezuela" },
];

// Pure functions — defined outside to avoid re-creation on every render
function formatPhoneNumber(phoneNumber: string) {
  if (!phoneNumber) return "";
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length > 10) {
    const cc = cleaned.slice(0, cleaned.length - 10);
    const areaCode = cleaned.slice(-10, -7);
    const firstPart = cleaned.slice(-7, -4);
    const lastPart = cleaned.slice(-4);
    return `+${cc} (${areaCode}) ${firstPart}-${lastPart}`;
  }
  return phoneNumber;
}

function formatPhoneInput(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  if (cleaned.length <= 10)
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
}

interface AuthViewProps {
  onClose: () => void;
}

export default function AuthView({ onClose }: AuthViewProps) {
  const {
    verifyOTP,
    createOrUpdateProfile: updateProfile,
    refreshProfile,
  } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+52");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberDisplay, setPhoneNumberDisplay] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".country-selector")) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fullPhone = countryCode + phoneNumber;
      setPhone(fullPhone);
      const response = await authService.sendOTPCode(fullPhone);
      if (response.success) {
        setStep("verify");
        setCountdown(60);
      } else {
        setError(response.error || "Error al enviar el código");
      }
    } catch {
      setError("Error al enviar el código OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (otp.length !== 6) {
      setError("El código debe tener 6 dígitos");
      setLoading(false);
      return;
    }
    try {
      const response = await verifyOTP(phone, otp);
      if (response.success) {
        const profileResponse = await authService.getMyProfile();
        if (profileResponse.success && profileResponse.data) {
          const responseData = profileResponse.data as any;
          const profile =
            responseData.data?.profile ||
            responseData.profile ||
            responseData.data ||
            responseData;
          if (profile.firstName) {
            await refreshProfile();
            onClose();
          } else {
            setStep("profile");
          }
        } else {
          setStep("profile");
        }
      } else {
        setError(response.error || "Código inválido");
      }
    } catch {
      setError("Error al verificar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const response = await authService.sendOTPCode(phone);
      if (response.success) {
        setCountdown(60);
      } else {
        setError(response.error || "Error al reenviar el código");
      }
    } catch {
      setError("Error al reenviar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await updateProfile({
        firstName,
        lastName,
        birthDate,
        gender: gender as "male" | "female" | "other",
      });
      if (response.success) {
        await refreshProfile();
        onClose();
      } else {
        setError(response.error || "Error al guardar el perfil");
      }
    } catch {
      setError("Error al guardar el perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col justify-center items-center px-4 py-8 relative overflow-y-auto">
      {/* Back Button */}
      <button
        onClick={() => {
          if (step === "verify") {
            setStep("phone");
            setOtp("");
            setError("");
          } else if (step === "profile") {
            return;
          } else {
            onClose();
          }
        }}
        disabled={step === "profile"}
        className={`absolute top-4 left-4 p-2 text-white rounded-full transition-all active:bg-white/10 z-20 ${
          step === "profile"
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white/10"
        }`}
      >
        <ArrowLeft className="size-5 md:size-6" />
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/logos/logo-short-green.webp"
            alt="Xquisito Logo"
            className="size-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-medium text-white">
            {step === "phone"
              ? "Ingresa tu número"
              : step === "verify"
                ? "Verifica tu código"
                : "Completa tu perfil"}
          </h1>
          <p className="text-gray-200 mt-2 text-sm">
            {step === "phone"
              ? "Te enviaremos un código de verificación"
              : step === "verify"
                ? `Enviamos un código al ${formatPhoneNumber(phone)}`
                : "Cuéntanos un poco más sobre ti"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-white text-sm">
            {error}
          </div>
        )}

        {/* Phone Step */}
        {step === "phone" && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="relative country-selector">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="h-[48px] w-[90px] px-3 text-gray-700 font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] cursor-pointer hover:border-gray-400 transition-colors flex items-center justify-between gap-1.5"
                    disabled={loading}
                  >
                    <div className="flex items-center gap-1.5">
                      <Flag
                        code={
                          countries.find((c) => c.code === countryCode)?.flag ||
                          "MX"
                        }
                        style={{ width: 20, height: 15, borderRadius: 2 }}
                      />
                      <span className="text-sm">{countryCode}</span>
                    </div>
                    <ChevronDown className="size-3 text-gray-500 shrink-0" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 overflow-hidden">
                      {countries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setCountryCode(country.code);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 transition-colors text-left"
                        >
                          <Flag
                            code={country.flag}
                            style={{ width: 20, height: 15, borderRadius: 2 }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {country.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                  <input
                    required
                    type="tel"
                    value={phoneNumberDisplay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setPhoneNumber(value);
                      setPhoneNumberDisplay(formatPhoneInput(value));
                    }}
                    className="h-[48px] w-full pl-10 pr-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b]"
                    placeholder="Número de teléfono"
                    disabled={loading}
                    maxLength={14}
                  />
                </div>
              </div>
              <p className="text-gray-300 text-xs">
                Ejemplo:{" "}
                {countryCode === "+52" || countryCode === "+1"
                  ? "500 555 0006"
                  : "123 456 789"}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !phoneNumber || phoneNumber.length < 8}
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        )}

        {/* OTP Step */}
        {step === "verify" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-3 py-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] text-center tracking-widest text-2xl"
              required
              disabled={loading}
              autoFocus
              autoComplete="one-time-code"
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verificando..." : "Verificar código"}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={countdown > 0 || loading}
                className={`text-sm underline transition-colors ${
                  countdown > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-white hover:text-gray-200 cursor-pointer"
                }`}
              >
                {countdown > 0
                  ? `Reenviar código en ${countdown}s`
                  : "¿No recibiste el código? Reenviar"}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="text-sm text-white hover:text-gray-200 underline"
              >
                Cambiar número
              </button>
            </div>
          </form>
        )}

        {/* Profile Step */}
        {step === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nombre"
                  className="h-[48px] w-full pl-10 pr-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b]"
                  required
                  disabled={loading}
                />
              </div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b]"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b]"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Género
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] cursor-pointer"
                disabled={loading}
                required
              >
                <option value="">Selecciona...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={
                loading || !firstName || !lastName || !birthDate || !gender
              }
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Guardando..." : "Continuar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
