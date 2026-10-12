-- Admin management v2 (perfection round 2026-10-12, PLAN.md §4.4).
-- Deals list and forced stage, one verification status with a return reason, verify/unverify reasons,
-- document-status filter, legal fields in admin_edit_profile, delete guard for requests with a deal,
-- admin budget/preferences, expired-offer filter, deal issue outcomes, reviews list, reporter and
-- company notices, and the audit rows for all of it. Re-runnable; every write is admin-only and audited.
begin;

-- ============================================================= schema
alter table public.profiles add column if not exists verification_note text;
alter table public.profiles drop constraint if exists profiles_verification_note_check;
alter table public.profiles add constraint profiles_verification_note_check check (verification_note is null or char_length(verification_note) between 3 and 500);

alter table meetany_private.deal_issues add column if not exists outcome text;
alter table meetany_private.deal_issues drop constraint if exists deal_issues_outcome_check;
alter table meetany_private.deal_issues add constraint deal_issues_outcome_check check (outcome is null or outcome in ('resolved','rejected','cancelled'));
update meetany_private.deal_issues set outcome='resolved' where status='resolved' and outcome is null;

-- Account notices without a request: verification decisions for a company, report decisions for the reporter.
alter table meetany_private.notifications add column if not exists detail jsonb;
alter table meetany_private.notifications alter column request_id drop not null;
alter table meetany_private.notifications drop constraint if exists notifications_kind_check;
alter table meetany_private.notifications add constraint notifications_kind_check check (kind in ('offer_received','offer_chosen','request_match','offer_declined','verification_reviewed','report_resolved'));
alter table meetany_private.notifications drop constraint if exists notifications_offer_kind_check;
alter table meetany_private.notifications add constraint notifications_offer_kind_check check (
  (kind in ('request_match','verification_reviewed','report_resolved') and offer_id is null)
  or (kind in ('offer_received','offer_chosen','offer_declined') and offer_id is not null));
alter table meetany_private.notifications drop constraint if exists notifications_request_kind_check;
alter table meetany_private.notifications add constraint notifications_request_kind_check check (
  request_id is not null or kind in ('verification_reviewed','report_resolved'));

-- New audit actions and the deal target.
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check check (action in (
  'request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify',
  'offer.delete','user.photo_remove','edit_profile','edit_request',
  'company.verification_review','request.preferences','deal.stage','deal.issue_resolve'));
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_target_type_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_target_type_check check (target_type in ('request','user','offer','deal'));

