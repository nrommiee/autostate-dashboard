/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'woaxmqckupcgwsjbnlep.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
}

module.exports = nextConfig
