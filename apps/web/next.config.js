const { withSentryConfig } = require('@sentry/nextjs');

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

module.exports = withSentryConfig(nextConfig, {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (CI/CD)
  silent: !process.env.SENTRY_AUTH_TOKEN,
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
