import { agentConfig } from '../../../config/agent.ts';
export { defineAgentConfig, availableTabs, storageNamespace } from './schema.ts';
export type * from './schema.ts';
export { agentConfig };
export const theme = agentConfig.theme;
export { t, messages } from './copy.ts';
