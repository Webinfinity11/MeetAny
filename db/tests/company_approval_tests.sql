\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.approval_start as select count(*) n from t.passed;
update public.profiles set verified=false,blocked=false where id=t.uid('bx_company');
insert into meetany_private.company_business(company_id,distributor) values(t.uid('bx_company'),true) on conflict(company_id) do update set distributor=true;
select t.as_anon();
select t.ok(not exists(select 1 from public.profiles where id=t.uid('bx_company')),'AP pending company RLS hidden');
select t.ok(not exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP pending directory hidden');
select t.ok(not exists(select 1 from jsonb_array_elements(public.company_business_features()) x where x->>'id'=t.uid('bx_company')::text),'AP pending plans and ratings hidden');
select t.ok(not exists(select 1 from jsonb_array_elements(public.company_distribution_profiles()) x where x->>'id'=t.uid('bx_company')::text),'AP pending distribution hidden');
select t.ok(public.company_products(t.uid('bx_company'))='[]'::jsonb,'AP pending products hidden');
select t.throws($q$select public.company_reviews(t.uid('bx_company'))$q$,'MA302','AP pending reviews private');
select t.ok(not exists(select 1 from public.company_stats(array[t.uid('bx_company')])),'AP pending company counts hidden');
select t.as_user('bx_other');
select t.ok(not exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP other user cannot see pending company');
select t.as_user('bx_company');
select t.ok(exists(select 1 from public.profiles where id=t.uid('bx_company')),'AP owner can view own pending profile');
select t.ok(exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP owner can preview pending directory profile');
select t.lives($q$select public.company_reviews(t.uid('bx_company'))$q$,'AP owner can preview reviews');
select t.throws($q$select public.send_offer(t.get('bx_request'),'Pending company attempts an offer')$q$,'MA801','AP pending cannot send offers');
select t.as_user('bx_admin');
select t.ok(exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP admin sees pending company');
select public.admin_set_verified(t.uid('bx_company'),true);
select t.as_anon();
select t.ok(exists(select 1 from public.profiles where id=t.uid('bx_company')),'AP approval exposes profile');
select t.ok(exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP approval exposes directory');
select t.ok(exists(select 1 from jsonb_array_elements(public.company_distribution_profiles()) x where x->>'id'=t.uid('bx_company')::text),'AP approval exposes distribution');
select t.as_user('bx_admin');
select public.admin_set_verified(t.uid('bx_company'),false);
select t.as_anon();
select t.ok(not exists(select 1 from public.list_companies() where id=t.uid('bx_company')),'AP revoked approval hides company');
select t.as_super();
\o
select 'Company approval: '||(count(*)-(select n from t.approval_start))||' assertions passed' from t.passed;
