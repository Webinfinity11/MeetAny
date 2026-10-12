-- Design parity: account upgrade, private attachments, request preferences and deal collaboration.
-- Additive; access stays inside authenticated/security-definer routines. No existing records are removed.
begin;
set local lock_timeout='5s';
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
create or replace function public.become_company(p_company text,p_industry text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role not in ('client','company') then perform meetany_private.flow_fail('MA901'); end if;
 if length(btrim(coalesce(p_company,''))) not between 2 and 100 or not coalesce(meetany_private.is_category(p_industry),false) then perform meetany_private.flow_fail('MA902'); end if;
 if me.role='company' then return me; end if;
 update public.profiles set role='company',company=btrim(p_company),industry=p_industry,verified=false,verified_at=null,provide_categories=array[p_industry],account_intent='both' where id=me.id returning * into me;
 return me;
end $$;

create table if not exists meetany_private.attachments (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('request_draft','offer_draft','request','offer','conversation','verification','deal','issue')),
 target_id uuid not null,slot text not null default '',name text not null check(length(name) between 1 and 180),
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),
 content bytea not null check(octet_length(content) between 1 and 10485760),created_at timestamptz not null default clock_timestamp()
);
create index if not exists attachments_target on meetany_private.attachments(kind,target_id,created_at);
alter table meetany_private.attachments enable row level security;
revoke all on meetany_private.attachments from public,anonymous,authenticated;
create table if not exists meetany_private.file_uploads (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),kind text not null,target_id uuid not null,slot text not null,
 name text not null,mime text not null,expected_size integer not null check(expected_size between 1 and 10485760),
 content bytea not null default ''::bytea,created_at timestamptz not null default clock_timestamp(),completed_id uuid
);
alter table meetany_private.file_uploads enable row level security;
revoke all on meetany_private.file_uploads from public,anonymous,authenticated;

