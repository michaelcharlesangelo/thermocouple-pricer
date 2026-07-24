import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thermocouple R/S/B Price Calculator",
  description: "R/S/B noble metal thermocouple cost calculator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
