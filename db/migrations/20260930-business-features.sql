-- Additive: no existing RPC signatures or profile rows are changed.
-- Requires categories v2, company gallery and admin migrations.
begin;
set local lock_timeout='5s';

-- Expanded financial-services taxonomy; existing stored keys remain valid.
create or replace function meetany_private.categories() returns text[]
language sql immutable set search_path='' as $$
 select array['food_fresh','food_processed','beverages','catering','building_materials','renovation','engineering',
 'furniture','equipment','textiles','packaging','printing','freight','warehouse','customs','wholesale','office_household',
 'cleaning','laundry','technical_service','security','software_web','it_support','branding_design','advertising','photo_video','events',
 'accounting','legal','consulting','hr_training','hotel_services','tours','leasing','business_finance','business_insurance','other']::text[]
$$;

create table if not exists meetany_private.company_business (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 distributor boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.company_plans (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 plan text not null check(plan in ('premium','vip')),
 expires_at timestamptz not null,
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.plan_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.profiles(id) on delete cascade,
 plan text not null check(plan in ('premium','vip')),
 status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')),
 note text not null default '' check(length(note)<=500),
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.company_reviews (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.requests(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 body text not null check(length(btrim(body)) between 20 and 1500),
 status text not null default 'pending' check(status in ('pending','published','hidden')),
 reason text not null default '' check(length(reason)<=500),
 updated_at timestamptz not null default now(),
 check(author_id<>company_id)
);
create index if not exists company_reviews_company on meetany_private.company_reviews(company_id,status,updated_at desc);
create table if not exists meetany_private.business_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null, target_id uuid not null, action text not null, detail jsonb not null,
 created_at timestamptz not null default now()
);
-- Tables are not directly exposed to either API role, including self-upgrades and self-moderation.
alter table meetany_private.company_business enable row level security;
alter table meetany_private.company_plans enable row level security;
alter table meetany_private.plan_requests enable row level security;
alter table meetany_private.company_reviews enable row level security;
alter table meetany_private.business_audit enable row level security;
revoke all on meetany_private.company_business,meetany_private.company_plans,meetany_private.plan_requests,meetany_private.company_reviews,meetany_private.business_audit from public,anonymous,authenticated;

create or replace function public.company_business_features() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'distributor',coalesce(b.distributor,false),
 'plan',case when m.expires_at>now() then m.plan else null end,
 'rating',r.rating,'reviewCount',coalesce(r.n,0))),'[]'::jsonb)
 from public.profiles p
 left join meetany_private.company_business b on b.company_id=p.id
 left join meetany_private.company_plans m on m.company_id=p.id
 left join lateral (select round(avg(v.rating),1) rating,count(*) n from meetany_private.company_reviews v
   join public.profiles a on a.id=v.author_id and not a.blocked
   where v.company_id=p.id and v.status='published') r on true
 where p.role='company' and not p.blocked
$$;

create or replace function public.my_business_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 return jsonb_build_object('distributor',coalesce((select distributor from meetany_private.company_business where company_id=me.id),false),
 'membership',(select to_jsonb(p)-'company_id' from meetany_private.company_plans p where p.company_id=me.id and expires_at>now()),
 'application',(select to_jsonb(a)-'company_id' from meetany_private.plan_requests a where a.company_id=me.id));
