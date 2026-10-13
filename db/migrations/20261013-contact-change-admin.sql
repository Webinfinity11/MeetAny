-- Contact-change requests store immutable structured intent; applying one is admin-only.
begin;
alter table meetany_private.reports add column if not exists payload jsonb;
alter table meetany_private.reports drop constraint if exists reports_target_kind_check;
alter table meetany_private.reports add constraint reports_target_kind_check check(target_kind in ('request','company','offer','contact_change'));
alter table meetany_private.reports drop constraint if exists reports_resolution_check;
alter table meetany_private.reports add constraint reports_resolution_check check(resolution in ('hidden','rejected','applied'));
-- The previous RPC generated this exact format. Preserve requests filed before this migration.
update meetany_private.reports r set payload=jsonb_build_object('phone',nullif(m.parts[1],'—'),'email',nullif(m.parts[2],'—'),'note',nullif(m.parts[3],'—'))
from (select id,regexp_match(body,'^ტელეფონი: (.*?) · ელფოსტა: (.*?) · შენიშვნა: (.*)$') parts from meetany_private.reports where target_kind='contact_change' and payload is null) m
where r.id=m.id and m.parts is not null;
CREATE OR REPLACE FUNCTION public.request_contact_change(p_phone text, p_email text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 me public.profiles:=meetany_private.require_user();
 phone text:=nullif(btrim(p_phone),''); email text:=nullif(lower(btrim(p_email)),'');
 note text:=btrim(coalesce(p_note,'')); description text; result meetany_private.reports;
begin
 if phone is not null then
  phone:=meetany_private.normalize_phone(phone);
  if phone is null then raise exception using message='MA711: invalid mobile phone',hint='MA711'; end if;
 end if;
 if email is not null and (length(email)>200 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
  raise exception using message='MA711: invalid email',hint='MA711'; end if;
 if (phone is null and email is null) or (coalesce(phone,me.phone)=me.phone and coalesce(email,me.email)=me.email) then
  raise exception using message='MA711: provide a new contact identifier',hint='MA711'; end if;
 description:='ტელეფონი: '||coalesce(phone,'—')||' · ელფოსტა: '||coalesce(email,'—')||' · შენიშვნა: '||coalesce(nullif(note,''),'—');
 if length(description)>500 then raise exception using message='MA711: maximum 500 characters',hint='MA711'; end if;
 perform pg_advisory_xact_lock(hashtextextended('meetany.contact_change:'||me.id::text,0));
 if exists(select 1 from meetany_private.reports where reporter_id=me.id and target_kind='contact_change' and status='new') then
  raise exception using message='MA710: contact change already requested',hint='MA710'; end if;
 insert into meetany_private.reports(reporter_id,target_kind,target_id,target_owner_id,target_label,reason,body,payload)
 values(me.id,'contact_change',me.id,me.id,left(coalesce(nullif(me.company,''),me.name),300),'other',description,jsonb_build_object('phone',phone,'email',email,'note',note))
 returning * into result;
 return jsonb_build_object('id',result.id,'status',result.status,'created_at',result.created_at);
end $function$;
CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'new'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_offset is null or p_offset<0 or (p_status is not null and p_status not in ('new','handled')) then
  raise exception using errcode='22023',message='invalid report queue'; end if;
 return jsonb_build_object(
 'total',(select count(*) from meetany_private.reports where p_status is null or status=p_status),
 'newCount',(select count(*) from meetany_private.reports where status='new'),
 'items',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]'::jsonb) from (
  select x.payload,co.phone current_phone,co.email current_email,x.id,x.target_kind,x.target_id,x.context_id,x.reason,x.body,x.status,x.resolution,x.resolution_reason,x.created_at,x.handled_at,
   x.reporter_id,coalesce(nullif(rp.company,''),rp.name) reporter_name,rp.email reporter_email,
   coalesce(case x.target_kind when 'request' then rq.title when 'contact_change' then coalesce(nullif(co.company,''),co.name) when 'company' then coalesce(nullif(co.company,''),co.name)
     else coalesce(nullif(oc.company,''),oc.name) end,nullif(x.target_label,'')) target_label,
   case x.target_kind when 'request' then rq.id is not null when 'contact_change' then co.id is not null when 'company' then co.id is not null else o.id is not null end target_exists,
   case x.target_kind when 'request' then coalesce(rq.hidden,false) when 'contact_change' then coalesce(co.blocked,false) when 'company' then coalesce(co.blocked,false) else false end target_removed,
   coalesce(case when x.target_kind='offer' then oq.title end,'') context_label,
   coalesce(case when x.target_kind='offer' then o.status end,'') offer_status,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id) target_reports,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id and s.status='new') target_new,
   coalesce(nullif(h.company,''),h.name) handler_name
  from meetany_private.reports x
  left join public.profiles rp on rp.id=x.reporter_id
  left join public.requests rq on x.target_kind='request' and rq.id=x.target_id
  left join public.profiles co on x.target_kind in ('company','contact_change') and co.id=x.target_id
  left join public.offers o on x.target_kind='offer' and o.id=x.target_id
  left join public.profiles oc on x.target_kind='offer' and oc.id=x.target_owner_id
  left join public.requests oq on x.target_kind='offer' and oq.id=x.context_id
  left join public.profiles h on h.id=x.handled_by
  where p_status is null or x.status=p_status
  order by x.created_at desc,x.id limit 20 offset p_offset) t));
end $function$;
CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_id uuid, p_action text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 me public.profiles:=meetany_private.require_admin();
 v_reason text:=meetany_private.moderation_reason(p_reason);
 v meetany_private.reports; c meetany_private.reports; v_effect text:='none'; v_closed integer;
