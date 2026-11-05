import type { Metadata, Viewport } from "next";
import "@fontsource/heebo/hebrew-400.css";
import "@fontsource/heebo/hebrew-500.css";
import "@fontsource/heebo/hebrew-600.css";
import "@fontsource/heebo/hebrew-700.css";
import "@fontsource/heebo/hebrew-800.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "עגלה לשניים · קניות עם אהבה",
  description: "הרשימה שלנו, הקניות שלנו, ביחד.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "עגלה לשניים",
    statusBarStyle: "default",
  },
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon-192.png`,
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf4",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
