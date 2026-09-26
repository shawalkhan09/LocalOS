import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { getCatalog } from "@/lib/api";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LocalOS",
  description: "Owner dashboard",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let primaryColor: string | undefined;
  try {
    const config = await getCatalog();
    primaryColor = config?.business?.primaryColor;
  } catch {
    // Fall back to CSS default variable if server fetch fails
  }

  return (
    <html lang="en" style={primaryColor ? ({ "--color-accent": primaryColor } as React.CSSProperties) : undefined}>
      <body className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
