import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence workspace-root warning when parent directory has a lockfile
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Dev-only: allow cross-origin requests from LAN devices and Cloudflare Tunnel
  ...(process.env.NODE_ENV !== "production" && {
    allowedDevOrigins: [
      "localhost",
      "127.0.0.1",
      "192.168.84.204",
      "wright-love-hat-decided.trycloudflare.com",
    ],
  }),
};

export default nextConfig;
