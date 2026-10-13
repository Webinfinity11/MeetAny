-- Detail reads share one transaction. SECURITY INVOKER keeps offers under the
-- caller's RLS; existing routines retain private-budget and file access checks.
begin;
set local lock_timeout='5s';
create or replace function public.request_detail_extras(p_request_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare preferences jsonb; files jsonb; offer_files jsonb:='{}'::jsonb;
begin
 preferences:=public.request_preferences(p_request_id);
 files:=public.list_attachments('request',p_request_id);
 -- Anonymous has no SELECT grant on offers. Never query that table for guests;
 -- authenticated callers use their ordinary SELECT grant and offer RLS.
 if current_user<>'anonymous' then
  select coalesce(jsonb_object_agg(o.id::text,public.list_attachments('offer',o.id)),'{}'::jsonb)
   into offer_files from public.offers o where o.request_id=p_request_id;
 end if;
 return jsonb_build_object('preferences',preferences,'attachments',files,
  'offerAttachments',offer_files,'businessFeatures',public.company_business_features());
end
$$;
create or replace function public.company_detail_extras(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'products',public.company_products(p_id),
  'reviews',public.company_reviews(p_id),
  'stats',public.company_public_stats(p_id))
$$;
revoke all on function public.request_detail_extras(uuid),public.company_detail_extras(uuid) from public;
grant execute on function public.request_detail_extras(uuid),public.company_detail_extras(uuid) to anonymous,authenticated;
commit;
