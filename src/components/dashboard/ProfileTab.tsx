"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { User, Camera, Loader2, Phone, X, LogOut, LogIn } from "lucide-react";
import { authService } from "@/services/auth.service";
import { useTableNavigation } from "@/hooks/useTableNavigation";

interface ProfileTabProps {
  onLogout?: () => void;
}

export default function ProfileTab({ onLogout }: ProfileTabProps = {}) {
  const { navigateWithTable } = useTableNavigation();
  const { profile, isLoading, logout: contextLogout } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Formatear número de teléfono
  const formatPhoneNumber = (phoneNumber: any) => {
    if (!phoneNumber) return "";

    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // Código de país (ej: +52)
    if (cleaned.length > 10) {
      const countryCode = cleaned.slice(0, cleaned.length - 10);
      const areaCode = cleaned.slice(-10, -7);
      const firstPart = cleaned.slice(-7, -4);
      const lastPart = cleaned.slice(-4);
      return `+${countryCode} ${areaCode} ${firstPart} ${lastPart}`;
    }

    return phoneNumber;
  };

  // Load profile data from AuthContext
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoadingData(true);

      const currentUser = authService.getCurrentUser();

      if (!currentUser) {
        setIsAuthenticated(false);
        setIsLoadingData(false);
        return;
      }

      setIsAuthenticated(true);

      try {
        const response = await authService.getMyProfile();
        console.log("📊 getMyProfile response:", response);

        // El backend puede devolver data.data.profile o data.profile
        const responseData = (response as any).data;
        const profileData =
          responseData?.data?.profile || responseData?.profile;

        if (response.success && profileData) {
          console.log("✅ Profile data loaded:", profileData);
          setFirstName(profileData.firstName || "");
          setLastName(profileData.lastName || "");
          setPhone(profileData.phone || "");
          setBirthDate(profileData.birthDate || "");
          setGender(profileData.gender || "");
          setPhotoUrl(profileData.photoUrl || "");
        } else {
          console.warn("⚠️ No profile data in response:", response);
        }
      } catch (error) {
        console.error("❌ Error loading user data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadUserData();
  }, []);

  const handleUpdateProfile = async () => {
    if (!isAuthenticated) return;

    setIsUpdating(true);
    try {
      const response = await authService.updateMyProfile({
        firstName,
        lastName,
        birthDate: birthDate || undefined,
        gender: gender as "male" | "female" | "other" | undefined,
      });

      if (response.success) {
        alert("Perfil actualizado correctamente");
      } else {
        throw new Error(response.error || "Error al actualizar");
      }
    } catch (error) {
      console.error("Error al actualizar el perfil:", error);
      alert("Error al actualizar el perfil");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated || !e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    // Validar tamaño (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5MB");
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten archivos de imagen");
      return;
    }

    setIsUpdating(true);

    try {
      const token = localStorage.getItem("xquisito_access_token");
      if (!token) {
        alert("No estás autenticado");
        return;
      }

      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/profiles/upload-photo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (data.success && data.data?.photoUrl) {
        setPhotoUrl(data.data.photoUrl);
        alert("Foto de perfil actualizada correctamente");
      } else {
        throw new Error(data.error || "Error al subir la foto");
      }
    } catch (error) {
      console.error("Error al actualizar la foto:", error);
      alert("Error al actualizar la foto");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await contextLogout();
      setIsLogoutModalOpen(false);
      if (onLogout) {
        onLogout();
      } else {
        navigateWithTable("/menu");
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión");
    }
  };

  if (isLoading || !profile || isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12 md:py-16 lg:py-20">
        <Loader2 className="size-8 md:size-10 lg:size-12 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Profile Image */}
      <div className="flex flex-col items-center">
        <div className="relative group mb-4">
          <div className="size-28 md:size-32 lg:size-36 rounded-full bg-gray-200 overflow-hidden border-2 md:border-4 border-teal-600 flex items-center justify-center">
            {isAuthenticated && photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div>
                <img
                  src="/logos/pp_default.jpg"
                  alt="Profile Pic"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          {isAuthenticated && (
            <label
              htmlFor="profile-image"
              className="absolute bottom-0 right-0 bg-teal-600 text-white p-2 md:p-2.5 lg:p-3 rounded-full cursor-pointer hover:bg-teal-700 transition-colors"
            >
              <Camera className="size-4 md:size-5 lg:size-6" />
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUpdating}
              />
            </label>
          )}
        </div>
      </div>

      {/* Email or Phone */}
      <div className="space-y-2 mb-4 md:mb-5 lg:mb-6">
        <label className="gap-1.5 md:gap-2 flex items-center text-sm md:text-base lg:text-lg text-gray-700">
          <Phone className="size-3.5 md:size-4 lg:size-5" />
          Teléfono
        </label>
        <div className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 text-base md:text-lg lg:text-xl">
          {formatPhoneNumber(profile.phone) || "No disponible"}
        </div>
      </div>

      <div className="flex gap-3 md:gap-4 lg:gap-5 mb-4 md:mb-5 lg:mb-6">
        {/* Nombre */}
        <div className="space-y-2 flex-1">
          <label className="gap-1.5 md:gap-2 flex items-center text-sm md:text-base lg:text-lg text-gray-700">
            <User className="size-3.5 md:size-4 lg:size-5" />
            Nombre
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black text-base md:text-lg lg:text-xl border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isUpdating || !isAuthenticated}
          />
        </div>

        {/* Apellido */}
        <div className="space-y-2 flex-1">
          <label className="gap-1.5 md:gap-2 flex items-center text-sm md:text-base lg:text-lg text-gray-700">
            <User className="size-3.5 md:size-4 lg:size-5" />
            Apellido
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Tu apellido"
            className="w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black text-base md:text-lg lg:text-xl border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isUpdating || !isAuthenticated}
          />
        </div>
      </div>

      <div className="flex gap-2 md:gap-4 lg:gap-5 mb-6 md:mb-8 lg:mb-10">
        {/* Fecha de nacimiento */}
        <div className="space-y-2 flex-1 min-w-0">
          <label className="gap-1.5 md:gap-2 flex items-center text-sm md:text-base lg:text-lg text-gray-700">
            Fecha de nacimiento
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            placeholder="dd/mm/aaaa"
            className="cursor-pointer w-full px-2 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black text-base md:text-lg lg:text-xl border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:cursor-pointer appearance-none bg-white"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "textfield",
            }}
            disabled={isUpdating || !isAuthenticated}
            lang="es-MX"
          />
        </div>

        {/* Genero */}
        <div className="space-y-2 flex-1 min-w-0">
          <label className="gap-1.5 md:gap-2 flex items-center text-sm md:text-base lg:text-lg text-gray-700">
            Género
          </label>
          <div className="relative">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="cursor-pointer w-full px-2 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black text-base md:text-lg lg:text-xl border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none bg-white pr-10"
              style={{
                WebkitAppearance: "none",
                MozAppearance: "none",
              }}
              disabled={isUpdating || !isAuthenticated}
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
            {/* Custom dropdown arrow */}
            <div className="pointer-events-none absolute inset-y-0 right-2 md:right-5 lg:right-6 flex items-center">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Logout/Login */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className={`font-medium text-sm md:text-base lg:text-lg flex items-center gap-2 cursor-pointer ${
            isAuthenticated
              ? "text-red-600 hover:text-red-700"
              : "text-teal-600 hover:text-teal-700"
          }`}
        >
          {isAuthenticated ? (
            <>
              <LogOut className="size-4 md:size-5 lg:size-6" />
              Cerrar sesión
            </>
          ) : (
            <>
              <LogIn className="size-4 md:size-5 lg:size-6" />
              Iniciar sesión
            </>
          )}
        </button>
      </div>

      {/* Update Button */}
      {isAuthenticated && (
        <button
          onClick={handleUpdateProfile}
          disabled={isUpdating}
          className="mt-6 md:mt-8 lg:mt-10 bg-black hover:bg-stone-950 w-full text-white py-3 md:py-4 lg:py-5 text-base md:text-lg lg:text-xl rounded-full cursor-pointer transition-colors disabled:bg-stone-600 disabled:cursor-not-allowed"
        >
          {isUpdating ? (
            <div className="flex items-center justify-center gap-1 md:gap-2">
              <Loader2 className="size-5 md:size-6 lg:size-7 animate-spin" />
              Actualizando...
            </div>
          ) : (
            "Guardar cambios"
          )}
        </button>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999 }}
        >
          {/* Fondo */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsLogoutModalOpen(false)}
          ></div>

          <div className="relative bg-white rounded-t-4xl w-full mx-4 p-6 md:p-7 lg:p-8">
            {/* Close Button */}
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute top-4 md:top-5 lg:top-6 right-4 md:right-5 lg:right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5 md:size-6 lg:size-7" />
            </button>

            {/* Modal Title */}
            <h3 className="text-base md:text-xl lg:text-2xl font-semibold text-gray-800 mb-4 md:mb-5">
              Cerrar sesión
            </h3>

            {/* Confirmation Message */}
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8">
              ¿Estás seguro de que deseas cerrar sesión?
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 md:gap-4">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 md:py-3 text-base md:text-lg rounded-full cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 md:py-3 text-base md:text-lg rounded-full cursor-pointer transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