create or replace function meetany_private.file_scope(p_kind text,p_target uuid,p_write boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=meetany_private.uid(); admin boolean:=meetany_private.is_admin();
begin
 if p_write and not meetany_private.can_write() then return false; end if;
 if me is not null and exists(select 1 from public.profiles where id=me and blocked) then return false; end if;
 if not p_write and admin then return true; end if;
 case p_kind
 when 'request_draft','offer_draft' then return p_write and me is not null;
 when 'verification' then return exists(select 1 from public.profiles where id=p_target and id=me and role='company' and not blocked and (not p_write or verification_documents_status not in('pending','approved')));
 when 'request' then return exists(select 1 from public.requests r join public.profiles p on p.id=r.owner_id where r.id=p_target and not p.blocked and
 (case when p_write then r.owner_id=me and meetany_private.request_state(r)='open' and not r.hidden else (not r.hidden or r.owner_id=me) end));
 when 'offer' then return exists(select 1 from public.offers o join public.requests r on r.id=o.request_id join public.profiles p on p.id=o.company_id where o.id=p_target and not p.blocked and
 (case when p_write then o.company_id=me and meetany_private.request_state(r)='open' and not r.hidden else me in(o.company_id,r.owner_id) end));
 when 'conversation' then return exists(select 1 from meetany_private.conversations c join public.profiles p on p.id=c.company_id join public.profiles b on b.id=c.client_id where c.id=p_target and me in(c.client_id,c.company_id) and not p.blocked and not b.blocked);
 when 'deal','issue' then return exists(select 1 from meetany_private.deals d join public.profiles p on p.id=d.supplier_id join public.profiles b on b.id=d.buyer_id where d.id=p_target and me in(d.buyer_id,d.supplier_id) and not p.blocked and not b.blocked and (not p_write or d.stage in('progress','complete')));
 else return false;
 end case;
end $$;
revoke all on function meetany_private.file_scope(text,uuid,boolean) from public,anonymous,authenticated;
create or replace function public.begin_file_upload(p_kind text,p_target uuid,p_name text,p_mime text,p_size integer,p_slot text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result uuid;
begin
 if not meetany_private.file_scope(p_kind,p_target,true) then perform meetany_private.flow_fail('MA901'); end if;
 if p_size is null or p_size not between 1 and 10485760 or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp') or length(coalesce(p_name,'')) not between 1 and 180 or p_name~'[[:cntrl:]]' or length(coalesce(p_slot,''))>80 then perform meetany_private.flow_fail('MA902'); end if;
 perform pg_advisory_xact_lock(hashtextextended(me.id::text,0));
 delete from meetany_private.file_uploads where owner_id=me.id and created_at<now()-interval '1 day';
 if (select count(*) from meetany_private.file_uploads where owner_id=me.id and completed_id is null)>=10
 or (select count(*) from meetany_private.attachments where kind=p_kind and target_id=p_target)>=10
 or (select coalesce(sum(octet_length(content)),0) from meetany_private.attachments where owner_id=me.id)>524288000 then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.file_uploads(owner_id,kind,target_id,slot,name,mime,expected_size) values(me.id,p_kind,p_target,coalesce(p_slot,''),p_name,p_mime,p_size) returning id into result;
 return result;
end $$;
create or replace function public.append_file_chunk(p_upload_id uuid,p_offset integer,p_chunk bytea) returns integer
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); u meetany_private.file_uploads; n integer;
begin
 select * into u from meetany_private.file_uploads where id=p_upload_id and owner_id=me.id for update;
 if not found or u.created_at<now()-interval '1 day' or u.completed_id is not null or not meetany_private.file_scope(u.kind,u.target_id,true) then perform meetany_private.flow_fail('MA901'); end if;
 n:=octet_length(u.content);
 if p_offset is null or p_offset<0 or p_chunk is null or octet_length(p_chunk) not between 1 and 1048576 or p_offset+octet_length(p_chunk)>u.expected_size then perform meetany_private.flow_fail('MA902'); end if;
 if p_offset<n and substring(u.content from p_offset+1 for octet_length(p_chunk))=p_chunk then return n; end if;
 if p_offset<>n then perform meetany_private.flow_fail('MA904'); end if;
 update meetany_private.file_uploads set content=content||p_chunk where id=u.id;
 return n+octet_length(p_chunk);
end $$;
create or replace function public.finish_file_upload(p_upload_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); u meetany_private.file_uploads; a meetany_private.attachments; h text;
begin
 select * into u from meetany_private.file_uploads where id=p_upload_id and owner_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if u.completed_id is not null then select * into a from meetany_private.attachments where id=u.completed_id; if a.id is null then perform meetany_private.flow_fail('MA901'); end if; return to_jsonb(a)-'content'||jsonb_build_object('size',octet_length(a.content)); end if;
 if not meetany_private.file_scope(u.kind,u.target_id,true) or u.created_at<now()-interval '1 day' then perform meetany_private.flow_fail('MA901'); end if;
 h:=encode(substring(u.content from 1 for 12),'hex');
 if octet_length(u.content)<>u.expected_size or not (
 (u.mime='application/pdf' and h like '255044462d%') or (u.mime='image/jpeg' and h like 'ffd8ff%') or
 (u.mime='image/png' and h like '89504e470d0a1a0a%') or (u.mime='image/webp' and h like '52494646________57454250')) then perform meetany_private.flow_fail('MA902'); end if;
 perform pg_advisory_xact_lock(hashtextextended(me.id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(u.kind||u.target_id::text,0));
 if (select coalesce(sum(octet_length(content)),0) from meetany_private.attachments where owner_id=me.id)+u.expected_size>524288000 then perform meetany_private.flow_fail('MA902'); end if;
 if (select count(*) from meetany_private.attachments where kind=u.kind and target_id=u.target_id)>=10 then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.attachments(owner_id,kind,target_id,slot,name,mime,content) values(me.id,u.kind,u.target_id,u.slot,u.name,u.mime,u.content) returning * into a;
 update meetany_private.file_uploads set completed_id=a.id,content=''::bytea where id=u.id;
 return to_jsonb(a)-'content'||jsonb_build_object('size',u.expected_size);
end $$;
create or replace function public.list_attachments(p_kind text,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_kind not in('request_draft','offer_draft') and not meetany_private.file_scope(p_kind,p_target,false) then perform meetany_private.flow_fail('MA901'); end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by created_at),'[]') from (select id,owner_id,kind,target_id,slot,name,mime,octet_length(content) size,created_at from meetany_private.attachments where kind=p_kind and target_id=p_target and (p_kind not in('request_draft','offer_draft') or owner_id=meetany_private.uid())) x);
end $$;
create or replace function public.get_attachment(p_id uuid) returns meetany_private.attachments
language plpgsql stable security definer set search_path='' as $$
declare a meetany_private.attachments;
begin
 select * into a from meetany_private.attachments where id=p_id;
 if a.id is null or not coalesce((case when a.kind in('request_draft','offer_draft') then a.owner_id=meetany_private.uid() else meetany_private.file_scope(a.kind,a.target_id,false) end),false) then perform meetany_private.flow_fail('MA901'); end if;
 return a;
