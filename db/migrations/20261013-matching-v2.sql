-- Matching v2: one supplier rule with a same-group fallback, an explainable rank and a verification nudge.
-- Rule (meetany_private.matching_suppliers): verified, unblocked company, not the request owner.
--  exact   = request category in provide_categories (always listed, always alerted);
--  similar = another category of the same group (web/app/lib/categories-data.js), listed when fewer than 3
--            exact suppliers exist, alerted only when there are none.
-- count_matching_suppliers = the alerted part; notify_matching_request alerts it; list_matching lists the rule.
-- Unverified companies of the exact category get one 'verify_to_respond' notice per Tbilisi day.
-- Re-runnable. Needs 20261012-admin-management (notifications.detail) and 20261013-matching-intent.
begin;
set local lock_timeout='5s';

-- Category -> group. Same groups as categoryGroups in web/app/lib/categories-data.js (checked by
-- web/qa/unit/category-groups.test.mjs and db/tests/matching_v2_tests.sql).
create or replace function meetany_private.category_groups() returns table(category text,group_id text)
language sql immutable set search_path='' as $$
 select * from (values
  ('food_fresh','food'),('food_processed','food'),('beverages','food'),('catering','food'),
  ('building_materials','construction'),('renovation','construction'),('engineering','construction'),
  ('furniture','interior'),('equipment','interior'),('textiles','interior'),
  ('packaging','production'),('printing','production'),
  ('freight','logistics'),('warehouse','logistics'),('customs','logistics'),
  ('wholesale','trade'),('office_household','trade'),
  ('cleaning','facility'),('laundry','facility'),('technical_service','facility'),('security','facility'),
  ('software_web','it'),('it_support','it'),
  ('branding_design','marketing'),('advertising','marketing'),('photo_video','marketing'),('events','marketing'),
  ('accounting','business'),('legal','business'),('consulting','business'),('hr_training','business'),
  ('leasing','finance'),('business_finance','finance'),('business_insurance','finance'),
  ('hotel_services','tourism'),('tours','tourism'),
  ('other','other')
 ) g(category,group_id)
$$;

create or replace function meetany_private.category_group_members(p text) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(g.category order by g.category),'{}') from meetany_private.category_groups() g
 where g.group_id=(select x.group_id from meetany_private.category_groups() x where x.category=p)
$$;

-- The single supplier rule. alerted = receives the request alert and is counted by the step-3 preview.
create or replace function meetany_private.matching_suppliers(p_category text,p_exclude uuid)
returns table(id uuid,exact boolean,alerted boolean)
language sql stable set search_path='' as $$
 with base as (
  select p.id,p_category=any(p.provide_categories) exact from public.profiles p
  where p.role='company' and p.verified and not p.blocked and p.id is distinct from p_exclude
   and p.provide_categories && meetany_private.category_group_members(p_category)
 ), n as (select count(*) filter(where b.exact) exact_count from base b)
 select b.id,b.exact,b.exact or n.exact_count=0 from base b cross join n
 where b.exact or n.exact_count<3
$$;

-- Words for keyword overlap: lower-case letter/digit runs of 5+ characters, without filler words
-- that appear in almost every request (compared on their first four letters). At most 80 words.
create or replace function meetany_private.match_words(p text) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(w order by w),'{}') from (
  select distinct w from regexp_split_to_table(lower(coalesce(p,'')),'[^0-9a-zა-ჿ]+') w
  where length(w)>=5 and left(w,4) <> all(array['გვჭი','საჭი','მჭირ','ვეძე','გვინ','სადე','განც','პროც','საჩვ','მაგა','საილ',
   'ფოტო','მომს','კომპ','რომე','ასევ','ყველ','შესა','თქვე','ჩვენ','რაოდ','მინი','მაქს','კვირ','მიწო','შემდ','აუცი','ძალი'])
  limit 80
 ) x
$$;

-- Matching request words: same first k letters, k = least(5, each word length - 1) and at least 4,
-- so Georgian case endings still match (მაგიდა/მაგიდები, სკამი/სკამები, თეთრეული/თეთრეულის).
create or replace function meetany_private.word_hits(p_request text[],p_company text[]) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(r order by r),'{}') from unnest(p_request) r
 where exists(select 1 from unnest(p_company) c, lateral (select least(5,length(r)-1,length(c)-1) k) k
  where k.k>=4 and left(r,k.k)=left(c,k.k))
$$;

revoke all on function meetany_private.category_groups(),meetany_private.category_group_members(text),
 meetany_private.matching_suppliers(text,uuid),meetany_private.match_words(text),meetany_private.word_hits(text[],text[])
 from public,anonymous,authenticated;

-- Preview count = the alert recipients of the rule (exact, or the group when no exact supplier exists).
create or replace function public.count_matching_suppliers(p_category text,p_city text default null) returns integer
language plpgsql stable security definer set search_path='' as $$
declare n integer;
begin
 -- p_city is accepted for symmetry with list_matching, which only uses the city for ranking.
 if not coalesce(meetany_private.is_category(p_category),false) then perform meetany_private.flow_fail('MA902'); end if;
 select count(*)::integer into n from meetany_private.matching_suppliers(p_category,meetany_private.uid()) m where m.alerted;
 return n;
end $$;
revoke all on function public.count_matching_suppliers(text,text) from public,anonymous,authenticated;
grant execute on function public.count_matching_suppliers(text,text) to anonymous,authenticated;

