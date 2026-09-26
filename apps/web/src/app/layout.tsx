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

// Calculate relative luminance per WCAG formula
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Compute accessible foreground color (white or dark) for a given accent color
// Returns whichever foreground meets 4.5:1 contrast, or the better of the two
function getAccessibleForeground(accentHex: string): string {
  const accentL = getLuminance(accentHex);
  const whiteL = 1.0;
  const darkL = getLuminance("#0B0F1A");

  const whiteContrast = (Math.max(whiteL, accentL) + 0.05) / (Math.min(whiteL, accentL) + 0.05);
  const darkContrast = (Math.max(darkL, accentL) + 0.05) / (Math.min(darkL, accentL) + 0.05);

  // Prefer white if it meets WCAG AA (4.5:1)
  if (whiteContrast >= 4.5) return "#FFFFFF";
  // Fall back to dark if white doesn't work
  return "#0B0F1A";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let primaryColor: string | undefined;
  let accentForeground: string | undefined;

  try {
    const config = await getCatalog();
    primaryColor = config?.business?.primaryColor;
    if (primaryColor) {
      accentForeground = getAccessibleForeground(primaryColor);
    }
  } catch {
    // Fall back to CSS default variables if server fetch fails
  }

  const htmlStyle = primaryColor
    ? ({
        "--color-accent": primaryColor,
        "--color-accent-foreground": accentForeground,
      } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" style={htmlStyle}>
      <body className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
