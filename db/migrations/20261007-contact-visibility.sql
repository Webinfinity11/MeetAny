-- Requires offer-terms + deals. Deploy only together with the documented API/client changes.
begin;
set local lock_timeout='5s';
revoke select on public.profiles from public,anonymous,authenticated;
revoke select(phone,email) on public.profiles from public,anonymous,authenticated;
grant select(id,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng,logo_url,gallery) on public.profiles to anonymous,authenticated;
-- Explicit safe projection; my_profile still returns one's own contacts.
create or replace function public.get_deal_contact(p_deal_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals; result jsonb;
begin
 select * into d from meetany_private.deals where id=p_deal_id and (me.id in (buyer_id,supplier_id) or me.role='admin');
 if not found or (d.stage='cancelled' and me.role<>'admin') then perform meetany_private.flow_fail('MA901'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'company',p.company,'phone',p.phone,'email',p.email) order by p.id),'[]') into result
 from public.profiles p where p.id in (d.buyer_id,d.supplier_id) and (me.role='admin' or (p.id<>me.id and not p.blocked));
 return result;
end $$;
-- Keep the legacy contact API for actual legacy choices, but respect cancellation on new deals.
create or replace function public.contact_for_request(p_request_id uuid)
returns table(name text,company text,phone text,email text)
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=meetany_private.uid(); r public.requests; o public.offers; other uuid;
begin
 if me is null or not meetany_private.can_write() then return; end if;
 select * into r from public.requests where id=p_request_id;
 if r.id is null or r.chosen_offer_id is null then return; end if;
 if exists(select 1 from meetany_private.deals where request_id=r.id and stage='cancelled') then return; end if;
 select * into o from public.offers where id=r.chosen_offer_id;
 if me=r.owner_id then other:=o.company_id; elsif me=o.company_id then other:=r.owner_id; else return; end if;
 return query select p.name,p.company,p.phone,p.email from public.profiles p where p.id=other and not p.blocked;
end $$;
create or replace function public.log_contact_event(p_target_kind text,p_target_id uuid,p_kind text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles; actor uuid:=meetany_private.uid(); at_time timestamptz; event_id uuid;
begin
 me:=meetany_private.require_user();
 if p_target_kind is null or p_target_kind not in ('company','request') or p_target_id is null
 or p_kind is null or p_kind not in ('reveal','call') or p_source is null
 or (p_target_kind='company' and p_source not in ('company-list','company-profile','company-partnership'))
 or (p_target_kind='request' and p_source not in ('request-owner','chosen-offer')) then
  raise exception using errcode='22023',message='invalid contact event';
 end if;
 if p_target_kind='company' then
  if not exists(select 1 from public.profiles where id=p_target_id and role='company' and not blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 else
  if not exists(select 1 from public.requests r join public.profiles p on p.id=r.owner_id where r.id=p_target_id and not r.hidden and not p.blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 end if;
 -- Logging is not contact authorization. The same selected-partner boundary is enforced here.
 if me.role<>'admin' and not exists(
  select 1 from public.requests r join public.offers o on o.id=r.chosen_offer_id
  where ((p_target_kind='company' and o.company_id=p_target_id and r.owner_id=me.id)
    or (p_target_kind='request' and r.id=p_target_id and me.id in (r.owner_id,o.company_id)))
  and not exists(select 1 from meetany_private.deals d where d.request_id=r.id and d.stage='cancelled')
  and not exists(select 1 from public.profiles p where p.id in (r.owner_id,o.company_id) and p.blocked)
 ) then perform meetany_private.flow_fail('MA901'); end if;
 -- Serialize the anonymous global cap, and each signed-in actor's writes.
 perform pg_advisory_xact_lock(hashtextextended('meetany-contact:'||coalesce(actor::text,'anonymous'),0));
 at_time:=clock_timestamp();
 if exists(select 1 from meetany_private.contact_events where actor_id is not distinct from actor
  and target_kind=p_target_kind and target_id=p_target_id and kind=p_kind and created_at>at_time-interval '1 minute')
 or (actor is null and (select count(*) from meetany_private.contact_events where actor_id is null and created_at>at_time-interval '1 minute')>=120) then
  return jsonb_build_object('recorded',false);
 end if;
 insert into meetany_private.contact_events(actor_id,actor_role,target_kind,target_id,kind,source,created_at)
 values(actor,coalesce(me.role,'anonymous'),p_target_kind,p_target_id,p_kind,p_source,at_time) returning id into event_id;
 return jsonb_build_object('recorded',true,'id',event_id);
end $$;

revoke all on function public.get_deal_contact(uuid),public.contact_for_request(uuid),public.log_contact_event(text,uuid,text,text) from public,anonymous,authenticated;
grant execute on function public.get_deal_contact(uuid),public.contact_for_request(uuid),public.log_contact_event(text,uuid,text,text) to authenticated;
commit;
