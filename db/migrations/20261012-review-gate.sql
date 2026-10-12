-- Company reviews exist only for completed deals, and a rated completed deal publishes its review on the company profile.
-- Re-runnable; existing company_reviews rows are not touched (reviews written before this gate stay as they are).
begin;

-- A deal rating may be stars only (the deal review text is optional), so a company review may have no text.
-- The 20-character minimum for hand-written reviews stays enforced in save_company_review.
alter table meetany_private.company_reviews drop constraint if exists company_reviews_body_check;
alter table meetany_private.company_reviews drop constraint if exists company_reviews_body_len;
alter table meetany_private.company_reviews add constraint company_reviews_body_len check(length(btrim(body))<=1500);

create or replace function public.my_company_review_targets(p_company_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select r.id,r.title,v.rating,v.body,v.status,v.reason
 from public.requests r
 join meetany_private.deals d on d.request_id=r.id and d.stage='complete' and d.buyer_id=me.id and d.supplier_id=p_company_id
 left join meetany_private.company_reviews v on v.request_id=r.id and v.author_id=me.id and v.company_id=p_company_id
 where r.owner_id=me.id and not r.hidden and me.id<>p_company_id order by r.created_at desc,r.id) t);
end $$;

create or replace function public.save_company_review(p_request_id uuid,p_rating integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); company uuid; v meetany_private.company_reviews;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_body is null or length(btrim(p_body)) not between 20 and 1500 then raise exception using errcode='22023',message='MA601: invalid review'; end if;
 select d.supplier_id into company from public.requests r
 join meetany_private.deals d on d.request_id=r.id and d.stage='complete' and d.buyer_id=me.id
 join public.profiles c on c.id=d.supplier_id and not c.blocked and c.role='company'
 where r.id=p_request_id and r.owner_id=me.id and not r.hidden and d.supplier_id<>me.id for share of r;
 if company is null then raise exception using errcode='42501',message='MA602: review requires a completed deal'; end if;
 insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body,status) values(p_request_id,me.id,company,p_rating,btrim(p_body),'published')
 on conflict(request_id) do update set company_id=excluded.company_id,rating=excluded.rating,body=excluded.body,status=case when company_reviews.status='hidden' then 'hidden' else 'published' end,updated_at=now() where company_reviews.author_id=me.id returning * into v;
 if v.id is null then raise exception using errcode='42501',message='MA602: review is not yours'; end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,v.id,'review_saved',jsonb_build_object('rating',v.rating,'status',v.status));
 return to_jsonb(v);
end $$;

-- rate_deal_full delegates to rate_deal, so one publication point covers both.
create or replace function public.rate_deal(p_deal_id uuid,p_rating integer,p_review text,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); d meetany_private.deals; v meetany_private.company_reviews;
begin
 select * into d from meetany_private.deals where id=p_deal_id and buyer_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if p_expected_revision is distinct from d.revision then perform meetany_private.flow_fail('MA904'); end if;
 if d.stage<>'complete' or d.rating is not null then perform meetany_private.flow_fail('MA903'); end if;
 if p_rating is null or p_rating not between 1 and 5 or length(coalesce(p_review,''))>2000 then perform meetany_private.flow_fail('MA902'); end if;
 update meetany_private.deals set rating=p_rating,review=btrim(p_review),rated_at=now(),revision=revision+1 where id=d.id returning * into d;
 perform meetany_private.deal_event(d,'rated');
 -- Publish on the company profile; a review the moderators hid (or one written by someone else) is left alone.
 insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body,status)
 values(d.request_id,d.buyer_id,d.supplier_id,p_rating,left(btrim(coalesce(p_review,'')),1500),'published')
 on conflict(request_id) do update set company_id=excluded.company_id,rating=excluded.rating,body=excluded.body,status=case when company_reviews.status='hidden' then 'hidden' else 'published' end,updated_at=now() where company_reviews.author_id=d.buyer_id returning * into v;
 if v.id is not null then
  insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,v.id,'review_saved',jsonb_build_object('rating',v.rating,'status',v.status,'source','deal'));
 end if;
 return to_jsonb(d);
end $$;

commit;
