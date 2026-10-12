-- Required request names may be a single character. Preserve all other RPC checks.
begin;
alter table public.requests drop constraint if exists requests_title_check;
alter table public.requests add constraint requests_title_check
  check (char_length(title) between 1 and 120 and char_length(btrim(title)) > 0);

do $$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.create_request(text,text,text,text,text,numeric,text,date,text)',
    'public.update_request(uuid,text,text,text,text,numeric,text,date,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if position('if char_length(v_title) < 5 then' in definition) > 0 then
      execute replace(definition, 'if char_length(v_title) < 5 then', 'if char_length(v_title) < 1 then');
    elsif position('if char_length(v_title) < 1 then' in definition) = 0 then
      raise exception 'Unexpected title validation in %', signature;
    end if;
  end loop;
  definition := pg_get_functiondef('meetany_private.fail(text)'::regprocedure);
  execute replace(definition, 'title must be at least 5 characters', 'title is required');
end $$;
commit;
