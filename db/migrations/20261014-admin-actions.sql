-- T7.3: reasoned, audited administrator actions. Apply after contact-change-admin and matching-v2.
begin;
set local lock_timeout='5s';
alter table public.profiles add column if not exists catalog_hidden boolean not null default false;
alter table public.profiles add column if not exists catalog_hidden_reason text;
alter table public.profiles add column if not exists anonymized_at timestamptz;
alter table public.profiles drop constraint if exists profiles_company_check;
alter table public.profiles add constraint profiles_company_check check(char_length(company) between 2 and 100 or (anonymized_at is not null and blocked and company=''));
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check check(phone ~ '^\+995 5[0-9]{2} [0-9]{3} [0-9]{3}$' or (anonymized_at is not null and blocked and phone=''));
alter table public.profiles drop constraint if exists profiles_phone_key;
create unique index if not exists profiles_phone_active_key on public.profiles(phone) where phone<>'';
alter table public.profiles drop constraint if exists profiles_company_industry;
alter table public.profiles add constraint profiles_company_industry check(role<>'company' or industry is not null or onboarding_completed_at is null);
alter table public.profiles drop constraint if exists profiles_catalog_hidden_reason_check;
alter table public.profiles add constraint profiles_catalog_hidden_reason_check check(catalog_hidden_reason is null or length(catalog_hidden_reason) between 3 and 500);
alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers add constraint offers_status_check check(status in ('sent','chosen','declined','withdrawn'));
alter table meetany_private.deal_updates drop constraint if exists deal_updates_status_check;
alter table meetany_private.deal_updates add constraint deal_updates_status_check check(status in ('started','producing','ready','delivered','admin_comment'));
alter table meetany_private.reports drop constraint if exists reports_target_kind_check;
alter table meetany_private.reports add constraint reports_target_kind_check check(target_kind in ('request','company','offer','contact_change','review','conversation'));
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check check(action in (
 'request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove','edit_profile','edit_request','company.verification_review','request.preferences','deal.stage','deal.issue_resolve',
 'user.role','user.anonymize','company.hide','company.show','offer.edit','report.resolve','deal.issue_comment'));
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_target_type_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_target_type_check check(target_type in ('request','user','offer','deal','report'));

create or replace function public.admin_set_role(p_user_id uuid,p_role text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.profiles; updated public.profiles; reason text:=meetany_private.moderation_reason(p_reason);
begin
 if reason is null then perform meetany_private.fail('MA304'); end if;
 select * into old from public.profiles where id=p_user_id for update;
 if old.id is null then perform meetany_private.fail('MA302'); end if;
 if p_role is null or p_role not in ('client','company') or old.role='admin' or me.id=p_user_id or old.anonymized_at is not null then
  raise exception using message='MA309: role change is not allowed',hint='MA309'; end if;
 update public.profiles set role=p_role,verified=case when p_role='client' then false else verified end,
 onboarding_completed_at=case when p_role='company' and old.role='client' then null else onboarding_completed_at end where id=p_user_id returning * into updated;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'user',old.id,'user.role',reason,jsonb_build_object('role',old.role,'verified',old.verified),jsonb_build_object('role',updated.role,'verified',updated.verified));
end $$;

create or replace function public.admin_anonymize_user(p_user_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.profiles; reason text:=meetany_private.moderation_reason(p_reason);
begin
 if reason is null then perform meetany_private.fail('MA304'); end if;
 select * into old from public.profiles where id=p_user_id for update;
 if old.id is null then perform meetany_private.fail('MA302'); end if;
 if old.role='admin' or old.id=me.id then raise exception using message='MA310: administrator cannot be anonymized',hint='MA310'; end if;
 update public.profiles set name='წაშლილი მომხმარებელი',company='',email='deleted-'||id||'@anonymized.meetany.ge',phone='',about='',logo_url=null,gallery='{}',
 address=null,lat=null,lng=null,website=null,legal_name=null,legal_form=null,registration_code=null,contact_position=null,blocked=true,blocked_reason=reason,anonymized_at=coalesce(anonymized_at,now()) where id=old.id;
 update public.requests r set hidden=true,hidden_reason=reason where r.owner_id=old.id and meetany_private.request_state(r)='open';
 update public.offers set status='withdrawn',updated_at=clock_timestamp() where company_id=old.id and status='sent';
 delete from meetany_private.saved_companies where user_id=old.id;
 delete from meetany_private.saved_requests where user_id=old.id;
 delete from meetany_private.request_alert_emails where user_id=old.id;
 delete from meetany_private.request_alert_preferences where user_id=old.id;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'user',old.id,'user.anonymize',reason,jsonb_build_object('blocked',old.blocked),jsonb_build_object('blocked',true,'anonymized',true));