-- ============================================================= notices
create or replace function meetany_private.account_notice(p_user uuid, p_kind text, p_detail jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into meetany_private.notifications(user_id,request_id,offer_id,kind,detail)
  select p_user,null,null,p_kind,p_detail where exists(select 1 from public.profiles where id=p_user and not blocked);
$$;
revoke all on function meetany_private.account_notice(uuid,text,jsonb) from public;

create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.deal_id,n.deal_action,n.deal_revision,n.request_id,n.created_at,n.read_at,n.detail,coalesce(r.title,n.detail->>'title') as title from meetany_private.notifications n
  left join public.requests r on r.id=n.request_id
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
  and (n.request_id is null or (r.id is not null and (not r.hidden or r.owner_id=me.id)))
  and (p_cursor is null or (n.created_at,n.id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), page as(select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.engagement_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return jsonb_build_object('version',2,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'savedRequestIds',coalesce((select jsonb_agg(s.request_id) from meetany_private.saved_requests s join public.requests r on r.id=s.request_id and not r.hidden join public.profiles o on o.id=r.owner_id and not o.blocked where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n left join public.requests r on r.id=n.request_id
  where n.user_id=me.id and n.read_at is null
  and (n.request_id is null or (r.id is not null and (not r.hidden or r.owner_id=me.id)))
  and case when n.kind<>'request_match' then true else meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked) end),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false),
 'requestAlerts',case when me.role='company' then public.request_alert_preferences() else null end);
end $$;

-- ============================================================= verification: one status, with reasons
-- verify -> documents approved; unverify -> documents returned (unless none were ever sent), note kept.
create or replace function meetany_private.admin_apply_verified(p_actor uuid, p_user_id uuid, p_verified boolean, p_reason text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare previous public.profiles; v public.profiles; v_verified boolean:=coalesce(p_verified,false);
begin
  select * into previous from public.profiles where id=p_user_id and role='company' for update;
  if not found then perform meetany_private.fail('MA303'); end if;
  update public.profiles
     set verified=v_verified,
         verified_at=case when not v_verified then null when verified then verified_at else now() end,
         verification_documents_status=case when v_verified then 'approved'
           when verification_documents_status='not_submitted' then 'not_submitted' else 'rejected' end,
         verification_note=case when v_verified then null else coalesce(p_reason,verification_note) end
   where id=p_user_id returning * into v;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (p_actor,'user',p_user_id,case when v_verified then 'company.verify' else 'company.unverify' end,p_reason,
          jsonb_build_object('verified',previous.verified,'documents',previous.verification_documents_status),
          jsonb_build_object('verified',v.verified,'documents',v.verification_documents_status));
  if previous.verified is distinct from v.verified or previous.verification_documents_status is distinct from v.verification_documents_status then
    perform meetany_private.account_notice(p_user_id,'verification_reviewed',jsonb_build_object(
      'title',case when v_verified then 'კომპანია ვერიფიცირებულია' else 'ვერიფიკაციის დოკუმენტები დაბრუნდა' end,
      'status',v.verification_documents_status,'note',v.verification_note));
  end if;
  return v;
end $$;
revoke all on function meetany_private.admin_apply_verified(uuid,uuid,boolean,text) from public;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := meetany_private.require_admin();
begin
  perform meetany_private.admin_apply_verified(me.id,p_user_id,p_verified,null);
end $$;

-- Reasoned variant: unverify needs a reason (MA304); verify may carry one.
create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := meetany_private.require_admin(); v_reason text := meetany_private.moderation_reason(p_reason);
begin
  if not coalesce(p_verified,false) and v_reason is null then perform meetany_private.fail('MA304'); end if;
  perform meetany_private.admin_apply_verified(me.id,p_user_id,p_verified,v_reason);
end $$;

create or replace function public.review_verification(p_profile_id uuid, p_status text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
begin
  return public.review_verification(p_profile_id,p_status,null);
end $$;

-- approved -> verified; rejected -> returned with a reason (3–500, MA304). Only pending documents (MA903).
create or replace function public.review_verification(p_profile_id uuid, p_status text, p_note text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_admin(); p public.profiles; v_note text:=meetany_private.moderation_reason(p_note);
begin
  select * into p from public.profiles where id=p_profile_id and role='company' for update;
  if not found or p_status is null or p_status not in('approved','rejected') or p.verification_documents_status<>'pending' then perform meetany_private.flow_fail('MA903'); end if;
  if p_status='rejected' and v_note is null then perform meetany_private.fail('MA304'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p.id,'company.verification_review',v_note,jsonb_build_object('documents',p.verification_documents_status),jsonb_build_object('documents',p_status));
  p := meetany_private.admin_apply_verified(me.id,p.id,p_status='approved',v_note);
  return p;
end $$;

create or replace function public.verification_record(p_profile_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_user(); p public.profiles;
begin
 if me.id<>p_profile_id and me.role<>'admin' then perform meetany_private.flow_fail('MA901'); end if;
 select * into p from public.profiles where id=p_profile_id and role='company';
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 return jsonb_build_object('status',p.verification_documents_status,'legal_name',p.legal_name,'registration_code',p.registration_code,
   'legal_form',p.legal_form,'verified',p.verified,'note',p.verification_note);
end $$;

-- Users search: + documents status filter (companies that actually sent documents).
drop function if exists public.admin_search_users(text,text,boolean,boolean,jsonb,integer);
create or replace function public.admin_search_users(p_q text default null, p_role text default null, p_blocked boolean default null, p_verified boolean default null, p_cursor jsonb default null, p_limit integer default 25, p_doc_status text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_q),'');
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_role is not null and p_role not in ('client','company','admin') then
    raise exception using errcode = '22023', message = 'invalid user role'; end if;
  if p_doc_status is not null and p_doc_status not in ('not_submitted','pending','approved','rejected') then
    raise exception using errcode = '22023', message = 'invalid documents status'; end if;
  with source as (select p.* from public.profiles p),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.name || ' ' || x.company || ' ' || x.email || ' ' || x.phone)) > 0)
       and (p_role is null or x.role=p_role) and (p_blocked is null or x.blocked=p_blocked)
       and (p_verified is null or x.verified=p_verified)
       and (p_doc_status is null or (x.role='company' and x.verification_documents_status=p_doc_status))
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

-- Profile edit: + legal and onboarding fields (the column checks validate them).
create or replace function public.admin_edit_profile(p_id uuid,p_patch jsonb) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.profiles; v public.profiles; k text; origin text:=meetany_private.photo_origin();
begin
 select * into old from public.profiles where id=p_id for update;
 if not found then perform meetany_private.fail('MA302'); end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception using errcode='22023',message='invalid profile'; end if;
 for k in select jsonb_object_keys(p_patch) loop
 if k<>all(array['name','company','phone','city','industry','about','address','lat','lng','logo_url','gallery','offers','seeks','service_cities',
   'legal_name','registration_code','legal_form','website','founded_year','employee_band','contact_position','account_intent']) then raise exception using errcode='22023',message='unsupported profile field'; end if;
 end loop;
 v:=jsonb_populate_record(old,p_patch);
 if v.lat is not null and (v.lat not between -90 and 90 or v.lng is null or v.lng not between -180 and 180) or (v.lat is null and v.lng is not null) then perform meetany_private.fail('MA413'); end if;
 if v.logo_url is not null and (origin is null or not meetany_private.valid_photo_url(v.logo_url,p_id) or lower(left(v.logo_url,length(origin)+1))<>origin||'/' or substr(v.logo_url,length(origin)+2,42)<>p_id::text||'/logo-') then perform meetany_private.fail('MA115'); end if;
 if exists(select 1 from unnest(v.gallery) u where origin is null or lower(left(u,length(origin)+1))<>origin||'/' or substr(u,length(origin)+2,45)<>p_id::text||'/gallery-') then perform meetany_private.fail('MA116'); end if;
 update public.profiles set name=btrim(v.name),company=btrim(v.company),phone=v.phone,city=v.city,industry=v.industry,about=btrim(v.about),address=nullif(btrim(v.address),''),lat=v.lat,lng=v.lng,logo_url=v.logo_url,gallery=v.gallery,offers=v.offers,seeks=v.seeks,service_cities=v.service_cities,
   legal_name=nullif(btrim(v.legal_name),''),registration_code=nullif(btrim(v.registration_code),''),legal_form=nullif(btrim(v.legal_form),''),
   website=nullif(btrim(v.website),''),founded_year=v.founded_year,employee_band=nullif(v.employee_band,''),contact_position=nullif(btrim(v.contact_position),''),
   account_intent=coalesce(nullif(v.account_intent,''),old.account_intent)
  where id=p_id returning * into v;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,old_flags,new_flags) values(me.id,'user',p_id,'edit_profile',to_jsonb(old),to_jsonb(v));
 return v;
end $$;

-- ============================================================= requests
-- A request with a deal cannot be deleted (the deal keeps it): MA305, checked before anything changes.
create or replace function public.admin_delete_request_v2(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.requests;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  if exists(select 1 from meetany_private.deals where request_id=p_request_id) then
    raise exception using errcode='P0001', message='MA305: request has a deal', hint='MA305'; end if;
  delete from public.requests where id=p_request_id returning * into previous;
  if not found then perform meetany_private.fail('MA106'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'request',p_request_id,'request.delete',v_reason,
    jsonb_build_object('hidden',previous.hidden,'deleted',false),jsonb_build_object('deleted',true));
end $$;

-- Budget and preferences of any request (same rules as the owner's set_request_preferences, any state).
create or replace function meetany_private.valid_request_preferences(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 or exists(select 1 from jsonb_object_keys(p) k where k not in('specification','design','supplierTypes','certificates','verifiedOnly','flexibility','budgetType','budgetMin','budgetMax','budgetPrivate','payment','vatInvoice','deferredPayment')) then return false; end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('specification','design','certificates','payment') and jsonb_typeof(x.value)<>'string') then return false; end if;
 if p ? 'design' and p->>'design' not in('','ready','needed','none') then return false; end if;
 if length(coalesce(p->>'specification',''))>2000 or length(coalesce(p->>'design',''))>120 or length(coalesce(p->>'payment',''))>500 or length(coalesce(p->>'certificates',''))>500 then return false; end if;
 if p ? 'flexibility' then
  if jsonb_typeof(p->'flexibility')<>'number' then return false; end if;
  if (p->>'flexibility')::numeric not between 0 and 30 then return false; end if;
 end if;
 if p ? 'supplierTypes' then
  if jsonb_typeof(p->'supplierTypes')<>'array' then return false; end if;
  if jsonb_array_length(p->'supplierTypes')>3 or exists(select 1 from jsonb_array_elements(p->'supplierTypes') t where jsonb_typeof(t)<>'string' or t#>>'{}' not in('manufacturer','distributor','service')) then return false; end if;
 end if;
 if coalesce(p->>'budgetType','negotiable') not in('range','exact','negotiable') then return false; end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetMin','budgetMax') and jsonb_typeof(x.value)<>'number') then return false; end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetMin','budgetMax') and (x.value::text)::numeric not between 0 and 1000000000) then return false; end if;
 if coalesce(p->>'budgetType','negotiable')<>'negotiable' then
  if not p ? 'budgetMin' then return false; end if;
  if (p->>'budgetMin')::numeric<=0 then return false; end if;
  if p->>'budgetType'='range' and (not p ? 'budgetMax' or (p->>'budgetMax')::numeric<(p->>'budgetMin')::numeric) then return false; end if;
 end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetPrivate','verifiedOnly','vatInvoice','deferredPayment') and jsonb_typeof(x.value)<>'boolean') then return false; end if;
 return true;
end $$;

create or replace function public.admin_set_request_preferences(p_request_id uuid, p_preferences jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_admin(); r public.requests; p jsonb:=p_preferences; old jsonb;
begin
 select * into r from public.requests where id=p_request_id for update;
 if not found then perform meetany_private.fail('MA106'); end if;
 if not meetany_private.valid_request_preferences(p) then perform meetany_private.flow_fail('MA902'); end if;
 select preferences into old from meetany_private.request_preferences where request_id=r.id;
 insert into meetany_private.request_preferences(request_id,preferences) values(r.id,p) on conflict(request_id) do update set preferences=excluded.preferences;
 update public.requests set
  budget_type=case when p->>'budgetType' in('range','exact') and not coalesce((p->>'budgetPrivate')::boolean,false) then p->>'budgetType' end,
  budget_min=case when p->>'budgetType' in('range','exact') and not coalesce((p->>'budgetPrivate')::boolean,false) then (p->>'budgetMin')::numeric end,
  budget_max=case when p->>'budgetType'='range' and not coalesce((p->>'budgetPrivate')::boolean,false) then (p->>'budgetMax')::numeric end
 where id=r.id;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,old_flags,new_flags)
 values(me.id,'request',r.id,'request.preferences',coalesce(old,'{}'::jsonb),p);
 return p;
end $$;

-- ============================================================= offers: + expired filter
drop function if exists public.admin_search_offers(text,text,jsonb,integer);
create or replace function public.admin_search_offers(p_q text default null, p_status text default null, p_cursor jsonb default null, p_limit integer default 25, p_expired boolean default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_q),'');
  v_today date := meetany_private.today();
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_status is not null and p_status not in ('sent','chosen','declined') then
    raise exception using errcode = '22023', message = 'invalid offer status'; end if;
  with source as (
    select o.*, coalesce(nullif(p.company,''),p.name) as company_name,
           r.title as request_title, r.hidden as request_hidden, p.name as search_name,
           (o.valid_until is not null and o.valid_until < v_today) as expired,
           (select d.id from meetany_private.deals d where d.offer_id=o.id) as deal_id
    from public.offers o join public.profiles p on p.id=o.company_id
    join public.requests r on r.id=o.request_id
  ), filtered as materialized (
    select * from source x where x.created_at <= v_asof
      and (v_q is null or position(lower(v_q) in lower(concat_ws(' ',x.id::text,x.request_id::text,x.company_id::text,x.body,x.company_name,x.search_name,x.request_title))) > 0)
      and (p_status is null or x.status=p_status)
      and (p_expired is null or x.expired=p_expired)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) - 'search_name' order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

-- ============================================================= deals
-- Every deal, newest first, filtered by stage and by text (deal, request, title, buyer, supplier).
create or replace function public.admin_list_deals(p_stage text default null, p_query text default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_query),'');
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_stage is not null and p_stage not in ('selected','discuss','terms','progress','complete','cancelled') then
    raise exception using errcode = '22023', message = 'invalid deal stage'; end if;
  with source as (
    select d.id,d.request_id,d.offer_id,d.buyer_id,d.supplier_id,d.stage,d.revision,d.total_price,d.rating,
           d.selected_at as created_at,greatest(d.selected_at,d.discuss_at,d.terms_at,d.progress_at,d.complete_at,d.cancelled_at) as updated_at,
           r.title as request_title,r.hidden as request_hidden,
           coalesce(nullif(b.company,''),b.name) as buyer_name,coalesce(nullif(s.company,''),s.name) as supplier_name,
           o.price as offer_price,o.price_type as offer_price_type,
           exists(select 1 from meetany_private.deal_issues i where i.deal_id=d.id and i.status='open') as open_issue,
           (select count(*) from meetany_private.deal_issues i where i.deal_id=d.id)::int as issues
    from meetany_private.deals d
    join public.requests r on r.id=d.request_id
    join public.profiles b on b.id=d.buyer_id
    join public.profiles s on s.id=d.supplier_id
    left join public.offers o on o.id=d.offer_id
  ), searched as materialized (
    select * from source x where x.created_at <= v_asof
      and (v_q is null or position(lower(v_q) in lower(concat_ws(' ',x.id::text,x.request_id::text,x.offer_id::text,x.buyer_id::text,x.supplier_id::text,x.request_title,x.buyer_name,x.supplier_name))) > 0)
  ), filtered as materialized (
    select * from searched x where p_stage is null or x.stage=p_stage
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),
    'stageCounts',coalesce((select jsonb_object_agg(stage,n) from (select stage,count(*) n from searched group by stage) c),'{}'::jsonb),
    'asOf',v_asof) into result;
  return result;
