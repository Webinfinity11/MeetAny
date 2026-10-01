\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.metrics_start as select count(*) n from t.passed;
grant select on t.metrics_start to public;
select t.as_anon();
select t.throws($q$select public.admin_market_metrics()$q$,'42501','MM guests denied');
select t.as_user('ds_client');
select t.throws($q$select public.admin_market_metrics()$q$,'MA003','MM clients denied');
select t.as_user('bx_company');
select t.throws($q$select public.admin_market_metrics()$q$,'MA003','MM companies denied');
select t.as_user('rp_admin');
select t.ok(jsonb_typeof(public.admin_market_metrics()->'gaps')='array','MM gaps array');
select t.as_super();
create table t.metrics_expected as
with r as (select r.*,meetany_private.request_state(r) state from public.requests r join public.profiles p on p.id=r.owner_id where not r.hidden and not p.blocked),
f as (select request_id,min(created_at) first_at from public.offers where status<>'withdrawn' group by request_id)
select (select count(*) from r where state='open' and not exists(select 1 from f where f.request_id=r.id)) unanswered,
(select round(avg(greatest(0,extract(epoch from f.first_at-r.created_at)/3600))::numeric,1) from r join f on f.request_id=r.id) hours,
(select round(100.0*count(*) filter(where chosen_offer_id is not null)/nullif(count(*) filter(where state<>'open'),0),1) from r) share;
grant select on t.metrics_expected to public;
select t.as_user('rp_admin');
select t.ok((public.admin_market_metrics()->>'withoutOffers')::bigint=(select unanswered from t.metrics_expected),'MM unanswered SQL match');
select t.ok((public.admin_market_metrics()->>'averageFirstOfferHours')::numeric is not distinct from (select hours from t.metrics_expected),'MM first response SQL match');
select t.ok((public.admin_market_metrics()->>'chosenShare')::numeric is not distinct from (select share from t.metrics_expected),'MM conversion SQL match');
select t.ok(not exists(select 1 from (select (x->>'companies')::int n,lag((x->>'companies')::int) over(order by ord) prev from jsonb_array_elements(public.admin_market_metrics()->'gaps') with ordinality a(x,ord)) q where n<prev),'MM gaps worst first');
select t.as_super();
\o
select 'Market metrics tests: '||(count(*)-(select n from t.metrics_start))||' passed' from t.passed;
