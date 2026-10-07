-- Requires 20261007-offer-terms. No legacy choices are backfilled automatically.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.deals (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.requests(id),
 offer_id uuid not null unique references public.offers(id),
 buyer_id uuid not null references public.profiles(id), supplier_id uuid not null references public.profiles(id),
 stage text not null default 'selected' check(stage in ('selected','discuss','terms','progress','complete','cancelled')),
 selected_at timestamptz not null default now(),discuss_at timestamptz,terms_at timestamptz,progress_at timestamptz,complete_at timestamptz,cancelled_at timestamptz,
 revision integer not null default 1,
 total_price numeric(12,2) check(total_price>0 and total_price<=1000000000),
 quantity numeric(13,3) check(quantity>0 and quantity<=1000000000),unit text check(unit is null or meetany_private.is_unit(unit)),
 delivery_days integer check(delivery_days between 0 and 365),delivery_date date check(isfinite(delivery_date)),delivery_place text check(length(delivery_place) between 1 and 500),
 payment_terms text check(length(payment_terms) between 1 and 500),includes text[] not null default '{}' check(meetany_private.valid_items(includes)),
 buyer_confirmed_at timestamptz,supplier_confirmed_at timestamptz,
 rating integer check(rating between 1 and 5),review text check(length(review)<=2000),rated_at timestamptz,
 check(buyer_id<>supplier_id),check((quantity is null)=(unit is null)),
 check(stage not in ('progress','complete') or (buyer_confirmed_at is not null and supplier_confirmed_at is not null)),
 check(stage<>'complete' or complete_at is not null),check(rating is null or stage='complete')
);
alter table meetany_private.deals enable row level security;
revoke all on meetany_private.deals from public,anonymous,authenticated;
grant select on meetany_private.deals to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='meetany_private' and tablename='deals' and policyname='deals_parties') then
 create policy deals_parties on meetany_private.deals for select to authenticated using
 (meetany_private.can_write() and (meetany_private.uid() in (buyer_id,supplier_id) or meetany_private.is_admin()));
 end if;
end $$;
-- Notifications retain their existing schema/kinds. A private companion records each revision;
-- the existing offer_chosen inbox item is refreshed for each recipient, without queuing
-- misleading repeated offer-chosen emails. Selection itself uses the existing outbox trigger.
create table if not exists meetany_private.deal_events (
 id uuid primary key default gen_random_uuid(),deal_id uuid not null references meetany_private.deals(id),
 revision integer not null,actor_id uuid not null references public.profiles(id),action text not null,
 created_at timestamptz not null default now(),unique(deal_id,revision)
);
alter table meetany_private.deal_events enable row level security;
revoke all on meetany_private.deal_events from public,anonymous,authenticated;
alter table meetany_private.notifications add column if not exists deal_id uuid references meetany_private.deals(id);
alter table meetany_private.notifications add column if not exists deal_action text;
alter table meetany_private.notifications add column if not exists deal_revision integer;
create or replace function meetany_private.deal_event(p_deal meetany_private.deals,p_action text) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into meetany_private.deal_events(deal_id,revision,actor_id,action) values(p_deal.id,p_deal.revision,meetany_private.uid(),p_action);
 insert into meetany_private.notifications(user_id,request_id,offer_id,kind,deal_id,deal_action,deal_revision)
 select u,p_deal.request_id,p_deal.offer_id,'offer_chosen',p_deal.id,p_action,p_deal.revision from unnest(array[p_deal.buyer_id,p_deal.supplier_id]) u
 where u<>meetany_private.uid() and exists(select 1 from public.profiles where id=u and not blocked)
 on conflict(user_id,offer_id,kind) do update set read_at=null,created_at=clock_timestamp(),deal_id=excluded.deal_id,deal_action=excluded.deal_action,deal_revision=excluded.deal_revision;
end $$;
revoke all on function meetany_private.deal_event(meetany_private.deals,text) from public,anonymous,authenticated;
create or replace function public.select_offer_deal(p_offer_id uuid,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); o public.offers; r public.requests; d meetany_private.deals;
begin
 select * into o from public.offers where id=p_offer_id;
 select * into r from public.requests where id=o.request_id for update;
 if r.id is null or r.owner_id<>me.id then perform meetany_private.flow_fail('MA901'); end if;
 select * into d from meetany_private.deals where request_id=r.id;
 if found then
  if d.offer_id<>p_offer_id or d.stage='cancelled' then perform meetany_private.flow_fail('MA903'); end if;
  return to_jsonb(d);
 end if;
 select * into o from public.offers where id=p_offer_id for update;
 if p_expected_updated_at is not null and o.updated_at<>p_expected_updated_at then perform meetany_private.flow_fail('MA904'); end if;
 if exists(select 1 from public.profiles where id=o.company_id and blocked) then perform meetany_private.flow_fail('MA901'); end if;
 if r.chosen_offer_id is null then
  if o.valid_until<meetany_private.today() then perform meetany_private.flow_fail('MA903'); end if;
  perform public.choose_offer(p_offer_id,p_expected_updated_at);
 elsif r.chosen_offer_id<>p_offer_id then perform meetany_private.flow_fail('MA903'); end if;
 insert into meetany_private.deals(request_id,offer_id,buyer_id,supplier_id,quantity,unit,delivery_days,payment_terms,includes)
 values(r.id,o.id,me.id,o.company_id,r.quantity,r.unit,o.delivery_days,o.payment_terms,o.commercial_terms) returning * into d;
 perform meetany_private.deal_event(d,'selected');
 return to_jsonb(d);
