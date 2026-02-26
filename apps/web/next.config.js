/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@aiecon/types', '@aiecon/calculators'],
  async redirects() {
    return [
      { source: '/dashboard', destination: '/analytics', permanent: true },
      { source: '/dashboard/customers', destination: '/analytics/customers', permanent: true },
      { source: '/dashboard/optimizations', destination: '/analytics/optimizations', permanent: true },
      { source: '/dashboard/prompts', destination: '/prompts', permanent: true },
      { source: '/dashboard/prompts/managed', destination: '/prompts/managed', permanent: true },
      { source: '/dashboard/prompts/managed/:id', destination: '/prompts/managed/:id', permanent: true },
      { source: '/dashboard/prompts/managed/:id/ab-tests', destination: '/prompts/managed/:id/ab-tests', permanent: true },
      { source: '/dashboard/settings', destination: '/settings', permanent: true },
      { source: '/dashboard/onboarding', destination: '/settings/sdk', permanent: true },
    ];
  },
};

module.exports = nextConfig;
