import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../../app/components/market/EngagementPanels.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const context={exports:{},require:()=>({})};
vm.runInNewContext(source,context);
const {groupOfferNotifications}=context.exports;
const notice=(id,request_id,kind='offer_received',extra={})=>({id,request_id,kind,...extra});
test('offer groups retain latest position and all sender rows without mutating input',()=>{
 const items=[notice('a','r1'),notice('b','r2'),notice('c','r1'),notice('d','r1','offer_chosen')];
 const result=groupOfferNotifications(items);
 assert.deepEqual(Array.from(result.grouped,x=>x.id),['a','b','d']);
 assert.deepEqual(Array.from(result.groups.get('r1'),x=>x.id),['a','c']);
 assert.equal(items.length,4);
});
test('unknown request and deal notifications are never collapsed into request offers',()=>{
 const items=[notice('a',null),notice('b',null),notice('c','r1','offer_received',{deal_id:'deal'}),notice('d','r1')];
 assert.equal(groupOfferNotifications(items).grouped.length,4);
});
test('expanded group preserves each notification for reading and navigation',()=>{
 const items=[notice('a','r'),notice('b','r')];
 const result=groupOfferNotifications(items,true);
 assert.equal(result.grouped.length,2);
 assert.equal(result.groups.size,0);
});

test('deal notices use agreed totals and never the original offer while loading',()=>{
 const {notificationTerms}=context.exports;
 const offer={price:2800,deliveryDays:18};
 const deal={total_price:2400,delivery_days:12};
 assert.equal(notificationTerms({deal_id:'deal'},deal,offer).price,2400);
 assert.equal(notificationTerms({deal_id:'deal'},deal,offer).days,12);
 assert.equal(notificationTerms({deal_id:'deal'},undefined,offer).price,undefined);
 assert.equal(notificationTerms({deal_id:'deal'},null,offer).days,undefined);
 assert.equal(notificationTerms({},undefined,offer).price,2800);
});
test('report outcomes never expose an internal enum',()=>{
 const {reportResolutionLabel}=context.exports;
 assert.equal(reportResolutionLabel('rejected'),'უარყოფილია');
 assert.equal(reportResolutionLabel('hidden'),'დაკმაყოფილდა');
 assert.equal(reportResolutionLabel('future-enum'),'საჩივარი განხილულია');
});
