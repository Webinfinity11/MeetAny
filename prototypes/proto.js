/* Static, local fixtures only. No market store, auth, API calls or persistence. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const params=new URLSearchParams(location.search),screen=document.body.dataset.screen,state=params.get('state')||'';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<svg class="icon" aria-hidden="true"><use href="/icons.svg#${n}"></use></svg>`;
const empty=(title,text)=>`<div class="ma-empty"><span class="ma-empty__icon">${icon('search')}</span><h2 class="ma-empty__title">${title}</h2><p class="ma-empty__text">${text}</p><a class="ma-btn ma-btn--secondary" href="${location.pathname}">საწყის ხედზე დაბრუნება</a></div>`;
const loading=()=>`<div class="ma-stack" aria-busy="true" aria-label="მონაცემები იტვირთება"><p role="status">იტვირთება…</p>${Array.from({length:3},()=>'<div class="ma-card ma-stack"><span class="ma-skel ma-skel--title"></span><span class="ma-skel ma-skel--line"></span><span class="ma-skel ma-skel--line ma-skel--w60"></span></div>').join('')}</div>`;
const launch=(id,opener)=>{const d=document.getElementById(id);d._opener=opener;d.showModal()};
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o){e.preventDefault();if(o.dataset.publicCompany)$('#public-company-name').textContent=o.dataset.publicCompany;launch(o.dataset.open,o);}if(e.target.closest('[data-close]'))e.target.closest('dialog').close();if(e.target.closest('[data-demo]')){const node=e.target.closest('[data-demo]');node.setAttribute('aria-describedby','prototype-feedback');$('#prototype-feedback').textContent='პროტოტიპი: ეს მოქმედება მონაცემებს არ ცვლის.'}});
$$('dialog').forEach(d=>d.addEventListener('close',()=>d._opener?.focus()));
const objectIcon=key=>{const positions={food:[3,0],packaging:[0,1],textiles:[0,0],logistics:[2,0],technology:[3,1]};const xy=positions[key];return xy?`<span class="r2-object" aria-hidden="true"><img src="/assets/industry-objects.png" alt="" style="left:${-100*xy[0]}%;top:${-100*xy[1]}%"></span>`:`<span class="r2-object r2-object--business" aria-hidden="true"><img src="/assets/category-business-3d.png" alt=""></span>`};
if(screen==='t21-requests'){const search=$('.ma-proto-toolbar .ma-field');const box=document.createElement('div');box.className='r2-search';box.append(search);$('.r2-band').append(box)}
if(screen==='t21-requests'){
 const categories={furniture:'ავეჯი და ინვენტარი',packaging:'შეფუთვა და წარმოება',food:'საკვები და სასმელი',textiles:'ტექსტილი და სასტუმროები',logistics:'ლოგისტიკა და დისტრიბუცია',technology:'IT და ტექნოლოგიები'};
 const cities={tbilisi:'თბილისი',batumi:'ბათუმი'};
 const rows=[
  {title:'სასტუმროსთვის გვჭირდება 120 ხის სკამი',category:'furniture',city:'tbilisi',quantity:'120 ცალი',owner:'სასტუმრო „ივერია“',days:8,neededBy:'5 ოქტომბრამდე',offers:3,sent:true,photo:null},
  {title:'500 მუყაოს ყუთი საკონდიტროსთვის',category:'packaging',city:'tbilisi',quantity:'500 ცალი',owner:'საკონდიტრო „ნუში“',days:11,neededBy:'1 ოქტომბრამდე',offers:2,photo:'/assets/photos/cardboard-packaging.jpg'},
  {title:'კაფესთვის 20 სასადილო მაგიდა',category:'furniture',city:'tbilisi',quantity:'20 ცალი',owner:'კაფე „ეზო“',days:3,neededBy:'28 სექტემბრამდე',offers:0,photo:null},
  {title:'ყოველკვირეული ბოსტნეულის მიწოდება',category:'food',city:'tbilisi',quantity:'80 კგ',owner:'რესტორანი „ბაღი“',days:12,neededBy:null,offers:1,photo:null},
  {title:'სასტუმროსთვის 40 საწოლის კარკასი',category:'furniture',city:'batumi',quantity:'40 ცალი',owner:'სასტუმრო „ზღვა“',days:5,neededBy:'8 ოქტომბრამდე',offers:4,photo:null},
  {title:'საჩუქრის 300 ქაღალდის ჩანთა',category:'packaging',city:'batumi',quantity:'300 ცალი',owner:'მაღაზია „ფერადი“',days:7,neededBy:null,offers:1,photo:null}
 ];
 let city='tbilisi',cat='',query='',sort=0;
 const matching=(r,ignore)=>r.title.includes(query)&&(!city||ignore==='city'||r.city===city)&&(!cat||ignore==='category'||r.category===cat);
 const card=(r)=>`<article class="ma-rcard ma-rcard--row ${state==='mine'?'ma-rcard--mine':state==='closed'?'ma-rcard--closed':''}"><div class="ma-stack"><div class="ma-rcard__top">${r.photo?`<img class="ma-rcard__photo" src="${r.photo}" alt="" width="48" height="48">`:`<span class="ma-avatar">${r.owner.replace(/[„“]/g,'').split(' ').map(w=>w[0]).slice(0,2).join('')}</span>`}<div class="ma-rcard__kicker"><span class="ma-small ma-muted">${categories[r.category]}</span><span class="ma-rcard__time">${state==='mine'?(params.get('role')==='client'?'ნინო ბერიძე':'ხის სახელოსნო „კერა“'):r.owner}</span></div>${state==='mine'?'<span class="ma-badge ma-badge--info">შენი მოთხოვნა</span>':state==='closed'?'<span class="ma-badge ma-badge--neutral">დახურულია</span>':''}</div><h2 class="ma-rcard__title"><a class="ma-proto-rowtitle" href="t22-offers.html">${r.title}</a></h2><div class="ma-facts"><span class="ma-fact">${icon('map-pin')}${cities[r.city]}</span><span class="ma-fact">${icon('package')}${r.quantity}</span></div><div class="ma-small ma-muted">${r.neededBy?'საჭიროა '+r.neededBy:'საჭირო თარიღი არ არის მითითებული'}</div></div><div class="ma-proto-rowend"><span class="ma-rcard__offers"><b>${r.offers}</b> შეთავაზება</span><span class="ma-small ${r.days<4?'ma-rcard__left--soon':'ma-muted'}">${state==='closed'?'მოთხოვნა დახურულია':'დარჩა '+r.days+' დღე'}</span>${params.get('role')!=='client'&&state!=='mine'&&r.sent?`<span class="ma-badge ma-badge--${state==='closed'?'success':'info'}">შენი შეთავაზება ${state==='closed'?'არჩეულია':'გაგზავნილია'}</span>`:''}<a class="ma-btn ma-btn--secondary" href="t22-offers.html${state==='closed'?'?state=chosen':''}">დეტალების ნახვა ${icon('arrow-right')}</a></div></article>`;
 function render(){
  const list=rows.filter(r=>matching(r));if(sort)list.sort((a,b)=>a.days-b.days);
  const count=state==='empty'?0:list.length;
  $('#result-count').textContent=state==='loading'?'მოთხოვნები იტვირთება…':`${count} ${state==='closed'?'დახურული':'ღია'} მოთხოვნა`;
  $('#filter-apply').textContent=`${count} მოთხოვნის ჩვენება`;
  $$('[data-filter-count]').forEach(n=>n.textContent=Number(!!city)+Number(!!cat));
  $$('[data-categories]').forEach(n=>{const entries=[['','ყველა კატეგორია'],...Object.entries(categories)].map(([key,label])=>{const count=rows.filter(r=>matching(r,'category')&&(!key||key===r.category)).length;return {count,html:`<button class="ma-proto-filter" data-category="${key}" aria-pressed="${cat===key}">${objectIcon(key)}<span>${label}</span><span>${count}</span></button>`}});const zero=entries.filter(e=>!e.count);n.innerHTML=entries.filter(e=>e.count).map(e=>e.html).join('')+(zero.length?`<details class="r2-more"><summary>მეტი კატეგორია (${zero.length})</summary>${zero.map(e=>e.html).join('')}</details>`:'')});
  $$('[data-city]').forEach(s=>{s.innerHTML=[['','ყველა ქალაქი'],...Object.entries(cities)].map(([key,label])=>`<option value="${key}">${label} (${rows.filter(r=>matching(r,'city')&&(!key||key===r.city)).length})</option>`).join('');s.value=city});
  $('#active-filters').innerHTML=(city?`<button class="ma-btn ma-btn--secondary" data-remove="city" aria-label="ქალაქის ფილტრის მოხსნა: ${cities[city]}">${cities[city]} ${icon('x')}</button>`:'')+(cat?`<button class="ma-btn ma-btn--secondary" data-remove="category" aria-label="კატეგორიის ფილტრის მოხსნა: ${categories[cat]}">${categories[cat]} ${icon('x')}</button>`:'');
  $('#active-filters').insertAdjacentHTML('beforeend',(city||cat||query)?'<button class="ma-btn ma-btn--ghost" data-clear>გასუფთავება</button>':'');
  $('#request-results').innerHTML=state==='loading'?loading():state==='empty'||!list.length?empty('ამ ფილტრით მოთხოვნა ვერ მოიძებნა','შეცვალე ან გაასუფთავე ფილტრები.'):list.map(card).join('');
 }
 document.addEventListener('click',e=>{const c=e.target.closest('[data-category]'),r=e.target.closest('[data-remove]');if(c)cat=c.dataset.category;if(r){if(r.dataset.remove==='city')city='';else cat=''}if(e.target.closest('[data-clear]')){city='';cat='';query='';$('#query').value=''}if(c||r||e.target.closest('[data-clear]'))render()});
 $$('[data-city]').forEach(s=>s.addEventListener('change',()=>{city=s.value;render()}));
 $('#query').addEventListener('input',e=>{query=e.target.value;render()});$('#sort').addEventListener('change',e=>{sort=e.target.selectedIndex;render()});render();
}
if(screen==='t22-offers'){
 $$('[data-offer-state]').forEach(n=>n.hidden=n.dataset.offerState!==(state==='chosen'?'chosen':'active'));
 if(state==='chosen'){const third=$('[data-offer-state=active] .ma-ocard:last-child').cloneNode(true);third.classList.add('ma-ocard--declined');$('.ma-ocard__name-row',third).insertAdjacentHTML('beforeend','<span class="ma-badge ma-badge--neutral">არ აირჩიეს</span>');$('.ma-ocard__actions',third)?.remove();$('[data-offer-state=chosen]').append(third);}
 if(state==='empty'||state==='loading'){$$('[data-offer-state]').forEach(n=>n.hidden=true);$('#offer-alternative').innerHTML=state==='loading'?loading():empty('ჯერ შეთავაზება არ მიგიღია','კომპანიების პასუხები აქ გამოჩნდება. მოთხოვნა 14 დღეა აქტიური.')}
 if(state==='closed'){$$('[data-open="choose"]').forEach(n=>n.hidden=true);$('#offer-alternative').innerHTML='<p class="ma-note">მოთხოვნა დახურულია. შეთავაზების არჩევა აღარ არის ხელმისაწვდომი.</p>'}
}
if(screen==='t23-new-request'){
 const form=$('#new-request-form'),input=$('#photo'),preview=$('#photo-preview'),img=$('img',preview),error=$('#photo-error');let photoURL;
 function clear(){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;preview.hidden=true;img.hidden=true;img.removeAttribute('src');input.value='';$('#photo-label').textContent='აირჩიე ფოტო ან ჩააგდე აქ'}
 function load(file){clear();error.hidden=true;if(!file)return;if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){error.textContent='აირჩიე JPG, PNG, WEBP ან GIF სურათი.';error.hidden=false;return}photoURL=URL.createObjectURL(file);img.onload=()=>{preview.hidden=false;img.hidden=false;$('#photo-label').textContent=file.name};img.onerror=()=>{clear();error.textContent='სურათი ვერ გაიხსნა. აირჩიე სხვა ფოტო.';error.hidden=false};img.src=photoURL}
 input.addEventListener('change',()=>load(input.files[0]));$('#photo-remove').addEventListener('click',()=>{clear();input.focus()});
 const drop=$('.ma-drop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-over')});drop.addEventListener('dragleave',()=>drop.classList.remove('is-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-over');load(e.dataTransfer.files[0])});
 form.addEventListener('submit',e=>{e.preventDefault();$('#form-message').hidden=false;$('#form-message').textContent='პროტოტიპი: მოთხოვნა არ გამოქვეყნებულა. შენი ტექსტი შენარჩუნებულია.';$('#form-message').scrollIntoView({block:'nearest'})});
 $('#new-request-open').focus();launch('new-request',$('#new-request-open'));
 // VisualViewport keeps the footer within the visible area when a software keyboard resizes it.
 function fit(){if(matchMedia('(max-width:767px)').matches&&window.visualViewport){const d=$('#new-request');d.style.height=visualViewport.height+'px';d.style.maxHeight=visualViewport.height+'px'}else{$('#new-request').style.height='';$('#new-request').style.maxHeight=''}}
 window.visualViewport?.addEventListener('resize',fit);window.addEventListener('resize',fit);fit();
}
if(screen==='t24-account'){
 const client=params.get('role')==='client',profile=params.get('tab')==='profile',role=client?'client':'company';
 $$('[data-company]').forEach(n=>n.hidden=client);$$('[data-client]').forEach(n=>n.hidden=!client);
 $('#account-overview').hidden=profile;$('#account-profile').hidden=!profile;
 $$('[data-overview-link]').forEach(a=>{a.href='?role='+role;a.toggleAttribute('aria-current',!profile);if(!profile)a.setAttribute('aria-current','page')});
 $$('[data-profile-link]').forEach(a=>{a.href='?role='+role+'&tab=profile';if(profile)a.setAttribute('aria-current','page')});
 if(client){$('#account-name').textContent='ნინო ბერიძე';$('#account-role').textContent='სასტუმრო „ივერია“ · კლიენტი';$('#account-avatar').textContent='ნბ';$('#name').value='ნინო ბერიძე';$('#company').value='სასტუმრო „ივერია“';$('label[for=company]').textContent='კომპანია / ობიექტი · არასავალდებულო';$('[data-account-list]').innerHTML='<article class="ma-panel"><a class="ma-proto-rowtitle ma-title" href="t22-offers.html">სასტუმროსთვის გვჭირდება 120 ხის სკამი</a><p class="ma-small ma-muted">თბილისი · 3 შეთავაზება · დარჩა 8 დღე</p><div><span class="ma-badge ma-badge--success">ღია</span></div></article>'}
 if(state==='empty'||state==='loading'){$('#account-overview').innerHTML=state==='loading'?loading():empty('ჯერ მოთხოვნა არ გაქვს','დაამატე პირველი მოთხოვნა — კომპანიები ფასსა და პირობებს შემოგთავაზებენ.')}
 $('#profile-form').addEventListener('submit',e=>{e.preventDefault();$('#profile-status').hidden=false;$('#profile-status').textContent='პროტოტიპი: ცვლილებები სერვერზე არ ინახება.'});
}
if(screen==='t24-admin'){
 const tab=params.get('tab')==='users'?'users':'requests';$('#admin-requests').hidden=tab!=='requests';$('#admin-users').hidden=tab!=='users';$$('[data-admin-tab]').forEach(a=>{a.removeAttribute('aria-current');if(a.dataset.adminTab===tab)a.setAttribute('aria-current','page')});
 if(state==='empty'||state==='loading'){$('#admin-'+tab).hidden=true;$('#admin-alternative').innerHTML=state==='loading'?loading():empty('ჩანაწერები არ არის','ახალი ჩანაწერები აქ გამოჩნდება.')}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-moderate]');if(!b)return;$('#moderation-title').textContent=b.textContent;$('#moderation-text').textContent=b.closest('tr').querySelector('td').innerText;launch('moderation',b)});
}
// Icon-only header action still has a complete accessible name at phone widths.
$$('.ma-header__actions a').forEach(a=>a.setAttribute('aria-label','მოთხოვნის დამატება'));
// Round 2 company fixtures follow mapUser + companyStats; nothing is persisted.
const companyFixtures=[
 {id:'kera',company:'ხის სახელოსნო „კერა“',name:'გიორგი მაისურაძე',industry:'furniture',city:'თბილისი',serviceCities:['თბილისი','ბათუმი','ქუთაისი'],about:'ვამზადებთ ხის ავეჯს სასტუმროებისა და რესტორნებისთვის. სახელოსნო თბილისშია; შეკვეთებს ვაწვდით რეგიონებშიც. ვმუშაობთ წიფლისა და მუხის მასალით, თქვენი სივრცის ზომებისა და სტილის მიხედვით.',offers:['ხის სკამები','მაგიდები შეკვეთით','სასტუმროს ავეჯი'],seeks:['ხის მასალის მომწოდებელი','შეფუთვის მასალა'],verified:true,verifiedAt:'2026-08-15',createdAt:'2026-06-10',stats:{sent:12,chosen:4}},
 {id:'pack',company:'შეფუთვა „პაკეტი“',name:'მარიამ კობახიძე',industry:'packaging',city:'ბათუმი',serviceCities:['მთელი საქართველო'],about:'ქაღალდისა და მუყაოს შეფუთვა თქვენი პროდუქციისთვის.',offers:['მუყაოს ყუთები','ქაღალდის ჩანთები','ბრენდირებული შეფუთვა'],seeks:['ქაღალდის მომწოდებელი'],verified:true,verifiedAt:'2026-08-20',createdAt:'2026-07-01',stats:{sent:8,chosen:2}},
 {id:'nushi',company:'საკვები „ნუში“',name:'ნინო ბერიძე',industry:'food',city:'თბილისი',serviceCities:['თბილისი','რუსთავი'],about:'ახალი პროდუქტების რეგულარული მიწოდება კაფეებისა და რესტორნებისთვის.',offers:['ბოსტნეული','ხილი','ყოველკვირეული მიწოდება'],seeks:['ფერმერული პროდუქტი'],verified:false,verifiedAt:null,createdAt:'2026-09-21',stats:{sent:0,chosen:0}},
 {id:'forma',company:'ავეჯის სახლი „ფორმა“',name:'ლევან კახიძე',industry:'furniture',city:'ქუთაისი',serviceCities:[],about:'',offers:['ავეჯი შეკვეთით'],seeks:[],verified:false,verifiedAt:null,createdAt:'2026-08-02',stats:{sent:3,chosen:1}}
];
const industries={furniture:'ავეჯი და ინვენტარი',packaging:'შეფუთვა და წარმოება',food:'საკვები და სასმელი',textiles:'ტექსტილი და სასტუმროები',logistics:'ლოგისტიკა და დისტრიბუცია'};
const initial=c=>c.company.replace(/[„“]/g,'').split(' ').slice(0,2).map(w=>w[0]).join('');
const chips=values=>`<div class="r2-chips">${values.map(v=>`<span class="r2-chip">${escape(v)}</span>`).join('')}</div>`;
const verified=c=>c.verified?'<span class="ma-badge ma-badge--success">'+icon('check')+'დადასტურებული</span>':'';
const stats=c=>c.stats.sent?`${c.stats.sent} გაგზავნილი · ${c.stats.chosen} არჩეული`:'ახალი წევრი';
const companyRow=c=>`<article class="r2-company-row"><span class="ma-avatar" aria-hidden="true">${initial(c)}</span><div class="r2-company-body"><a class="ma-title ma-proto-rowtitle" href="t25-company.html?id=${c.id}">${escape(c.company)}</a>${verified(c)}<p class="ma-small ma-muted">${industries[c.industry]} · ${c.city}</p><p class="ma-small">ემსახურება: ${c.serviceCities.length?c.serviceCities.join(', '):'ქალაქები არ არის მითითებული'}</p><p class="ma-small">რას გთავაზობთ</p>${chips(c.offers.slice(0,3))}</div><div class="r2-company-end"><span>${stats(c)}</span><a class="ma-btn ma-btn--secondary" href="t25-company.html?id=${c.id}">პროფილი ${icon('arrow-right')}</a></div></article>`;
const sectionTitle=(title,kicker='კომპანიის შესახებ')=>`<div class="r2-section-head"><div><span class="ma-eyebrow">${kicker}</span><h2>${title}</h2></div></div>`;
if(screen==='t25-companies'){
 $('.r2-band').append($('.r2-catalog-search'));
 let industry=industries[params.get('industry')]?params.get('industry'):'',city='',onlyVerified=false,query='';
 const match=(c,ignore)=>`${c.company} ${c.offers.join(' ')}`.includes(query)&&(!industry||ignore==='industry'||industry===c.industry)&&(!city||c.city===city)&&(!onlyVerified||c.verified);
 function renderCompanies(){
  const list=companyFixtures.filter(c=>match(c));
  $$('[data-industries]').forEach(el=>{const entries=[['','ყველა დარგი'],...Object.entries(industries)].map(([key,label])=>{const n=companyFixtures.filter(c=>match(c,'industry')&&(!key||c.industry===key)).length;return {n,html:`<button class="ma-proto-filter" data-industry="${key}" aria-pressed="${industry===key}">${objectIcon(key)}<span>${label}</span><span>${n}</span></button>`}});const zero=entries.filter(e=>!e.n);el.innerHTML=entries.filter(e=>e.n).map(e=>e.html).join('')+(zero.length?`<details class="r2-more"><summary>მეტი კატეგორია (${zero.length})</summary>${zero.map(e=>e.html).join('')}</details>`:'')});
  $$('[data-company-city]').forEach(el=>el.value=city);$$('[data-verified]').forEach(el=>el.checked=onlyVerified);
  $$('[data-company-filter-count]').forEach(el=>el.textContent=Number(!!city)+Number(!!industry)+Number(onlyVerified));
  $('#company-active').innerHTML=[['industry',industry?industries[industry]:''],['city',city],['verified',onlyVerified?'დადასტურებული':'']].filter(([,v])=>v).map(([k,v])=>`<button class="ma-btn ma-btn--secondary" data-company-remove="${k}" aria-label="ფილტრის მოხსნა: ${v}">${v} ${icon('x')}</button>`).join('')+((industry||city||onlyVerified||query)?'<button class="ma-btn ma-btn--ghost" data-company-clear>გასუფთავება</button>':'');
  $('#company-count').textContent=state==='loading'?'კომპანიები იტვირთება…':`${state==='empty'?0:list.length} კომპანია`;
  $('#company-apply').textContent=`${state==='empty'?0:list.length} კომპანიის ჩვენება`;
  $('#company-results').innerHTML=state==='loading'?loading():state==='empty'||!list.length?empty('კომპანია ვერ მოიძებნა','შეცვალე ან გაასუფთავე ფილტრები.'):list.map(companyRow).join('');
 }
 document.addEventListener('click',e=>{const cat=e.target.closest('[data-industry]'),remove=e.target.closest('[data-company-remove]'),clear=e.target.closest('[data-company-clear]');if(cat)industry=cat.dataset.industry;if(remove){if(remove.dataset.companyRemove==='industry')industry='';if(remove.dataset.companyRemove==='city')city='';if(remove.dataset.companyRemove==='verified')onlyVerified=false}if(clear){industry='';city='';onlyVerified=false;query='';$('#company-query').value=''}if(cat||remove||clear)renderCompanies()});
 $$('[data-company-city]').forEach(el=>el.addEventListener('change',()=>{city=el.value;renderCompanies()}));$$('[data-verified]').forEach(el=>el.addEventListener('change',()=>{onlyVerified=el.checked;renderCompanies()}));$('#company-query').addEventListener('input',e=>{query=e.target.value;renderCompanies()});renderCompanies();
}
if(screen==='t25-company'){
 const c=companyFixtures.find(c=>c.id===params.get('id'))||companyFixtures[0],date=value=>{const [y,m,d]=value.split('-');return `${Number(d)} ${['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'][Number(m)-1]}, ${y}`};
 $('#company-profile').innerHTML=`<header class="r2-band ma-page-head"><span class="ma-avatar ma-avatar--xl" aria-hidden="true">${initial(c)}</span><div><span class="ma-eyebrow">კომპანიის პროფილი</span><h1 class="ma-h1">${escape(c.company)}</h1><p class="ma-lead">${industries[c.industry]} · ${c.city}</p><div class="ma-cluster">${verified(c)}<span>${stats(c)}</span></div></div></header><div class="ma-proto-account"><aside class="ma-panel r2-facts"><h2 class="ma-h3">ფაქტები</h2><dl class="ma-kv"><div><dt>ქალაქი</dt><dd>${c.city}</dd></div><div><dt>ემსახურება</dt><dd>${c.serviceCities.join(', ')||'არ არის მითითებული'}</dd></div><div><dt>წევრია</dt><dd>${date(c.createdAt)}</dd></div>${c.verifiedAt?`<div><dt>დადასტურებულია</dt><dd>${date(c.verifiedAt)}</dd></div>`:''}<div><dt>გაგზავნილი</dt><dd>${c.stats.sent}</dd></div><div><dt>არჩეული</dt><dd>${c.stats.chosen}</dd></div></dl></aside><div class="ma-stack"><section class="r2-section">${sectionTitle('ჩვენს შესახებ')}<p>${escape(c.about)||'კომპანიას აღწერა ჯერ არ დაუმატებია.'}</p></section><section class="r2-section">${sectionTitle('რას გთავაზობთ','მომსახურება')}${chips(c.offers)}</section><section class="r2-section">${sectionTitle('რას ვეძებთ','თანამშრომლობა')}${c.seeks.length?chips(c.seeks):'<p class="ma-muted">საჭიროებები ჯერ არ არის მითითებული.</p>'}</section><section class="r2-section">${sectionTitle('ღია მოთხოვნები','კომპანიის საჭიროებები')}${c.id==='kera'?'<article class="ma-panel"><a class="ma-title ma-proto-rowtitle" href="t21-requests.html?state=mine">მშრალი წიფლის მასალა სახელოსნოსთვის</a><p class="ma-muted">თბილისი · 500 კგ · 2 შეთავაზება · დარჩა 6 დღე</p></article>':'<p class="ma-muted">ამ კომპანიას ღია მოთხოვნა ჯერ არ აქვს.</p>'}</section></div></div><section class="r2-cta"><div><span class="ma-eyebrow ma-eyebrow--brand">იპოვე შესაბამისი პარტნიორი</span><h2 class="ma-h2">გჭირდება ${industries[c.industry]}?</h2><a class="ma-btn ma-btn--primary" href="t23-new-request.html?category=${c.industry}">მოთხოვნის დამატება ამ დარგში</a></div><img src="/assets/photos/workshop-process-banner.jpg" alt="" width="640" height="420"></section><div class="r2-sticky"><a class="ma-btn ma-btn--primary" href="t23-new-request.html?category=${c.industry}">მოთხოვნის დამატება ამ დარგში</a></div>`;
}
if(screen==='t23-new-request'&&params.has('category')){const label=industries[params.get('category')];if(label)$('#category').value=label}
// Shared section grammar; existing controls and data fields remain in place.
if(['t22-offers','t24-account','t24-admin'].includes(screen)){
 $$('main h2').filter(h=>!h.closest('.r2-band,.r2-section-head')).forEach(h=>{const wrap=document.createElement('div');wrap.className='r2-section-head';h.before(wrap);const inner=document.createElement('div');inner.innerHTML='<span class="ma-eyebrow">MeetAny · შენი სივრცე</span>';inner.append(h);wrap.append(inner)});
 if(screen==='t22-offers')$$('[data-open="company-preview"]').forEach(a=>{const name=a.closest('article')?.querySelector('[data-public-company]')?.dataset.publicCompany;if(name?.includes('მუხა')){a.dataset.publicCompany=name;return}a.href='t25-company.html?id='+ (name?.includes('ფორმა')?'forma':'kera');a.removeAttribute('data-open')});
 if(screen==='t24-account')$$('a[data-open="company-preview"]').forEach(a=>{a.href='t25-company.html?id=kera';a.removeAttribute('data-open')});
}
if(screen==='t23-new-request')$('#new-request-open').insertAdjacentHTML('afterend',`<section class="r2-steps">${[['01','clipboard-list','აღწერე საჭიროება'],['02','building-2','მიიღე შეთავაზებები'],['03','check','აირჩიე პარტნიორი']].map(([n,i,t])=>`<div><strong>${n}</strong>${icon(i)}<h2 class="ma-title">${t}</h2></div>`).join('')}</section>`);

if(screen==='t21-requests')$('.ma-proto-toolbar').insertAdjacentHTML('beforebegin',sectionTitle('მოთხოვნების სია','შენი შემდეგი საქმიანი კავშირი'));
if(screen==='t22-offers')$('[data-offer-state]').insertAdjacentHTML('beforebegin',sectionTitle('შეადარე პირობები','მიღებული პასუხები'));
if(screen==='t25-companies')$('.r2-cta').insertAdjacentHTML('beforebegin',`<section class="r2-section">${sectionTitle('მიმართულებები შენი ბიზნესისთვის','აღმოაჩინე მეტი')}<div class="r2-photo-grid">${[['textiles','hotel-linen','ტექსტილი და სასტუმროები'],['packaging','cardboard-packaging','შეფუთვა და წარმოება'],['food','fresh-produce','საკვები და სასმელი']].map(([key,img,label])=>`<a class="r2-photo-card" href="?industry=${key}"><img src="/assets/photos/${img}.jpg" alt="" width="640" height="360"><span>${label} ${icon('arrow-right')}</span></a>`).join('')}</div></section>`);

if(screen==='t24-admin')$('.ma-proto-kpis').insertAdjacentHTML('beforebegin',sectionTitle('პლატფორმის მიმოხილვა','ადმინისტრირება'));