end $$;
create or replace function public.remove_attachment(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); a meetany_private.attachments;
begin
 select * into a from meetany_private.attachments where id=p_id for update;
 if a.owner_id<>me.id or not meetany_private.file_scope(a.kind,a.target_id,true) then perform meetany_private.flow_fail('MA901'); end if;
 if a.kind='verification' and exists(select 1 from public.profiles where id=me.id and verification_documents_status in('pending','approved')) then perform meetany_private.flow_fail('MA903'); end if;
 delete from meetany_private.attachments where id=p_id;
end $$;
create or replace function public.bind_draft_files(p_kind text,p_draft uuid,p_target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_kind not in('request','offer') or not meetany_private.file_scope(p_kind,p_target,true) then perform meetany_private.flow_fail('MA901'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||p_target::text,0));
 if (select count(*) from meetany_private.attachments where (kind=p_kind and target_id=p_target) or (owner_id=me.id and kind=p_kind||'_draft' and target_id=p_draft))>10 then perform meetany_private.flow_fail('MA902'); end if;
 update meetany_private.attachments set kind=p_kind,target_id=p_target where owner_id=me.id and kind=p_kind||'_draft' and target_id=p_draft;
end $$;
create or replace function public.submit_verification() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if me.verified then return me; end if;
 if me.legal_name is null or me.registration_code is null or me.logo_url is null or not exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='registration') or not exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='tax') then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set verification_documents_status='pending' where id=me.id returning * into me;
 return me;
end $$;

create table if not exists meetany_private.request_preferences (request_id uuid primary key references public.requests(id) on delete cascade,preferences jsonb not null default '{}'::jsonb);
alter table meetany_private.request_preferences enable row level security;
revoke all on meetany_private.request_preferences from public,anonymous,authenticated;
create or replace function public.set_request_preferences(p_request_id uuid,p_preferences jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); r public.requests; p jsonb:=p_preferences;
begin
 select * into r from public.requests where id=p_request_id and owner_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if meetany_private.request_state(r)<>'open' then perform meetany_private.flow_fail('MA903'); end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 or exists(select 1 from jsonb_object_keys(p) k where k not in('specification','design','supplierTypes','certificates','verifiedOnly','flexibility','budgetType','budgetMin','budgetMax','budgetPrivate','payment','vatInvoice','deferredPayment')) then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('specification','design','certificates','payment') and jsonb_typeof(x.value)<>'string') then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'design' and p->>'design' not in('','ready','needed','none') then perform meetany_private.flow_fail('MA902'); end if;
 if length(coalesce(p->>'specification',''))>2000 or length(coalesce(p->>'design',''))>120 or length(coalesce(p->>'payment',''))>500 or length(coalesce(p->>'certificates',''))>500 then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'flexibility' and (jsonb_typeof(p->'flexibility')<>'number' or (p->>'flexibility')::numeric not between 0 and 30) then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'supplierTypes' and (jsonb_typeof(p->'supplierTypes')<>'array' or jsonb_array_length(p->'supplierTypes')>3 or exists(select 1 from jsonb_array_elements_text(p->'supplierTypes') t where t not in('manufacturer','distributor','service'))) then perform meetany_private.flow_fail('MA902'); end if;
 if coalesce(p->>'budgetType','negotiable') not in('range','exact','negotiable') then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetMin','budgetMax') and (jsonb_typeof(x.value)<>'number' or (x.value::text)::numeric not between 0 and 1000000000)) then perform meetany_private.flow_fail('MA902'); end if;
 if coalesce(p->>'budgetType','negotiable')<>'negotiable' and (not p ? 'budgetMin' or (p->>'budgetMin')::numeric<=0 or (p->>'budgetType'='range' and (not p ? 'budgetMax' or (p->>'budgetMax')::numeric<(p->>'budgetMin')::numeric))) then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetPrivate','verifiedOnly','vatInvoice','deferredPayment') and jsonb_typeof(x.value)<>'boolean') then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.request_preferences(request_id,preferences) values(r.id,p) on conflict(request_id) do update set preferences=excluded.preferences;
 return p;
