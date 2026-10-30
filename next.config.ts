import type { NextConfig } from "next";
import path from "path";

const nextConfig: any = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    '192.168.1.12', 
    '192.168.1.12:3000', 
    '192.168.137.1', 
    '192.168.137.1:3000', 
    '192.168.1.9', 
    '192.168.1.9:3000', 
    'localhost:3000'
  ],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@supabase/supabase-js',
      'date-fns',
      'sonner',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
