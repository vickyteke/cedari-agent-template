import {it,expect} from 'vitest';
import {originAllowed} from '../src/lib/policy/origins';
import {emailConfigured} from '../src/lib/email/service';
import {agentConfig} from '../../../packages/config/src/public';
it('foreign_origin_is_rejected_before_work',()=>{
 expect(originAllowed('https://foreign.example','https://agent.example')).toBe(false);
 expect(originAllowed('https://agent.example','https://agent.example')).toBe(true);
 expect(originAllowed(null,'https://agent.example')).toBe(true);
});
it('disabled_email_sends_no_jobs',()=>{
 const prev=agentConfig.features.email;agentConfig.features.email=false;
 expect(emailConfigured()).toBe(false);agentConfig.features.email=prev;
});
