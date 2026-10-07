-- Draft: GEL amounts reuse offers.price and price_type; delivery_days already exists.
begin;
set local lock_timeout='5s';
create or replace function meetany_private.flow_fail(p_code text) returns void
language plpgsql set search_path='' as $$
begin
 raise exception using errcode='P0001',message=p_code||': '||case p_code
 when 'MA901' then 'resource unavailable' when 'MA902' then 'invalid flow input'
 when 'MA903' then 'invalid stage or action' when 'MA904' then 'stale revision'
 when 'MA905' then 'both parties must confirm terms' when 'MA906' then 'buyer action required'
 else 'flow rejected' end,hint=p_code;
end $$;
revoke all on function meetany_private.flow_fail(text) from public,anonymous,authenticated;
alter table public.offers add column if not exists payment_terms text check (char_length(payment_terms) between 1 and 500);
alter table public.offers add column if not exists valid_until date check (isfinite(valid_until));
alter table public.offers add column if not exists commercial_terms text[] not null default '{}' check (meetany_private.valid_items(commercial_terms));

create or replace function public.set_offer_terms(p_offer_id uuid,p_payment_terms text,p_valid_until date,p_commercial_terms text[],p_expected_updated_at timestamptz)
returns public.offers language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); o public.offers; r public.requests;
begin
 select * into o from public.offers where id=p_offer_id and company_id=me.id;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 select * into r from public.requests where id=o.request_id for update;
 select * into o from public.offers where id=p_offer_id for update;
 if o.id is null or meetany_private.request_state(r)<>'open' then perform meetany_private.flow_fail('MA903'); end if;
 if p_expected_updated_at is null or o.updated_at<>p_expected_updated_at then perform meetany_private.flow_fail('MA904'); end if;
 if (p_payment_terms is not null and length(btrim(p_payment_terms)) not between 1 and 500)
 or (p_valid_until is not null and (not isfinite(p_valid_until) or p_valid_until<meetany_private.today()))
 or p_commercial_terms is null or not meetany_private.valid_items(p_commercial_terms) then perform meetany_private.flow_fail('MA902'); end if;
 update public.offers set payment_terms=btrim(p_payment_terms),valid_until=p_valid_until,commercial_terms=p_commercial_terms,updated_at=clock_timestamp() where id=o.id returning * into o;
 return o;
end $$;

create or replace function public.compare_offers(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 if not exists(select 1 from public.requests where id=p_request_id and owner_id=me.id) then perform meetany_private.flow_fail('MA901'); end if;
 -- Compare total GEL only. Unit prices need the request quantity; negotiable prices cannot win.
 with amounts as (
 select o.*,p.company,p.verified,p.city,
 case when o.price_type='total' then o.price when o.price_type='unit' then o.price*r.quantity end total_gel,
 (o.status<>'declined' and (o.valid_until is null or o.valid_until>=meetany_private.today())) eligible
 from public.offers o join public.requests r on r.id=o.request_id join public.profiles p on p.id=o.company_id
 where o.request_id=p_request_id and not p.blocked
 ), ranked as (
 select a.*,coalesce(eligible and total_gel=min(total_gel) filter(where eligible) over(),false) best_price,
 coalesce(eligible and delivery_days=min(delivery_days) filter(where eligible) over(),false) fastest from amounts a
 ) select coalesce(jsonb_agg(to_jsonb(r) order by total_gel nulls last,id),'[]'::jsonb) into result from ranked r;
 return result;
end $$;
revoke all on function public.set_offer_terms(uuid,text,date,text[],timestamptz),public.compare_offers(uuid) from public,anonymous,authenticated;
grant execute on function public.set_offer_terms(uuid,text,date,text[],timestamptz),public.compare_offers(uuid) to authenticated;
commit;
