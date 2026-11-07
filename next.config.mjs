import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
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

