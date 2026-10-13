-- Run only through run.sh: fixtures and all mutations live in its disposable database.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

-- Exercise the actual chunked RPCs as the current caller, including maximum-size files.
create function t.fc_file(kind text, target uuid, mime text default 'application/pdf',
                         bytes bytea default convert_to('%PDF-test', 'UTF8'), slot text default '')
returns uuid language plpgsql as $$
declare upload uuid; result jsonb; pos integer:=0; n integer:=octet_length(bytes);
begin
  upload:=public.begin_file_upload(kind,target,'test-file',mime,n,slot);
  while pos<n loop
    perform public.append_file_chunk(upload,pos,substring(bytes from pos+1 for least(1048576,n-pos)));
    pos:=pos+least(1048576,n-pos);
  end loop;
  result:=public.finish_file_upload(upload);
  return (result->>'id')::uuid;
end $$;
create function t.fc_revision() returns integer language sql as $$
  select (public.get_deal(t.get('fc_deal'))->>'revision')::integer $$;
create function t.fc_proposal(id uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements(public.get_deal(t.get('fc_deal'))->'proposals') x where x->>'id'=$1::text $$;
create table t.fc_snapshot(k text primary key, n bigint not null);
grant select,insert,update on t.fc_snapshot to public;
grant execute on function t.fc_file(text,uuid,text,bytea,text),t.fc_revision(),t.fc_proposal(uuid) to public;

select t.signup('fc_b','fc-b@test.ge','{"role":"client","name":"Completion Buyer","company":"Buyer Ltd","phone":"599882001","city":"tbilisi"}');
select t.signup('fc_s','fc-s@test.ge','{"role":"company","name":"Completion Seller","company":"Seller Ltd","phone":"599882002","city":"tbilisi","industry":"other"}');
select t.signup('fc_x','fc-x@test.ge','{"role":"company","name":"Completion Outsider","company":"Outsider Ltd","phone":"599882003","city":"batumi","industry":"other"}');
select t.signup('fc_c','fc-c@test.ge','{"role":"client","name":"Completion Client","company":"Client Ltd","phone":"599882004","city":"batumi"}');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id=t.uid('fc_s');
select t.put('fc_draft',gen_random_uuid());
select t.put('fc_limit_draft',gen_random_uuid());

-- Chunk bounds, ordering, retry safety, completion and binary signature validation.
select t.as_user('fc_b');
select t.throws($q$select public.begin_file_upload('request_draft',t.get('fc_draft'),'bad','text/plain',9)$q$,'MA902','FC unsupported file type rejected');
select t.throws($q$select public.begin_file_upload('request_draft',t.get('fc_draft'),'bad','application/pdf',0)$q$,'MA902','FC zero size rejected');
select t.throws($q$select public.begin_file_upload('request_draft',t.get('fc_draft'),'bad','application/pdf',10485761)$q$,'MA902','FC file above 10 MiB rejected');
select t.throws($q$select public.begin_file_upload('request_draft',t.get('fc_draft'),E'bad\nname','application/pdf',9)$q$,'MA902','FC control characters in filename rejected');
select t.put('fc_upload',public.begin_file_upload('request_draft',t.get('fc_draft'),'chunked.pdf','application/pdf',9));
select t.ok(public.append_file_chunk(t.get('fc_upload'),0,convert_to('%PDF-','UTF8'))=5,'FC first chunk returns exact offset');
select t.ok(public.append_file_chunk(t.get('fc_upload'),0,convert_to('%PDF-','UTF8'))=5,'FC repeated chunk does not duplicate bytes');
select t.throws($q$select public.append_file_chunk(t.get('fc_upload'),0,convert_to('wrong','UTF8'))$q$,'MA904','FC conflicting retry rejected');
select t.throws($q$select public.append_file_chunk(t.get('fc_upload'),6,convert_to('x','UTF8'))$q$,'MA904','FC noncontiguous chunk rejected');
select t.throws($q$select public.append_file_chunk(t.get('fc_upload'),5,convert_to('12345','UTF8'))$q$,'MA902','FC chunk beyond declared length rejected');
select t.throws($q$select public.finish_file_upload(t.get('fc_upload'))$q$,'MA902','FC incomplete upload cannot finish');
select t.as_user('fc_x');
select t.throws($q$select public.append_file_chunk(t.get('fc_upload'),5,convert_to('test','UTF8'))$q$,'MA901','FC unrelated user cannot append upload');
select t.throws($q$select public.finish_file_upload(t.get('fc_upload'))$q$,'MA901','FC unrelated user cannot finish upload');
select t.as_user('fc_b');
select t.ok(public.append_file_chunk(t.get('fc_upload'),5,convert_to('test','UTF8'))=9,'FC second chunk completes declared length');
select t.put('fc_draft_file',(public.finish_file_upload(t.get('fc_upload'))->>'id')::uuid);
select t.ok((public.finish_file_upload(t.get('fc_upload'))->>'id')::uuid=t.get('fc_draft_file'),'FC finish retry returns same attachment');
select t.ok(not (public.finish_file_upload(t.get('fc_upload')) ? 'content'),'FC finish metadata excludes binary');
select t.ok((public.get_attachment(t.get('fc_draft_file'))).content=convert_to('%PDF-test','UTF8'),'FC chunked download preserves exact content');
select t.throws($q$select public.append_file_chunk(t.get('fc_upload'),0,convert_to('%PDF-','UTF8'))$q$,'MA901','FC completed upload cannot be appended');
select t.throws($q$select t.fc_file('request_draft',t.get('fc_draft'),'application/pdf',convert_to('not a pdf','UTF8'))$q$,'MA902','FC extension and MIME cannot bypass PDF magic');
select t.throws($q$select t.fc_file('request_draft',t.get('fc_draft'),'image/png',decode('ffd8ff00','hex'))$q$,'MA902','FC mismatched image MIME rejected');
select t.lives($q$select t.fc_file('request_draft',t.get('fc_draft'),'image/png',decode('89504e470d0a1a0a00','hex'))$q$,'FC PNG signature accepted');
select t.lives($q$select t.fc_file('request_draft',t.get('fc_draft'),'image/jpeg',decode('ffd8ff00','hex'))$q$,'FC JPEG signature accepted');
select t.lives($q$select t.fc_file('request_draft',t.get('fc_draft'),'image/webp',decode('524946460000000057454250','hex'))$q$,'FC WebP signature accepted');
select t.put('fc_max_file',t.fc_file('request_draft',t.get('fc_draft'),'application/pdf',convert_to('%PDF-'||repeat('x',10485755),'UTF8')));
select t.ok(octet_length((public.get_attachment(t.get('fc_max_file'))).content)=10485760,'FC exact 10 MiB file survives ten chunks');
select t.put('fc_big_chunk_upload',public.begin_file_upload('request_draft',t.get('fc_draft'),'large.pdf','application/pdf',10485760));
select t.throws($q$select public.append_file_chunk(t.get('fc_big_chunk_upload'),0,convert_to(repeat('x',1048577),'UTF8'))$q$,'MA902','FC chunk above 1 MiB rejected');
select t.as_super();
select t.ok((select octet_length(content)=0 and completed_id=t.get('fc_draft_file') from meetany_private.file_uploads where id=t.get('fc_upload')),'FC finished staging bytes cleared');
select t.ok(not has_table_privilege('authenticated','meetany_private.attachments','SELECT,INSERT,UPDATE,DELETE'),'FC authenticated cannot bypass attachment RPC');
select t.ok(not has_table_privilege('anonymous','meetany_private.file_uploads','SELECT,INSERT,UPDATE,DELETE'),'FC anonymous cannot access upload staging');
select t.as_user('fc_x');
select t.ok(public.list_attachments('request_draft',t.get('fc_draft'))='[]'::jsonb,'FC unrelated user cannot list another draft');
select t.throws($q$select public.get_attachment(t.get('fc_draft_file'))$q$,'MA901','FC unrelated user cannot download draft');
select t.as_anon();
select t.ok(public.list_attachments('request_draft',t.get('fc_draft'))='[]'::jsonb,'FC anonymous cannot list draft');
select t.throws($q$select public.get_attachment(t.get('fc_draft_file'))$q$,'MA901','FC anonymous cannot download draft');
select t.throws($q$select public.begin_file_upload('request_draft',t.get('fc_draft'),'x','application/pdf',9)$q$,'42501','FC anonymous cannot begin upload');
select t.as_user('fc_c');
do $$ begin
 for i in 1..10 loop perform t.fc_file('request_draft',t.get('fc_limit_draft')); end loop;
end $$;
select t.ok(jsonb_array_length(public.list_attachments('request_draft',t.get('fc_limit_draft')))=10,'FC ten files per target accepted');
select t.throws($q$select t.fc_file('request_draft',t.get('fc_limit_draft'))$q$,'MA902','FC eleventh file per target rejected');
do $$ begin
 for i in 1..10 loop perform public.begin_file_upload('request_draft',gen_random_uuid(),'unfinished.pdf','application/pdf',9); end loop;
end $$;
select t.throws($q$select public.begin_file_upload('request_draft',gen_random_uuid(),'unfinished.pdf','application/pdf',9)$q$,'MA902','FC eleventh active upload per owner rejected');

-- Atomic creation: failure after insert leaves neither request nor moved draft files.
select t.as_super();
insert into t.fc_snapshot select 'preferences_before',count(*) from meetany_private.request_preferences;
select t.as_user('fc_b');
select t.throws($q$select public.create_request_full('FC invalid preferences','A meaningful request body','other','tbilisi',null,10,'pcs',null,null,'{"unknown":true}',t.get('fc_draft'))$q$,'MA902','FC invalid preferences fail whole request creation');
select t.ok(not exists(select 1 from public.requests where title='FC invalid preferences'),'FC preferences failure rolls back request insert');
select t.ok(jsonb_array_length(public.list_attachments('request_draft',t.get('fc_draft')))=5,'FC preferences failure preserves all draft files');
-- Seed a legacy over-limit draft to exercise failure inside the final bind operation.
select t.as_super();
select t.put('fc_overfull_draft',gen_random_uuid());
insert into meetany_private.attachments(owner_id,kind,target_id,name,mime,content)
select t.uid('fc_b'),'request_draft',t.get('fc_overfull_draft'),'legacy.pdf','application/pdf',convert_to('%PDF-test','UTF8') from generate_series(1,11);
select t.as_user('fc_b');
select t.throws($q$select public.create_request_full('FC failed final bind','A meaningful request body','other','tbilisi',null,null,null,null,null,'{"budgetType":"exact","budgetMin":25}',t.get('fc_overfull_draft'))$q$,'MA902','FC final bind limit fails whole request creation');
select t.ok(not exists(select 1 from public.requests where title='FC failed final bind'),'FC bind failure rolls back request insert');
select t.ok(jsonb_array_length(public.list_attachments('request_draft',t.get('fc_overfull_draft')))=11,'FC bind failure preserves legacy drafts');
select t.as_super();
select t.ok((select count(*) from meetany_private.request_preferences)=(select n from t.fc_snapshot where k='preferences_before'),'FC failed creation leaves no preference rows');
select t.as_user('fc_b');
select t.put('fc_request',(public.create_request_full('FC completed request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{"specification":"food grade","budgetType":"range","budgetMin":100,"budgetMax":200,"budgetPrivate":true}',t.get('fc_draft'))).id);
select t.ok(public.list_attachments('request_draft',t.get('fc_draft'))='[]'::jsonb,'FC successful creation consumes own draft scope');
select t.ok(jsonb_array_length(public.list_attachments('request',t.get('fc_request')))=5,'FC successful creation binds all files');
select t.ok((public.get_attachment(t.get('fc_draft_file'))).target_id=t.get('fc_request'),'FC existing attachment ID preserved on bind');
select t.ok(public.request_preferences(t.get('fc_request'))->>'budgetMin'='100','FC owner reads private budget');
select t.throws($q$select public.set_request_preferences(t.get('fc_request'),' {"budgetType":"range","budgetMin":200,"budgetMax":100}')$q$,'MA902','FC inverted budget range rejected');
select t.as_anon();
select t.ok(jsonb_array_length(public.list_attachments('request',t.get('fc_request')))=5,'FC anonymous can list public request files');
select t.ok(not (public.list_attachments('request',t.get('fc_request'))->0 ? 'content'),'FC public file list contains metadata only');
select t.ok((public.get_attachment(t.get('fc_draft_file'))).content=convert_to('%PDF-test','UTF8'),'FC anonymous can download published request file');
select t.ok(not (public.request_preferences(t.get('fc_request')) ?| array['budgetMin','budgetMax']),'FC anonymous private budget amounts filtered');
select t.ok(public.request_preferences(t.get('fc_request'))->>'specification'='food grade','FC nonfinancial preferences remain public');
select t.as_user('fc_x');
select t.ok(not (public.request_preferences(t.get('fc_request')) ?| array['budgetMin','budgetMax']),'FC authenticated nonowner private budget filtered');
select t.throws($q$select public.set_request_preferences(t.get('fc_request'),'{}')$q$,'MA901','FC unrelated user cannot change preferences');
select t.throws($q$select public.begin_file_upload('request',t.get('fc_request'),'x','application/pdf',9)$q$,'MA901','FC unrelated user cannot upload request file');
select t.throws($q$select public.remove_attachment(t.get('fc_draft_file'))$q$,'MA901','FC unrelated user cannot delete public file');
select t.as_user('flow_a');
select t.ok(public.request_preferences(t.get('fc_request'))->>'budgetMax'='200','FC admin reads private budget');
select t.as_super();
update public.requests set hidden=true where id=t.get('fc_request');
select t.as_anon();
select t.throws($q$select public.get_attachment(t.get('fc_draft_file'))$q$,'MA901','FC hidden request binary not public');
select t.throws($q$select public.request_preferences(t.get('fc_request'))$q$,'MA901','FC hidden request preferences not public');
select t.as_user('fc_b');
select t.ok((public.get_attachment(t.get('fc_draft_file'))).owner_id=t.uid('fc_b'),'FC owner retains hidden request download');
select t.as_super();
update public.requests set hidden=false where id=t.get('fc_request');

-- Private offer and conversation files remain restricted to their real participants.
select t.as_user('fc_s');
select t.put('fc_offer',(public.send_offer(t.get('fc_request'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('fc_offer_file',t.fc_file('offer',t.get('fc_offer')));
select t.as_user('fc_b');
select t.ok((public.get_attachment(t.get('fc_offer_file'))).kind='offer','FC buyer can download sealed offer file');
select t.throws($q$select public.remove_attachment(t.get('fc_offer_file'))$q$,'MA901','FC buyer cannot delete supplier file');
select t.put('fc_conversation',(public.start_conversation(t.uid('fc_s'),t.get('fc_request'))->>'id')::uuid);
select t.put('fc_chat_file',t.fc_file('conversation',t.get('fc_conversation')));
select t.as_user('fc_s');
select t.ok((public.get_attachment(t.get('fc_chat_file'))).kind='conversation','FC conversation peer can download shared file');
select t.throws($q$select public.remove_attachment(t.get('fc_chat_file'))$q$,'MA901','FC conversation peer cannot delete owner file');
select t.as_user('fc_x');
select t.throws($q$select public.get_attachment(t.get('fc_offer_file'))$q$,'MA901','FC unrelated user cannot download offer file');
select t.throws($q$select public.list_attachments('conversation',t.get('fc_conversation'))$q$,'MA901','FC unrelated user cannot list conversation files');
select t.throws($q$select public.get_attachment(t.get('fc_chat_file'))$q$,'MA901','FC unrelated user cannot download conversation file');
select t.as_anon();
select t.throws($q$select public.get_attachment(t.get('fc_offer_file'))$q$,'MA901','FC anonymous cannot download offer file');
select t.throws($q$select public.get_attachment(t.get('fc_chat_file'))$q$,'MA901','FC anonymous cannot download conversation file');
select t.as_user('fc_b');
select public.remove_attachment(t.get('fc_chat_file'));
select t.ok(public.list_attachments('conversation',t.get('fc_conversation'))='[]'::jsonb,'FC owner can remove shared conversation file');

-- Recommended feed distinguishes client suppliers from company request/supplier tabs.
select t.as_user('fc_b');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_matching_feed('recommended')) x where x->>'kind'='supplier' and x->>'id'=t.uid('fc_s')::text),'FC client recommendations use own request categories');
select t.ok(public.list_matching_feed('requests')='[]'::jsonb,'FC client request recommendations empty before upgrade');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching_feed('suppliers')) x where x->>'id'=t.uid('fc_x')::text),'FC unverified suppliers excluded');
select t.as_user('fc_s');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_matching_feed('requests')) x where x->>'id'=t.get('fc_request')::text and x->>'kind'='request' and x->>'score'='100'),'FC company request tab scores category and city');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching_feed('requests')) x where x->>'kind'<>'request'),'FC requests tab contains only requests');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching_feed('suppliers')) x where x->>'kind'<>'supplier'),'FC suppliers tab contains only suppliers');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching_feed('requests','batumi')) x where x->>'id'=t.get('fc_request')::text),'FC matching city filter excludes other cities');
select t.ok(public.list_matching_feed('requests',null,1,0)->0=public.list_matching_feed('requests',null,2,0)->0,'FC first paginated item consistent');
select t.ok(public.list_matching_feed('requests',null,1,1)->0=public.list_matching_feed('requests',null,2,0)->1,'FC offset yields next item');
select t.throws($q$select public.list_matching_feed('invalid')$q$,'MA902','FC invalid matching tab rejected');
select t.throws($q$select public.list_matching_feed('requests',null,0)$q$,'MA902','FC invalid matching page size rejected');
select t.throws($q$select public.list_matching_feed('requests',null,12,-1)$q$,'MA902','FC negative matching offset rejected');
select t.as_anon();
select t.throws('select public.list_matching_feed()','42501','FC anonymous matching denied');

