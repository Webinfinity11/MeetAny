// One caller-scoped transaction replaces the browser's dependent catalog reads.
// No shared cache: private offers, contacts and notifications always use RLS.
const PUBLIC_PROFILE = 'id,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng,logo_url,gallery';
export async function marketBootstrap(db, authenticated) {
  const me = authenticated ? 'select * from public.my_profile() where id is not null' : 'select null::uuid as id where false';
  const offers = authenticated ? 'select * from public.offers' : 'select null::uuid as company_id where false';
  const stats = authenticated ? "case when exists(select 1 from m where role='admin' and not blocked) then public.admin_stats() else null end" : 'null::jsonb';
  const engagement = authenticated ? "case when exists(select 1 from m where not blocked) then public.engagement_state() else null end" : 'null::jsonb';
  const contacts = authenticated ? `select r.id,public.contact_for_request(r.id) as contact from r
    where r.chosen_offer_id is not null and (r.owner_id=(select id from m) or exists(select 1 from o where o.id=r.chosen_offer_id and o.company_id=(select id from m)))` : 'select null::uuid as id,null::jsonb as contact where false';
  const sql = `with m as materialized (${me}), r as materialized (select * from public.requests),
    c as materialized (select ${PUBLIC_PROFILE} from public.profiles where role='company'),
    o as materialized (${offers}), contacts as (${contacts}),
    cg as (select array_agg(id) as ids from (select id,(row_number() over(order by id)-1)/500 as batch from c) t group by batch),
    rg as (select array_agg(id) as ids from (select id,(row_number() over(order by id)-1)/500 as batch from r) t group by batch)
    select json_build_object(
      'me',(select row_to_json(m) from m),
      'requests',(select coalesce(json_agg(r),'[]'::json) from r),
      'companies',(select coalesce(json_agg(c),'[]'::json) from c),
      'offers',(select coalesce(json_agg(o),'[]'::json) from o),
      'companyStats',(select coalesce(json_agg(t),'[]'::json) from cg cross join lateral public.company_stats(ids=>cg.ids) t),
      'counts',(select coalesce(json_agg(t),'[]'::json) from rg cross join lateral public.offer_counts(ids=>rg.ids) t),
      'profiles',(select coalesce(json_agg(t),'[]'::json) from (select ${PUBLIC_PROFILE} from public.profiles where id in(select owner_id from r union select company_id from o) and id not in(select id from c)) t),
      'contacts',(select coalesce(json_agg(contacts),'[]'::json) from contacts),
      'stats',${stats},'engagement',${engagement}) as j`;
  return (await db.query(sql)).rows[0].j;
}