end $$;
create or replace function public.set_company_distributor(p_distributor boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_distributor is null then raise exception using errcode='22023',message='invalid distributor'; end if;
 insert into meetany_private.company_business(company_id,distributor) values(me.id,p_distributor)
 on conflict(company_id) do update set distributor=excluded.distributor,updated_at=now();
 return public.my_business_settings();
end $$;
create or replace function public.request_company_plan(p_plan text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_plan is null or p_plan not in ('premium','vip') then raise exception using errcode='22023',message='invalid plan'; end if;
 insert into meetany_private.plan_requests(company_id,plan) values(me.id,p_plan)
 on conflict(company_id) do update set plan=excluded.plan,status='pending',note='',updated_at=now();
 return public.my_business_settings();
end $$;
create or replace function public.cancel_company_plan_request() returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 update meetany_private.plan_requests set status='cancelled',updated_at=now() where company_id=me.id and status='pending';
 return public.my_business_settings();
end $$;

create or replace function public.company_reviews(p_company_id uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 then raise exception using errcode='22023',message='invalid offset'; end if;
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 select jsonb_build_object('total',count(*),'rating',round(avg(v.rating),1)) into result
 from meetany_private.company_reviews v join public.profiles a on a.id=v.author_id and not a.blocked
 where v.company_id=p_company_id and v.status='published';
 return result || jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.id,v.rating,v.body,v.updated_at,coalesce(nullif(a.company,''),a.name) author
 from meetany_private.company_reviews v join public.profiles a on a.id=v.author_id and not a.blocked
 where v.company_id=p_company_id and v.status='published' order by v.updated_at desc,v.id limit 10 offset p_offset) t));
end $$;
create or replace function public.my_company_review_targets(p_company_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select r.id,r.title,v.rating,v.body,v.status,v.reason
 from public.requests r join public.offers o on o.id=r.chosen_offer_id and o.company_id=p_company_id
 left join meetany_private.company_reviews v on v.request_id=r.id and v.author_id=me.id and v.company_id=p_company_id
 where r.owner_id=me.id and not r.hidden and me.id<>p_company_id order by r.created_at desc,r.id) t);
end $$;
create or replace function public.save_company_review(p_request_id uuid,p_rating integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); company uuid; v meetany_private.company_reviews;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_body is null or length(btrim(p_body)) not between 20 and 1500 then
 raise exception using errcode='22023',message='MA601: invalid review'; end if;
 select o.company_id into company from public.requests r join public.offers o on o.id=r.chosen_offer_id
 join public.profiles c on c.id=o.company_id and not c.blocked and c.role='company'
 where r.id=p_request_id and r.owner_id=me.id and not r.hidden and o.company_id<>me.id for share of r;
 if company is null then raise exception using errcode='42501',message='MA602: review requires your chosen offer'; end if;
 insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body)
 values(p_request_id,me.id,company,p_rating,btrim(p_body))
 on conflict(request_id) do update set company_id=excluded.company_id,rating=excluded.rating,body=excluded.body,status='pending',reason='',updated_at=now()
 where company_reviews.author_id=me.id returning * into v;
 if v.id is null then raise exception using errcode='42501',message='MA602: review is not yours'; end if;
 return to_jsonb(v);
end $$;

create or replace function public.admin_business_queue(p_kind text,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 if p_offset is null or p_offset<0 or p_kind is null or p_kind not in ('reviews','plans') then raise exception using errcode='22023',message='invalid queue'; end if;
 if p_kind='reviews' then
 return jsonb_build_object('total',(select count(*) from meetany_private.company_reviews),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.*,p.company,a.name author from meetany_private.company_reviews v join public.profiles p on p.id=v.company_id join public.profiles a on a.id=v.author_id
 order by (v.status='pending') desc,v.updated_at desc,v.id limit 20 offset p_offset) t));
 end if;
 return jsonb_build_object('total',(select count(*) from meetany_private.plan_requests),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.*,p.company,p.email,p.phone,m.plan active_plan,m.expires_at from meetany_private.plan_requests v join public.profiles p on p.id=v.company_id
 left join meetany_private.company_plans m on m.company_id=p.id
 order by (v.status='pending') desc,v.updated_at desc,v.id limit 20 offset p_offset) t));
end $$;
create or replace function public.admin_moderate_review(p_id uuid,p_status text,p_reason text default '') returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_status is null or p_status not in ('published','hidden') or length(coalesce(p_reason,''))>500 or (p_status='hidden' and length(btrim(coalesce(p_reason,'')))<3) then
 raise exception using errcode='22023',message='MA603: add moderation reason'; end if;
 update meetany_private.company_reviews set status=p_status,reason=btrim(coalesce(p_reason,'')),updated_at=now() where id=p_id;
 if not found then perform meetany_private.fail('MA302'); end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_id,'review_'||p_status,jsonb_build_object('reason',p_reason));
