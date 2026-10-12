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

test('verification document statuses filter unverified companies by their documents', () => {
 assert.deepEqual(adminUserFilterParams('pending'), {p_role:'company',p_blocked:false,p_verified:false,p_doc_status:'pending'});
 assert.deepEqual(adminUserFilterParams('returned'), {p_role:'company',p_blocked:false,p_verified:false,p_doc_status:'rejected'});
 assert.deepEqual(adminUserFilterParams('no_documents'), {p_role:'company',p_blocked:false,p_verified:false,p_doc_status:'not_submitted'});
 const rows=[
  {id:'sent',role:'company',verified:false,blocked:false,verification_documents_status:'pending'},
  {id:'none',role:'company',verified:false,blocked:false},
  {id:'done',role:'company',verified:true,blocked:false,verification_documents_status:'approved'},
 ];
 assert.deepEqual(rows.filter(u=>adminUserMatchesStatus(u,'pending')).map(u=>u.id),['sent']);
 assert.deepEqual(rows.filter(u=>adminUserMatchesStatus(u,'no_documents')).map(u=>u.id),['none']);
});

test('existing user statuses keep their meaning', () => {
 assert.deepEqual(adminUserFilterParams('verified','company'), {p_role:'company',p_blocked:false,p_verified:true});
 assert.deepEqual(adminUserFilterParams('blocked'), {p_role:null,p_blocked:true,p_verified:null});
 assert.deepEqual(adminUserFilterParams(''), {p_role:null,p_blocked:null,p_verified:null});
 assert.equal(adminUserMatchesStatus({role:'client',verified:false,blocked:false},'active'),true);
 assert.equal(adminUserMatchesStatus({role:'company',verified:true,blocked:true},'verified'),false);
});
