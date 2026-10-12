-- One matching rule: verified, unblocked company, not the request owner, request category in provide_categories.
-- Used by list_matching(request), the step-3 preview count and the default request-alert recipients.
-- Also lets become_company take the account intent instead of always granting 'both'.
begin;
set local lock_timeout='5s';

create or replace function public.count_matching_suppliers(p_category text,p_city text default null) returns integer
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=meetany_private.uid(); n integer;
begin
 -- p_city is accepted for symmetry with list_matching, which only uses the city for ranking.
 if not coalesce(meetany_private.is_category(p_category),false) then perform meetany_private.flow_fail('MA902'); end if;
 select count(*)::integer into n from public.profiles p
 where p.role='company' and p.verified and not p.blocked and p.id is distinct from me and p_category=any(p.provide_categories);
 return n;
end $$;
revoke all on function public.count_matching_suppliers(text,text) from public,anonymous,authenticated;
grant execute on function public.count_matching_suppliers(text,text) to anonymous,authenticated;

-- Missing preference rows follow the matching rule; saved rows always win (see notify_matching_request).
create or replace function meetany_private.default_request_alert_preferences(p public.profiles)
returns table(enabled boolean,categories text[],cities text[],email_mode text)
language sql stable set search_path='' as $$
 with defaults as (
  select case when cardinality(p.provide_categories)>0 then p.provide_categories
   when p.industry is not null then array[p.industry] else '{}'::text[] end cats
 )
 select p.role='company' and p.verified and cardinality(cats)>0,cats,array['georgia']::text[],'off'::text
 from defaults
$$;
revoke all on function meetany_private.default_request_alert_preferences(public.profiles) from public, anonymous, authenticated;

create or replace function public.become_company(p_company text,p_industry text,p_account_intent text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role not in ('client','company') then perform meetany_private.flow_fail('MA901'); end if;
 if length(btrim(coalesce(p_company,''))) not between 2 and 100 or not coalesce(meetany_private.is_category(p_industry),false)
  or p_account_intent is null or p_account_intent not in ('buy','sell','both') then perform meetany_private.flow_fail('MA902'); end if;
 if me.role='company' then return me; end if;
 update public.profiles set role='company',company=btrim(p_company),industry=p_industry,verified=false,verified_at=null,provide_categories=array[p_industry],account_intent=p_account_intent where id=me.id returning * into me;
 return me;
end $$;
revoke all on function public.become_company(text,text,text) from public,anonymous,authenticated;
grant execute on function public.become_company(text,text,text) to authenticated;

create or replace function public.become_company(p_company text,p_industry text) returns public.profiles
language sql security definer set search_path='' as $$ select public.become_company(p_company,p_industry,'both') $$;
commit;