end $$;

create or replace function public.admin_set_company_hidden(p_user_id uuid,p_hidden boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.profiles; reason text:=meetany_private.moderation_reason(p_reason);
begin
 if reason is null then perform meetany_private.fail('MA304'); end if;
 select * into old from public.profiles where id=p_user_id and role='company' for update;
 if old.id is null then perform meetany_private.fail('MA302'); end if;
 if p_hidden is null then raise exception using errcode='22023',message='hidden is required'; end if;
 update public.profiles set catalog_hidden=p_hidden,catalog_hidden_reason=case when p_hidden then reason end where id=old.id;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'user',old.id,case when p_hidden then 'company.hide' else 'company.show' end,reason,jsonb_build_object('catalog_hidden',old.catalog_hidden),jsonb_build_object('catalog_hidden',p_hidden));
end $$;

create or replace function public.admin_edit_offer(p_id uuid,p_patch jsonb,p_reason text) returns public.offers
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.offers; updated public.offers; reason text:=meetany_private.moderation_reason(p_reason); old_diff jsonb; new_diff jsonb;
begin
 if reason is null then perform meetany_private.fail('MA304'); end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception using message='MA311: invalid offer patch',hint='MA311'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k<>all(array['body','price','price_type','vat_included','delivery_days','delivery_included','payment_terms','valid_until','commercial_terms'])) then raise exception using message='MA311: invalid offer patch key',hint='MA311'; end if;
 select * into old from public.offers where id=p_id for update;
 if old.id is null then perform meetany_private.flow_fail('MA901'); end if;
 updated:=jsonb_populate_record(old,p_patch);
 updated.body:=rtrim(left(btrim(coalesce(updated.body,'')),2000));
 if length(updated.body)<10 then perform meetany_private.fail('MA204'); end if;
 if updated.price_type is null or updated.price_type not in ('unit','total','negotiable') then perform meetany_private.fail('MA210'); end if;
 if updated.price_type='negotiable' and updated.price is not null then perform meetany_private.fail('MA211'); end if;
 if updated.price_type<>'negotiable' and updated.price is null then perform meetany_private.fail('MA212'); end if;
 if updated.price is not null and (updated.price='NaN'::numeric or updated.price<=0 or updated.price>1000000000) then perform meetany_private.fail('MA205'); end if;
 if updated.delivery_days is not null and updated.delivery_days not between 0 and 365 then perform meetany_private.fail('MA213'); end if;
 if (updated.payment_terms is not null and length(btrim(updated.payment_terms)) not between 1 and 500)
 or (p_patch ? 'valid_until' and updated.valid_until is not null and (not isfinite(updated.valid_until) or updated.valid_until<meetany_private.today()))
 or updated.commercial_terms is null or not meetany_private.valid_items(updated.commercial_terms) then perform meetany_private.flow_fail('MA902'); end if;
 updated.vat_included:=updated.price_type<>'negotiable' and coalesce(updated.vat_included,false);
 updated.delivery_included:=coalesce(updated.delivery_included,false);
 updated.payment_terms:=btrim(updated.payment_terms);
 update public.offers set body=updated.body,price=updated.price,price_type=updated.price_type,vat_included=updated.vat_included,delivery_days=updated.delivery_days,delivery_included=updated.delivery_included,payment_terms=updated.payment_terms,valid_until=updated.valid_until,commercial_terms=updated.commercial_terms,updated_at=clock_timestamp() where id=old.id returning * into updated;
 select coalesce(jsonb_object_agg(k,to_jsonb(old)->k),'{}'),coalesce(jsonb_object_agg(k,to_jsonb(updated)->k),'{}') into old_diff,new_diff
 from unnest(array['body','price','price_type','vat_included','delivery_days','delivery_included','payment_terms','valid_until','commercial_terms']) k where to_jsonb(old)->k is distinct from to_jsonb(updated)->k;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags) values(me.id,'offer',old.id,'offer.edit',reason,old_diff,new_diff);
 return updated;
end $$;

