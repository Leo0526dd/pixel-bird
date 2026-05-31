/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  basePath: isGithubPages ? "/pixel-bird" : undefined,
  assetPrefix: isGithubPages ? "/pixel-bird/" : undefined,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
