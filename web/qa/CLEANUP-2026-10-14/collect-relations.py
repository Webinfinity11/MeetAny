"""Generate and execute read-only relationship inventory; never selects credentials."""
import json,re,pathlib,subprocess
root=pathlib.Path('web/qa/CLEANUP-2026-10-14')
def query(sql):
 return json.loads(subprocess.check_output(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d','meetany_live_snapshot_20261014','-c',"begin read only; select coalesce(jsonb_agg(x),'[]') from ("+sql+") x; commit;"],text=True))
ledger=[]
profile_emails={p['id']:p['email'] for p in json.loads((root/'inventory.json').read_text())['profiles']}
for b in re.findall(r'```(?:json)?\s*([\s\S]*?)```',pathlib.Path('DEMO-ACCOUNTS.local.md').read_text()):
 try: data=json.loads(b)
 except ValueError: continue
 if isinstance(data,dict) and 'accounts' in data:
  for email,a in data['accounts'].items(): ledger.append({'id':a['id'],'email':a.get('email',profile_emails.get(a['id'],email))})
(root/'protected-accounts.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
ids=','.join("'%s'"%a['id'] for a in ledger)
predicate="email ~ '^e2e\\+[0-9]+-[a-z0-9-]+@meetany\\.local$' and blocked and onboarding_completed_at is null and id not in ("+ids+")"
queries={
 'candidates':"select id,email,company,blocked,onboarding_completed_at from public.profiles where "+predicate,
 'orphan_contacts':"select id,actor_id,target_kind,target_id from meetany_private.contact_events where (target_kind='request' and not exists(select 1 from public.requests where id=target_id)) or (target_kind='company' and not exists(select 1 from public.profiles where id=target_id))",
 'drafts':"select owner_id,updated_at,data->>'title' title from meetany_private.request_drafts",
 'uploads':"select id,owner_id,kind,target_id,created_at,completed_id,created_at<timestamptz '2026-10-14 00:00:00+00'-interval '1 day' expired_at_cutoff from meetany_private.file_uploads",
 'orphan_attachments':"select id,owner_id,kind,target_id from meetany_private.attachments a where case kind when 'request' then not exists(select 1 from public.requests where id=a.target_id) when 'offer' then not exists(select 1 from public.offers where id=a.target_id) when 'conversation' then not exists(select 1 from meetany_private.conversations where id=a.target_id) when 'verification' then not exists(select 1 from public.profiles where id=a.target_id) when 'deal' then not exists(select 1 from meetany_private.deals where id=a.target_id) when 'issue' then not exists(select 1 from meetany_private.deal_issues where id=a.target_id) else false end",
 'orphan_notifications':"select id,user_id,request_id,offer_id,deal_id from meetany_private.notifications n where not exists(select 1 from public.profiles where id=n.user_id) or (request_id is not null and not exists(select 1 from public.requests where id=n.request_id)) or (offer_id is not null and not exists(select 1 from public.offers where id=n.offer_id)) or (deal_id is not null and not exists(select 1 from meetany_private.deals where id=n.deal_id))",
 'orphan_conversations':"select id,client_id,company_id,request_id from meetany_private.conversations c where not exists(select 1 from public.profiles where id=c.client_id) or not exists(select 1 from public.profiles where id=c.company_id) or (request_id is not null and not exists(select 1 from public.requests where id=c.request_id))",
 'orphan_drafts':"select owner_id,updated_at from meetany_private.request_drafts d where not exists(select 1 from public.profiles where id=d.owner_id)",
 'registration_sessions':"select s.id,e.id event_id,e.profile_id,e.stage from meetany_private.registration_sessions s join meetany_private.registration_events e on e.session_id=s.id where s.id in (select session_id from meetany_private.registration_events where profile_id in (select id from public.profiles where "+predicate+"))"
}
cols=query("select table_schema,table_name,column_name from information_schema.columns where table_schema in ('public','meetany_private') and udt_name='uuid'")
for c in cols:
 if c['table_name'] in ['moderation_audit','business_audit'] or c['column_name']=='id': continue
 key='references:'+c['table_schema']+'.'+c['table_name']+'.'+c['column_name']
 queries[key]=f"select count(*) count from {c['table_schema']}.{c['table_name']} where {c['column_name']} in (select id from public.profiles where {predicate})"
sql='begin read only;\n'
for key,q in queries.items(): sql+="select jsonb_build_object('category', '"+key+"', 'rows', (select coalesce(jsonb_agg(x),'[]') from ("+q+") x));\n"
sql+='commit;\n';(root/'relations.sql').write_text(sql)
r={k:query(v) for k,v in queries.items()}
(root/'relations.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
for k,v in r.items():
 if not k.startswith('references:') or v[0]['count']: print(k,json.dumps(v,ensure_ascii=False))
