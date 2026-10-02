import test from 'node:test';
import assert from 'node:assert/strict';
import { adminUserFilterParams, adminUserMatchesStatus } from '../../app/lib/admin-user-filters.js';

test('pending company filter targets unverified, unblocked companies for list and export', () => {
 assert.deepEqual(adminUserFilterParams('unverified'), {p_role:'company',p_blocked:false,p_verified:false});
 assert.deepEqual(adminUserFilterParams('unverified','client'), {p_role:'company',p_blocked:false,p_verified:false});
 const rows=[
  {id:'new',role:'company',verified:false,blocked:false},
  {id:'known',role:'company',verified:true,blocked:false},
  {id:'blocked',role:'company',verified:false,blocked:true},
  {id:'client',role:'client',verified:false,blocked:false},
 ];
 assert.deepEqual(rows.filter(u=>adminUserMatchesStatus(u,'unverified')).map(u=>u.id),['new']);
});

test('existing user statuses keep their meaning', () => {
 assert.deepEqual(adminUserFilterParams('verified','company'), {p_role:'company',p_blocked:false,p_verified:true});
 assert.deepEqual(adminUserFilterParams('blocked'), {p_role:null,p_blocked:true,p_verified:null});
 assert.deepEqual(adminUserFilterParams(''), {p_role:null,p_blocked:null,p_verified:null});
 assert.equal(adminUserMatchesStatus({role:'client',verified:false,blocked:false},'active'),true);
 assert.equal(adminUserMatchesStatus({role:'company',verified:true,blocked:true},'verified'),false);
});