end $$;

create or replace function public.get_deal(p_deal_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and (me.id in (buyer_id,supplier_id) or me.role='admin');
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 return to_jsonb(d)||jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(e) order by revision),'[]') from meetany_private.deal_events e where deal_id=d.id));
end $$;

create or replace function public.propose_deal_terms(p_deal_id uuid,p_expected_revision integer,p_total_price numeric,p_quantity numeric,p_unit text,p_delivery_days integer,p_delivery_date date,p_delivery_place text,p_payment_terms text,p_includes text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and me.id in (buyer_id,supplier_id) for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage not in ('discuss','terms') then perform meetany_private.flow_fail('MA903'); end if;
 if p_total_price is null or p_total_price not between 0.01 and 1000000000
 or p_quantity is null or p_quantity not between 0.001 and 1000000000
 or not coalesce(meetany_private.is_unit(p_unit),false)
 or p_delivery_days is null or p_delivery_days not between 0 and 365
 or (p_delivery_date is not null and (not isfinite(p_delivery_date) or p_delivery_date<meetany_private.today()))
 or length(btrim(coalesce(p_delivery_place,''))) not between 1 and 500
 or length(btrim(coalesce(p_payment_terms,''))) not between 1 and 500
 or p_includes is null or not meetany_private.valid_items(p_includes) then perform meetany_private.flow_fail('MA902'); end if;
 update meetany_private.deals set stage='terms',terms_at=coalesce(terms_at,now()),revision=revision+1,
 total_price=p_total_price,quantity=p_quantity,unit=p_unit,delivery_days=p_delivery_days,delivery_date=p_delivery_date,
 delivery_place=btrim(p_delivery_place),payment_terms=btrim(p_payment_terms),includes=p_includes,
 buyer_confirmed_at=null,supplier_confirmed_at=null where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'propose_terms');return to_jsonb(d);
end $$;

-- discuss/cancel are explicit stage moves. progress requires two confirmations; complete is buyer-only.
create or replace function public.advance_deal(p_deal_id uuid,p_stage text,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and me.id in (buyer_id,supplier_id) for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if p_stage is null or not ((p_stage='discuss' and d.stage='selected') or (p_stage='progress' and d.stage='terms')
 or (p_stage='complete' and d.stage='progress') or (p_stage='cancelled' and d.stage in ('selected','discuss','terms'))) then perform meetany_private.flow_fail('MA903'); end if;
 if p_stage='progress' and (d.buyer_confirmed_at is null or d.supplier_confirmed_at is null) then perform meetany_private.flow_fail('MA905'); end if;
 if p_stage='complete' and me.id<>d.buyer_id then perform meetany_private.flow_fail('MA906'); end if;
 update meetany_private.deals set stage=p_stage,revision=revision+1,
 discuss_at=case when p_stage='discuss' then now() else discuss_at end,
 progress_at=case when p_stage='progress' then now() else progress_at end,
 complete_at=case when p_stage='complete' then now() else complete_at end,
 cancelled_at=case when p_stage='cancelled' then now() else cancelled_at end where id=d.id returning * into d;
 perform meetany_private.deal_event(d,p_stage);return to_jsonb(d);
end $$;
create or replace function public.confirm_deal_terms(p_deal_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and me.id in (buyer_id,supplier_id) for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage<>'terms' or d.total_price is null then perform meetany_private.flow_fail('MA903'); end if;
 if (me.id=d.buyer_id and d.buyer_confirmed_at is not null) or (me.id=d.supplier_id and d.supplier_confirmed_at is not null) then return to_jsonb(d); end if;
 update meetany_private.deals set revision=revision+1,
 buyer_confirmed_at=case when me.id=buyer_id then now() else buyer_confirmed_at end,
 supplier_confirmed_at=case when me.id=supplier_id then now() else supplier_confirmed_at end where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'confirm_terms');return to_jsonb(d);
end $$;
create or replace function public.rate_deal(p_deal_id uuid,p_rating integer,p_review text,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and buyer_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage<>'complete' or d.rating is not null then perform meetany_private.flow_fail('MA903'); end if;
 if p_rating is null or p_rating not between 1 and 5 or length(coalesce(p_review,''))>2000 then perform meetany_private.flow_fail('MA902'); end if;
 update meetany_private.deals set rating=p_rating,review=btrim(p_review),rated_at=now(),revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'rated');return to_jsonb(d);
end $$;
revoke all on function public.select_offer_deal(uuid,timestamptz),public.get_deal(uuid),public.propose_deal_terms(uuid,integer,numeric,numeric,text,integer,date,text,text,text[]),public.advance_deal(uuid,text,integer),public.confirm_deal_terms(uuid,integer),public.rate_deal(uuid,integer,text,integer) from public,anonymous,authenticated;
grant execute on function public.select_offer_deal(uuid,timestamptz),public.get_deal(uuid),public.propose_deal_terms(uuid,integer,numeric,numeric,text,integer,date,text,text,text[]),public.advance_deal(uuid,text,integer),public.confirm_deal_terms(uuid,integer),public.rate_deal(uuid,integer,text,integer) to authenticated;
create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.deal_id,n.deal_action,n.deal_revision,n.request_id,n.created_at,n.read_at,r.title from meetany_private.notifications n
  join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
  and (p_cursor is null or (n.created_at,n.id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), page as(select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;


commit;