create or replace function public.admin_comment_deal_issue(p_issue_id uuid,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); issue meetany_private.deal_issues; deal meetany_private.deals; body text:=btrim(p_body);
begin
 if body is null or length(body) not between 3 and 1000 then perform meetany_private.flow_fail('MA902'); end if;
 select * into issue from meetany_private.deal_issues where id=p_issue_id;
 if issue.id is null then perform meetany_private.flow_fail('MA901'); end if;
 select * into deal from meetany_private.deals where id=issue.deal_id for update;
 insert into meetany_private.deal_updates(deal_id,actor_id,status,body) values(deal.id,me.id,'admin_comment',body);
 update meetany_private.deals set revision=revision+1 where id=deal.id returning * into deal;
 perform meetany_private.deal_event(deal,'admin_comment');
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'deal',deal.id,'deal.issue_comment',left(body,500),'{}',jsonb_build_object('issue_id',issue.id));
end $$;

-- The shared visibility rule covers public profile sections; list_companies powers the snapshot/home.
create or replace function meetany_private.can_view_company(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id and p.role='company' and
 (meetany_private.is_admin() or p.id=meetany_private.uid() or (p.verified and not p.blocked and not p.catalog_hidden)))
$$;
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles for select to anonymous,authenticated using
(meetany_private.is_admin() or id=meetany_private.uid() or (not blocked and (role<>'company' or (verified and not catalog_hidden))));
-- Patch only known predicates, preserving the installed matching and pagination implementations.
do $$
declare f record; definition text;
begin
 for f in select oid,proname from pg_proc where (pronamespace='public'::regnamespace and proname in ('list_companies','company_public_stats')) or (pronamespace='meetany_private'::regnamespace and proname='matching_suppliers') loop
  definition:=pg_get_functiondef(f.oid);
  if position('p.catalog_hidden' in definition)=0 then
   if position('not p.blocked' in definition)=0 then raise exception 'Missing company visibility predicate: %',f.proname; end if;
   definition:=replace(definition,'not p.blocked','not p.blocked and not p.catalog_hidden');
   execute definition;
  end if;
 end loop;
end $$;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.list_matching_feed(text,text,integer,integer)'::regprocedure);
 if position('p.catalog_hidden' in definition)=0 then
  definition:=replace(definition,$predicate$p.role='company' and p.verified and not p.blocked$predicate$,$predicate$p.role='company' and p.verified and not p.blocked and not p.catalog_hidden$predicate$);
  execute definition;
 end if;
end $$;
-- admin_search_users selects p.* and therefore includes both catalog fields without changing its signature.