end $$;
-- Private budgets never enter the public table/API column grants. Only this filtered routine exposes preferences.

create or replace function public.request_preferences(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.requests; p jsonb;
begin
 select * into r from public.requests where id=p_request_id and (meetany_private.file_scope('request',p_request_id,false) or meetany_private.is_admin());
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 select preferences into p from meetany_private.request_preferences where request_id=r.id;
 p:=coalesce(p,'{}'::jsonb);
 return case when coalesce((p->>'budgetPrivate')::boolean,false) and r.owner_id is distinct from meetany_private.uid() and not meetany_private.is_admin() then p-'budgetMin'-'budgetMax' else p end;
end $$;

create table if not exists meetany_private.deal_proposals (
 id uuid primary key default gen_random_uuid(),deal_id uuid not null references meetany_private.deals(id),revision integer not null,
 actor_id uuid not null references public.profiles(id),previous jsonb not null,proposed jsonb not null,
 status text not null default 'pending' check(status in('pending','accepted','rejected','superseded')),created_at timestamptz not null default now(),unique(deal_id,revision)
);
create table if not exists meetany_private.deal_updates (
 id uuid primary key default gen_random_uuid(),deal_id uuid not null references meetany_private.deals(id),actor_id uuid not null references public.profiles(id),
 status text not null check(status in('started','producing','ready','delivered')),body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now()
);
create table if not exists meetany_private.deal_issues (
 id uuid primary key default gen_random_uuid(),deal_id uuid not null references meetany_private.deals(id),actor_id uuid not null references public.profiles(id),
 reason text not null check(reason in('quality','quantity','late','other')),body text not null check(length(body) between 3 and 2000),
 status text not null default 'open' check(status in('open','resolved')),created_at timestamptz not null default now(),resolved_at timestamptz,resolved_by uuid references public.profiles(id),resolution text
);
create unique index if not exists deal_one_open_issue on meetany_private.deal_issues(deal_id) where status='open';
alter table meetany_private.deal_proposals enable row level security;
alter table meetany_private.deal_updates enable row level security;
alter table meetany_private.deal_issues enable row level security;
revoke all on meetany_private.deal_proposals,meetany_private.deal_updates,meetany_private.deal_issues from public,anonymous,authenticated;
create or replace function meetany_private.guard_deal_collaboration() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb:=to_jsonb(old); original_price numeric;
begin
 if old.total_price is null then
  select case when o.price_type='total' then o.price when o.price_type='unit' then o.price*r.quantity else null end into original_price from public.offers o join public.requests r on r.id=o.request_id where o.id=old.offer_id;
  previous:=previous||jsonb_build_object('total_price',original_price);
 end if;
 if exists(select 1 from meetany_private.deal_issues where deal_id=old.id and status='open') and (new.stage is distinct from old.stage or new.rating is distinct from old.rating) then perform meetany_private.flow_fail('MA903'); end if;
 if new.stage='terms' and (old.stage<>'terms' or (new.total_price,new.quantity,new.unit,new.delivery_days,new.delivery_date,new.delivery_place,new.payment_terms,new.includes) is distinct from (old.total_price,old.quantity,old.unit,old.delivery_days,old.delivery_date,old.delivery_place,old.payment_terms,old.includes)) then
  update meetany_private.deal_proposals set status='superseded' where deal_id=new.id and status='pending';
  insert into meetany_private.deal_proposals(deal_id,revision,actor_id,previous,proposed) values(new.id,new.revision,meetany_private.uid(),previous,to_jsonb(new));
 end if;
 if new.buyer_confirmed_at is not null and new.supplier_confirmed_at is not null then update meetany_private.deal_proposals set status='accepted' where deal_id=new.id and status='pending'; end if;
 return new;
end $$;
drop trigger if exists guard_deal_collaboration on meetany_private.deals;
create trigger guard_deal_collaboration before update on meetany_private.deals for each row execute function meetany_private.guard_deal_collaboration();
revoke all on function meetany_private.guard_deal_collaboration() from public,anonymous,authenticated;
create or replace function public.add_deal_update(p_deal_id uuid,p_expected_revision integer,p_status text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals; u meetany_private.deal_updates;
begin
 select * into d from meetany_private.deals where id=p_deal_id and supplier_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage<>'progress' or exists(select 1 from meetany_private.deal_issues where deal_id=d.id and status='open') then perform meetany_private.flow_fail('MA903'); end if;
 if p_status not in('started','producing','ready','delivered') or length(btrim(coalesce(p_body,''))) not between 1 and 2000 then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.deal_updates(deal_id,actor_id,status,body) values(d.id,me.id,p_status,btrim(p_body)) returning * into u;
 update meetany_private.deals set revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'update_'||p_status);
 return to_jsonb(u);
end $$;
create or replace function public.open_deal_issue(p_deal_id uuid,p_expected_revision integer,p_reason text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals; i meetany_private.deal_issues;
begin
 select * into d from meetany_private.deals where id=p_deal_id and me.id in(buyer_id,supplier_id) for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage not in('progress','complete') or exists(select 1 from meetany_private.deal_issues where deal_id=d.id and status='open') then perform meetany_private.flow_fail('MA903'); end if;
 if p_reason not in('quality','quantity','late','other') or length(btrim(coalesce(p_body,''))) not between 3 and 2000 then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.deal_issues(deal_id,actor_id,reason,body) values(d.id,me.id,p_reason,btrim(p_body)) returning * into i;
 update meetany_private.deals set revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'issue_opened'); return to_jsonb(i);
end $$;
create or replace function public.admin_deal_issues() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 return (select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') from (select i.*,r.title,d.buyer_id,d.supplier_id from meetany_private.deal_issues i join meetany_private.deals d on d.id=i.deal_id join public.requests r on r.id=d.request_id order by i.created_at desc limit 100) x);
end $$;
create or replace function public.admin_resolve_deal_issue(p_issue_id uuid,p_resolution text) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); i meetany_private.deal_issues; d meetany_private.deals;
begin
 select * into i from meetany_private.deal_issues where id=p_issue_id;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 select * into d from meetany_private.deals where id=i.deal_id for update;
 if length(btrim(coalesce(p_resolution,''))) not between 3 and 2000 then perform meetany_private.flow_fail('MA902'); end if;
 update meetany_private.deal_issues set status='resolved',resolved_at=now(),resolved_by=me.id,resolution=btrim(p_resolution) where id=i.id and status='open';
 if not found then return; end if;
 update meetany_private.deals set revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'issue_resolved');
