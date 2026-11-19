import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeAvailable} from '../src/lib/navigation.ts';
import {defaultConfig} from '../../../packages/config/src/defaults.ts';
test('hidden_tab_direct_route_is_inaccessible',()=>{
 const config={...defaultConfig,navigation:{...defaultConfig.navigation,tabs:defaultConfig.navigation.tabs.filter(t=>t.id!=='saved')}};
 assert.equal(routeAvailable('/saved',config),false);
 assert.equal(routeAvailable('/account',config),true);
});
test('disabled_comparison_route_is_inaccessible',()=>{
 assert.equal(routeAvailable('/compare',{...defaultConfig,features:{...defaultConfig.features,comparison:false}}),false);
});
