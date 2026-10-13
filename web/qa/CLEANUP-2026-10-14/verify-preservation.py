"""Compare surviving rows byte-for-byte (hashed JSON), snapshot READ ONLY vs local copy."""
import pathlib,json,subprocess
root=pathlib.Path('web/qa/CLEANUP-2026-10-14')
r=json.loads((root/'relations.json').read_text()); ids=','.join("'%s'"%x['id'] for x in r['candidates'])
filters={'public.profiles':f'id not in ({ids})','meetany_private.contact_events':"id<>'7946c958-443d-496f-aeca-f15498e2d07d'",'meetany_private.registration_sessions':"id<>'21ead4e8-2b34-499c-ac7f-4dff3daab339'",'meetany_private.registration_events':"session_id<>'21ead4e8-2b34-499c-ac7f-4dff3daab339'"}
result=[]
for row in json.loads((root/'before-counts.json').read_text()):
 t=row['table_name']; where=filters.get(t,'true'); hashes=[]
 q=f"begin read only; select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) from {t} t where {where}; commit;"
 for db in ['meetany_live_snapshot_20261014','meetany_preview_p7_dbclean']:
  hashes.append(subprocess.check_output(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db,'-c',q],text=True).strip())
 result.append({'table':t,'snapshot_survivors_md5':hashes[0],'preview_md5':hashes[1],'equal':hashes[0]==hashes[1]})
(root/'preservation.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(x['equal'] for x in result),[x for x in result if not x['equal']]
print(f'{len(result)} tables: all surviving rows unchanged')
