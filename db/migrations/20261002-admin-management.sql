begin;
set local lock_timeout='5s';
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check check(action in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove','edit_profile','edit_request'));
-- Administrator edits use explicit allowlists. Auth identity, role, ownership and chosen offers cannot be rewritten.
create or replace function public.admin_edit_profile(p_id uuid,p_patch jsonb) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.profiles; v public.profiles; k text; origin text:=meetany_private.photo_origin();
begin
 select * into old from public.profiles where id=p_id for update;
 if not found then perform meetany_private.fail('MA302'); end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception using errcode='22023',message='invalid profile'; end if;
 for k in select jsonb_object_keys(p_patch) loop
 if k<>all(array['name','company','phone','city','industry','about','address','lat','lng','logo_url','gallery','offers','seeks','service_cities']) then raise exception using errcode='22023',message='unsupported profile field'; end if;
 end loop;
 v:=jsonb_populate_record(old,p_patch);
 if v.lat is not null and (v.lat not between -90 and 90 or v.lng is null or v.lng not between -180 and 180) or (v.lat is null and v.lng is not null) then perform meetany_private.fail('MA413'); end if;
 if v.logo_url is not null and (origin is null or not meetany_private.valid_photo_url(v.logo_url,p_id) or lower(left(v.logo_url,length(origin)+1))<>origin||'/' or substr(v.logo_url,length(origin)+2,42)<>p_id::text||'/logo-') then perform meetany_private.fail('MA115'); end if;
 if exists(select 1 from unnest(v.gallery) u where origin is null or lower(left(u,length(origin)+1))<>origin||'/' or substr(u,length(origin)+2,45)<>p_id::text||'/gallery-') then perform meetany_private.fail('MA116'); end if;
 update public.profiles set name=btrim(v.name),company=btrim(v.company),phone=v.phone,city=v.city,industry=v.industry,about=btrim(v.about),address=nullif(btrim(v.address),''),lat=v.lat,lng=v.lng,logo_url=v.logo_url,gallery=v.gallery,offers=v.offers,seeks=v.seeks,service_cities=v.service_cities where id=p_id returning * into v;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,old_flags,new_flags) values(me.id,'user',p_id,'edit_profile',to_jsonb(old),to_jsonb(v));
 return v;
end $$;
create or replace function public.admin_edit_request(p_id uuid,p_patch jsonb) returns public.requests
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old public.requests; v public.requests; k text; origin text:=meetany_private.photo_origin();
begin
 select * into old from public.requests where id=p_id for update;
 if not found then perform meetany_private.fail('MA106'); end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception using errcode='22023',message='invalid request'; end if;
 for k in select jsonb_object_keys(p_patch) loop
 if k<>all(array['title','body','category','city','address_note','quantity','unit','needed_by','photo_url','status','expires_at']) then raise exception using errcode='22023',message='unsupported request field'; end if;
 end loop;
 v:=jsonb_populate_record(old,p_patch);
 perform meetany_private.check_terms(v.quantity,v.unit,v.needed_by,old.needed_by);
 if v.chosen_offer_id is not null and v.status='open' and old.status<>'open' then raise exception using errcode='22023',message='chosen request cannot reopen'; end if;
 if v.expires_at is null or v.expires_at>now()+interval '2 years' then raise exception using errcode='22023',message='invalid expiry'; end if;
 if v.photo_url is not null and (origin is null or not meetany_private.valid_photo_url(v.photo_url,old.owner_id) or lower(left(v.photo_url,length(origin)+1))<>origin||'/') then perform meetany_private.fail('MA109'); end if;
 update public.requests set title=btrim(v.title),body=btrim(v.body),category=v.category,city=v.city,address_note=nullif(btrim(v.address_note),''),quantity=v.quantity,unit=v.unit,needed_by=v.needed_by,photo_url=v.photo_url,status=v.status,expires_at=v.expires_at where id=p_id returning * into v;
 insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,old_flags,new_flags) values(me.id,'request',p_id,'edit_request',to_jsonb(old),to_jsonb(v));
 return v;
end $$;
create or replace function public.admin_company_settings(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 if not exists(select 1 from public.profiles where id=p_id and role='company') then perform meetany_private.fail('MA302'); end if;
 return jsonb_build_object('membership',(select to_jsonb(m) from meetany_private.company_plans m where company_id=p_id),'application',(select to_jsonb(a) from meetany_private.plan_requests a where company_id=p_id));
end $$;
create or replace function public.admin_manage_plan(p_id uuid,p_plan text,p_expires_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); old jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_id and role='company' and not blocked for update) then perform meetany_private.fail('MA302'); end if;
 select to_jsonb(m) into old from meetany_private.company_plans m where company_id=p_id;
 if p_plan is null then delete from meetany_private.company_plans where company_id=p_id;
 else
 if p_plan not in ('premium','vip') or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '2 years' then raise exception using errcode='22023',message='invalid plan or expiry'; end if;
 insert into meetany_private.company_plans(company_id,plan,expires_at) values(p_id,p_plan,p_expires_at) on conflict(company_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,updated_at=now();
 end if;
 update meetany_private.plan_requests set status=case when p_plan is null then 'cancelled' else 'approved' end,updated_at=now() where company_id=p_id and status='pending';
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_id,'plan_managed',jsonb_build_object('old',old,'plan',p_plan,'expires_at',p_expires_at));
 return public.admin_company_settings(p_id);
