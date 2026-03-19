/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMOVED output: 'export' to allow custom headers for iframe embedding
  trailingSlash: true,

  // Keep image optimization disabled for compatibility
  images: {
    unoptimized: true
  },

  // Ensure proper base path for deployment
  basePath: '',
  assetPrefix: '',

  // Allow iframe embedding - these headers now work with server-side rendering
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
    ]
  },

  experimental: {
    // None needed for this project
  }
}

module.exports = nextConfig