-- Preserve report throttling, duplicate locking and the existing contact-change resolution.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.report_content(text,uuid,text,text)'::regprocedure);
 if position('elsif p_kind=''review''' in definition)=0 then
  definition:=replace(definition,$old$p_kind not in ('request','company','offer')$old$,$new$p_kind not in ('request','company','offer','review','conversation')$new$);
  definition:=replace(definition,$old$else
  -- Offers are sealed:$old$,$new$elsif p_kind='review' then
  select review_row.author_id,'შეფასება · '||coalesce(nullif(p.company,''),p.name)||' · ★'||review_row.rating,review_row.company_id into v_owner,v_label,v_context
  from meetany_private.company_reviews review_row join public.profiles p on p.id=review_row.company_id
  where review_row.id=p_target_id and review_row.status='published' and meetany_private.can_view_company(review_row.company_id);
 elsif p_kind='conversation' then
  select case when c.client_id=me.id then c.company_id else c.client_id end,
   'მიმოწერა · '||coalesce(nullif(a.company,''),a.name)||' ↔ '||coalesce(nullif(b.company,''),b.name),c.request_id into v_owner,v_label,v_context
  from meetany_private.conversations c join public.profiles a on a.id=c.client_id join public.profiles b on b.id=c.company_id
  where c.id=p_target_id and me.id in(c.client_id,c.company_id);
 else
  -- Offers are sealed:$new$);
  if position('elsif p_kind=''review''' in definition)=0 then raise exception 'Unsupported report_content shape'; end if;
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.admin_list_reports(text,integer)'::regprocedure);
 if position('rv.id' in definition)=0 then
  definition:=replace(definition,'select x.payload,','select rv.body target_body,x.payload,');
  definition:=replace(definition,'case x.target_kind when ''request'' then rq.id is not null',
   'case x.target_kind when ''review'' then rv.id is not null when ''conversation'' then cv.id is not null when ''request'' then rq.id is not null');
  definition:=replace(definition,'case x.target_kind when ''request'' then coalesce(rq.hidden,false)',
   'case x.target_kind when ''review'' then rv.status=''hidden'' when ''conversation'' then coalesce(peer.blocked,false) when ''request'' then coalesce(rq.hidden,false)');
  definition:=replace(definition,'left join public.profiles h on h.id=x.handled_by',
   'left join meetany_private.company_reviews rv on x.target_kind=''review'' and rv.id=x.target_id
  left join meetany_private.conversations cv on x.target_kind=''conversation'' and cv.id=x.target_id
  left join public.profiles peer on x.target_kind=''conversation'' and peer.id=x.target_owner_id
  left join public.profiles h on h.id=x.handled_by');
  if position('rv.id' in definition)=0 then raise exception 'Unsupported admin_list_reports shape'; end if;
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.admin_list_reports(text,integer)'::regprocedure);
 if position('target_body' in definition)=0 then execute replace(definition,'select x.payload,','select rv.body target_body,x.payload,'); end if;
 definition:=pg_get_functiondef('public.admin_resolve_report(uuid,text,text)'::regprocedure);
 if position('hide_review' in definition)=0 then
  definition:=replace(definition,$old$p_action not in ('hide','reject')$old$,$new$p_action not in ('hide','reject','hide_review','block_user','dismiss')$new$);
  definition:=replace(definition,$old$if v.target_kind='contact_change'$old$,$new$if (p_action='hide_review' and v.target_kind<>'review') or (p_action='block_user' and v.target_kind<>'conversation')
 or (v.target_kind='review' and p_action not in ('hide_review','dismiss','reject'))
 or (v.target_kind='conversation' and p_action not in ('block_user','dismiss','reject')) then raise exception using errcode='22023',message='invalid resolution for report kind'; end if;
 if p_action='dismiss' then p_action:='reject'; end if;
 if p_action in ('hide_review','block_user') then p_action:='hide'; end if;
 if v.target_kind='contact_change'$new$);
  definition:=replace(definition,$old$if v.target_kind='request' then$old$,$new$if v.target_kind='review' then
   perform public.admin_moderate_review(v.target_id,'hidden',v_reason); v_effect:='review.hide';
  elsif v.target_kind='conversation' then
   perform public.admin_set_blocked(v.target_owner_id,true,v_reason); v_effect:='user.block';
  elsif v.target_kind='request' then$new$);
  definition:=replace(definition,'insert into meetany_private.business_audit(actor_id,target_id,action,detail)',
   'insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,''report'',v.id,''report.resolve'',v_reason,jsonb_build_object(''status'',v.status),jsonb_build_object(''action'',p_action,''kind'',v.target_kind,''target_id'',v.target_id,''effect'',v_effect));
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)');
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.admin_list_audit_v2(jsonb,integer,text,text)'::regprocedure);
 if position('user.anonymize' in definition)=0 then
  definition:=replace(definition,'''deal.issue_resolve'')','''deal.issue_resolve'',''user.role'',''user.anonymize'',''company.hide'',''company.show'',''offer.edit'',''report.resolve'',''deal.issue_comment'')');
  definition:=replace(definition,$old$('request','user','offer','deal')$old$,$new$('request','user','offer','deal','report')$new$);
  execute definition;
 end if;
end $$;

do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.company_reviews(uuid,integer)'::regprocedure);
 definition:=replace(definition,'select v.id,v.rating,v.body','select v.id,v.author_id,v.rating,v.body');
 execute definition;
 definition:=pg_get_functiondef('public.admin_search_offers(text,text,jsonb,integer,boolean)'::regprocedure);
 definition:=replace(definition,$old$('sent','chosen','declined')$old$,$new$('sent','chosen','declined','withdrawn')$new$);
 execute definition;
end $$;

revoke all on function public.admin_set_role(uuid,text,text),public.admin_anonymize_user(uuid,text),public.admin_set_company_hidden(uuid,boolean,text),public.admin_edit_offer(uuid,jsonb,text),public.admin_comment_deal_issue(uuid,text),public.report_content(text,uuid,text,text),public.admin_list_reports(text,integer),public.admin_resolve_report(uuid,text,text) from public,anonymous,authenticated;
grant execute on function public.admin_set_role(uuid,text,text),public.admin_anonymize_user(uuid,text),public.admin_set_company_hidden(uuid,boolean,text),public.admin_edit_offer(uuid,jsonb,text),public.admin_comment_deal_issue(uuid,text),public.report_content(text,uuid,text,text),public.admin_list_reports(text,integer),public.admin_resolve_report(uuid,text,text) to authenticated;
commit;
