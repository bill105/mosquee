/* eslint-disable @next/next/no-page-custom-font -- Lien Google Fonts (Amiri, Plus Jakarta Sans, Inter) requis dans le <head> par le thème du site */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mosquée Hadja Yah Diakite — Apprendre l'Islam authentique",
  description:
    "Mosquée Hadja Yah Diakite (Bingerville). Des milliers de contenus à votre disposition : cours audio, conférences, prêches, podcasts, articles et vidéos.",
  icons: {
    icon: "https://i.ibb.co/bj08x4h6/Whats-App-Image-2026-08-11-at-16-23-01.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
