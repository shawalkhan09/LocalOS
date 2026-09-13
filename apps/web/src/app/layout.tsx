import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LocalOS",
  description: "Owner dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexSans.variable}`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
