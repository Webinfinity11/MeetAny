-- Flow integrity: apply after 20261014-detail-extras.sql. Re-runnable.
-- Response window is at most 14 days initially and never past the requested delivery day
-- (Asia/Tbilisi). Normalize still-open requests too; chosen/archived history stays intact.
begin;
set local lock_timeout='5s';
create or replace function meetany_private.cap_request_expiry() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.needed_by is not null then
  new.expires_at:=least(new.expires_at,((new.needed_by+1)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond');
 end if;
 return new;
end $$;
revoke all on function meetany_private.cap_request_expiry() from public,anonymous,authenticated;
drop trigger if exists cap_request_expiry on public.requests;
create trigger cap_request_expiry before insert or update of needed_by,expires_at on public.requests
 for each row execute function meetany_private.cap_request_expiry();
update public.requests set expires_at=((needed_by+1)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond'
 where status='open' and chosen_offer_id is null and needed_by is not null and expires_at>now()
 and expires_at>((needed_by+1)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond';

create or replace function public.extend_request(p_request_id uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
  s text := meetany_private.request_state(r);
begin
  if r.needed_by < meetany_private.today() then raise exception using errcode='P0001',message='MA118: delivery date has passed',hint='MA118'; end if;
  if s not in ('open', 'expired', 'closed') then perform meetany_private.fail('MA108'); end if;
  if s <> 'open' then
    perform 1 from public.profiles where id = r.owner_id for update;
    if meetany_private.open_count(r.owner_id) >= 5 then perform meetany_private.fail('MA105'); end if;
  end if;
  update public.requests
     set status = 'open',
         expires_at = least(greatest(now(), expires_at) + interval '7 days', now() + interval '21 days')
   where id = r.id
  returning * into r;
  return r;
end
$$;

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
  if meetany_private.request_state(r)<>'open' or o.status<>'sent' then perform meetany_private.flow_fail('MA903'); end if;
  update public.offers set status=case when id=o.id then 'chosen' else 'declined' end where request_id=r.id;
  update public.requests set chosen_offer_id=o.id where id=r.id;
 elsif r.chosen_offer_id<>p_offer_id then perform meetany_private.flow_fail('MA903'); end if;
 insert into meetany_private.deals(request_id,offer_id,buyer_id,supplier_id,quantity,unit,delivery_days,payment_terms,includes)
 values(r.id,o.id,me.id,o.company_id,r.quantity,r.unit,o.delivery_days,o.payment_terms,o.commercial_terms) returning * into d;
 perform meetany_private.deal_event(d,'selected');
 return to_jsonb(d);
end $$;

-- Older callers get the same atomic selection and deal as the current API.
create or replace function public.choose_offer(p_offer_id uuid,p_expected_updated_at timestamptz default null)
returns public.offers language plpgsql security definer set search_path='' as $$
declare o public.offers;
begin
 perform public.select_offer_deal(p_offer_id,p_expected_updated_at);
 select * into o from public.offers where id=p_offer_id;
 return o;
end $$;

-- New catalog saves accept at most 15 items; existing catalogs are never truncated.
create or replace function public.set_my_products(p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); item jsonb; cleaned jsonb:='[]'; product jsonb; keys text[]:='{}'; product_key text;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then perform meetany_private.fail('MA622'); end if;
 if jsonb_array_length(p_items)>15 then perform meetany_private.fail('MA622'); end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 2 and 80
   or (item ? 'photoUrl' and jsonb_typeof(item->'photoUrl') not in ('string','null'))
   or (coalesce(item->>'photoUrl','')<>'' and
       (not coalesce(meetany_private.valid_photo_url(item->>'photoUrl',me.id),false)
        or not coalesce(item->>'photoUrl'=any(me.gallery),false)))
   or (item ? 'note' and jsonb_typeof(item->'note')<>'string') or length(coalesce(item->>'note',''))>200
   or (item ? 'code' and (jsonb_typeof(item->'code')<>'string' or length(item->>'code')>40))
   or (item ? 'unit' and (jsonb_typeof(item->'unit')<>'string' or item->>'unit' not in ('pcs','m2','kg','hour','service','m','l','set','pack')))
   or (item ? 'price' and jsonb_typeof(item->'price')<>'number')
  then perform meetany_private.fail('MA622'); end if;
  -- Cast only after checking the JSON type, so malformed prices also produce MA622.
  if item ? 'price' and ((item->>'price')::numeric<0 or (item->>'price')::numeric>1000000000)
  then perform meetany_private.fail('MA622'); end if;
  product:=jsonb_build_object('name',trim(item->>'name'),'photoUrl',item->>'photoUrl','note',trim(coalesce(item->>'note','')));
  if nullif(trim(item->>'code'),'') is not null then product:=product||jsonb_build_object('code',trim(item->>'code')); end if;
  product_key:=case when product ? 'code' then 'code:'||(product->>'code') else 'name:'||lower(product->>'name') end;
  if product_key=any(keys) then raise exception using errcode='P0001',message='MA623: duplicate product identity',hint='MA623'; end if;
  keys:=array_append(keys,product_key);
  if item ? 'unit' then product:=product||jsonb_build_object('unit',item->>'unit'); end if;
  if item ? 'price' then product:=product||jsonb_build_object('price',item->'price'); end if;
  cleaned:=cleaned||jsonb_build_array(product);
 end loop;
 insert into meetany_private.company_products(company_id,items) values(me.id,cleaned) on conflict(company_id) do update set items=excluded.items;
 return cleaned;
end $$;

create or replace function public.list_matching(p_request_id uuid default null,p_city text default null,p_limit integer default 25,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); target public.requests; words text[]; result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 or (p_city is not null and not meetany_private.is_city(p_city)) then perform meetany_private.flow_fail('MA902'); end if;
 if p_request_id is null then
  if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by score desc,created_at desc,id),'[]') into result from (
   select r.id,r.title,r.category,r.city,r.created_at,70+case when r.city=me.city or r.city=any(me.service_cities) then 30 else 0 end score
   from public.requests r join public.profiles p on p.id=r.owner_id
   where r.owner_id<>me.id and not r.hidden and not p.blocked and meetany_private.request_state(r)='open'
   and r.category=any(me.provide_categories) and (p_city is null or r.city=p_city)
   order by score desc,r.created_at desc,r.id limit p_limit offset p_offset
  ) x;
 else
  select * into target from public.requests where id=p_request_id and owner_id=me.id;
  if not found then perform meetany_private.flow_fail('MA901'); end if;
  words:=meetany_private.match_words(target.title||' '||coalesce(target.body,''));
  select coalesce(jsonb_agg(to_jsonb(x)-'parts' order by score desc,id),'[]') into result from (
   select s.id,s.company,s.city,s.industry,s.verified,s.match,s.notified,
    (s.parts->>'category_points')::int+(s.parts->>'city_points')::int+5*least(3,cardinality(s.hits))
     +least(15,3*s.deals)+least(10,coalesce(round(s.rating*2)::int,0)) score,
    jsonb_strip_nulls(jsonb_build_object('category',s.match,'city',s.parts->>'city','keywords',case when cardinality(s.hits)>0 then to_jsonb(s.hits[1:3]) end,
     'deals',nullif(s.deals,0),'rating',s.rating)) reasons,
    s.parts
   from (
    select p.id,p.company,p.city,p.industry,p.verified,case when m.exact then 'exact' else 'similar' end match,
     exists(select 1 from meetany_private.notifications n where n.user_id=p.id and n.request_id=target.id and n.kind='request_match') notified,
     jsonb_build_object('category_points',case when m.exact then 200 else 100 end,
      'city',case when p.city=target.city or target.city=any(p.service_cities) then 'local' when p.city='georgia' or 'georgia'=any(p.service_cities) or target.city='georgia' then 'georgia' end,
      'city_points',case when p.city=target.city or target.city=any(p.service_cities) then 30 when p.city='georgia' or 'georgia'=any(p.service_cities) or target.city='georgia' then 20 else 0 end) parts,
     meetany_private.word_hits(words,meetany_private.match_words(array_to_string(coalesce(p.offers,'{}')||coalesce(p.business_tags,'{}'),' ')||' '||coalesce((select string_agg(concat_ws(' ',item->>'name',item->>'note'),' ') from meetany_private.company_products cp cross join lateral jsonb_array_elements(cp.items) item where cp.company_id=p.id),''))) hits,
     (select count(*)::int from meetany_private.deals d where d.supplier_id=p.id and d.stage='complete') deals,
     (select round(avg(v.rating),1) from meetany_private.company_reviews v join public.profiles a on a.id=v.author_id and not a.blocked
      where v.company_id=p.id and v.status='published') rating
    from meetany_private.matching_suppliers(target.category,me.id) m join public.profiles p on p.id=m.id
    where p_city is null or p.city=p_city or p_city=any(p.service_cities) or p.city='georgia' or 'georgia'=any(p.service_cities)
   ) s
   order by score desc,s.id limit p_limit offset p_offset
  ) x;
 end if;
 return result;
end $$;
commit;
