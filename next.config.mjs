/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'export',
  basePath: '/shotclock',
  env: {
    // Dev server serves public/ under the basePath; production nginx serves out/ from root
    NEXT_PUBLIC_BASE_PATH: process.env.NODE_ENV === 'development' ? '/shotclock' : '',
  },
};

export default nextConfig;