end $$;

-- Forced stage change or cancellation, with a reason. Finished deals stay finished; an open issue is
-- resolved first (MA308); progress and complete still need both confirmations (MA905).
create or replace function public.admin_set_deal_stage(p_deal uuid, p_stage text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_admin(); d meetany_private.deals; previous text; v_reason text:=meetany_private.moderation_reason(p_reason);
begin
 if v_reason is null then perform meetany_private.fail('MA304'); end if;
 select * into d from meetany_private.deals where id=p_deal for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_stage is null or p_stage not in ('selected','discuss','terms','progress','complete','cancelled')
    or p_stage=d.stage or d.stage in ('complete','cancelled') then perform meetany_private.flow_fail('MA903'); end if;
 if exists(select 1 from meetany_private.deal_issues where deal_id=d.id and status='open') then
   raise exception using errcode='P0001', message='MA308: resolve the open deal issue first', hint='MA308'; end if;
 if p_stage in ('progress','complete') and (d.buyer_confirmed_at is null or d.supplier_confirmed_at is null) then perform meetany_private.flow_fail('MA905'); end if;
 previous:=d.stage;
 update meetany_private.deals set stage=p_stage,revision=revision+1,
  discuss_at=case when p_stage='discuss' then now() else discuss_at end,
  terms_at=case when p_stage='terms' then now() else terms_at end,
  progress_at=case when p_stage='progress' then now() else progress_at end,
  complete_at=case when p_stage='complete' then now() else complete_at end,
  cancelled_at=case when p_stage='cancelled' then now() else cancelled_at end
 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,p_stage);
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'deal',d.id,'deal.stage',v_reason,jsonb_build_object('stage',previous,'request_id',d.request_id),jsonb_build_object('stage',d.stage,'request_id',d.request_id));
 return to_jsonb(d);