end $$;
-- Reviews from an actual chosen-offer author publish immediately; hidden reviews remain hidden after author edits.
create or replace function public.save_company_review(p_request_id uuid,p_rating integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); company uuid; v meetany_private.company_reviews;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_body is null or length(btrim(p_body)) not between 20 and 1500 then raise exception using errcode='22023',message='MA601: invalid review'; end if;
 select o.company_id into company from public.requests r join public.offers o on o.id=r.chosen_offer_id join public.profiles c on c.id=o.company_id and not c.blocked and c.role='company' where r.id=p_request_id and r.owner_id=me.id and not r.hidden and o.company_id<>me.id for share of r;
 if company is null then raise exception using errcode='42501',message='MA602: review requires your chosen offer'; end if;
 insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body,status) values(p_request_id,me.id,company,p_rating,btrim(p_body),'published')
 on conflict(request_id) do update set company_id=excluded.company_id,rating=excluded.rating,body=excluded.body,status=case when company_reviews.status='hidden' then 'hidden' else 'published' end,updated_at=now() where company_reviews.author_id=me.id returning * into v;
 if v.id is null then raise exception using errcode='42501',message='MA602: review is not yours'; end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,v.id,'review_saved',jsonb_build_object('rating',v.rating,'status',v.status));
 return to_jsonb(v);
end $$;
alter table meetany_private.company_reviews alter column status set default 'published';
create table if not exists meetany_private.site_content(id boolean primary key default true check(id),content jsonb not null default '{}',updated_at timestamptz not null default now());
alter table meetany_private.site_content enable row level security;
revoke all on meetany_private.site_content from public,anonymous,authenticated;
create or replace function public.site_content() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce((select content from meetany_private.site_content where id),'{}'::jsonb) $$;
create or replace function public.admin_save_site_content(p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); k text; val text; origin text:=meetany_private.photo_origin();
begin
 if p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>20000 then raise exception using errcode='22023',message='invalid content'; end if;
 for k,val in select key,value from jsonb_each_text(p_content) loop
 if k<>all(array['heroTitle','heroAccent','heroSubtitle','companiesTitle','requestsTitle','businessTitle','businessSubtitle','heroLabel1','heroLabel2','heroLabel3','heroLabel4','heroImage1','heroImage2','heroImage3','heroImage4','businessImage1','businessImage2','businessImage3','businessImage4','businessImage5','businessImage6','businessImage7','businessImage8','businessImage9']) or jsonb_typeof(p_content->k)<>'string' or length(val)>1000 then raise exception using errcode='22023',message='invalid content field'; end if;
 if k like '%Image%' and val<>'' and not (val ~ '^/(images|assets/photos)/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp|avif)$' or (origin is not null and lower(left(val,length(origin)+1))=origin||'/' and val ~ '^https://[a-z0-9]+\.public\.blob\.vercel-storage\.com/[0-9a-f-]{36}/site-[A-Za-z0-9_-]+\.(jpg|png|webp|gif)$')) then raise exception using errcode='22023',message='invalid content photo'; end if;
 end loop;
 insert into meetany_private.site_content(id,content) values(true,p_content) on conflict(id) do update set content=excluded.content,updated_at=now();
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,me.id,'site_content_saved',jsonb_build_object('keys',array(select jsonb_object_keys(p_content))));
 return p_content;
end $$;
revoke all on function public.admin_edit_profile(uuid,jsonb),public.admin_edit_request(uuid,jsonb),public.admin_company_settings(uuid),public.admin_manage_plan(uuid,text,timestamptz),public.site_content(),public.admin_save_site_content(jsonb) from public,anonymous,authenticated;
grant execute on function public.admin_edit_profile(uuid,jsonb),public.admin_edit_request(uuid,jsonb),public.admin_company_settings(uuid),public.admin_manage_plan(uuid,text,timestamptz),public.admin_save_site_content(jsonb) to authenticated;
grant execute on function public.site_content() to anonymous,authenticated;
-- A separate offset-paged history preserves the moderation journal's UUID cursor contract.
create or replace function public.admin_business_audit(p_offset integer default 0,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='invalid audit page'; end if;
 return jsonb_build_object('total',(select count(*) from meetany_private.business_audit),'items',(
 select coalesce(jsonb_agg(to_jsonb(entry)),'[]'::jsonb) from (
 select b.id,b.action,b.created_at,coalesce(nullif(actor.company,''),actor.name,'მომხმარებელი') actor,
 case when b.action='site_content_saved' then 'საიტის შიგთავსი' else coalesce(nullif(report.target_label,''),nullif(company.company,''),company.name,'ჩანაწერი') end target,
 case when company.role='company' then company.id else null end company_id,
 jsonb_strip_nulls(jsonb_build_object('plan',b.detail->'plan','expiresAt',b.detail->'expires_at','days',b.detail->'days',
 'approved',b.detail->'approved','rating',coalesce(b.detail->'rating',to_jsonb(review.rating)),
 'status',b.detail->'status','reason',coalesce(b.detail->'reason',b.detail->'note'),'keys',b.detail->'keys')) changes
 from meetany_private.business_audit b
 left join public.profiles actor on actor.id=b.actor_id
 left join meetany_private.company_reviews review on review.id=b.target_id
 left join meetany_private.plan_requests application on application.id=b.target_id
 left join meetany_private.reports report on report.id=b.target_id
 left join public.profiles company on company.id=coalesce(review.company_id,application.company_id,report.target_owner_id,b.target_id)
 order by b.created_at desc,b.id desc limit p_limit offset p_offset
 ) entry));
end $$;
revoke all on function public.admin_business_audit(integer,integer) from public,anonymous,authenticated;
grant execute on function public.admin_business_audit(integer,integer) to authenticated;

commit;
