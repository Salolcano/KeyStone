import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--serif" });
const sans = Inter({ subsets: ["latin"], variable: "--sans" });
export const metadata = { title: "Keystone Deposits", description: "Rental deposits held in escrow and settled by GenLayer validators." };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${serif.variable} ${sans.variable}`}><body>{children}</body></html>;
}