-- Upgrade keeps identity, owned request/attachments and existing conversations intact.
select t.as_user('fc_b');
select t.throws($q$select public.become_company('x','other')$q$,'MA902','FC invalid company upgrade rejected');
select t.ok((public.become_company('Upgraded Buyer','other')).id=t.uid('fc_b'),'FC upgrade keeps profile ID');
select t.ok((select role='company' and not verified from public.my_profile()),'FC upgrade grants unverified company only');
select t.ok((select provide_categories=array['other'] and account_intent='both' from public.my_profile()),'FC upgrade initializes company matching and intent');
select t.ok(exists(select 1 from public.requests where id=t.get('fc_request') and owner_id=t.uid('fc_b')),'FC upgrade preserves request ownership');
select t.ok((public.get_attachment(t.get('fc_draft_file'))).owner_id=t.uid('fc_b'),'FC upgrade preserves attachment ownership');
select t.ok((public.start_conversation(t.uid('fc_s'),t.get('fc_request'))->>'id')::uuid=t.get('fc_conversation'),'FC upgrade preserves conversation identity');
select t.ok((public.become_company('Different name','other')).company='Upgraded Buyer','FC upgrade retry does not overwrite company');
select t.as_user('flow_a');
select t.throws($q$select public.become_company('Admin Company','other')$q$,'MA901','FC admin cannot convert role via upgrade');

