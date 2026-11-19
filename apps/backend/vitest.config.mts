import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{environment:'node',env:{CEDARI_MCP_URL:'https://cedari.example/mcp',CEDARI_API_KEY:'test-key',APP_URL:'https://agent.example',NEXT_PUBLIC_APP_URL:'https://agent.example'}}});
