from pathlib import Path
import re,hashlib
root=Path('dist')
# A separate static route tree preserves the approved design and all existing behavior.
files=[root/'index.html',root/'categories/index.html',*sorted((root/'companies').glob('*/index.html'))]
for p in files:
 s=p.read_text()
 s=re.sub(r'<a class="design-switch".*?</a>','',s)
 target='/v2/'+str(p.relative_to(root)).replace('index.html','')
 switch='<a class="design-switch" href="'+target+'">დიზაინი 02 <span aria-hidden="true">↗</span></a>'
 s=s.replace('<div class="header-actions">','<div class="header-actions">'+switch,1)
 p.write_text(s)
 v=s.replace(switch,'')
 v=v.replace('href="/categories','href="/v2/categories').replace('action="/categories','action="/v2/categories').replace('href="/companies','href="/v2/companies').replace('href="/"','href="/v2/"').replace('href="/#','href="/v2/#')
 v=re.sub(r'<script src="/app.js[^\"]*"','<script src="/v2/app.js"',v)
 v=v.replace('</head>','<link rel="stylesheet" href="/v2/design.css"></head>').replace('<body>','<body class="design-two">')
 back='/'+str(p.relative_to(root)).replace('index.html','')
 v=v.replace('<div class="header-actions">','<div class="header-actions"><a class="design-switch" href="'+back+'">დიზაინი 01 <span aria-hidden="true">↗</span></a>',1)
 if p==root/'index.html':
  v=v.replace('class="home-discovery"','class="home-discovery editorial-discovery"')
  v=v.replace('MeetAny · პარტნიორები შენი ბიზნესისთვის','ბიზნესის საჭიროებები. სწორი კავშირები.')
  v=v.replace('აღწერე, რა გჭირდება.<br>იპოვე შესაბამისი კომპანია.','ყველა საქმიანი კავშირი<br><span>ერთი საჭიროებით იწყება.</span>')
  # Separate the process from the entry field, but retain all three steps and art.
  steps=re.search(r'<ol class="discovery-steps".*?</ol>',v).group()
  v=v.replace(steps,'')
  v=v.replace('<section class="category-section"','<section class="editorial-process"><div class="editorial-process-label">როგორ მუშაობს MeetAny</div>'+steps+'</section><section class="category-section"',1)
 if '/companies/' in str(p):
  v=re.sub(r'(<img class="profile-cover".*?)(<nav class="profile-sections-nav")',r'<div class="editorial-profile-hero">\1</div>\2',v,count=1)
 out=root/'v2'/p.relative_to(root);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(v)
app=(root/'app.js').read_text().replace('/categories','/v2/categories').replace('/companies/','/v2/companies/')
(root/'v2/app.js').write_text(app)
css=root/'refinement.css'
if '.design-switch {' not in css.read_text():
 css.write_text(css.read_text()+'''\n.design-switch { display:inline-flex; align-items:center; gap:9px; padding:8px 12px; border:1px solid #c9d6e8; border-radius:6px; font-size:12px; color:#245ddd; white-space:nowrap; font-feature-settings:"case" 1; }
.design-switch:hover { background:#edf3ff; }
@media(max-width:900px) { .header-actions { gap:10px; } .header-actions .language { display:none; } }
@media(max-width:600px) { .header-inner { flex-wrap:wrap; } .header-actions { flex-wrap:wrap; } .design-switch { padding:6px 8px; font-size:11px; } }
''')
