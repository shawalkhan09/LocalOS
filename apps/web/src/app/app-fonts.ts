import { Bricolage_Grotesque } from "next/font/google";

// Display face for the dashboard and login. Body font (Plus Jakarta Sans)
// is loaded once in the root layout as --font-plus-jakarta-sans.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage-app",
  display: "swap",
});
