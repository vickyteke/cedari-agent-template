export function usesCedari() {
  // ARVIVA_MCP_URL is an explicit legacy override for rollback/local fixtures.
  // A configured Cedari endpoint or key always selects Cedari.
  return !!(process.env.CEDARI_MCP_URL || process.env.CEDARI_API_KEY) || !process.env.ARVIVA_MCP_URL;
}
export function mcpConnection() {
  return usesCedari()
    ? { endpoint: process.env.CEDARI_MCP_URL || "https://app.cedari.ai/mcp", credential: process.env.CEDARI_API_KEY }
    : { endpoint: process.env.ARVIVA_MCP_URL!, credential: process.env.MCP_INTERNAL_TOKEN };
}
