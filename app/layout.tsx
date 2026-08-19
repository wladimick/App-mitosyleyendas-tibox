import type { Metadata } from "next";
import "./globals.css";
import "./tabs.css";

export const metadata: Metadata = {
  title: "Team Cornetas | Mitos y Leyendas",
  description: "Winrate, partidas y estadísticas del Team Cornetas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
