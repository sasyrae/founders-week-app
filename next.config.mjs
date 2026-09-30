/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve speaker headshots straight from Supabase Storage. We intentionally
    // skip Vercel's image optimizer: on this plan its transform quota runs out
    // and it starts returning 402 (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED),
    // which shows up as broken images for any newly uploaded photo. The raw
    // Supabase public URL has no such limit. (To re-enable optimization later,
    // upgrade the Vercel plan and remove `unoptimized`.)
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