end $$;
create table if not exists meetany_private.deal_reviews (deal_id uuid primary key references meetany_private.deals(id),scores integer[] not null,would_again boolean not null);
alter table meetany_private.deal_reviews enable row level security;
revoke all on meetany_private.deal_reviews from public,anonymous,authenticated;
create or replace function public.rate_deal_full(p_deal_id uuid,p_expected_revision integer,p_scores integer[],p_would_again boolean,p_review text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb; average_rating integer;
begin
 if cardinality(p_scores) is distinct from 4 or array_position(p_scores,null) is not null or exists(select 1 from unnest(p_scores) n where n not between 1 and 5) or p_would_again is null then perform meetany_private.flow_fail('MA902'); end if;
 select round(avg(v))::integer into average_rating from unnest(p_scores) v;
 d:=public.rate_deal(p_deal_id,average_rating,p_review,p_expected_revision);
 insert into meetany_private.deal_reviews(deal_id,scores,would_again) values(p_deal_id,p_scores,p_would_again);
 return d;
end $$;
revoke all on function public.rate_deal_full(uuid,integer,integer[],boolean,text) from public,anonymous,authenticated;
grant execute on function public.rate_deal_full(uuid,integer,integer[],boolean,text) to authenticated;
create or replace function public.get_deal(p_deal_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals;
begin
 select * into d from meetany_private.deals where id=p_deal_id and (me.id in(buyer_id,supplier_id) or me.role='admin');
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 return to_jsonb(d)||jsonb_build_object(
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by revision),'[]') from meetany_private.deal_events e where deal_id=d.id),
 'review_details',(select to_jsonb(v)-'deal_id' from meetany_private.deal_reviews v where v.deal_id=d.id),
 'proposals',(select coalesce(jsonb_agg(to_jsonb(p) order by revision desc),'[]') from meetany_private.deal_proposals p where deal_id=d.id),
 'updates',(select coalesce(jsonb_agg(to_jsonb(u) order by created_at desc),'[]') from meetany_private.deal_updates u where deal_id=d.id),
 'issues',(select coalesce(jsonb_agg(to_jsonb(i) order by created_at desc),'[]') from meetany_private.deal_issues i where deal_id=d.id));
