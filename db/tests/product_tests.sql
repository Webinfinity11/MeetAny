\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.product_start as select count(*) n from t.passed;
grant select on t.product_start to public;
update public.profiles set blocked=false where id=t.uid('gal_f');
select t.as_user('gal_c');
select t.throws($q$select public.set_my_products('[]')$q$,'MA201','PR client denied');
select t.as_user('gal_f');
select public.set_my_gallery(array[t.photo('gal_f','gallery-product.jpg')]);
select t.throws($q$select public.set_my_products('{}')$q$,'MA622','PR object rejected');
select t.throws($q$select public.set_my_products('[{"name":"x"}]')$q$,'MA622','PR incomplete item rejected');
select t.throws($q$select public.set_my_products(jsonb_build_array(jsonb_build_object('name','Chair','photoUrl',t.photo('gal_g','gallery-product.jpg'))))$q$,'MA622','PR foreign owner photo rejected');
select t.throws($q$select public.set_my_products(jsonb_build_array(jsonb_build_object('name','Chair','photoUrl',t.photo('gal_f','gallery-missing.jpg'))))$q$,'MA622','PR missing gallery photo rejected');
select t.ok(jsonb_array_length(public.set_my_products(jsonb_build_array(jsonb_build_object('name','Chair','photoUrl',t.photo('gal_f','gallery-product.jpg'),'note','Wooden chair'))))=1,'PR product saved');
select t.as_anon();
select t.ok(public.company_products(t.uid('gal_f'))->0->>'name'='Chair','PR guest reads products');
select t.throws($q$select public.set_my_products('[]')$q$,'42501','PR guest cannot mutate');
select t.as_user('gal_f');
select public.set_my_gallery('{}');
select t.ok(public.company_products(t.uid('gal_f'))='[]'::jsonb,'PR removed gallery photos no longer public');
select t.as_super();
update public.profiles set blocked=true where id=t.uid('gal_f');
select t.as_anon();
select t.ok(public.company_products(t.uid('gal_f'))='[]'::jsonb,'PR blocked products hidden');
select t.as_super();
\o
select 'Product tests: '||(count(*)-(select n from t.product_start))||' passed' from t.passed;