end $$;

create or replace function public.admin_deal_issues() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 perform meetany_private.require_admin();
 return (select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') from (
  select i.*,r.title,d.buyer_id,d.supplier_id,d.stage,
   coalesce(nullif(a.company,''),a.name) as actor_name,case when i.actor_id=d.buyer_id then 'buyer' else 'supplier' end as actor_side,
   coalesce(nullif(h.company,''),h.name) as resolver_name
  from meetany_private.deal_issues i join meetany_private.deals d on d.id=i.deal_id join public.requests r on r.id=d.request_id
  left join public.profiles a on a.id=i.actor_id left join public.profiles h on h.id=i.resolved_by
  order by (i.status='open') desc,i.created_at desc limit 100) x);
end $$;

-- Outcome: resolved (handled), rejected (unfounded), cancelled (the deal is cancelled too). Audited.
create or replace function public.admin_resolve_deal_issue(p_issue_id uuid, p_resolution text, p_outcome text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles:=meetany_private.require_admin(); i meetany_private.deal_issues; d meetany_private.deals; previous text;
begin
 if p_outcome is null or p_outcome not in ('resolved','rejected','cancelled') then perform meetany_private.flow_fail('MA902'); end if;
 select * into i from meetany_private.deal_issues where id=p_issue_id;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 select * into d from meetany_private.deals where id=i.deal_id for update;
 if length(btrim(coalesce(p_resolution,''))) not between 3 and 2000 then perform meetany_private.flow_fail('MA902'); end if;
 if p_outcome='cancelled' and d.stage in ('complete','cancelled') then perform meetany_private.flow_fail('MA903'); end if;
 update meetany_private.deal_issues set status='resolved',outcome=p_outcome,resolved_at=now(),resolved_by=me.id,resolution=btrim(p_resolution) where id=i.id and status='open';
 if not found then return; end if;
 previous:=d.stage;
 update meetany_private.deals set revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'issue_resolved');
 if p_outcome='cancelled' then
  update meetany_private.deals set stage='cancelled',cancelled_at=now(),revision=revision+1 where id=d.id returning * into d;
  perform meetany_private.deal_event(d,'cancelled');
 end if;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'deal',d.id,'deal.issue_resolve',left(btrim(p_resolution),500),
  jsonb_build_object('issue_id',i.id,'stage',previous,'request_id',d.request_id),
  jsonb_build_object('issue_id',i.id,'outcome',p_outcome,'stage',d.stage,'request_id',d.request_id));