end $$;
create or replace function public.list_matching_feed(p_kind text default 'recommended',p_city text default null,p_limit integer default 12,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 if me.role not in('company','client') then perform meetany_private.flow_fail('MA901'); end if;
 if p_kind not in('recommended','requests','suppliers') or p_limit not between 1 and 100 or p_offset not between 0 and 10000 or (p_city is not null and not meetany_private.is_city(p_city)) then perform meetany_private.flow_fail('MA902'); end if;
 with matches as (
 select r.id,'request'::text kind,r.title,p.company,r.category,r.city,p.industry,p.verified,r.created_at,70+case when r.city=me.city or r.city=any(me.service_cities) then 30 else 0 end score from public.requests r join public.profiles p on p.id=r.owner_id
 where me.role='company' and p_kind in('recommended','requests') and r.owner_id<>me.id and not r.hidden and not p.blocked and meetany_private.request_state(r)='open' and r.category=any(me.provide_categories) and (p_city is null or r.city=p_city)
 union all
 select p.id,'supplier',p.company,p.company,p.industry,p.city,p.industry,p.verified,p.created_at,70+case when p.city=me.city or me.city=any(p.service_cities) then 30 else 0 end from public.profiles p
 where p_kind in('recommended','suppliers') and p.role='company' and p.verified and not p.blocked and p.id<>me.id and (p.industry=any(me.need_categories) or p.provide_categories&&me.need_categories or exists(select 1 from public.requests r where r.owner_id=me.id and not r.hidden and meetany_private.request_state(r)='open' and (r.category=p.industry or r.category=any(p.provide_categories)))) and (p_city is null or p.city=p_city or p_city=any(p.service_cities))
 ) select coalesce(jsonb_agg(to_jsonb(x) order by score desc,created_at desc,id),'[]') into result from (select * from matches order by score desc,created_at desc,id limit p_limit offset p_offset) x;
 return result;
end $$;

-- Publishing binds files and preferences in the same transaction as the request.
create or replace function public.create_request_full(p_title text,p_body text,p_category text,p_city text,p_photo_url text,p_quantity numeric,p_unit text,p_needed_by date,p_address_note text,p_preferences jsonb,p_draft uuid) returns public.requests
language plpgsql security definer set search_path='' as $$
declare r public.requests;
begin
 r:=public.create_request(p_title,p_body,p_category,p_city,p_photo_url,p_quantity,p_unit,p_needed_by,p_address_note);
 perform public.set_request_preferences(r.id,p_preferences);
 if p_draft is not null then perform public.bind_draft_files('request',p_draft,r.id); end if;
 return r;
end $$;
create or replace function public.reject_deal_proposal(p_deal_id uuid,p_expected_revision integer,p_proposal_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals; p meetany_private.deal_proposals; v jsonb;
begin
 select * into d from meetany_private.deals where id=p_deal_id and me.id in(buyer_id,supplier_id) for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if d.revision is distinct from p_expected_revision then perform meetany_private.flow_fail('MA904'); end if;
 select * into p from meetany_private.deal_proposals where id=p_proposal_id and deal_id=d.id and status='pending';
 if not found or p.actor_id=me.id or d.stage<>'terms' then perform meetany_private.flow_fail('MA903'); end if;
 update meetany_private.deal_proposals set status='rejected' where id=p.id;
 v:=p.previous;
 update meetany_private.deals set stage='discuss',total_price=(v->>'total_price')::numeric,quantity=(v->>'quantity')::numeric,unit=v->>'unit',delivery_days=(v->>'delivery_days')::integer,delivery_date=(v->>'delivery_date')::date,delivery_place=v->>'delivery_place',payment_terms=v->>'payment_terms',includes=array(select jsonb_array_elements_text(v->'includes')),buyer_confirmed_at=null,supplier_confirmed_at=null,revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'proposal_rejected'); return to_jsonb(d);
end $$;
-- Verification remains optional for account completion; submission and approval are separate actions.
create or replace function public.complete_onboarding() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if length(btrim(coalesce(me.company,'')))<2 or length(btrim(coalesce(me.about,'')))<10 or me.legal_name is null or me.registration_code is null or me.legal_form is null or me.founded_year is null or me.employee_band is null then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=me.id returning * into me;
 return me;
end $$;
create or replace function public.review_verification(p_profile_id uuid,p_status text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); p public.profiles;
begin
 select * into p from public.profiles where id=p_profile_id and role='company' for update;
 if not found or p_status not in('approved','rejected') or p.verification_documents_status<>'pending' then perform meetany_private.flow_fail('MA903'); end if;
 perform public.admin_set_verified(p.id,p_status='approved');
 update public.profiles set verification_documents_status=p_status where id=p.id returning * into p;
 return p;
end $$;
revoke all on function public.create_request_full(text,text,text,text,text,numeric,text,date,text,jsonb,uuid),public.reject_deal_proposal(uuid,integer,uuid),public.complete_onboarding(),public.review_verification(uuid,text) from public,anonymous,authenticated;
grant execute on function public.create_request_full(text,text,text,text,text,numeric,text,date,text,jsonb,uuid),public.reject_deal_proposal(uuid,integer,uuid),public.complete_onboarding(),public.review_verification(uuid,text) to authenticated;

create or replace function public.verification_record(p_profile_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); p public.profiles;
begin
 if me.id<>p_profile_id and me.role<>'admin' then perform meetany_private.flow_fail('MA901'); end if;
 select * into p from public.profiles where id=p_profile_id and role='company';
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 return jsonb_build_object('status',p.verification_documents_status,'legal_name',p.legal_name,'registration_code',p.registration_code,'verified',p.verified);
end $$;
revoke all on function public.verification_record(uuid) from public,anonymous,authenticated;
grant execute on function public.verification_record(uuid) to authenticated;

-- Never grant binary table access. File download uses only get_attachment, with scope checked each time.
revoke all on function public.become_company(text,text),public.begin_file_upload(text,uuid,text,text,integer,text),public.append_file_chunk(uuid,integer,bytea),public.finish_file_upload(uuid),public.list_attachments(text,uuid),public.get_attachment(uuid),public.remove_attachment(uuid),public.bind_draft_files(text,uuid,uuid),public.submit_verification(),public.set_request_preferences(uuid,jsonb),public.request_preferences(uuid),public.add_deal_update(uuid,integer,text,text),public.open_deal_issue(uuid,integer,text,text),public.admin_deal_issues(),public.admin_resolve_deal_issue(uuid,text),public.list_matching_feed(text,text,integer,integer) from public,anonymous,authenticated;
grant execute on function public.become_company(text,text),public.begin_file_upload(text,uuid,text,text,integer,text),public.append_file_chunk(uuid,integer,bytea),public.finish_file_upload(uuid),public.remove_attachment(uuid),public.bind_draft_files(text,uuid,uuid),public.submit_verification(),public.set_request_preferences(uuid,jsonb),public.add_deal_update(uuid,integer,text,text),public.open_deal_issue(uuid,integer,text,text),public.admin_deal_issues(),public.admin_resolve_deal_issue(uuid,text),public.list_matching_feed(text,text,integer,integer) to authenticated;
grant execute on function public.list_attachments(text,uuid),public.get_attachment(uuid),public.request_preferences(uuid) to anonymous,authenticated;
commit;
