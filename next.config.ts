import type { NextConfig } from "next";

// The Duty Board is mounted under /duty on the Derby Control hub (PotatOS), which proxies /duty/*
// to this deployment. basePath keeps every route and asset under that prefix on
// bob.derbycontrol.co.uk too; the bare hostname (where the original board lived) and the old
// bridge address redirect onto it.
const BASE_PATH = "/duty";

const nextConfig: NextConfig = {
  agentRules: false,
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  async redirects() {
    const temp = { basePath: false as const, permanent: false };
    return [
      { source: "/", destination: BASE_PATH, ...temp },
      { source: "/index.html", destination: BASE_PATH, ...temp },
      { source: "/storage-bridge.html", destination: `${BASE_PATH}/storage-bridge.html`, ...temp },
    ];
  },
};

export default nextConfig;
