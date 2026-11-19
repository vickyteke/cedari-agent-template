import { agentConfig } from '../packages/config/src/public.ts';
import { loadServerConfig } from '../packages/config/src/server.ts';
let failed=false;
try {
 loadServerConfig(process.env);
 if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY is required for conversational shopping');
 if(agentConfig.features.roomPreviews && process.env.ROOM_PREVIEW_ENABLED!=='true')throw Error('ROOM_PREVIEW_ENABLED must be true for configured preview workflows');
 if(agentConfig.features.email)for(const key of ['MAILGUN_API_KEY','MAILGUN_DOMAIN','MAILGUN_FROM','MAILGUN_WEBHOOK_SIGNING_KEY','EMAIL_POSTAL_ADDRESS','EMAIL_TOKEN_SECRET','CRON_SECRET'])if(!process.env[key])throw Error(key+' is required for email');
 if(agentConfig.features.analytics && !process.env.EXPO_PUBLIC_POSTHOG_KEY)throw Error('EXPO_PUBLIC_POSTHOG_KEY is required for analytics');
 console.log('Configuration prerequisites are present for '+agentConfig.id+'. Run the documented database and connectivity checks before deployment.');
}catch(e){failed=true;console.error(e.message);}
process.exitCode=failed?1:0;
