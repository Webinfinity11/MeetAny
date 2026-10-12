-- Run only through run.sh: server-side request drafts.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

select t.signup('rd_a','rd-a@test.ge','{"role":"client","name":"Draft Owner","company":"Draft Owner Ltd","phone":"599884401","city":"tbilisi"}');
select t.signup('rd_b','rd-b@test.ge','{"role":"client","name":"Draft Other","company":"Draft Other Ltd","phone":"599884402","city":"batumi"}');

select t.as_user('rd_a');
select t.ok(public.my_request_draft() is null,'RD no draft initially');
select t.ok((public.save_request_draft('{"title":"First","body":"Some text","preferences":{"specification":"oak"}}'))->'data'->>'title'='First','RD save returns data');
select t.ok((public.my_request_draft())->'data'->'preferences'->>'specification'='oak','RD read returns saved draft');
select t.ok((public.my_request_draft())->>'updatedAt' is not null,'RD read returns updatedAt');
select public.save_request_draft('{"title":"Second","quantity":"5"}');
select t.ok((public.my_request_draft())->'data'->>'title'='Second' and not (public.my_request_draft())->'data' ? 'body','RD overwrite replaces whole draft');
select t.throws($q$select public.save_request_draft('{"title":"x","evil":1}')$q$,'MA902','RD unknown key rejected');
select t.throws($q$select public.save_request_draft('[]')$q$,'MA902','RD array rejected');
select t.throws($q$select public.save_request_draft(null)$q$,'MA902','RD null rejected');
select t.throws($q$select public.save_request_draft(jsonb_build_object('body',repeat('x',16100)))$q$,'MA902','RD oversize rejected');
select t.ok((public.my_request_draft())->'data'->>'title'='Second','RD rejected save leaves draft unchanged');
select t.throws($q$select * from meetany_private.request_drafts$q$,'42501','RD table is private');

select t.as_user('rd_b');
select t.ok(public.my_request_draft() is null,'RD other user sees nothing');
select t.ok(public.delete_request_draft()=false,'RD delete without draft returns false');
select t.as_user('rd_a');
select t.ok((public.my_request_draft())->'data'->>'title'='Second','RD other user delete does not touch the draft');

select t.as_anon();
select t.throws($q$select public.my_request_draft()$q$,'42501','RD guest cannot read');
select t.throws($q$select public.save_request_draft('{"title":"x"}')$q$,'42501','RD guest cannot save');
select t.throws($q$select public.delete_request_draft()$q$,'42501','RD guest cannot delete');

select t.as_user('rd_a');
select t.ok(public.delete_request_draft(),'RD delete removes the draft');
select t.ok(public.my_request_draft() is null,'RD draft gone after delete');

select t.as_super();
update public.profiles set blocked=true where id=t.uid('rd_b');
select t.as_user('rd_b');
select t.throws($q$select public.save_request_draft('{"title":"x"}')$q$,'MA002','RD blocked user cannot save');
