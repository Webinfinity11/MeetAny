import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesDistribution as matches } from '../../app/lib/distribution-filter.js';
const c={company:'Supply',name:'Owner',about:'Delivery',offers:['Milk']},d={brands:['Acme'],categories:['food'],channels:['horeca','online'],warehouse:'own',transport:'contracted',coldChain:true};
test('distributor brands and combined catalog filters',()=>{
 assert(matches(c,d,{query:'acme milk',product:'food',channels:'horeca,online',warehouse:'1',cold:'1'}));
 for(const filter of [{query:'missing'},{product:'furniture'},{channels:'horeca,export'},{transport:'1'}])assert.equal(matches(c,d,filter),false);
 assert.equal(matches(c,undefined,{}),false);
});
