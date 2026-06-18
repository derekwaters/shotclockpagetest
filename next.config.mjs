/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'export',
  basePath: '/shotclock',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/shotclock',
  },
};

export default nextConfig;