-- Score (higher first), each part returned in reasons:
--  category exact 200 / similar 100 (an exact supplier always outranks a similar one: 100+70 < 200);
--  city: serves the request city 30, covers all Georgia 20; keywords 5 each (max 15) from offers and
--  business tags against the request title and description; completed deals as supplier 3 each (max 15);
--  published rating x2 (max 10). Ties by company id. notified = this company got the request alert.
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
     meetany_private.word_hits(words,meetany_private.match_words(array_to_string(coalesce(p.offers,'{}')||coalesce(p.business_tags,'{}'),' '))) hits,
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
revoke all on function public.list_matching(uuid,text,integer,integer) from public,anonymous,authenticated;
grant execute on function public.list_matching(uuid,text,integer,integer) to authenticated;

-- New notice kind: an unverified company whose directions match a new request. One per company per Tbilisi day.
alter table meetany_private.notifications drop constraint if exists notifications_kind_check;
alter table meetany_private.notifications add constraint notifications_kind_check check (kind in ('offer_received','offer_chosen','request_match','offer_declined','verification_reviewed','report_resolved','verify_to_respond'));
alter table meetany_private.notifications drop constraint if exists notifications_offer_kind_check;
alter table meetany_private.notifications add constraint notifications_offer_kind_check check (
  (kind in ('request_match','verification_reviewed','report_resolved','verify_to_respond') and offer_id is null)
  or (kind in ('offer_received','offer_chosen','offer_declined') and offer_id is not null));
create unique index if not exists notifications_verify_daily_idx on meetany_private.notifications(user_id,(detail->>'day')) where kind='verify_to_respond';

-- Alerts: saved or default preferences as before for the request category; the rule's similar suppliers are
-- added (preferences enabled, cities respected) only when the category has no exact supplier.
create or replace function meetany_private.notify_matching_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare n meetany_private.notifications; mode text; due timestamptz; bucket_key text; job uuid; generation_id uuid;
begin
 if new.hidden or new.status<>'open' or new.expires_at<=now() or new.chosen_offer_id is not null
 or not exists(select 1 from public.profiles where id=new.owner_id and not blocked) then return new; end if;
 for n in
  insert into meetany_private.notifications(user_id,request_id,kind)
  select p.id,new.id,'request_match'
  from public.profiles p
  left join meetany_private.request_alert_preferences saved on saved.user_id=p.id
  cross join lateral meetany_private.default_request_alert_preferences(p) defaults
  cross join lateral (select
   case when saved.user_id is null then defaults.enabled else saved.enabled end enabled,
   case when saved.user_id is null then defaults.categories else saved.categories end categories,
   case when saved.user_id is null then defaults.cities else saved.cities end cities) pref
  left join meetany_private.matching_suppliers(new.category,new.owner_id) fallback on fallback.id=p.id and fallback.alerted and not fallback.exact
  where pref.enabled and p.role='company' and not p.blocked and p.id<>new.owner_id
    and (new.category=any(pref.categories) or fallback.id is not null)
    and (new.city='georgia' or 'georgia'=any(pref.cities) or new.city=any(pref.cities))
  on conflict do nothing returning *
 loop
  select email_mode,generation into mode,generation_id from meetany_private.request_alert_preferences where user_id=n.user_id;
  if mode is null or mode='off' then continue; end if;
  if mode='daily' then
   due:=((now() at time zone 'Asia/Tbilisi')::date+time '20:00') at time zone 'Asia/Tbilisi';
   if due<=now() then due:=due+interval '1 day'; end if;
   bucket_key:='daily/'||generation_id::text||'/'||to_char(due at time zone 'UTC','YYYY-MM-DD HH24:MI');
  else due:=now(); bucket_key:='instant/'||n.id::text; end if;
  -- Cancelled buckets must never be revived (including after an opt-out/opt-in).
  insert into meetany_private.request_alert_emails(user_id,bucket,mode,available_at)
  values(n.user_id,bucket_key,mode,due)
  on conflict(user_id,bucket) do update set bucket=excluded.bucket
  returning id into job;
  insert into meetany_private.request_alert_email_items(notification_id,job_id) values(n.id,job) on conflict do nothing;
 end loop;
 -- Unverified companies of the category (provide_categories, else industry) that did not opt out:
 -- an in-app nudge to finish verification, at most one per company per Tbilisi day, no email.
 insert into meetany_private.notifications(user_id,request_id,kind,detail)
 select p.id,new.id,'verify_to_respond',jsonb_build_object('day',((now() at time zone 'Asia/Tbilisi')::date)::text,'title',new.title)
 from public.profiles p left join meetany_private.request_alert_preferences saved on saved.user_id=p.id
 where p.role='company' and not p.verified and not p.blocked and p.id<>new.owner_id
  and new.category=any(case when cardinality(p.provide_categories)>0 then p.provide_categories when p.industry is not null then array[p.industry] else '{}'::text[] end)
  and (saved.user_id is null or saved.enabled)
  and not exists(select 1 from meetany_private.notifications x where x.user_id=p.id and x.request_id=new.id and x.kind='request_match')
 on conflict do nothing;
 return new;
end $$;
revoke all on function meetany_private.notify_matching_request() from public,anonymous,authenticated;
drop trigger if exists notify_matching_request on public.requests;
create trigger notify_matching_request after insert on public.requests for each row execute function meetany_private.notify_matching_request();
commit;
