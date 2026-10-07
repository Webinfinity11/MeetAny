-- Requires offer-terms + matching. Account intent is NOT an authorization role.
begin;
set local lock_timeout='5s';
alter table public.profiles add column if not exists account_intent text not null default 'both' check(account_intent in ('buy','sell','both'));
alter table public.profiles add column if not exists employee_band text check(employee_band in ('1-7','8-50','51-200','201+'));
alter table public.profiles add column if not exists founded_year integer check(founded_year between 1800 and 2200);
alter table public.profiles add column if not exists markets text[] not null default '{}' check(meetany_private.valid_items(markets));
alter table public.profiles add column if not exists languages text[] not null default '{}' check(meetany_private.valid_items(languages));
alter table public.profiles add column if not exists legal_name text check(length(legal_name) between 2 and 200);
alter table public.profiles add column if not exists registration_code text check(length(registration_code) between 3 and 40);
alter table public.profiles add column if not exists legal_form text check(length(legal_form) between 1 and 80);
alter table public.profiles add column if not exists contact_position text check(length(contact_position)<=100);
alter table public.profiles add column if not exists website text check(length(website)<=500 and website ~ '^https?://');
alter table public.profiles add column if not exists business_tags text[] not null default '{}' check(meetany_private.valid_items(business_tags));
alter table public.profiles add column if not exists certificates text[] not null default '{}' check(meetany_private.valid_items(certificates));
alter table public.profiles add column if not exists verification_documents_status text not null default 'not_submitted' check(verification_documents_status in ('not_submitted','pending','approved','rejected'));
-- Only status metadata: private file storage/upload authorization must precede document submission.
create or replace function public.set_onboarding_details(p_account_intent text,p_employee_band text,p_founded_year integer,p_markets text[],p_languages text[],p_legal_name text,p_registration_code text,p_legal_form text,p_contact_position text,p_website text,p_business_tags text[],p_certificates text[]) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result public.profiles;
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if p_account_intent is null or p_account_intent not in ('buy','sell','both')
 or (p_employee_band is not null and p_employee_band not in ('1-7','8-50','51-200','201+'))
 or (p_founded_year is not null and (p_founded_year<1800 or p_founded_year>extract(year from meetany_private.today())))
 or p_markets is null or not meetany_private.valid_items(p_markets) or p_languages is null or not meetany_private.valid_items(p_languages)
 or (p_legal_name is not null and length(btrim(p_legal_name)) not between 2 and 200)
 or (p_registration_code is not null and length(btrim(p_registration_code)) not between 3 and 40)
 or (p_legal_form is not null and length(btrim(p_legal_form)) not between 1 and 80)
 or length(p_contact_position)>100 or (p_website is not null and (length(p_website)>500 or p_website !~ '^https?://'))
 or p_business_tags is null or not meetany_private.valid_items(p_business_tags) or p_certificates is null or not meetany_private.valid_items(p_certificates) then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set account_intent=p_account_intent,employee_band=p_employee_band,founded_year=p_founded_year,
 markets=p_markets,languages=p_languages,legal_name=btrim(p_legal_name),registration_code=btrim(p_registration_code),legal_form=btrim(p_legal_form),
 contact_position=btrim(p_contact_position),website=p_website,business_tags=p_business_tags,certificates=p_certificates,
 verification_documents_status=case when (legal_name,registration_code,legal_form) is distinct from (btrim(p_legal_name),btrim(p_registration_code),btrim(p_legal_form)) then 'not_submitted' else verification_documents_status end
 where id=me.id returning * into result;
 return result;
end $$;
-- Admin status is separate from profiles.verified; existing admin approval stays authoritative.
create or replace function public.admin_set_document_status(p_profile_id uuid,p_status text) returns text
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_status is null or p_status not in ('not_submitted','pending','approved','rejected') then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set verification_documents_status=p_status where id=p_profile_id and role='company';
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_profile_id,'document_status',jsonb_build_object('status',p_status));
 return p_status;
end $$;
revoke all on function public.set_onboarding_details(text,text,integer,text[],text[],text,text,text,text,text,text[],text[]),public.admin_set_document_status(uuid,text) from public,anonymous,authenticated;
grant execute on function public.set_onboarding_details(text,text,integer,text[],text[],text,text,text,text,text,text[],text[]),public.admin_set_document_status(uuid,text) to authenticated;
commit;
