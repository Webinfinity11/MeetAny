-- Only IDs/emails; no passwords, sessions, tokens or credentials.
begin read only;
select jsonb_pretty(jsonb_agg(x)) from (
 select u.id,u.email,exists(select 1 from public.profiles p where p.id::text=u.id::text) has_profile
 from neon_auth."user" u where u.email ~ '^e2e\+' order by email
) x;
commit;
