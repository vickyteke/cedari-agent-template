import { defaultConfig } from '../packages/config/src/defaults.ts';
import { defineAgentConfig } from '../packages/config/src/schema.ts';
// Edit this file to brand and scope your agent. Never put credentials here.
export const agentConfig = defineAgentConfig(defaultConfig);