end $$;

create or replace function public.admin_resolve_deal_issue(p_issue_id uuid, p_resolution text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform public.admin_resolve_deal_issue(p_issue_id,p_resolution,'resolved');
end $$;

-- ============================================================= reviews list (source, date, filters)
create or replace function public.admin_list_reviews(p_status text default null, p_source text default null, p_q text default null, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q text:=nullif(btrim(p_q),'');
begin
 perform meetany_private.require_admin();
 if p_offset is null or p_offset<0 or (p_status is not null and p_status not in ('pending','published','hidden'))
    or (p_source is not null and p_source not in ('deal','manual')) or char_length(v_q)>200 then
   raise exception using errcode='22023',message='invalid reviews filter'; end if;
 return (with source as (
   select v.id,v.request_id,v.company_id,v.author_id,v.rating,v.body,v.status,v.reason,v.updated_at,
          coalesce(nullif(p.company,''),p.name) as company,coalesce(nullif(a.company,''),a.name) as author,
          r.title as request_title,d.id as deal_id,case when d.id is null then 'manual' else 'deal' end as source,
          dr.scores,dr.would_again
   from meetany_private.company_reviews v join public.profiles p on p.id=v.company_id join public.profiles a on a.id=v.author_id
   left join public.requests r on r.id=v.request_id
   left join meetany_private.deals d on d.request_id=v.request_id
   left join meetany_private.deal_reviews dr on dr.deal_id=d.id
 ), filtered as materialized (
   select * from source x where (p_status is null or x.status=p_status) and (p_source is null or x.source=p_source)
     and (v_q is null or position(lower(v_q) in lower(concat_ws(' ',x.company,x.author,x.body,x.request_title))) > 0)
 ) select jsonb_build_object('total',(select count(*) from filtered),
   'items',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from filtered order by (status='pending') desc,updated_at desc,id limit 20 offset p_offset) t),'[]'::jsonb)));
