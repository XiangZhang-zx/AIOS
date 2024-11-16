/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,

    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'supabase.com',
            port: '',
            pathname: '**',
          },
        ],
    },

    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: '/api/:path*',
            },
        ];
    },
};

export default nextConfig;
