"""Read-only source/catalog cross-check. Run from repository root."""
import json,re,pathlib,subprocess
ROOT=pathlib.Path('web/qa/CLEANUP-2026-10-14')
d=json.loads((ROOT/'inventory.json').read_text())
def split_args(s):
 parts=[]; start=0; level=0; quote=False
 for i,c in enumerate(s):
  if c=="'": quote=not quote
  if not quote:
   if c in '([': level+=1
   if c in ')]': level-=1
   if c==',' and level==0: parts.append(s[start:i]); start=i+1
 parts.append(s[start:]); return parts
signatures={}
for p in [pathlib.Path('db/schema.sql'),*sorted(pathlib.Path('db/migrations').glob('*.sql'))]:
 text=re.sub(r'--[^\n]*','',p.read_text())
 for m in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+((?:public|meetany_private)\.\w+)\s*\(',text,re.I):
  start=m.end(); i=start; depth=1; quote=False
  while depth:
   c=text[i]
   if c=="'": quote=not quote
   if not quote: depth+=(c=='(')-(c==')')
   i+=1
  args=[]
  for arg in split_args(text[start:i-1]):
   arg=re.split(r'\bdefault\b|=',arg,flags=re.I)[0].strip().lower()
   arg=re.sub(r'^in\s+','',arg)
   if not arg: continue
   if arg.startswith('out '): continue
   words=arg.split()
   if len(words)>1 and words[0] not in ['double','timestamp','character']: arg=' '.join(words[1:])
   arg={'int':'integer','int4':'integer','int8':'bigint','bool':'boolean','timestamptz':'timestamp with time zone','varchar':'character varying'}.get(arg,arg)
   args.append(re.sub(r'\bpublic\.', '', arg))
  signatures.setdefault(m[1].lower()+'('+', '.join(args)+')',[]).append(str(p))
files=list(pathlib.Path('web/app').rglob('*'))
code={str(p):p.read_text() for p in files if p.is_file() and p.suffix in ['.js','.ts','.tsx','.jsx']}
result=[]
for f in d['functions']:
 key=f['schema']+'.'+f['name']+'('+f['types']+')'
 result.append({'signature':key,'defined_in':signatures.get(key,[]),'code_references':[p for p,t in code.items() if re.search(r'\b'+re.escape(f['name'])+r'\b',t)],'dependents':f['dependents']})
(ROOT/'function-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Not defined signatures:')
for f in result:
 if not f['defined_in']: print(json.dumps(f,ensure_ascii=False))
print('counts',len(result))
