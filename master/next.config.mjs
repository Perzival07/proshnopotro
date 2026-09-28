/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A logo upload (up to 1 MB) goes through a server action, whose default
  // limit is 1 MB for the whole form.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
