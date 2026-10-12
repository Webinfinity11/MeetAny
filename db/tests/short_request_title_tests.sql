\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.signup('short_b','short-b@test.ge','{"role":"client","name":"Short Title Buyer","company":"Buyer Ltd","phone":"599882099","city":"tbilisi"}');
select t.as_user('short_b');
select t.put('short_request',(public.create_request('  ხე  ','გვჭირდება ხე სახელოსნოსთვის','furniture','tbilisi',null,1,'pcs',t.today()+1)).id);
select t.ok((select title='ხე' from public.requests where id=t.get('short_request')),'two-character Georgian title accepted and trimmed');
select t.ok((public.update_request(t.get('short_request'),'ა','გვჭირდება ხე სახელოსნოსთვის','furniture','tbilisi',1,'pcs',t.today()+1)).title='ა','single-character title accepted when editing');
select t.ok((public.create_request_full('ხე','გვჭირდება ხე სახელოსნოსთვის','furniture','tbilisi',null,1,'pcs',t.today()+1,null,'{}',null)).title='ხე','full publishing RPC accepts short title');
select t.throws($$select public.create_request('   ','გვჭირდება ხე სახელოსნოსთვის','furniture','tbilisi')$$,'MA101','blank title still required');
select t.throws(format($$select public.update_request(%L,'','გვჭირდება ხე სახელოსნოსთვის','furniture','tbilisi')$$,t.get('short_request')),'MA101','editing cannot clear title');
select t.throws($$select public.create_request('ა','მოკლე','furniture','tbilisi')$$,'MA102','short titles retain body validation');
select t.as_super();
select t.throws(format($$update public.requests set title=' ' where id=%L$$,t.get('short_request')),'23514','direct writes reject blank title');
select t.throws(format($$update public.requests set title=repeat('ა',121) where id=%L$$,t.get('short_request')),'23514','title maximum retained');
\o
\echo 'SHORT REQUEST TITLES PASS'
