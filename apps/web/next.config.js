/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@launchpromptly/types', '@launchpromptly/calculators'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/settings', destination: '/admin/sdk', permanent: true },
      { source: '/dashboard/onboarding', destination: '/admin/sdk', permanent: true },
      { source: '/settings', destination: '/admin/sdk', permanent: true },
      { source: '/settings/:path*', destination: '/admin/sdk', permanent: true },
      { source: '/analytics', destination: '/admin/security', permanent: true },
      { source: '/analytics/:path*', destination: '/admin/security', permanent: true },
      { source: '/observability', destination: '/admin/security', permanent: true },
      { source: '/observability/:path*', destination: '/admin/security', permanent: true },
      { source: '/prompts', destination: '/', permanent: true },
      { source: '/prompts/:path*', destination: '/', permanent: true },
    ];
  },
};

// Only apply Sentry wrapper when auth token is available (CI/CD with source maps)
if (process.env.SENTRY_AUTH_TOKEN) {
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(nextConfig, { silent: false });
} else {
  module.exports = nextConfig;
}
