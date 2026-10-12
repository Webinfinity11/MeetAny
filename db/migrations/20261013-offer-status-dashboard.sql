-- Offer "viewed" status, "not selected" notifications for the other companies, and the buyer/supplier deal list for the dashboard.
-- Re-runnable and independent of the other flows (needs only offers, notifications and deals).
begin;
set local lock_timeout='5s';

alter table public.offers add column if not exists viewed_at timestamptz;

-- Only the request author marks sent offers as viewed; chosen/declined ones keep their own status.
create or replace function public.mark_request_offers_viewed(p_request_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); n integer;
begin
 if not exists(select 1 from public.requests where id=p_request_id and owner_id=me.id) then perform meetany_private.flow_fail('MA901'); end if;
 update public.offers set viewed_at=now() where request_id=p_request_id and viewed_at is null and status='sent';
 get diagnostics n=row_count;
 return n;
end $$;

-- A new version of an offer has not been seen by the buyer: editing the content clears the mark.
create or replace function meetany_private.reset_offer_viewed() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status=old.status and (
  new.body is distinct from old.body or new.price is distinct from old.price or new.price_type is distinct from old.price_type
  or new.vat_included is distinct from old.vat_included or new.delivery_days is distinct from old.delivery_days
  or new.delivery_included is distinct from old.delivery_included or new.payment_terms is distinct from old.payment_terms
  or new.valid_until is distinct from old.valid_until or new.commercial_terms is distinct from old.commercial_terms
 ) then new.viewed_at:=null; end if;
 return new;
end $$;
drop trigger if exists reset_offer_viewed on public.offers;
create trigger reset_offer_viewed before update on public.offers for each row execute function meetany_private.reset_offer_viewed();

-- Companies whose offer was not selected get an in-app notification only (no e-mail, nothing in the outbox).
alter table meetany_private.notifications drop constraint if exists notifications_kind_check;
alter table meetany_private.notifications add constraint notifications_kind_check check(kind in ('offer_received','offer_chosen','request_match','offer_declined'));

create or replace function meetany_private.notify_offer() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; target_offer uuid; target_request uuid; event_kind text; event_id uuid;
begin
 if tg_table_name='offers' then
  select owner_id into recipient from public.requests where id=new.request_id;
  target_offer:=new.id; target_request:=new.request_id; event_kind:='offer_received';
 else
  if new.chosen_offer_id is null or new.chosen_offer_id is not distinct from old.chosen_offer_id then return new; end if;
  insert into meetany_private.notifications(user_id,request_id,offer_id,kind)
  select o.company_id,new.id,o.id,'offer_declined' from public.offers o join public.profiles p on p.id=o.company_id and not p.blocked
  where o.request_id=new.id and o.id<>new.chosen_offer_id on conflict do nothing;
  select company_id into recipient from public.offers where id=new.chosen_offer_id;
  target_offer:=new.chosen_offer_id; target_request:=new.id; event_kind:='offer_chosen';
 end if;
 if recipient is null or not exists(select 1 from public.profiles where id=recipient and not blocked) then return new; end if;
 insert into meetany_private.notifications(user_id,request_id,offer_id,kind)
 values(recipient,target_request,target_offer,event_kind) on conflict do nothing returning id into event_id;
 if event_id is not null and exists(select 1 from meetany_private.notification_preferences where user_id=recipient and email_offers) then
  insert into meetany_private.notification_outbox(notification_id) values(event_id) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists notify_new_offer on public.offers;
create trigger notify_new_offer after insert on public.offers for each row execute function meetany_private.notify_offer();
drop trigger if exists notify_chosen_offer on public.requests;
create trigger notify_chosen_offer after update of chosen_offer_id on public.requests for each row execute function meetany_private.notify_offer();

-- Every deal the caller takes part in (as buyer or supplier), most recently active first.
create or replace function public.list_my_deals() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return coalesce((select jsonb_agg(x.j order by x.latest_at desc,x.id) from (
  select d.id,greatest(d.selected_at,d.discuss_at,d.terms_at,d.progress_at,d.complete_at,d.cancelled_at,d.rated_at,
   (select max(e.created_at) from meetany_private.deal_events e where e.deal_id=d.id)) latest_at,
   to_jsonb(d)||jsonb_build_object('request_title',r.title,'latest_at',greatest(d.selected_at,d.discuss_at,d.terms_at,d.progress_at,d.complete_at,d.cancelled_at,d.rated_at,
   (select max(e.created_at) from meetany_private.deal_events e where e.deal_id=d.id))) j
  from meetany_private.deals d join public.requests r on r.id=d.request_id
  where me.id in (d.buyer_id,d.supplier_id)) x),'[]'::jsonb);
end $$;

revoke all on function public.mark_request_offers_viewed(uuid),public.list_my_deals() from public,anonymous,authenticated;
grant execute on function public.mark_request_offers_viewed(uuid),public.list_my_deals() to authenticated;
revoke all on function meetany_private.reset_offer_viewed(),meetany_private.notify_offer() from public,anonymous,authenticated;
commit;