-- Verification requires private legal files; submission locks them until admin review.
select t.as_user('fc_b');
select t.throws('select public.submit_verification()','MA902','FC incomplete verification rejected');
select t.ok((public.complete_onboarding()).onboarding_completed_at is not null and (select about='' from public.my_profile()),'FC company with empty about can complete onboarding');
select t.as_super();
update public.profiles set logo_url=null,about='A complete company description' where id=t.uid('fc_b');
select t.as_user('fc_b');
select public.set_onboarding_details('both','8-50',2020,array['GE'],array['ka'],'Buyer Legal','405882001','LLC','Director',null,'{}','{}');
select t.ok(not (public.complete_onboarding()).verified,'FC onboarding completion does not require or grant verification');
select t.ok((public.complete_onboarding()).onboarding_completed_at is not null,'FC completed onboarding records completion timestamp');
select t.put('fc_registration_file',t.fc_file('verification',t.uid('fc_b'),'application/pdf',convert_to('%PDF-test','UTF8'),'registration'));
select t.throws('select public.submit_verification()','MA902','FC missing tax document blocks submission');
select t.put('fc_tax_file',t.fc_file('verification',t.uid('fc_b'),'application/pdf',convert_to('%PDF-test','UTF8'),'tax'));
select t.ok((public.submit_verification()).verification_documents_status='pending' and (select not verified from public.my_profile()),'FC verification without logo enters pending without self approval');
select t.throws($q$select public.remove_attachment(t.get('fc_registration_file'))$q$,'MA901','FC pending verification file cannot be removed');
select t.throws($q$select public.begin_file_upload('verification',t.uid('fc_b'),'x','application/pdf',9,'tax')$q$,'MA901','FC pending verification file cannot be replaced');
select t.throws($q$select public.review_verification(t.uid('fc_b'),'approved')$q$,'MA003','FC company cannot approve itself');
select t.as_user('fc_x');
select t.throws($q$select public.get_attachment(t.get('fc_registration_file'))$q$,'MA901','FC unrelated user cannot download legal document');
select t.as_anon();
select t.throws($q$select public.get_attachment(t.get('fc_registration_file'))$q$,'MA901','FC anonymous cannot download legal document');
select t.as_user('flow_a');
select t.ok((public.get_attachment(t.get('fc_registration_file'))).slot='registration','FC admin can review private document');
select t.ok((public.review_verification(t.uid('fc_b'),'rejected')).verification_documents_status='rejected','FC admin can reject pending verification');
select t.throws($q$select public.review_verification(t.uid('fc_b'),'approved')$q$,'MA903','FC admin cannot approve without pending submission');
select t.as_user('fc_b');
select public.remove_attachment(t.get('fc_tax_file'));
select t.put('fc_tax_file',t.fc_file('verification',t.uid('fc_b'),'application/pdf',convert_to('%PDF-test','UTF8'),'tax'));
select t.ok((public.submit_verification()).verification_documents_status='pending','FC rejected documents can be corrected and resubmitted');
select t.as_user('flow_a');
select t.ok((public.review_verification(t.uid('fc_b'),'approved')).verified,'FC admin approval grants verified company');
select t.as_user('fc_b');
select t.throws($q$select public.remove_attachment(t.get('fc_tax_file'))$q$,'MA901','FC approved verification file remains locked');
select t.as_user('fc_s');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_matching_feed('recommended')) x where x->>'kind'='request' and x->>'id'=t.get('fc_request')::text) and exists(select 1 from jsonb_array_elements(public.list_matching_feed('recommended')) x where x->>'kind'='supplier' and x->>'id'=t.uid('fc_b')::text),'FC recommended tab combines matching requests and suppliers');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching_feed('recommended')) x where x->>'id'=t.uid('fc_s')::text),'FC recommendations exclude own company');

