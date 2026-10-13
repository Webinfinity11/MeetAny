begin read only;
select jsonb_pretty(jsonb_build_object(
 'bracket_requests',(select coalesce(jsonb_agg(x),'[]') from (select id,owner_id,title from public.requests where title ~ '^\[') x),
 'marked_requests',(select coalesce(jsonb_agg(x),'[]') from (select id,owner_id,title from public.requests where title ~* '\[(e2e|qa|strict-qa|ux-audit|gap-audit)(\]|[- :])') x),
 'marked_offers',(select coalesce(jsonb_agg(x),'[]') from (select id,company_id,request_id,body from public.offers where body ~* '\[(e2e|qa|strict-qa|ux-audit|gap-audit)(\]|[- :])') x),
 'marked_profiles',(select coalesce(jsonb_agg(x),'[]') from (select id,email,company,name from public.profiles where concat_ws(' ',name,company,email) ~* '\[(e2e|qa|strict-qa|ux-audit|gap-audit)(\]|[- :])' or email ~* '^(e2e\+|qa[-+])') x),
 'demo_companies',(select coalesce(jsonb_agg(x),'[]') from (select id,company from public.profiles where about like '%სადემო კომპანია%') x),
 'auth_accounts_remaining',(select coalesce(jsonb_agg(x),'[]') from (select p.id,p.email,exists(select 1 from neon_auth."user" u where u.id::text=p.id::text) auth_present from public.profiles p where p.email ~ '^e2e\+[0-9]+-[a-z0-9-]+@meetany\.local$') x)
));
commit;