begin
 if v_reason is null then perform meetany_private.fail('MA304'); end if;
 if p_action is null or p_action not in ('hide','reject') then raise exception using errcode='22023',message='invalid report action'; end if;
 select * into v from meetany_private.reports where id=p_id for update;
 if v.id is null or v.status<>'new' then perform meetany_private.report_fail('MA706'); end if;
 if v.target_kind='contact_change' and p_action<>'reject' then raise exception using errcode='22023',message='use admin_apply_contact_change'; end if;
 if p_action='hide' then
  if v.target_kind='request' then
   if exists(select 1 from public.requests where id=v.target_id and not hidden) then
    perform public.admin_set_hidden(v.target_id,true,v_reason); v_effect:='request.hide'; end if;
  elsif v.target_kind='offer' then
   if exists(select 1 from public.offers where id=v.target_id) then
    perform public.admin_delete_offer(v.target_id,v_reason); v_effect:='offer.delete'; end if;
  elsif v.target_kind='company' then
   if exists(select 1 from public.profiles where id=v.target_id and not blocked and role<>'admin') then
    perform public.admin_set_blocked(v.target_id,true,v_reason); v_effect:='user.block'; end if;
  end if;
  v_closed:=0;
  for c in update meetany_private.reports set status='handled',resolution='hidden',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
   where target_kind=v.target_kind and target_id=v.target_id and status='new' returning * loop
   perform meetany_private.account_notice(c.reporter_id,'report_resolved',jsonb_build_object('title',coalesce(nullif(c.target_label,''),'საჩივარი'),'resolution','hidden','resolution_reason',left(v_reason,500),'result','hidden','note',left(v_reason,500),'report_id',c.id,'kind',c.target_kind));
   v_closed:=v_closed+1;
  end loop;
 else
  update meetany_private.reports set status='handled',resolution='rejected',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where id=v.id;
  get diagnostics v_closed=row_count;
  perform meetany_private.account_notice(v.reporter_id,'report_resolved',jsonb_build_object('title',coalesce(nullif(v.target_label,''),'საჩივარი'),'resolution',case when v.target_kind='contact_change' then 'კონტაქტის შეცვლის მოთხოვნა უარყოფილია: '||v_reason else 'rejected' end,'resolution_reason',left(v_reason,500),'result','rejected','note',left(v_reason,500),'report_id',v.id,'kind',v.target_kind));
 end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)
 values(me.id,v.id,'report_'||case when p_action='hide' then 'hidden' else 'rejected' end,
  jsonb_build_object('kind',v.target_kind,'target_id',v.target_id,'reason',v_reason,'effect',v_effect,'closed',v_closed));
 return jsonb_build_object('id',v.id,'action',p_action,'effect',v_effect,'closed',v_closed);
end $function$;

create or replace function public.admin_apply_contact_change(p_report_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_admin(); r meetany_private.reports;
 old public.profiles; updated public.profiles; v_phone text; v_email text;
 note text:=nullif(btrim(p_note),'');
begin
 select * into r from meetany_private.reports where id=p_report_id for update;
 if r.id is null or r.status<>'new' or r.target_kind<>'contact_change' then perform meetany_private.report_fail('MA706'); end if;
 if note is not null and length(note)>500 then perform meetany_private.fail('MA304'); end if;
 if r.payload is null or jsonb_typeof(r.payload)<>'object' then raise exception using message='MA711: missing contact payload',hint='MA711'; end if;
 select * into old from public.profiles where id=r.target_id for update;
 if old.id is null or r.reporter_id<>old.id then perform meetany_private.fail('MA302'); end if;
 v_phone:=nullif(btrim(r.payload->>'phone'),''); v_email:=nullif(lower(btrim(r.payload->>'email')),'');
 if v_phone is null and v_email is null then raise exception using message='MA711: empty contact payload',hint='MA711'; end if;
 if v_phone is not null then
  v_phone:=meetany_private.normalize_phone(v_phone);
  if v_phone is null then perform meetany_private.fail('MA404'); end if;
  if exists(select 1 from public.profiles where id<>old.id and profiles.phone=v_phone) then perform meetany_private.fail('MA405'); end if;
 end if;
 if v_email is not null and (length(v_email)>200 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then perform meetany_private.fail('MA403'); end if;
 -- Same normalized phone/unique-phone and email-format rules as profile creation.
 -- update_my_profile deliberately cannot edit contact identifiers. Neon Auth is never updated here.
 begin
  update public.profiles set phone=coalesce(v_phone,old.phone),email=coalesce(v_email,old.email) where id=old.id returning * into updated;
 exception when unique_violation then perform meetany_private.fail('MA405');
 end;
 update meetany_private.reports set status='handled',resolution='applied',resolution_reason=note,handled_by=me.id,handled_at=now() where id=r.id;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags)
 values(me.id,'user',old.id,'edit_profile',note,jsonb_build_object('phone',old.phone,'email',old.email),jsonb_build_object('phone',updated.phone,'email',updated.email));
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,r.id,'contact_change_applied',jsonb_build_object('target_id',old.id,'reason',note));
 perform meetany_private.account_notice(r.reporter_id,'report_resolved',jsonb_build_object('title','კონტაქტის შეცვლის მოთხოვნა','resolution','საკონტაქტო მონაცემები განახლდა. შესასვლელი ელფოსტა უცვლელია.','resolution_reason',note,'report_id',r.id,'kind',r.target_kind));
 return jsonb_build_object('id',r.id,'status','handled','resolution','applied');
end $$;
revoke all on function public.request_contact_change(text,text,text), public.admin_apply_contact_change(uuid,text) from public,anonymous;
grant execute on function public.request_contact_change(text,text,text), public.admin_apply_contact_change(uuid,text) to authenticated;
commit;