end $$;

-- ============================================================= reports: tell the reporter
create or replace function public.admin_resolve_report(p_id uuid,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 me public.profiles:=meetany_private.require_admin();
 v_reason text:=meetany_private.moderation_reason(p_reason);
 v meetany_private.reports; c meetany_private.reports; v_effect text:='none'; v_closed integer;
begin
 if v_reason is null then perform meetany_private.fail('MA304'); end if;
 if p_action is null or p_action not in ('hide','reject') then raise exception using errcode='22023',message='invalid report action'; end if;
 select * into v from meetany_private.reports where id=p_id for update;
 if v.id is null or v.status<>'new' then perform meetany_private.report_fail('MA706'); end if;
 if p_action='hide' then
  if v.target_kind='request' then
   if exists(select 1 from public.requests where id=v.target_id and not hidden) then
    perform public.admin_set_hidden(v.target_id,true,v_reason); v_effect:='request.hide'; end if;
  elsif v.target_kind='offer' then
   if exists(select 1 from public.offers where id=v.target_id) then
    perform public.admin_delete_offer(v.target_id,v_reason); v_effect:='offer.delete'; end if;
  else
   if exists(select 1 from public.profiles where id=v.target_id and not blocked and role<>'admin') then
    perform public.admin_set_blocked(v.target_id,true,v_reason); v_effect:='user.block'; end if;
  end if;
  v_closed:=0;
  for c in update meetany_private.reports set status='handled',resolution='hidden',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
   where target_kind=v.target_kind and target_id=v.target_id and status='new' returning * loop
   perform meetany_private.account_notice(c.reporter_id,'report_resolved',jsonb_build_object('title',coalesce(nullif(c.target_label,''),'საჩივარი'),'resolution','hidden','kind',c.target_kind));
   v_closed:=v_closed+1;
  end loop;
 else
  update meetany_private.reports set status='handled',resolution='rejected',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where id=v.id;
  get diagnostics v_closed=row_count;
  perform meetany_private.account_notice(v.reporter_id,'report_resolved',jsonb_build_object('title',coalesce(nullif(v.target_label,''),'საჩივარი'),'resolution','rejected','kind',v.target_kind));
 end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)
 values(me.id,v.id,'report_'||case when p_action='hide' then 'hidden' else 'rejected' end,
  jsonb_build_object('kind',v.target_kind,'target_id',v.target_id,'reason',v_reason,'effect',v_effect,'closed',v_closed));
 return jsonb_build_object('id',v.id,'action',p_action,'effect',v_effect,'closed',v_closed);
