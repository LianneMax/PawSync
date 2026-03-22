import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../'),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    devtoolSegmentExplorer: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${backendOrigin}/api/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${backendOrigin}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
