/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't auto-redirect /api/foo/ → /api/foo. FastAPI's routes are registered
  // WITH trailing slashes, so the redirect would push the browser back to
  // FastAPI's own redirect (Location: http://backend:8000/...) which the
  // browser can't resolve. Keep the slash, no redirect, no broken proxy.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Proxy all /api/* calls through Next.js to the backend.
    // This avoids cross-origin cookie issues when accessing from phones/other devices.
    // Inside Docker the backend is reachable at http://backend:8000.
    // In local dev it falls back to localhost:8000.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
}
module.exports = nextConfig