end $$;

-- ============================================================= audit: new actions and deal targets
create or replace function public.admin_list_audit_v2(p_cursor jsonb default null, p_limit integer default 25, p_action text default null, p_target_type text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if p_action is not null and p_action not in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove',
     'edit_profile','edit_request','company.verification_review','request.preferences','deal.stage','deal.issue_resolve') then
    raise exception using errcode = '22023', message = 'invalid audit action'; end if;
  if p_target_type is not null and p_target_type not in ('request','user','offer','deal') then
    raise exception using errcode = '22023', message = 'invalid audit target type'; end if;
  with source as (select a.* from meetany_private.moderation_audit a),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (p_action is null or x.action=p_action) and (p_target_type is null or x.target_type=p_target_type)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'actor_name',coalesce(nullif(actor.company,''),actor.name),'actor_email',actor.email,
      'target_name',case p.target_type when 'user' then coalesce(nullif(u.company,''),u.name)
        when 'request' then r.title when 'offer' then case when o.id is not null then coalesce(nullif(company.company,''),company.name) end
        when 'deal' then dr.title end,
      'target_role',case when p.target_type='user' then u.role end,
      'target_exists',case p.target_type when 'user' then u.id is not null when 'request' then r.id is not null when 'offer' then o.id is not null when 'deal' then deal.id is not null end,
      'target_context',context.title,'target_context_id',case when p.target_type='offer' then (p.old_flags->>'request_id')::uuid end
    ) order by p.created_at desc,p.id desc) from page p
    left join public.profiles actor on actor.id=p.actor_id
    left join public.profiles u on p.target_type='user' and u.id=p.target_id
    left join public.requests r on p.target_type='request' and r.id=p.target_id
    left join public.offers o on p.target_type='offer' and o.id=p.target_id
    left join public.profiles company on p.target_type='offer' and company.id=(p.old_flags->>'company_id')::uuid
    left join public.requests context on p.target_type='offer' and context.id=(p.old_flags->>'request_id')::uuid
    left join meetany_private.deals deal on p.target_type='deal' and deal.id=p.target_id
    left join public.requests dr on dr.id=deal.request_id),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

-- ============================================================= grants
revoke all on function public.admin_set_verified(uuid,boolean,text), public.review_verification(uuid,text,text),
  public.admin_search_users(text,text,boolean,boolean,jsonb,integer,text), public.admin_set_request_preferences(uuid,jsonb),
  public.admin_search_offers(text,text,jsonb,integer,boolean), public.admin_list_deals(text,text,jsonb,integer),
  public.admin_set_deal_stage(uuid,text,text), public.admin_resolve_deal_issue(uuid,text,text),
  public.admin_list_reviews(text,text,text,integer) from public, anonymous;
grant execute on function public.admin_set_verified(uuid,boolean,text), public.review_verification(uuid,text,text),
  public.admin_search_users(text,text,boolean,boolean,jsonb,integer,text), public.admin_set_request_preferences(uuid,jsonb),
  public.admin_search_offers(text,text,jsonb,integer,boolean), public.admin_list_deals(text,text,jsonb,integer),
  public.admin_set_deal_stage(uuid,text,text), public.admin_resolve_deal_issue(uuid,text,text),
  public.admin_list_reviews(text,text,text,integer) to authenticated;
revoke all on function meetany_private.valid_request_preferences(jsonb) from public;

commit;