end $$;
create or replace function public.admin_resolve_plan(p_id uuid,p_approve boolean,p_days integer default 30,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); v meetany_private.plan_requests;
begin
 if p_approve is null or p_days is null or p_days not between 1 and 366 or length(coalesce(p_note,''))>500 then raise exception using errcode='22023',message='invalid plan resolution'; end if;
 select * into v from meetany_private.plan_requests where id=p_id for update;
 if v.id is null or v.status<>'pending' then raise exception using errcode='22023',message='MA604: application already processed'; end if;
 if not exists(select 1 from public.profiles where id=v.company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 update meetany_private.plan_requests set status=case when p_approve then 'approved' else 'declined' end,note=coalesce(p_note,''),updated_at=now() where id=p_id;
 if p_approve then
 insert into meetany_private.company_plans(company_id,plan,expires_at) values(v.company_id,v.plan,now()+make_interval(days=>p_days))
 on conflict(company_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,updated_at=now();
 end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_id,'plan_resolved',jsonb_build_object('approved',p_approve,'days',p_days,'plan',v.plan,'note',p_note));
end $$;
-- Explicit grants, including revoking PostgreSQL's default PUBLIC execution.
do $$
declare f record;
begin
 for f in select oid::regprocedure sig,proname from pg_proc where pronamespace='public'::regnamespace and proname=any(array[
 'company_business_features','company_reviews','my_company_review_targets','save_company_review','my_business_settings','set_company_distributor',
 'request_company_plan','cancel_company_plan_request','admin_business_queue','admin_moderate_review','admin_resolve_plan']) loop
 execute format('revoke all on function %s from public, anonymous, authenticated',f.sig);
 execute format('grant execute on function %s to authenticated',f.sig);
 if f.proname in ('company_business_features','company_reviews') then execute format('grant execute on function %s to anonymous',f.sig); end if;
 end loop;
end $$;
create or replace function public.set_request_alert_preferences(p_enabled boolean,p_categories text[],p_cities text[],p_email_mode text default 'off') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); cats text[]; towns text[]; changed boolean;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_enabled is null or p_email_mode is null or p_email_mode not in ('off','instant','daily')
 or p_categories is null or p_cities is null or cardinality(p_categories)>cardinality(meetany_private.categories()) or cardinality(p_cities)>8
 or array_position(p_categories,null) is not null or array_position(p_cities,null) is not null
 or not p_categories <@ meetany_private.categories() or not p_cities <@ meetany_private.cities() then
  raise exception using errcode='22023',message='invalid request alert preferences';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into cats from unnest(p_categories) x;
 select coalesce(array_agg(distinct x order by x),'{}') into towns from unnest(p_cities) x;
 if 'georgia'=any(towns) then towns:=array['georgia']; end if;
 if p_enabled and (cardinality(cats)=0 or cardinality(towns)=0) then raise exception using errcode='22023',message='select categories and cities'; end if;
 insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities,email_mode)
 values(me.id,p_enabled,cats,towns,p_email_mode)
 on conflict(user_id) do update set enabled=excluded.enabled,categories=excluded.categories,cities=excluded.cities,email_mode=excluded.email_mode,generation=gen_random_uuid()
 where (request_alert_preferences.enabled,request_alert_preferences.categories,request_alert_preferences.cities,request_alert_preferences.email_mode)
 is distinct from (excluded.enabled,excluded.categories,excluded.cities,excluded.email_mode)
 returning true into changed;
 -- A preference change cancels queued delivery, not existing inbox history. No backfill.
 update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null
 where changed and user_id=me.id and status in ('pending','processing');
 return public.request_alert_preferences();
end $$;


commit;
