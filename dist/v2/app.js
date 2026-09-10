const icon=(name,extra='')=>'<svg class="icon '+extra+'" aria-hidden="true"><use href="/v2/icons.svg#'+name+'"></use></svg>';
const categoryIcons={suppliers:'package',services:'briefcase-business',distributors:'truck',partners:'handshake'};
const categories=[{id:'suppliers',title:'მომწოდებელი',sub:'პროდუქტი და წარმოება'},{id:'services',title:'მომსახურება',sub:'ექსპერტიზა შენი ბიზნესისთვის'},{id:'distributors',title:'დისტრიბუტორი',sub:'ახალი ბაზარი და გაყიდვები'},{id:'partners',title:'ბიზნესპარტნიორი',sub:'ერთობლივი შესაძლებლობები'}];
const companies=[{id:'linen',name:'Linen House',initials:'lh.',type:'suppliers',city:'tbilisi',cityLabel:'თბილისი',description:'სასტუმროს თეთრეული და ტექსტილი — შენი სტუმრების კომფორტისთვის.',tags:['სასტუმროები','ტექსტილი'],color:'#357da4',bg:'#e9f3f9',offer:['თეთრეულის და პირსახოცების მიწოდება','სასტუმროებისა და რესტორნების ტექსტილი','შეკვეთის პირობების ინდივიდუალური შეთანხმება'],area:'თბილისი, ბათუმი',words:'თეთრეული მომწოდებელი ტექსტილი სასტუმრო თბილისი ბათუმი',languages:'ქართული, ინგლისური'},
{id:'studio',name:'Forma Studio',initials:'f.',type:'services',city:'tbilisi',cityLabel:'თბილისი',description:'ბრენდინგი და მარკეტინგი, რომელიც შენს ბიზნესს უკეთ წარმოაჩენს.',tags:['მარკეტინგი','დიზაინი'],color:'#9455a9',bg:'#f4ebf8',offer:['ბრენდის ვიზუალური იდენტობა','სოციალური მედიის კონტენტი','ვებგვერდის დიზაინი'],area:'მთელი საქართველო · დისტანციურად',words:'მარკეტინგი დიზაინი ბრენდინგი მომსახურება თბილისი',languages:'ქართული, ინგლისური'},
{id:'route',name:'Route Logistics',initials:'RL',type:'services',city:'batumi',cityLabel:'ბათუმი',description:'ტვირთის გადაზიდვა და მიწოდების ორგანიზება შენი ბიზნესისთვის.',tags:['ლოგისტიკა','გადაზიდვა'],color:'#d1842b',bg:'#fff2df',offer:['საქალაქთაშორისო გადაზიდვა','სასაწყობე მომსახურება','მიწოდების ინდივიდუალური გრაფიკი'],area:'თბილისი, ბათუმი, ქუთაისი',words:'ლოგისტიკა გადაზიდვა მომსახურება მიწოდება ბათუმი თბილისი ქუთაისი',languages:'ქართული, ინგლისური'},
{id:'fresh',name:'Fresh Market',initials:'fm',type:'suppliers',city:'tbilisi',cityLabel:'თბილისი',description:'ახალი პროდუქტი რესტორნებისა და კაფეებისთვის, შეთანხმებული მიწოდებით.',tags:['საკვები','რესტორნები'],color:'#367c79',bg:'#eaf6f2',offer:['ხილი და ბოსტნეული','სეზონური პროდუქტის შეკვეთა','მიწოდების პირობების შეთანხმება'],area:'თბილისი',words:'საკვები პროდუქტი რესტორანი კაფე მომწოდებელი თბილისი',languages:'ქართული'},
{id:'pack',name:'Pack & Co',initials:'p&c',type:'suppliers',city:'kutaisi',cityLabel:'ქუთაისი',description:'შეფუთვის გადაწყვეტილებები შენი პროდუქტისა და ბრენდისთვის.',tags:['შეფუთვა','წარმოება'],color:'#b35c7c',bg:'#fbedf2',offer:['ქაღალდის შეფუთვა','ბრენდირებული ყუთები','შეფუთვის დიზაინის მხარდაჭერა'],area:'მთელი საქართველო',words:'შეფუთვა ყუთი წარმოება მომწოდებელი ქუთაისი თბილისი ბათუმი',languages:'ქართული, ინგლისური'},
{id:'bridge',name:'Bridge Distribution',initials:'bd',type:'distributors',city:'tbilisi',cityLabel:'თბილისი',description:'პროდუქტის დისტრიბუცია და ახალი სავაჭრო პარტნიორების მოძიება.',tags:['დისტრიბუცია','გაყიდვები'],color:'#426eb1',bg:'#edf2fc',offer:['საცალო ქსელებთან თანამშრომლობა','გაყიდვების არხების განვითარება','დისტრიბუციის პირობების შეთანხმება'],area:'თბილისი, ქუთაისი',words:'დისტრიბუტორი გაყიდვები პროდუქტი თბილისი ქუთაისი',languages:'ქართული, ინგლისური'},
{id:'stay',name:'Stay Collective',initials:'sc.',type:'partners',city:'batumi',cityLabel:'ბათუმი',description:'სასტუმროებისა და ტურისტული ბიზნესების ერთობლივი პროექტები.',tags:['ტურიზმი','პარტნიორობა'],color:'#866db2',bg:'#f1edf9',offer:['ტურისტული პაკეტების შექმნა','სასტუმროებთან ერთობლივი შეთავაზებები','ადგილობრივ ბიზნესთან თანამშრომლობა'],area:'ბათუმი, თბილისი',words:'ბიზნესპარტნიორი სასტუმრო ტურიზმი ბათუმი თბილისი',languages:'ქართული, ინგლისური'},
{id:'account',name:'Balance Partners',initials:'b.',type:'services',city:'tbilisi',cityLabel:'თბილისი',description:'ბუღალტრული მომსახურება მცირე და მზარდი ბიზნესებისთვის.',tags:['ბუღალტერია','ბიზნესმომსახურება'],color:'#417585',bg:'#eaf3f7',offer:['ბუღალტრული აღრიცხვა','ყოველთვიური ანგარიშგება','ფინანსური პროცესების ორგანიზება'],area:'მთელი საქართველო · დისტანციურად',words:'ბუღალტერია ფინანსები მომსახურება თბილისი',languages:'ქართული'}];
companies.push(...[{"id": "pixel", "name": "Pixel Works", "type": "services", "city": "tbilisi", "cityLabel": "თბილისი", "description": "ვებსაიტები, პროგრამული გადაწყვეტები და ტექნიკური მხარდაჭერა შენი ბიზნესისთვის.", "tags": ["IT და ტექნოლოგიები"], "offer": ["ვებსაიტის შექმნა", "ბიზნესპროცესების ავტომატიზაცია", "ტექნიკური მხარდაჭერა"], "area": "მთელი საქართველო · დისტანციურად", "words": "IT და ტექნოლოგიები ვებსაიტები, პროგრამული გადაწყვეტები და ტექნიკური მხარდაჭერა შენი ბიზნესისთვის. ვებსაიტის შექმნა ბიზნესპროცესების ავტომატიზაცია ტექნიკური მხარდაჭერა", "languages": "ქართული, ინგლისური"}, {"id": "build", "name": "Axis Build", "type": "services", "city": "tbilisi", "cityLabel": "თბილისი", "description": "კომერციული სივრცის მოწყობა და სარემონტო სამუშაოების დაგეგმვა.", "tags": ["მშენებლობა და რემონტი"], "offer": ["კომერციული სივრცის რემონტი", "ინტერიერის მოწყობა", "სამუშაოების ხარჯთაღრიცხვა"], "area": "თბილისი, ბათუმი, ქუთაისი", "words": "მშენებლობა და რემონტი კომერციული სივრცის მოწყობა და სარემონტო სამუშაოების დაგეგმვა. კომერციული სივრცის რემონტი ინტერიერის მოწყობა სამუშაოების ხარჯთაღრიცხვა", "languages": "ქართული, ინგლისური"}, {"id": "legal", "name": "Accord Legal", "type": "services", "city": "tbilisi", "cityLabel": "თბილისი", "description": "ხელშეკრულებების მომზადება და ბიზნესის იურიდიული მხარდაჭერა.", "tags": ["იურიდიული მომსახურება"], "offer": ["ბიზნესხელშეკრულებები", "კორპორაციული დოკუმენტები", "მიმდინარე იურიდიული მხარდაჭერა"], "area": "მთელი საქართველო · დისტანციურად", "words": "იურიდიული მომსახურება ხელშეკრულებების მომზადება და ბიზნესის იურიდიული მხარდაჭერა. ბიზნესხელშეკრულებები კორპორაციული დოკუმენტები მიმდინარე იურიდიული მხარდაჭერა", "languages": "ქართული, ინგლისური"}, {"id": "clean", "name": "Clear Space", "type": "services", "city": "tbilisi", "cityLabel": "თბილისი", "description": "ოფისებისა და კომერციული სივრცეების დასუფთავება შენს სამუშაო გრაფიკზე მორგებით.", "tags": ["დასუფთავება და მოვლა"], "offer": ["ოფისის რეგულარული დასუფთავება", "რემონტის შემდგომი დასუფთავება", "კომერციული სივრცის მოვლა"], "area": "თბილისი", "words": "დასუფთავება და მოვლა ოფისებისა და კომერციული სივრცეების დასუფთავება შენს სამუშაო გრაფიკზე მორგებით. ოფისის რეგულარული დასუფთავება რემონტის შემდგომი დასუფთავება კომერციული სივრცის მოვლა", "languages": "ქართული, ინგლისური"}]);
companies.forEach(c=>Object.assign(c,companyDetails[c.id]));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photos={linen:['hotel-linen.jpg','სასტუმროს ოთახი და თეთრეული'],studio:['creative-team.jpg','გუნდი შემოქმედებით სამუშაო სივრცეში'],route:['logistics-warehouse.jpg','ლოგისტიკური საწყობის თაროები'],fresh:['fresh-produce.jpg','ახალი ხილი და ბოსტნეული'],pack:['cardboard-packaging.jpg','მუყაოს შეფუთვის ყუთები'],bridge:['logistics-warehouse.jpg','სადისტრიბუციო საწყობი'],stay:['hotel-linen.jpg','სასტუმროს ნომერი'],account:['creative-team.jpg','სამუშაო სივრცე']};
Object.assign(photos,{"pixel": ["technology-office.jpg", "ტექნოლოგიური გუნდის სამუშაო სივრცე"], "build": ["construction-interior.jpg", "შენობის ინტერიერის მოწყობის სამუშაოები"], "legal": ["legal-office.jpg", "საქმიანი შეხვედრის სივრცე"], "clean": ["commercial-cleaning.jpg", "კომერციული სივრცის დასუფთავება"]});
function companyLogo(c,extra=''){const photo=photos[c.id];return '<span class="company-logo company-photo-avatar '+extra+'"><img src="/assets/photos/'+photo[0]+'" alt="'+esc(c.name)+' — სამუშაო გარემოს ფოტო" loading="lazy" decoding="async"></span>';}
function profileHref(c){const base="/v2/companies/"+c.slug+"/";return location.pathname==="/v2/categories/"?base+"?from="+encodeURIComponent("/v2/categories/"+location.search):base;}
function card(c){
 const photo=photos[c.id],href=esc(profileHref(c));
 return `<article class="company-listing">
  <a class="listing-media" href="${href}" aria-label="${esc(c.name)} — კომპანიის პროფილი"><img src="/assets/photos/${photo[0]}" alt="${esc(photo[1])}" width="800" height="533" loading="lazy" decoding="async"></a>
  <div class="listing-content">
   <div class="listing-heading">${companyLogo(c)}<div><p class="listing-industry">${esc(filterOptions.industry[c.industry])}</p><h3><a href="${href}">${esc(c.name)}</a></h3></div><span class="listing-city">${icon('map-pin')}${esc(c.cityLabel)}</span></div>
   <p class="listing-description">${esc(c.description)}</p>
   <dl class="listing-facts"><div><dt>${icon('globe')}<span class="sr-only">მომსახურების არეალი</span></dt><dd>${esc(c.area)}</dd></div><div><dt>${icon('handshake')}<span class="sr-only">თანამშრომლობა</span></dt><dd>${c.collaboration.map(x=>filterOptions.collaboration[x]).join(' · ')}</dd></div></dl>
   <div class="listing-footer"><a class="listing-offers" href="${href}#offers">${c.offer.length} შეთავაზება ${icon('chevron-right')}</a><a class="button listing-action" href="${href}" aria-label="${esc(c.name)} — გაცნობა">გაიცანი კომპანია ${icon('arrow-up-right')}</a></div>
  </div>
 </article>`;
}
const grid=document.querySelector('#category-grid');if(grid)grid.innerHTML=categories.map((c,index)=>`<a class="category-card" href="/v2/categories/?type=${c.id}"><span class="category-icon" aria-hidden="true"><img class="category-3d-sheet" src="/assets/category-business-3d.png" alt="" style="--category-x:${-100*(index%2)}%;--category-y:${-100*Math.floor(index/2)}%" decoding="async">${icon(categoryIcons[c.id])}</span><div><h3>${c.title}</h3><p>${c.sub}</p></div>${icon('arrow-up-right','category-arrow')}</a>`).join('');
const featured=document.querySelector('#featured-companies');if(featured)featured.innerHTML=companies.slice(0,3).map(card).join('');
document.querySelector('.nav-home')?.classList.add('active');
document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close)close.closest('dialog').close();});
const cityNames={tbilisi:'თბილისი',batumi:'ბათუმი',kutaisi:'ქუთაისი'};
const filterValues={type:{suppliers:'პროდუქტის მიწოდება',services:'მომსახურება',distributors:'დისტრიბუცია',partners:'ერთობლივი პროექტები'},city:cityNames,language:{ka:'ქართული',en:'ინგლისური'},...filterOptions,sort:{relevance:'შესაბამისობის მიხედვით',name:'სახელის მიხედვით'}};
const defaultFilters={q:'',type:'',city:'',language:'',industry:'',collaboration:'',format:'',sort:'relevance'};
const multiFilterKeys=['industry','city','type'];
const selectedValues=value=>value?value.split(','):[];
function validateFilters(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid filters');
 const normalized={...defaultFilters};
 for(const [key,value] of Object.entries(input)){
  if(!Object.hasOwn(defaultFilters,key))throw Error('Unknown filter');
  if(typeof value!=='string')throw Error('Filter values must be strings');
  if(key==='q'){if(value.length>200)throw Error('Query is too long');normalized[key]=value;continue;}
  const values=multiFilterKeys.includes(key)?selectedValues(value):value?[value]:[];
  if(values.some(v=>!Object.hasOwn(filterValues[key],v)))throw Error('Invalid '+key);
  normalized[key]=multiFilterKeys.includes(key)?Object.keys(filterValues[key]).filter(v=>values.includes(v)).join(','):value;
 }
 return normalized;
}
function nextFilterSelection(key,value,checked){
 if(!multiFilterKeys.includes(key)||!value)return value;
 const values=new Set(selectedValues(filters[key]));
 if(checked)values.add(value);else values.delete(value);
 return [...values].join(',');
}
function removeFilterSelection(key,value){return multiFilterKeys.includes(key)?selectedValues(filters[key]).filter(v=>v!==value).join(','):'';}
function companyServiceTypes(c){return c.id==='bridge'?['suppliers','distributors']:c.id==='stay'?['services','partners']:[c.type];}
function readFilters(search=location.search){const p=new URLSearchParams(search);const data={};for(const k of Object.keys(defaultFilters)){const value=p.get(k);if(!value)continue;try{validateFilters({[k]:value});data[k]=value;}catch{}}return validateFilters(data);}
function filterQuery(f){const p=new URLSearchParams();for(const [k,v] of Object.entries(f))if(v&&!(k==='sort'&&v==='relevance'))p.set(k,v);return p.toString();}
function safeCatalogFrom(raw){try{if(!raw)return '/v2/categories/';const u=new URL(raw,location.origin);if(u.origin!==location.origin||!['/v2/categories','/v2/categories/'].includes(u.pathname))return '/v2/categories/';const q=filterQuery(readFilters(u.search));return '/v2/categories/'+(q?'?'+q:'');}catch{return '/v2/categories/';}}
let filters=readFilters();
const stopWords=['ვეძებ','მინდა','მჭირდება','და','ან','საჭიროა','ბიზნესისთვის','სანდო'];
function searchTerms(q){return q.toLocaleLowerCase().split(/[\s,.;!?]+/).filter(x=>x&&!stopWords.includes(x)).map(x=>x.replace(/(ისთვის|ებში|ების|ებს|ის|ს)$/u,''));}
function getResults(f){const terms=searchTerms(f.q);const matches=companies.filter(c=>{if(f.type&&!selectedValues(f.type).some(v=>companyServiceTypes(c).includes(v)))return false;if(f.city&&!selectedValues(f.city).some(v=>c.area.includes(cityNames[v]))&&!c.area.includes('მთელი საქართველო'))return false;if(f.language==='en'&&!c.languages.includes('ინგლისური'))return false;if(f.industry&&!selectedValues(f.industry).includes(c.industry))return false;if(f.collaboration&&!c.collaboration.includes(f.collaboration))return false;if(f.format&&!c.format.includes(f.format))return false;const words=(c.name+' '+c.description+' '+c.words+' '+c.offer.join(' ')+' '+filterOptions.industry[c.industry]).toLocaleLowerCase().split(/\s+/);return !terms.length||terms.every(t=>words.some(w=>w.includes(t)));});if(f.sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));else if(terms.length){const score=c=>terms.reduce((sum,t)=>sum+(c.name.toLowerCase().includes(t)?3:0)+(c.tags.some(tag=>tag.includes(t))?2:0),0);matches.sort((a,b)=>score(b)-score(a));}return matches;}
function setFilters(next,{push=true}={}){filters=validateFilters({...filters,...next});const url=new URL(location.href);url.search=filterQuery(filters);if(push)history.pushState({},'',url);else history.replaceState({},'',url);renderResults();return getResults(filters);}
function facetCount(key,value){return getResults({...filters,[key]:value}).length;}
const filterIndustryIcons={textiles:'shirt',marketing:'megaphone',logistics:'truck',food:'utensils',packaging:'package',tourism:'map-pin',finance:'calculator',technology:'monitor',construction:'hard-hat',legal:'scale',cleaning:'sparkles'};
function renderResults(){const grid=document.querySelector('#results-grid');if(!grid)return;
 for(const key of ['industry','type','city','collaboration','format','language']){
  const any={industry:'ყველა მიმართულება',type:'ყველა შეთავაზება',city:'ყველა ქალაქი',collaboration:'ნებისმიერი',format:'ნებისმიერი',language:'ყველა ენა'}[key];
  document.querySelector('#'+key+'-options').innerHTML=[['',any],...Object.entries(filterValues[key])].map(([value,label])=>{
   const count=facetCount(key,value);
   const selected=value?selectedValues(filters[key]).includes(value):!filters[key];
   const symbol=key==='industry'?(filterIndustryIcons[value]||'building-2'):key==='type'?(categoryIcons[value]||'users'):null;
   return `<label class="radio-option ${selected?'is-selected':''}"><input type="${multiFilterKeys.includes(key)?'checkbox':'radio'}" name="${key}" value="${value}" ${selected?'checked':''}><span class="filter-option-label">${symbol?icon(symbol,'filter-option-icon'):''}<span>${esc(label)}</span></span><small aria-label="${count} კომპანია">${count}</small></label>`;
  }).join('');
 }
 document.querySelector('#sort-filter').value=filters.sort;document.querySelector('#catalog-query').value=filters.q;document.querySelector('#clear-catalog-query').hidden=!filters.q;
 const industry=filterOptions.industry[filters.industry];document.querySelector('#catalog-title').textContent=industry||'კომპანიები';document.title=(industry||'კატეგორიები და კომპანიები')+' — MeetAny';const results=getResults(filters);document.querySelector('#result-count').innerHTML=`<strong>${results.length} კომპანია</strong> <span>· ${results.reduce((sum,c)=>sum+c.offer.length,0)} შეთავაზება</span>`;
 document.querySelector('#filter-results-button').textContent='შედეგების ნახვა ('+results.length+')';
 const chips=Object.entries(filters).filter(([k,v])=>v&&k!=='sort').flatMap(([k,v])=>(multiFilterKeys.includes(k)?selectedValues(v):[v]).map(value=>[k,value,k==='q'?value:filterValues[k][value]]));
 document.querySelector('#active-filters').innerHTML=chips.map(([key,value,label])=>`<button class="filter-chip" data-remove-filter="${key}" data-filter-value="${esc(value)}" aria-label="ფილტრის წაშლა: ${esc(label)}">${esc(label)} ${icon('x')}</button>`).join('')+(chips.length?'<button class="reset-button" data-reset>ყველას გასუფთავება</button>':'');
 for(const key of ['type','collaboration','format','language']){const count=document.querySelector('#'+key+'-selected-count');if(count)count.textContent=filters[key]?' · '+selectedValues(filters[key]).length:'';}

 document.querySelector('#filter-toggle').innerHTML=icon('sliders-horizontal')+' ფილტრები'+(chips.length?' ('+chips.length+')':'');
 grid.innerHTML=results.length?results.map(card).join(''):`<div class="empty-state">${icon('search')}<h2>ამ პირობებით კომპანია ვერ მოიძებნა</h2><p>მოხსენი ერთ-ერთი არჩეული ფილტრი, შეცვალე საძიებო სიტყვა ან შექმენი შენი მოთხოვნა.</p><div class="form-actions"><button class="button button-outline" data-reset>ყველა ფილტრის გასუფთავება</button><button class="button" data-action="request">მოამზადე მოთხოვნა</button></div></div>`;
}
if(document.querySelector('#results-grid')){
 document.querySelector('.nav-home').classList.remove('active');document.querySelector('.nav-categories').classList.add('active');
 const panel=document.querySelector('#filters'),toggle=document.querySelector('#filter-toggle');
 function setFilterPanel(open){panel.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));}
 panel.addEventListener('change',e=>{const key=e.target.name,value=e.target.value;if(Object.hasOwn(defaultFilters,key)){setFilters({[key]:nextFilterSelection(key,value,e.target.checked)});const options=document.querySelectorAll('#'+key+'-options input');[...options].find(input=>input.value===value)?.focus({preventScroll:true});}});
 document.querySelector('#filter-results-button').addEventListener('click',()=>{setFilterPanel(false);toggle.focus({preventScroll:true});document.querySelector('.results-toolbar').scrollIntoView({block:'start'});});
 document.querySelector('#sort-filter').addEventListener('change',e=>setFilters({sort:e.target.value}));
 const queryInput=document.querySelector('#catalog-query'),clearQuery=document.querySelector('#clear-catalog-query');
 queryInput.addEventListener('input',()=>{clearQuery.hidden=!queryInput.value;});
 queryInput.addEventListener('search',()=>{if(!queryInput.value)setFilters({q:''});});
 clearQuery.addEventListener('click',()=>{setFilters({q:''});queryInput.focus();});
 document.querySelector('#catalog-search').addEventListener('submit',e=>{e.preventDefault();setFilters({q:document.querySelector('#catalog-query').value.trim()});});
 toggle.addEventListener('click',()=>{const open=!panel.classList.contains('is-open');setFilterPanel(open);if(open)panel.scrollIntoView({block:'start',behavior:'smooth'});});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('is-open')){setFilterPanel(false);toggle.focus();}});
 window.addEventListener('popstate',()=>{filters=readFilters();renderResults();});renderResults();
}
let requestDraft={};let lastDraft=null;
function readValidDraft(form){
 const data={};
 for(const field of form.querySelectorAll('[name]')){
  if(field.disabled)continue;
  const value=field.value.trim();
  field.setCustomValidity(field.required&&value.length<Math.max(1,field.minLength||0)?'შეავსე ველი სრულად; მხოლოდ გამოტოვებები საკმარისი არ არის.':'');
  data[field.name]=value;
 }
 return form.reportValidity()?data:null;
}
document.addEventListener('input',e=>{if(e.target.matches('#intro-form [name],#company-form [name]'))e.target.setCustomValidity('');});
const requestChoices={
 budgetMode:{discuss:'ჯერ დასაზუსტებელია',limit:'ბიუჯეტის მითითება'},
 currency:{GEL:'₾ — ლარი',USD:'$ — დოლარი',EUR:'€ — ევრო'},
 timing:{flexible:'ვადა მოქნილია',soon:'რაც შეიძლება მალე',month:'ერთი თვის განმავლობაში',date:'კონკრეტულ თარიღამდე'},
 collaboration:{discuss:'ჯერ დასაზუსტებელია',once:'ერთჯერადი შეკვეთა',project:'პროექტული თანამშრომლობა',ongoing:'რეგულარული თანამშრომლობა'}
};
function requestOptions(options,value){return Object.entries(options).map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');}
function localRequestDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function requestFacts(d){return [
 ['ადგილი',d.city],['მოცულობა',d.quantity||'დასაზუსტებელია'],
 ['თანამშრომლობა',requestChoices.collaboration[d.collaboration]||requestChoices.collaboration.discuss],
 ['ბიუჯეტი',d.budgetMode==='limit'?Number(d.budget).toLocaleString('ka-GE')+' '+d.currency:'დასაზუსტებელია'],
 ['სასურველი ვადა',d.timing==='date'?d.deadline.split('-').reverse().join('.'):requestChoices.timing[d.timing]||requestChoices.timing.flexible],
 ['გამომგზავნი',d.name],['ელფოსტა',d.email]
];}
function requestDownloadText(d){return 'MeetAny — გაცნობის მოთხოვნის მონახაზი\n\nმიმღები: '+d.company+(d.offer?'\nშეთავაზება: '+d.offer:'')+'\n\n'+d.need+'\n\n'+requestFacts(d).map(([label,value])=>label+': '+value).join('\n')+'\n\nსაცდელი ვერსია. მოთხოვნა არ გაგზავნილა.';}
function requestDetailsError(d,today=localRequestDate()){
 if(!Object.hasOwn(requestChoices.budgetMode,d.budgetMode))return ['budgetMode','აირჩიე ბიუჯეტის ვარიანტი.'];
 if(d.budgetMode==='limit'&&(!Number.isFinite(Number(d.budget))||Number(d.budget)<=0||Number(d.budget)>1000000000))return ['budget','მიუთითე დადებითი თანხა, მაქსიმუმ 1 000 000 000.'];
 if(d.budgetMode==='limit'&&!Object.hasOwn(requestChoices.currency,d.currency))return ['currency','აირჩიე ვალუტა.'];
 if(!Object.hasOwn(requestChoices.timing,d.timing))return ['timing','აირჩიე სასურველი ვადა.'];
 if(d.timing==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.deadline||'')||!Number.isFinite(Date.parse(d.deadline))||new Date(d.deadline+'T12:00:00Z').toISOString().slice(0,10)!==d.deadline||d.deadline<today))return ['deadline','აირჩიე დღევანდელი ან მომავალი თარიღი.'];
 if(!Object.hasOwn(requestChoices.collaboration,d.collaboration))return ['collaboration','აირჩიე თანამშრომლობის ტიპი.'];
 return null;
}
function openRequest(companyId,offerIndex){
 const company=companies.find(c=>c.id===companyId);
 const offer=Number.isInteger(offerIndex)&&company?.offer[offerIndex]?company.offer[offerIndex]:'';
 const key=(companyId||'general')+':'+(offer?offerIndex:'general');
 const d={budgetMode:'discuss',currency:'GEL',timing:'flexible',collaboration:'discuss',...requestDraft[key]};
 const dialog=document.querySelector('#form-dialog');
 document.querySelector('#form-content').innerHTML=`
 <span class="section-kicker">თანამშრომლობის მოთხოვნა</span>
 <h2 id="form-title">${company?esc(company.name):'რას ეძებს შენი ბიზნესი?'}</h2>
 <p class="request-intro">მოკლედ აღწერე საჭიროება და დატოვე საკონტაქტო ინფორმაცია.</p>
 ${offer?`<p class="selected-offer">შეთავაზება: ${esc(offer)}</p>`:''}
 <form id="intro-form" novalidate>
  <div class="request-essential">
   <div class="field"><label for="request-text">რა გჭირდება? *</label><textarea id="request-text" name="need" required minlength="10" maxlength="2000" rows="3" placeholder="მაგ.: სასტუმროსთვის 100 კომპლექტი თეთრეული">${esc(d.need??(offer?'დაინტერესებული ვარ: '+offer+'\n\n':filters.q||''))}</textarea></div>
   <div class="field"><label for="request-city">სად გჭირდება? *</label><input id="request-city" name="city" required maxlength="100" value="${esc(d.city??selectedValues(filters.city).map(v=>cityNames[v]).join(', '))}" placeholder="ქალაქი ან დისტანციურად" autocomplete="address-level2"></div>
   <div class="request-field-grid">
    <div class="field"><label for="request-name">სახელი / კომპანია *</label><input id="request-name" name="name" required maxlength="120" value="${esc(d.name||'')}" autocomplete="organization" placeholder="შენი სახელი ან კომპანია"></div>
    <div class="field"><label for="request-email">ელფოსტა *</label><input id="request-email" type="email" name="email" required maxlength="200" value="${esc(d.email||'')}" autocomplete="email" placeholder="name@company.ge"></div>
   </div>
  </div>
  <details class="request-extras" id="request-extras" ${d.quantity||d.budgetMode==='limit'||d.timing!=='flexible'||d.collaboration!=='discuss'?'open':''}>
   <summary><span>დაამატე პირობები <small>არასავალდებულო</small></span>${icon('plus')}</summary>
   <div class="request-extras-content">
    <div class="request-field-grid">
     <div class="field"><label for="request-quantity">მოცულობა</label><input id="request-quantity" name="quantity" maxlength="120" value="${esc(d.quantity||'')}" placeholder="მაგ.: 100 კომპლექტი"></div>
     <div class="field"><label for="request-collaboration">თანამშრომლობა</label><select id="request-collaboration" name="collaboration">${requestOptions(requestChoices.collaboration,d.collaboration)}</select></div>
    </div>
    <div class="request-field-grid">
     <div class="field"><label for="request-budget-mode">ბიუჯეტი</label><select id="request-budget-mode" name="budgetMode">${requestOptions(requestChoices.budgetMode,d.budgetMode)}</select></div>
     <div class="field"><label for="request-timing">სასურველი ვადა</label><select id="request-timing" name="timing">${requestOptions(requestChoices.timing,d.timing)}</select></div>
    </div>
    <div class="request-field-grid" id="budget-fields" hidden>
     <div class="field"><label for="request-budget">ბიუჯეტის ზედა ზღვარი *</label><input id="request-budget" name="budget" type="number" min="0.01" max="1000000000" step="0.01" inputmode="decimal" value="${esc(d.budget||'')}" disabled placeholder="მაგ.: 5000"></div>
     <div class="field"><label for="request-currency">ვალუტა</label><select id="request-currency" name="currency" disabled>${requestOptions(requestChoices.currency,d.currency)}</select></div>
    </div>
    <div class="field" id="deadline-field" hidden><label for="request-deadline">სასურველი თარიღი *</label><input id="request-deadline" name="deadline" type="date" min="${localRequestDate()}" value="${esc(d.deadline||'')}" disabled></div>
   </div>
  </details>
  <div class="form-action-bar"><button type="button" class="form-cancel" data-close>გაუქმება</button><button class="button form-submit" type="submit">გაგრძელება ${icon('arrow-right')}</button></div>
  <p class="request-demo-note">მოთხოვნის მონახაზი — კომპანიას ჯერ არ ეგზავნება.</p>
 </form>`;
 const form=document.querySelector('#intro-form');
 const sync=()=>{
  const budget=form.elements.budgetMode.value==='limit',date=form.elements.timing.value==='date';
  document.querySelector('#budget-fields').hidden=!budget;
  form.elements.budget.disabled=!budget;form.elements.budget.required=budget;form.elements.currency.disabled=!budget;
  document.querySelector('#deadline-field').hidden=!date;
  form.elements.deadline.disabled=!date;form.elements.deadline.required=date;form.elements.deadline.min=localRequestDate();
 };
 const remember=()=>{requestDraft[key]=Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name,el.value]));};
 form.addEventListener('input',remember);form.addEventListener('change',()=>{sync();remember();});sync();
 form.addEventListener('submit',e=>{
  e.preventDefault();sync();const extras=document.querySelector('#request-extras');if([...extras.querySelectorAll('[name]')].some(field=>!field.disabled&&!field.checkValidity()))extras.open=true;const data=readValidDraft(form);if(!data)return;
  const error=requestDetailsError(data);if(error){extras.open=true;form.elements[error[0]].setCustomValidity(error[1]);form.reportValidity();return;}
  remember();lastDraft={...data,company:company?.name||'პარტნიორი შესარჩევია',offer};
  document.querySelector('#form-content').innerHTML=`<span class="section-kicker">მოთხოვნის მონახაზი</span><h2 id="form-title" tabindex="-1">გადაამოწმე დეტალები</h2>
   <div class="draft-summary"><span class="section-kicker">მიმღები</span><h3>${esc(lastDraft.company)}</h3>${offer?`<p class="selected-offer">${esc(offer)}</p>`:''}<p style="white-space:pre-wrap">${esc(data.need)}</p><dl>${requestFacts(lastDraft).map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></div>
   <p class="form-note">მოთხოვნა კომპანიას არ გაგზავნია. ჩამოტვირთე მონახაზი ან დაბრუნდი დეტალების შესასწორებლად.</p>
   <div class="form-actions"><button class="button" data-action="download">ჩამოტვირთე მონახაზი ${icon('download')}</button><button class="button button-outline" id="edit-request">რედაქტირება</button></div>`;
  document.querySelector('#edit-request').addEventListener('click',()=>openRequest(companyId,offerIndex));
  dialog.scrollTop=0;document.querySelector('#form-title').focus({preventScroll:true});
 });
 if(!dialog.open)dialog.showModal();else form.elements.need.focus({preventScroll:true});dialog.scrollTop=0;
}
function openCompanyForm(){document.querySelector('#form-content').innerHTML=`<span class="section-kicker">შენი კომპანია MeetAny-ზე</span><h2 id="form-title">კომპანიის დამატება</h2><p class="request-intro">შეავსე სამი ველი და გადაამოწმე პროფილი.</p><form id="company-form"><div class="company-essential"><div class="field"><label for="company-name">კომპანიის დასახელება *</label><input id="company-name" name="name" required maxlength="80" autocomplete="organization" placeholder="მაგ.: შენი კომპანიის სახელი"></div><div class="field"><label for="company-offer">რას სთავაზობ ბიზნესებს? *</label><textarea id="company-offer" name="offer" required minlength="10" maxlength="1500" rows="3" placeholder="მოკლედ აღწერე პროდუქტი ან მომსახურება"></textarea></div><div class="field"><label for="company-area">მომსახურების ტერიტორია *</label><input id="company-area" name="area" required maxlength="100" placeholder="მაგალითად: მთელი საქართველო"></div></div><div class="form-action-bar"><button type="button" class="form-cancel" data-close>გაუქმება</button><button class="button form-submit" type="submit">გაგრძელება ${icon('arrow-right')}</button></div><p class="request-demo-note">პროფილის მონახაზი — საჯაროდ არ გამოქვეყნდება.</p></form>`;document.querySelector('#company-form').addEventListener('submit',e=>{e.preventDefault();const data=readValidDraft(e.target);if(!data)return;lastDraft={profile:true,...data};document.querySelector('#form-content').innerHTML=`<span class="section-kicker">პროფილის მონახაზი</span><h2 id="form-title">${esc(data.name)}</h2><p style="white-space:pre-wrap">${esc(data.offer)}</p><div class="detail-meta"><div><small>მომსახურების ტერიტორია</small>${esc(data.area)}</div></div><p class="form-note">პროფილი არ გამოქვეყნებულა. ეს ტექსტის წინასწარი ვერსიაა.</p><button class="button form-submit" data-action="download">ჩამოტვირთე მონახაზი ${icon('download')}</button>`;});document.querySelector('#form-dialog').showModal();}
document.addEventListener('click',e=>{if(e.target.closest('[data-reset]'))setFilters({...defaultFilters});const remove=e.target.closest('[data-remove-filter]');if(remove){setFilters({[remove.dataset.removeFilter]:removeFilterSelection(remove.dataset.removeFilter,remove.dataset.filterValue)});document.querySelector('#active-filters button')?.focus({preventScroll:true});}const intro=e.target.closest('[data-intro]');if(intro)openRequest(intro.dataset.intro,intro.dataset.offerIndex===undefined?undefined:Number(intro.dataset.offerIndex));const action=e.target.closest('[data-action]')?.dataset.action;if(action==='request')openRequest();if(action==='add-company')openCompanyForm();if(action==='download'&&lastDraft){const d=lastDraft;const text=d.profile?`MeetAny — კომპანიის მონახაზი\n\n${d.name}\n${d.offer}\n\nტერიტორია: ${d.area}\n\nსაცდელი ვერსია. პროფილი არ გამოქვეყნებულა.`:requestDownloadText(d);const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=d.profile?'MeetAny-profile.txt':'MeetAny-request.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
if(document.modelContext?.registerTool&&document.querySelector('#results-grid')){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'set_catalog_filters',title:'კომპანიების ძიება',description:'Set visible MeetAny demo catalog filters and return matching fictional companies. Does not contact companies.',inputSchema:{type:'object',properties:{q:{type:'string',maxLength:200},type:{type:'string',description:'Comma-separated offer types: suppliers, services, distributors, partners; empty selects all.'},city:{type:'string',description:'Comma-separated cities: tbilisi, batumi, kutaisi; empty selects all.'},language:{type:'string',enum:['','ka','en']},industry:{type:'string',description:'Comma-separated industries: '+Object.keys(filterOptions.industry).join(', ')+'. Empty selects all.'},collaboration:{type:'string',enum:['',...Object.keys(filterOptions.collaboration)]},format:{type:'string',enum:['',...Object.keys(filterOptions.format)]},sort:{type:'string',enum:['relevance','name']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const f=validateFilters(input);const results=setFilters(f);return{count:results.length,companies:results.map(c=>({id:c.id,name:c.name,description:c.description})),demo:true}}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}

const menuButton=document.querySelector('.mobile-menu');if(menuButton){menuButton.addEventListener('click',()=>{const nav=document.querySelector('#main-nav');const open=nav.classList.toggle('is-open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'მენიუს დახურვა':'მენიუს გახსნა');menuButton.innerHTML=icon(open?'x':'menu');});document.querySelectorAll('#main-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#main-nav').classList.remove('is-open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','მენიუს გახსნა');menuButton.innerHTML=icon('menu');}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('#main-nav').classList.contains('is-open')){menuButton.click();menuButton.focus();}});}

// A failed logo stays a readable company identity, never a broken image.
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.classList.contains('logo-sheet'))e.target.closest('.company-logo').classList.add('logo-unavailable');},true);
document.querySelectorAll('.logo-sheet').forEach(img=>{if(img.complete&&!img.naturalWidth)img.closest('.company-logo').classList.add('logo-unavailable');});
const profile=document.querySelector('[data-profile-id]');
if(profile){
 document.querySelector('.nav-home')?.classList.remove('active');
 document.querySelector('.nav-categories')?.classList.add('active');
 const back=safeCatalogFrom(new URLSearchParams(location.search).get('from'));
 document.querySelector('[data-back-to-results]').href=back;
 filters=readFilters(new URL(back,location.origin).search);
}

document.querySelector('#main-nav a.active')?.setAttribute('aria-current','page');

// Preserve semantic navigation when its decorative 3D asset cannot load.
function categoryImageFallback(img){if(img instanceof HTMLImageElement&&img.classList.contains('category-3d-sheet'))img.closest('.category-icon')?.classList.add('icon-unavailable');}
document.addEventListener('error',e=>categoryImageFallback(e.target),true);
document.querySelectorAll('.category-3d-sheet').forEach(img=>{if(img.complete&&!img.naturalWidth)categoryImageFallback(img);});


const galleryDialog=document.querySelector('#gallery-dialog');
if(galleryDialog){
 const thumbnails=[...document.querySelectorAll('[data-gallery-index]')];
 const fullImage=document.querySelector('#gallery-full-image'),caption=document.querySelector('#gallery-full-caption');
 const previous=document.querySelector('#gallery-prev'),next=document.querySelector('#gallery-next');
 let current=0,opener=null;
 function showGalleryPhoto(index){
  current=Math.max(0,Math.min(thumbnails.length-1,index));
  const selected=thumbnails[current];
  fullImage.hidden=false;fullImage.alt=selected.dataset.galleryCaption;fullImage.src=selected.dataset.gallerySrc;
  caption.textContent=selected.dataset.galleryCaption;
  document.querySelector('#gallery-counter').textContent=(current+1)+' / '+thumbnails.length;
  previous.disabled=current===0;next.disabled=current===thumbnails.length-1;
 }
 thumbnails.forEach((button,index)=>button.addEventListener('click',()=>{opener=button;showGalleryPhoto(index);galleryDialog.showModal();galleryDialog.querySelector('.gallery-close').focus();}));
 previous.addEventListener('click',()=>showGalleryPhoto(current-1));
 next.addEventListener('click',()=>showGalleryPhoto(current+1));
 galleryDialog.querySelector('.gallery-close').addEventListener('click',()=>galleryDialog.close());
 galleryDialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showGalleryPhoto(current+(event.key==='ArrowRight'?1:-1));}});
 galleryDialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
 fullImage.addEventListener('error',()=>{fullImage.hidden=true;caption.textContent='ფოტო ვერ ჩაიტვირთა. სცადე სხვა ფოტო.';});
}

const discoveryQuery=document.querySelector('.discovery-query');
if(discoveryQuery){const input=discoveryQuery.querySelector('input');input.addEventListener('focus',()=>discoveryQuery.classList.remove('suggestions-dismissed'));input.addEventListener('input',()=>discoveryQuery.classList.remove('suggestions-dismissed'));discoveryQuery.addEventListener('keydown',event=>{if(event.key==='Escape'){discoveryQuery.classList.add('suggestions-dismissed');input.focus();discoveryQuery.classList.add('suggestions-dismissed');}});}
