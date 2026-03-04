/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@launchpromptly/types', '@launchpromptly/calculators'],
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
