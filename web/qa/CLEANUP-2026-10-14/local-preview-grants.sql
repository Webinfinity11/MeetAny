-- LOCAL PREVIEW ONLY: snapshot was restored without ACLs. Not part of production cleanup.
-- Existing grants copied from db/schema.sql:45,508-509 and 20261007-contact-visibility.sql:6.
begin;
do $$ begin
 if current_database()<>'meetany_preview_p7_dbclean' then raise exception 'Local cleanup preview only'; end if;
end $$;
grant usage on schema meetany_private to anonymous,authenticated;
grant select on public.requests to anonymous,authenticated;
grant select on public.offers to authenticated;
grant select(id,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng,logo_url,gallery) on public.profiles to anonymous,authenticated;
commit;
