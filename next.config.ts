import type { NextConfig } from "next";

/* Sur Vercel (env VERCEL définie automatiquement) : sortie standard.
   Ailleurs (sandbox/serveur local) : sortie "standalone" utilisée par
   les scripts build/start du projet. */
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
