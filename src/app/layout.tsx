import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RestaurantProvider } from "@/context/RestaurantContext";
import { TableProvider } from "@/context/TableContext";
import { CartProvider } from "@/context/CartContext";
import { UserDataProvider } from "@/context/userDataContext";
import { GuestProvider } from "@/context/GuestContext";
import { PaymentProvider } from "@/context/PaymentContext";
import { PepperProvider } from "@/context/PepperContext";
import Script from "next/script";

const helveticaNeue = localFont({
  src: [
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueUltraLight.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueUltraLightItalic.otf",
      weight: "200",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueLight.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueLightItalic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueRoman.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueItalic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueMedium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueMediumItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueBoldItalic.otf",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueHeavy.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueHeavyItalic.otf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueBlack.otf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../../public/fonts/helvetica-neue/HelveticaNeueBlackItalic.otf",
      weight: "800",
      style: "italic",
    },
  ],
  variable: "--font-helvetica-neue",
});

export const metadata: Metadata = {
  title: "Even Tap Order & Pay",
  description: "Tu menú digital con un toque de NFC",
  icons: {
    icon: [
      {
        url: "/logos/logo-short-green.webp",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logos/logo-short-white.webp",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;
  void nonce;

  return (
    <html lang="es">
      <body
        className={`${helveticaNeue.variable} antialiased`}
        style={{ fontFamily: "var(--font-helvetica-neue)" }}
      >
        <Script
          src="https://ecartpay.com/sdk/pay.js"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <RestaurantProvider>
            <PepperProvider>
              <CartProvider>
                <TableProvider>
                  <GuestProvider>
                    <PaymentProvider>
                      <UserDataProvider>{children}</UserDataProvider>
                    </PaymentProvider>
                  </GuestProvider>
                </TableProvider>
              </CartProvider>
            </PepperProvider>
          </RestaurantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
