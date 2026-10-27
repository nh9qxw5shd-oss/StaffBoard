import type { NextConfig } from "next";

// The Duty Board is mounted under /duty on the Derby Control hub (PotatOS), which proxies /duty/*
// to this deployment. basePath keeps every route and asset under that prefix on
// bob.derbycontrol.co.uk too; the bare hostname (where the original board lived) and the old
// bridge address redirect onto it.
const BASE_PATH = "/duty";

// Overseer is the only way in (PotatOS docs/09 §4.6). The hub marks every request it forwards with
// x-overseer-hop; a page load without the marker (a bookmark or link to this hostname) goes to the same
// address on Overseer, which signs the person in and frames this page. Scripts, data, API calls and
// the storage bridge are untouched. The marker routes people; it is not a secret.
const VIA_OVERSEER = {
  source: "/:path((?!.*storage-bridge).*)",
  has: [{ type: "header" as const, key: "sec-fetch-dest", value: "(document|iframe)" }],
  missing: [{ type: "header" as const, key: "x-overseer-hop", value: "overseer" }],
  destination: "https://overseer.derbycontrol.co.uk/:path",
  basePath: false as const,
  permanent: false,
};

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
      VIA_OVERSEER,
    ];
  },
};

export default nextConfig;