-- Proposal history retains old/new terms, counteroffers, rejection and mutual approval.
select t.as_user('fc_b');
select t.put('fc_deal',(public.select_offer_deal(t.get('fc_offer'))->>'id')::uuid);
select public.advance_deal(t.get('fc_deal'),'discuss',t.fc_revision());
select public.propose_deal_terms(t.get('fc_deal'),t.fc_revision(),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select t.put('fc_proposal_one',(public.get_deal(t.get('fc_deal'))->'proposals'->0->>'id')::uuid);
select t.ok((public.get_deal(t.get('fc_deal'))->'proposals'->0->'previous'->>'total_price')::numeric=100 and (public.get_deal(t.get('fc_deal'))->'proposals'->0->'proposed'->>'total_price')::numeric=100,'FC first proposal records selected offer price and proposed price');
select t.throws($q$select public.reject_deal_proposal(t.get('fc_deal'),t.fc_revision(),t.get('fc_proposal_one'))$q$,'MA903','FC actor cannot reject own proposal');
select public.confirm_deal_terms(t.get('fc_deal'),t.fc_revision());
select t.as_user('fc_s');
select public.propose_deal_terms(t.get('fc_deal'),t.fc_revision(),120,10,'pcs',6,current_date+6,'Batumi','On delivery',array['VAT']);
select t.put('fc_proposal_two',(public.get_deal(t.get('fc_deal'))->'proposals'->0->>'id')::uuid);
select t.ok(t.fc_proposal(t.get('fc_proposal_one'))->>'status'='superseded','FC counteroffer supersedes earlier pending proposal');
select t.ok(t.fc_proposal(t.get('fc_proposal_two'))->'previous'->>'total_price'='100.00' and t.fc_proposal(t.get('fc_proposal_two'))->'proposed'->>'total_price'='120.00','FC counteroffer preserves both prices');
select t.ok(public.get_deal(t.get('fc_deal'))->>'buyer_confirmed_at' is null and public.get_deal(t.get('fc_deal'))->>'supplier_confirmed_at' is null,'FC changed terms invalidate both confirmations');
select t.as_user('fc_b');
select t.throws($q$select public.reject_deal_proposal(t.get('fc_deal'),t.fc_revision()-1,t.get('fc_proposal_two'))$q$,'MA904','FC stale proposal rejection denied');
select public.reject_deal_proposal(t.get('fc_deal'),t.fc_revision(),t.get('fc_proposal_two'));
select t.ok(public.get_deal(t.get('fc_deal'))->>'stage'='discuss' and public.get_deal(t.get('fc_deal'))->>'total_price'='100.00' and public.get_deal(t.get('fc_deal'))->>'delivery_place'='Tbilisi','FC rejection restores previous terms and discussion stage');
select t.ok(t.fc_proposal(t.get('fc_proposal_two'))->>'status'='rejected','FC rejection remains in proposal history');
select public.propose_deal_terms(t.get('fc_deal'),t.fc_revision(),110,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select public.confirm_deal_terms(t.get('fc_deal'),t.fc_revision());
select t.throws($q$select public.advance_deal(t.get('fc_deal'),'progress',t.fc_revision())$q$,'MA905','FC one confirmation cannot start progress');
select t.as_user('fc_s');
select public.confirm_deal_terms(t.get('fc_deal'),t.fc_revision());
select t.ok(public.get_deal(t.get('fc_deal'))->'proposals'->0->>'status'='accepted','FC both confirmations accept latest proposal');
select t.as_user('fc_b');
select public.advance_deal(t.get('fc_deal'),'progress',t.fc_revision());

-- Supplier progress is audited; unresolved issues block completion and post-completion rating.
select t.throws($q$select public.add_deal_update(t.get('fc_deal'),t.fc_revision(),'started','Starting work')$q$,'MA901','FC buyer cannot impersonate supplier progress');
select t.as_user('fc_s');
select t.throws($q$select public.add_deal_update(t.get('fc_deal'),t.fc_revision()-1,'started','Starting work')$q$,'MA904','FC stale supplier update denied');
select t.throws($q$select public.add_deal_update(t.get('fc_deal'),t.fc_revision(),'invalid','Starting work')$q$,'MA902','FC unsupported supplier status denied');
select t.ok(public.add_deal_update(t.get('fc_deal'),t.fc_revision(),'producing','Production started')->>'status'='producing','FC supplier can report production');
select t.ok(public.get_deal(t.get('fc_deal'))->'updates'->0->>'body'='Production started','FC supplier update appears in deal history');
select t.as_user('fc_x');
select t.throws($q$select public.open_deal_issue(t.get('fc_deal'),1,'quality','Wrong quality')$q$,'MA901','FC unrelated user cannot open deal issue');
select t.as_user('fc_b');
select t.put('fc_issue',(public.open_deal_issue(t.get('fc_deal'),t.fc_revision(),'quality','Wrong quality delivered')->>'id')::uuid);
select t.throws($q$select public.open_deal_issue(t.get('fc_deal'),t.fc_revision(),'late','Still waiting')$q$,'MA903','FC duplicate unresolved deal issue denied');
select t.throws($q$select public.advance_deal(t.get('fc_deal'),'complete',t.fc_revision())$q$,'MA903','FC open issue blocks buyer completion');
select t.throws($q$select public.admin_resolve_deal_issue(t.get('fc_issue'),'Resolved')$q$,'MA003','FC participant cannot resolve own dispute as admin');
select t.as_user('fc_s');
select t.throws($q$select public.add_deal_update(t.get('fc_deal'),t.fc_revision(),'delivered','Now delivered')$q$,'MA903','FC unresolved issue freezes supplier progress');
select t.as_user('flow_a');
select t.ok(exists(select 1 from jsonb_array_elements(public.admin_deal_issues()) x where x->>'id'=t.get('fc_issue')::text and x->>'status'='open' and x->>'title'='FC completed request'),'FC admin issue list includes real request context');
select t.throws($q$select public.admin_resolve_deal_issue(t.get('fc_issue'),'x')$q$,'MA902','FC admin resolution requires explanation');
select public.admin_resolve_deal_issue(t.get('fc_issue'),'Supplier replaced the defective goods');
insert into t.fc_snapshot values('resolved_revision',t.fc_revision());
select public.admin_resolve_deal_issue(t.get('fc_issue'),'Repeated resolution');
select t.ok(t.fc_revision()=(select n from t.fc_snapshot where k='resolved_revision'),'FC resolution retry does not create another revision');
select t.ok(public.get_deal(t.get('fc_deal'))->'issues'->0->>'status'='resolved' and public.get_deal(t.get('fc_deal'))->'issues'->0->>'resolved_by'=t.uid('flow_a')::text,'FC admin resolution is attributed and visible');
select t.as_user('fc_s');
select public.add_deal_update(t.get('fc_deal'),t.fc_revision(),'delivered','Replacement delivered');
select t.as_user('fc_b');
select public.advance_deal(t.get('fc_deal'),'complete',t.fc_revision());
select t.put('fc_rating_issue',(public.open_deal_issue(t.get('fc_deal'),t.fc_revision(),'quantity','Some items remain missing')->>'id')::uuid);
select t.throws($q$select public.rate_deal(t.get('fc_deal'),5,'Good',t.fc_revision())$q$,'MA903','FC post-completion issue blocks rating');
select t.ok(public.get_deal(t.get('fc_deal'))->>'rating' is null,'FC blocked rating does not mutate deal');
select t.as_user('flow_a');
select public.admin_resolve_deal_issue(t.get('fc_rating_issue'),'Missing quantity supplied');
select t.as_user('fc_b');
select t.throws($q$select public.rate_deal_full(t.get('fc_deal'),t.fc_revision(),array[5,4,5],true,'Good')$q$,'MA902','FC structured review requires four scores');
select t.throws($q$select public.rate_deal_full(t.get('fc_deal'),t.fc_revision(),array[5,0,5,4],true,'Good')$q$,'MA902','FC structured review rejects out-of-range score');
select t.throws($q$select public.rate_deal_full(t.get('fc_deal'),t.fc_revision(),array[5,4,5,4],null,'Good')$q$,'MA902','FC structured review requires repeat-business answer');
select t.ok(public.rate_deal_full(t.get('fc_deal'),t.fc_revision(),array[5,4,5,4],true,'Resolved successfully')->>'rating'='5','FC resolved issue permits structured rating with server-derived average');
select t.ok(public.get_deal(t.get('fc_deal'))->'review_details'->'scores'='[5,4,5,4]'::jsonb and public.get_deal(t.get('fc_deal'))->'review_details'->>'would_again'='true','FC structured review retains all criteria and repeat-business answer');
select t.throws($q$select public.rate_deal_full(t.get('fc_deal'),t.fc_revision(),array[1,1,1,1],false,'Again')$q$,'MA903','FC duplicate structured review cannot replace existing rating');
select t.as_super();
select t.ok((select count(*) from meetany_private.deal_events where deal_id=t.get('fc_deal'))=(select revision from meetany_private.deals where id=t.get('fc_deal')),'FC successful collaboration revisions each have exactly one event');
select t.ok((select count(*) from meetany_private.deal_issues where deal_id=t.get('fc_deal') and status='open')=0,'FC both issues finish resolved');
\o
select format('FLOW COMPLETION %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'FC %';
