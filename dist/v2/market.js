/* MeetAny beta marketplace UI: requests board, sealed offers, accounts, admin, sharing.
   Depends on v2/app.js globals (icon, esc) and v2/market-store.js (MarketStore). */
(function(){
 const S=window.MarketStore;if(!S)return;
 const {categories,cities,stateLabels}=S;
 const svg=(paths,extra='')=>`<svg class="micon ${extra}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
 const ic={
  clock:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  phone:svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  mail:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  lock:svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  share:svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  link:svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  shield:svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  user:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  inbox:svg('<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>'),
  eye:svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>'),
  trash:svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  ban:svg('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  image:svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  whatsapp:'<svg class="micon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3"/></svg>',
  facebook:'<svg class="micon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4a22 22 0 0 0-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8z"/></svg>'
 };
 const $=(sel,root=document)=>root.querySelector(sel);
 const page=document.body.dataset.marketPage||'';

 /* ---------- formatting ---------- */
 const money=v=>v==null?'ფასი შეთანხმებით':Number(v).toLocaleString('ka-GE',{maximumFractionDigits:2})+' ₾';
 function ago(iso){const d=Math.floor((Date.now()-Date.parse(iso))/86400000);return d<=0?'დღეს':d===1?'გუშინ':d+' დღის წინ';}
 function requestHref(r){return r.slug?'/v2/requests/'+r.slug+'/':'/v2/requests/view/?id='+encodeURIComponent(r.id);}
 function stateBadge(r){const s=S.requestState(r);const text=s==='open'?(S.daysLeft(r)<=1?'ბოლო დღე':S.daysLeft(r)+' დღე დარჩა'):stateLabels[s];return `<span class="req-state req-state-${s}">${s==='open'?ic.clock:''}${esc(text)}</span>`;}
 function roleLabel(u){return u.role==='company'?'კომპანია':u.role==='admin'?'ადმინი':'კლიენტი';}
 function verifiedBadge(u){return u&&u.verified?`<span class="verified-badge" title="MeetAny-ს მიერ გადამოწმებული კომპანია">${ic.shield}დადასტურებული</span>`:'';}
 const optionList=(obj,selected,blank)=>(blank?`<option value="">${esc(blank)}</option>`:'')+Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===selected?'selected':''}>${esc(v)}</option>`).join('');

 /* ---------- toast + dialog ---------- */
 let toastTimer;
 function toast(message){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.append(t);}t.textContent=message;t.classList.add('market-toast','is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('is-visible'),3200);}
 function dialogShell(){
  let dialog=$('#form-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='form-dialog';dialog.setAttribute('aria-labelledby','form-title');dialog.innerHTML=`<button class="close-button" data-close aria-label="დახურვა">${icon('x')}</button><div id="form-content"></div>`;document.body.append(dialog);
   dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))dialog.close();});}
  return dialog;
 }
 function openDialog(html,className=''){const dialog=dialogShell();$('#form-content').innerHTML=html;dialog.dataset.market=className;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;return dialog;}
 function closeDialog(){const d=$('#form-dialog');if(d?.open)d.close();}
 function showError(form,err){let box=$('.market-error',form);if(!box){box=document.createElement('p');box.className='market-error';box.setAttribute('role','alert');form.prepend(box);}box.textContent=err.userMessage||'რაღაც ვერ შესრულდა. სცადე თავიდან.';box.scrollIntoView({block:'nearest'});if(!err.userMessage)console.error(err);}
 const formData=form=>Object.fromEntries(new FormData(form).entries());

 /* ---------- auth ---------- */
 function authFormHtml(mode,role){
  const isRegister=mode==='register';
  return `<div class="auth-panel">
   <div class="auth-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!isRegister}" data-auth-mode="login">შესვლა</button><button type="button" role="tab" aria-selected="${isRegister}" data-auth-mode="register">რეგისტრაცია</button></div>
   ${isRegister?`<form id="register-form" class="market-form" novalidate>
    <fieldset class="role-choice"><legend>ვინ ხარ?</legend>
     <label><input type="radio" name="role" value="client" ${role!=='company'?'checked':''}><span><b>ვეძებ მომწოდებელს</b><small>დადე განცხადება და მიიღე შეთავაზებები</small></span></label>
     <label><input type="radio" name="role" value="company" ${role==='company'?'checked':''}><span><b>ვარ კომპანია</b><small>ნახე განცხადებები და გაუგზავნე შეთავაზება</small></span></label>
    </fieldset>
    <div class="request-field-grid"><div class="field"><label for="reg-name">სახელი და გვარი *</label><input id="reg-name" name="name" required maxlength="80" autocomplete="name"></div>
    <div class="field"><label for="reg-company" data-company-label>${role==='company'?'კომპანიის დასახელება *':'კომპანია / ობიექტი'}</label><input id="reg-company" name="company" maxlength="100" autocomplete="organization"></div></div>
    <div class="request-field-grid"><div class="field"><label for="reg-phone">მობილური ტელეფონი *</label><input id="reg-phone" name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="+995 5XX XXX XXX" value="+995 "><small class="field-hint">საჭიროა კონტაქტისთვის, როცა შეთავაზებას აირჩევენ.</small></div>
    <div class="field"><label for="reg-email">ელფოსტა *</label><input id="reg-email" name="email" type="email" required maxlength="120" autocomplete="email" placeholder="name@company.ge"></div></div>
    <div class="request-field-grid"><div class="field"><label for="reg-city">ქალაქი *</label><select id="reg-city" name="city" required>${optionList(cities,'tbilisi')}</select></div>
    <div class="field" data-industry-field ${role==='company'?'':'hidden'}><label for="reg-industry">საქმიანობის მიმართულება *</label><select id="reg-industry" name="industry">${optionList(categories,'','აირჩიე')}</select></div></div>
    <div class="field"><label for="reg-password">პაროლი *</label><input id="reg-password" name="password" type="password" required minlength="6" autocomplete="new-password"><small class="field-hint">მინიმუმ 6 სიმბოლო.</small></div>
    <label class="terms-check"><input type="checkbox" name="acceptTerms" value="1" required> ვეთანხმები <a href="/v2/terms/" target="_blank" rel="noopener">წესებსა და პერსონალური მონაცემების დამუშავებას</a></label>
    <div class="form-action-bar"><button class="button form-submit" type="submit">ანგარიშის შექმნა ${icon('arrow-right')}</button></div>
   </form>`:`<form id="login-form" class="market-form" novalidate>
    <div class="field"><label for="login-email">ელფოსტა</label><input id="login-email" name="email" type="email" required autocomplete="email"></div>
    <div class="field"><label for="login-password">პაროლი</label><input id="login-password" name="password" type="password" autocomplete="current-password"></div>
    <div class="form-action-bar"><button class="button form-submit" type="submit">შესვლა ${icon('arrow-right')}</button></div>
   </form>
   <div class="demo-accounts"><h3>სწრაფი შესვლა — სადემონსტრაციო ანგარიშები</h3>${demoAccountsHtml()}</div>`}
   <p class="beta-note">ბეტა-ვერსია: მონაცემები ინახება მხოლოდ ამ ბრაუზერში.</p>
  </div>`;
 }
 function demoAccountsHtml(){
  const current=S.currentUser();
  const groups=[['client','კლიენტები'],['company','კომპანიები'],['admin','ადმინისტრაცია']];
  return groups.map(([role,title])=>{const list=S.demoAccounts().filter(u=>u.role===role);return list.length?`<div class="demo-group"><span>${title}</span>${list.map(u=>`<button type="button" class="demo-account ${current?.id===u.id?'is-current':''}" data-demo-login="${u.id}"><b>${esc(u.company)}</b><small>${esc(u.name)}${u.role==='company'?' · '+esc(categories[u.industry]||''):''}</small></button>`).join('')}</div>`:'';}).join('');
 }
 function bindAuth(root,{onDone}={}){
  root.addEventListener('click',e=>{
   const tab=e.target.closest('[data-auth-mode]');if(tab){root.innerHTML=authFormHtml(tab.dataset.authMode);bindAuthForms(root,onDone);}
  });
  bindAuthForms(root,onDone);
 }
 function bindAuthForms(root,onDone){
  const reg=$('#register-form',root),login=$('#login-form',root);
  if(reg){
   reg.addEventListener('change',e=>{if(e.target.name==='role'){const company=e.target.value==='company';$('[data-industry-field]',reg).hidden=!company;$('[data-company-label]',reg).textContent=company?'კომპანიის დასახელება *':'კომპანია / ობიექტი';}});
   reg.addEventListener('submit',async e=>{e.preventDefault();try{const d=formData(reg);const user=await S.register({...d,acceptTerms:!!d.acceptTerms});toast('ანგარიში შეიქმნა. მოგესალმებით, '+user.name.split(' ')[0]+'!');onDone?.(user);}catch(err){showError(reg,err);}});
  }
  if(login)login.addEventListener('submit',async e=>{e.preventDefault();try{const d=formData(login);const user=await S.login(d.email,d.password);toast('შეხვედი როგორც '+user.company);onDone?.(user);}catch(err){showError(login,err);}});
 }
 function openAuth(mode='login',role){
  openDialog(`<span class="section-kicker">MeetAny ბეტა</span><h2 id="form-title">${mode==='register'?'შექმენი ანგარიში':'შედი ანგარიშში'}</h2><div id="auth-root">${authFormHtml(mode,role)}</div>`,'auth');
  bindAuth($('#auth-root'),{onDone:closeDialog});
 }
 document.addEventListener('click',e=>{
  const demo=e.target.closest('[data-demo-login]');
  if(demo){const u=S.loginAsDemo(demo.dataset.demoLogin);toast('შეხვედი როგორც '+u.company+' ('+roleLabel(u)+')');if($('#form-dialog')?.dataset.market==='auth'||$('#form-dialog')?.dataset.market==='beta')closeDialog();}
 });

 /* ---------- header, beta switcher ---------- */
 function enhanceHeader(){
  const nav=$('#main-nav');
  if(nav&&!$('.nav-requests',nav)){const a=document.createElement('a');a.href='/v2/requests/';a.className='nav-requests';a.textContent='განცხადებები';nav.querySelector('.nav-categories')?.after(a);}
  const actions=$('.header-actions');
  if(actions&&!$('.account-link',actions)){const a=document.createElement('a');a.className='account-link';a.href='/v2/account/';actions.querySelector('[data-action="add-company"]')?.before(a);}
  if(['requests','request','account','admin','terms'].includes(page)){
   document.querySelectorAll('#main-nav a,.drawer-links a').forEach(a=>{a.classList.remove('active');a.removeAttribute('aria-current');});
   const target=page==='requests'||page==='request'?'/v2/requests/':null;
   if(target)document.querySelectorAll(`#main-nav a[href="${target}"],.drawer-links a[href="${target}"]`).forEach(a=>{a.classList.add('active');a.setAttribute('aria-current','page');});
  }
  const drawerNav=$('.drawer-links');
  if(drawerNav&&!$('.nav-requests',drawerNav)){const a=document.createElement('a');a.href='/v2/requests/';a.className='nav-requests';a.textContent='განცხადებები';drawerNav.querySelector('.nav-categories')?.after(a);}
  const drawerActions=$('.drawer-actions');
  if(drawerActions&&!$('.account-link',drawerActions)){const a=document.createElement('a');a.className='account-link';a.href='/v2/account/';drawerActions.prepend(a);}
  if(!$('.beta-pill')){const b=document.createElement('button');b.type='button';b.className='beta-pill';b.addEventListener('click',openBetaSwitcher);document.body.append(b);}
  renderHeaderUser();
 }
 function renderHeaderUser(){
  const u=S.currentUser();
  document.querySelectorAll('.account-link').forEach(a=>{a.innerHTML=u?`${ic.user}<span>${esc(u.company)}</span>`:`${ic.user}<span>შესვლა</span>`;a.setAttribute('aria-label',u?'ჩემი ანგარიში — '+u.company:'შესვლა ან რეგისტრაცია');});
  const pill=$('.beta-pill');if(pill)pill.innerHTML=`<b>ბეტა</b><span>${u?esc(u.company)+' · '+roleLabel(u):'სტუმარი'}</span>${icon('chevron-right')}`;
 }
 function openBetaSwitcher(){
  const u=S.currentUser();
  openDialog(`<span class="section-kicker">პრეზენტაციის რეჟიმი</span><h2 id="form-title">ბეტა-ვერსია</h2>
   <p class="request-intro">აირჩიე, ვის სახელით ნახო პლატფორმა. ყველა კომპანია და კლიენტი სადემონსტრაციოა.</p>
   <p class="beta-current">ახლა: <b>${u?esc(u.company)+' · '+roleLabel(u):'სტუმარი (შესვლის გარეშე)'}</b></p>
   <div class="demo-accounts">${demoAccountsHtml()}</div>
   <div class="form-actions beta-actions">${u?'<button type="button" class="button button-outline" data-beta="logout">გასვლა</button>':''}<a class="button button-outline" href="/v2/admin/">ადმინ-პანელი</a><button type="button" class="button button-outline" data-beta="reset">ბეტას განულება</button></div>
   <p class="beta-note">განულება აბრუნებს საწყის სადემონსტრაციო განცხადებებს და შლის ამ ბრაუზერში შექმნილ მონაცემებს.</p>`,'beta');
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-beta]');if(!b)return;
  if(b.dataset.beta==='logout'){S.logout();closeDialog();toast('გამოხვედი ანგარიშიდან.');}
  if(b.dataset.beta==='reset'){if(b.dataset.confirm){S.resetBeta();closeDialog();toast('ბეტა დაბრუნდა საწყის მდგომარეობაში.');}else{b.dataset.confirm='1';b.textContent='დაადასტურე განულება';b.classList.add('is-danger');}}
 });
 // "Add company" now leads to a real company registration instead of a text draft.
 document.addEventListener('click',e=>{const add=e.target.closest('[data-action="add-company"]');if(add){e.preventDefault();e.stopImmediatePropagation();document.querySelector('#mobile-drawer')?.close();const u=S.currentUser();if(u)location.href='/v2/account/';else openAuth('register','company');}},true);

 /* ---------- request form ---------- */
 function resizePhoto(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.size)return resolve(null);
   if(!file.type.startsWith('image/'))return reject(Object.assign(new Error(),{userMessage:'ატვირთე მხოლოდ სურათი.'}));
   if(file.size>12*1024*1024)return reject(Object.assign(new Error(),{userMessage:'სურათი უნდა იყოს 12 MB-ზე ნაკლები.'}));
   const img=new Image(),url=URL.createObjectURL(file);
   img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',0.78));};
   img.onerror=()=>{URL.revokeObjectURL(url);reject(Object.assign(new Error(),{userMessage:'სურათი ვერ წავიკითხეთ.'}));};
   img.src=url;
  });
 }
 function openRequestForm(){
  const u=S.currentUser();
  if(!u){openAuth('login');toast('განცხადების დასადებად შედი ანგარიშში ან დარეგისტრირდი.');return;}
  openDialog(`<span class="section-kicker">ახალი განცხადება</span><h2 id="form-title">რა გჭირდება?</h2>
   <p class="request-intro">მოკლედ აღწერე საჭიროება. კომპანიები გამოგიგზავნიან წერილობით შეთავაზებებს, რომლებსაც მხოლოდ შენ ნახავ.</p>
   <form id="new-request-form" class="market-form" novalidate>
    <div class="field"><label for="nr-title">სათაური *</label><input id="nr-title" name="title" required minlength="5" maxlength="120" placeholder="მაგ.: მჭირდება 1000 სკამი"></div>
    <div class="field"><label for="nr-body">აღწერა *</label><textarea id="nr-body" name="body" required minlength="10" maxlength="2000" rows="5" placeholder="რაოდენობა, ხარისხი, მიწოდების ადგილი, სასურველი ვადა…"></textarea></div>
    <div class="request-field-grid"><div class="field"><label for="nr-category">კატეგორია *</label><select id="nr-category" name="category" required>${optionList(categories,'','აირჩიე კატეგორია')}</select></div>
    <div class="field"><label for="nr-city">ქალაქი *</label><select id="nr-city" name="city" required>${optionList(cities,u.city||'tbilisi')}</select></div></div>
    <div class="field photo-field"><label for="nr-photo">${ic.image} ფოტო <small>არასავალდებულო</small></label><input id="nr-photo" name="photo" type="file" accept="image/*"><img class="photo-preview" alt="ატვირთული ფოტოს გადახედვა" hidden></div>
    <div class="form-action-bar"><button type="button" class="form-cancel" data-close>გაუქმება</button><button class="button form-submit" type="submit">გამოქვეყნება ${icon('arrow-right')}</button></div>
    <p class="request-demo-note">${ic.clock} განცხადება ${S.REQUEST_DAYS} დღე იქნება აქტიური. ვადის გაგრძელება შეგიძლია ანგარიშიდან.</p>
   </form>`,'request');
  const form=$('#new-request-form');let photo=null;
  form.elements.photo.addEventListener('change',async e=>{try{photo=await resizePhoto(e.target.files[0]);const p=$('.photo-preview',form);p.hidden=!photo;if(photo)p.src=photo;}catch(err){e.target.value='';showError(form,err);}});
  form.addEventListener('submit',e=>{e.preventDefault();try{const d=formData(form);const r=S.createRequest({...d,photo});closeDialog();toast('განცხადება გამოქვეყნდა.');location.href=requestHref(r);}catch(err){showError(form,err);}});
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-market="new-request"]')){e.preventDefault();openRequestForm();}if(e.target.closest('[data-market="login"]')){e.preventDefault();openAuth('login');}if(e.target.closest('[data-market="register-company"]')){e.preventDefault();openAuth('register','company');}});

 /* ---------- cards ---------- */
 function requestCard(r){
  const owner=S.userById(r.ownerId),count=S.offerCount(r.id);
  return `<article class="req-card">
   <a class="req-card-media" href="${requestHref(r)}" tabindex="-1" aria-hidden="true">${r.photo?`<img src="${esc(r.photo)}" alt="" loading="lazy" decoding="async">`:`<span class="req-card-placeholder">${ic.inbox}</span>`}</a>
   <div class="req-card-body">
    <div class="req-card-top"><span class="req-category">${esc(categories[r.category]||'')}</span>${stateBadge(r)}</div>
    <h3><a href="${requestHref(r)}">${esc(r.title)}</a></h3>
    <p class="req-excerpt">${esc(r.body)}</p>
    <div class="req-card-meta"><span>${icon('map-pin')}${esc(cities[r.city]||'')}</span><span>${esc(owner?.company||'')}</span><span>${ago(r.createdAt)}</span></div>
    <div class="req-card-footer"><span class="offer-count">${ic.lock}<b>${count}</b> შეთავაზება</span><a class="button listing-action" href="${requestHref(r)}">${S.currentUser()?.role==='company'&&S.requestState(r)==='open'?'შესთავაზე':'ნახვა'} ${icon('arrow-up-right')}</a></div>
   </div>
  </article>`;
 }

 /* ---------- pages ---------- */
 function renderRequestsPage(){
  const root=$('#requests-root');if(!root)return;
  const p=new URLSearchParams(location.search);
  const f={q:p.get('q')||'',category:Object.hasOwn(categories,p.get('category')||'')?p.get('category'):'',city:Object.hasOwn(cities,p.get('city')||'')?p.get('city'):'',state:['open','done','all'].includes(p.get('state'))?p.get('state'):'open'};
  const list=S.listRequests({...f,state:f.state==='all'?'':f.state});
  const st=S.stats(),u=S.currentUser();
  root.innerHTML=`<section class="catalog-head req-head"><div class="breadcrumb"><a href="/v2/">მთავარი</a> / განცხადებები</div>
   <div class="req-head-row"><div><h1>განცხადებები</h1><p>კომპანიებს სჭირდებათ პროდუქტი და მომსახურება. ${u?.role==='company'?'შესთავაზე შენი ფასი და პირობები.':'დადე შენი განცხადება და მიიღე შეთავაზებები.'}</p></div>
   <button class="button" data-market="new-request">${icon('plus')} დადე განცხადება</button></div>
   <form class="req-filters" id="req-filters" role="search">
    <div class="req-search">${icon('search')}<label class="sr-only" for="rq">ძიება განცხადებებში</label><input id="rq" name="q" type="search" value="${esc(f.q)}" placeholder="მაგ.: სკამი, ბეტონი, თეთრეული" maxlength="200"></div>
    <label class="sr-only" for="rc">კატეგორია</label><select id="rc" name="category">${optionList(categories,f.category,'ყველა კატეგორია')}</select>
    <label class="sr-only" for="rcity">ქალაქი</label><select id="rcity" name="city">${optionList(cities,f.city,'ყველა ქალაქი')}</select>
    <button class="button" type="submit">მოძებნე</button>
   </form></section>
   <div class="req-layout">
    <div class="req-toolbar"><div class="req-state-tabs" role="group" aria-label="განცხადების სტატუსი">${[['open','ღია ('+st.open+')'],['done','დასრულებული'],['all','ყველა']].map(([k,l])=>`<button type="button" data-state="${k}" aria-pressed="${f.state===k}">${l}</button>`).join('')}</div><p role="status">${list.length} განცხადება</p></div>
    <div class="req-grid">${list.length?list.map(requestCard).join(''):`<div class="empty-state">${icon('search')}<h2>განცხადება ვერ მოიძებნა</h2><p>შეცვალე ფილტრები ან დადე შენი განცხადება — კომპანიები თავად გამოგიგზავნიან შეთავაზებებს.</p><div class="form-actions"><a class="button button-outline" href="/v2/requests/">ფილტრების გასუფთავება</a><button class="button" data-market="new-request">დადე განცხადება</button></div></div>`}</div>
    <aside class="req-how"><h2>როგორ მუშაობს</h2><ol><li><b>დადე განცხადება</b><span>აღწერე, რა გჭირდება — მაგ. „1000 სკამი“.</span></li><li><b>მიიღე შეთავაზებები</b><span>კომპანიები გიგზავნიან ფასს და პირობებს. სხვები ხედავენ მხოლოდ რაოდენობას.</span></li><li><b>აირჩიე საუკეთესო</b><span>არჩევისას ორივე მხარე ხედავს ერთმანეთის ტელეფონს.</span></li></ol>${u?'':`<button class="button button-outline" data-market="register-company">${icon('plus')} დაარეგისტრირე კომპანია</button>`}</aside>
   </div>`;
  const form=$('#req-filters');
  const apply=next=>{const q=new URLSearchParams();const merged={...f,...next};for(const [k,v] of Object.entries(merged))if(v&&!(k==='state'&&v==='open'))q.set(k,v);history.replaceState({},'',location.pathname+(q.toString()?'?'+q:''));renderRequestsPage();};
  form.addEventListener('submit',e=>{e.preventDefault();apply(formData(form));});
  form.addEventListener('change',e=>{if(e.target.tagName==='SELECT')apply(formData(form));});
  root.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>apply({...formData(form),state:b.dataset.state})));
 }

 function shareBar(r){
  const url=location.origin+requestHref(r),text=r.title+' — MeetAny';
  return `<div class="share-bar" aria-label="განცხადების გაზიარება"><span>${ic.share} გააზიარე</span>
   <button type="button" class="share-btn" data-copy-link="${esc(url)}">${ic.link}<span>ბმულის კოპირება</span></button>
   <a class="share-btn share-wa" href="https://wa.me/?text=${encodeURIComponent(text+'\n'+url)}" target="_blank" rel="noopener">${ic.whatsapp}<span>WhatsApp</span></a>
   <a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">${ic.facebook}<span>Facebook</span></a>
   ${navigator.share?`<button type="button" class="share-btn" data-native-share>${ic.share}<span>სხვა</span></button>`:''}
  </div>${r.slug?'':'<p class="beta-note">ბეტაში ახალი განცხადება ჯერ მხოლოდ ამ ბრაუზერში ჩანს. რეალურ ვერსიაში ბმული ყველასთვის გაიხსნება.</p>'}`;
 }
 document.addEventListener('click',async e=>{
  const copy=e.target.closest('[data-copy-link]');
  if(copy){try{await navigator.clipboard.writeText(copy.dataset.copyLink);toast('ბმული დაკოპირდა.');}catch{toast(copy.dataset.copyLink);}}
  const native=e.target.closest('[data-native-share]');
  if(native){const r=currentRequest();if(r)try{await navigator.share({title:r.title,text:r.title+' — MeetAny',url:location.origin+requestHref(r)});}catch{}}
 });

 function currentRequest(){const main=$('[data-market-page="request"]')||document.body;const id=main.dataset.requestId||new URLSearchParams(location.search).get('id');return id?S.getRequest(id):null;}
 function contactCard(contact,title){return `<div class="contact-card"><span class="section-kicker">${icon('handshake')}${esc(title)}</span><h3>${esc(contact.company)}</h3><p>${esc(contact.name)}</p><a href="tel:${esc(contact.phone.replace(/\s/g,''))}">${ic.phone}${esc(contact.phone)}</a><a href="mailto:${esc(contact.email)}">${ic.mail}${esc(contact.email)}</a></div>`;}
 function offerItem(o,r,viewer){
  const company=S.userById(o.companyUserId),isOwner=viewer&&viewer.id===r.ownerId,open=S.requestState(r)==='open';
  const status=o.status==='chosen'?'<span class="offer-status chosen">'+icon('check')+'არჩეულია</span>':o.status==='declined'?'<span class="offer-status declined">არ აირჩიეს</span>':'';
  return `<article class="offer-card ${o.status==='chosen'?'is-chosen':''}">
   <header><div><h3>${company?.profile?`<a href="/v2/companies/${company.profile}/">${esc(company.company)}</a>`:esc(company?.company||'კომპანია')}</h3><p>${verifiedBadge(company)}<span>${esc(categories[company?.industry]||'')}</span><span>${ago(o.createdAt)}</span></p></div><div class="offer-price">${money(o.price)}</div></header>
   <p class="offer-body">${esc(o.body)}</p>
   <div class="offer-foot">${status}${isOwner&&open?`<button type="button" class="button" data-choose-offer="${o.id}">${icon('check')} ამ შეთავაზების არჩევა</button>`:''}</div>
  </article>`;
 }
 function renderRequestPage(){
  const root=$('#request-root');if(!root)return;
  const r=currentRequest(),u=S.currentUser();
  if(!r||(S.requestState(r)==='hidden'&&u?.role!=='admin'&&u?.id!==r?.ownerId)){root.innerHTML=`<div class="empty-state req-missing">${icon('search')}<h1>განცხადება ვერ მოიძებნა</h1><p>შესაძლოა წაიშალა, ან შექმნილია სხვა ბრაუზერში (ბეტაში მონაცემები მხოლოდ ერთ ბრაუზერში ინახება).</p><a class="button" href="/v2/requests/">ყველა განცხადება</a></div>`;return;}
  document.title=r.title+' — განცხადება | MeetAny';
  const owner=S.userById(r.ownerId),state=S.requestState(r),count=S.offerCount(r.id);
  const isOwner=u&&u.id===r.ownerId,isAdmin=u?.role==='admin';
  const offers=S.visibleOffers(r.id,u),mine=u?offers.find(o=>o.companyUserId===u.id):null;
  const contact=S.contactFor(r,u);
  let side='';
  if(isOwner){
   side=`<div class="req-side-box"><h2>შენი განცხადება</h2><p class="req-side-count"><b>${count}</b> შეთავაზება</p>${stateBadge(r)}
    <div class="owner-actions">${state==='open'?`<button type="button" class="button button-outline" data-owner="extend">${ic.clock} ვადის გაგრძელება (+${S.EXTEND_DAYS} დღე)</button><button type="button" class="button button-outline" data-owner="close">განცხადების დახურვა</button>`:''}${['expired','closed'].includes(state)?`<button type="button" class="button" data-owner="extend">ხელახლა გახსნა ${S.EXTEND_DAYS} დღით</button>`:''}<button type="button" class="text-danger" data-owner="delete">${ic.trash} წაშლა</button></div></div>`;
  }else if(u?.role==='company'){
   if(mine&&mine.status==='chosen')side=`<div class="req-side-box success"><h2>${icon('check')} შენი შეთავაზება აირჩიეს!</h2><p>დაუკავშირდი კლიენტს და შეათანხმეთ დეტალები.</p></div>`;
   else if(state!=='open')side=`<div class="req-side-box"><h2>${esc(stateLabels[state])}</h2><p>ეს განცხადება ახალ შეთავაზებებს აღარ იღებს.</p></div>`;
   else if(u.blocked)side=`<div class="req-side-box"><h2>ანგარიში დაბლოკილია</h2></div>`;
   else side=`<div class="req-side-box"><h2>${mine?'შენი შეთავაზების რედაქტირება':'გაუგზავნე შეთავაზება'}</h2><p class="sealed-note">${ic.lock} შეთავაზებას ნახავს მხოლოდ ${esc(owner?.company||'განცხადების ავტორი')}. კონკურენტები შენს ფასს ვერ ხედავენ.</p>
    <form id="offer-form" class="market-form" novalidate><div class="field"><label for="of-body">შეთავაზება *</label><textarea id="of-body" name="body" required minlength="10" maxlength="2000" rows="6" placeholder="მაგ.: გაგიკეთებთ 1000 სკამს, მიწოდება 10 დღეში, გარანტია 2 წელი…">${esc(mine?.body||'')}</textarea></div>
    <div class="field"><label for="of-price">ფასი (₾) <small>არასავალდებულო</small></label><input id="of-price" name="price" inputmode="decimal" value="${mine?.price??''}" placeholder="მაგ.: 45 ან ჯამური თანხა"><small class="field-hint">მიუთითე ერთეულის ან ჯამური ფასი — ტექსტში დააზუსტე.</small></div>
    <button class="button form-submit" type="submit">${mine?'განახლება':'შეთავაზების გაგზავნა'} ${icon('arrow-right')}</button>${mine?`<button type="button" class="text-danger" data-withdraw="${mine.id}">შეთავაზების გაუქმება</button>`:''}</form></div>`;
  }else if(u){
   side=`<div class="req-side-box"><h2><b>${count}</b> შეთავაზება</h2><p class="sealed-note">${ic.lock} შეთავაზებებს ხედავს მხოლოდ განცხადების ავტორი.</p><p>შეთავაზების გაგზავნა შეუძლიათ კომპანიის ანგარიშებს.</p><button class="button button-outline" data-market="new-request">${icon('plus')} დადე შენი განცხადება</button></div>`;
  }else{
   side=`<div class="req-side-box"><h2><b>${count}</b> შეთავაზება</h2><p class="sealed-note">${ic.lock} შეთავაზებებს ხედავს მხოლოდ განცხადების ავტორი.</p>${state==='open'?`<p>ხარ კომპანია და შეგიძლია ამის მიწოდება?</p><button class="button" data-market="register-company">შესთავაზე შენი ფასი</button><button class="button button-outline" data-market="login">შესვლა</button>`:`<p>${esc(stateLabels[state])}.</p>`}</div>`;
  }
  if(isAdmin)side+=`<div class="req-side-box admin-box"><h2>ადმინი</h2><button type="button" class="button button-outline" data-admin-hide="${r.id}" data-hidden="${r.hidden?'0':'1'}">${r.hidden?'გამოჩენა':'დამალვა (სპამი)'}</button></div>`;
  const showOffers=isOwner||isAdmin||(mine&&!isOwner);
  root.innerHTML=`<div class="profile-breadcrumb req-breadcrumb"><a href="/v2/requests/">${icon('arrow-right')} განცხადებების სია</a><span>${esc(categories[r.category]||'')}</span></div>
  <div class="req-detail">
   <article class="req-main">
    ${r.photo?`<img class="req-cover" src="${esc(r.photo)}" alt="განცხადების საილუსტრაციო ფოტო">`:''}
    <div class="req-card-top"><span class="req-category">${esc(categories[r.category]||'')}</span>${stateBadge(r)}</div>
    <h1>${esc(r.title)}</h1>
    <div class="req-card-meta"><span>${icon('map-pin')}${esc(cities[r.city]||'')}</span><span>${icon('building-2')}${esc(owner?.company||'')}</span><span>${ic.clock}გამოქვეყნდა ${ago(r.createdAt)}</span></div>
    <p class="req-body">${esc(r.body)}</p>
    ${contact?contactCard(contact,isOwner?'არჩეული მომწოდებლის კონტაქტი':'კლიენტის კონტაქტი'):''}
    ${shareBar(r)}
    ${showOffers?`<section class="req-offers" aria-labelledby="offers-title"><div class="req-offers-head"><h2 id="offers-title">${isOwner||isAdmin?'მიღებული შეთავაზებები':'შენი შეთავაზება'} <span>${offers.length}</span></h2>${isOwner&&offers.length>1?`<label>დალაგება <select id="offer-sort"><option value="date">თარიღით</option><option value="price">ფასით (იაფი → ძვირი)</option></select></label>`:''}</div>
     <div id="offer-list">${offers.length?offers.map(o=>offerItem(o,r,u)).join(''):`<div class="empty-offers">${ic.inbox}<p>შეთავაზებები ჯერ არ არის. კომპანიებს შეტყობინება გაეგზავნათ — როგორც კი შემოვა, აქ გამოჩნდება.</p></div>`}</div></section>`:''}
   </article>
   <aside class="req-side">${side}</aside>
  </div>`;
  const sort=$('#offer-sort');
  if(sort)sort.addEventListener('change',()=>{const list=[...offers];if(sort.value==='price')list.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));$('#offer-list').innerHTML=list.map(o=>offerItem(o,r,u)).join('');});
  const form=$('#offer-form');
  if(form)form.addEventListener('submit',e=>{e.preventDefault();try{const wasMine=!!mine;S.sendOffer(r.id,formData(form));toast(wasMine?'შეთავაზება განახლდა.':'შეთავაზება გაიგზავნა. '+(owner?.company||'ავტორი')+' მიიღებს შეტყობინებას.');}catch(err){showError(form,err);}});
 }
 document.addEventListener('click',e=>{
  const choose=e.target.closest('[data-choose-offer]');
  if(choose){if(!choose.dataset.confirm){choose.dataset.confirm='1';choose.innerHTML=icon('check')+' დაადასტურე არჩევა';choose.classList.add('is-confirm');return;}try{S.chooseOffer(choose.dataset.chooseOffer);toast('მომწოდებელი არჩეულია. კონტაქტები გაიხსნა.');window.scrollTo({top:0,behavior:'smooth'});}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
  const withdraw=e.target.closest('[data-withdraw]');
  if(withdraw){try{S.withdrawOffer(withdraw.dataset.withdraw);toast('შეთავაზება გაუქმდა.');}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
  const owner=e.target.closest('[data-owner]');
  if(owner){const r=currentRequest()||S.getRequest(owner.dataset.requestId);if(!r)return;try{
   if(owner.dataset.owner==='extend'){S.extendRequest(r.id);toast('ვადა გაგრძელდა '+S.EXTEND_DAYS+' დღით.');}
   if(owner.dataset.owner==='close'){S.closeRequest(r.id);toast('განცხადება დაიხურა.');}
   if(owner.dataset.owner==='delete'){if(!owner.dataset.confirm){owner.dataset.confirm='1';owner.innerHTML=ic.trash+' დაადასტურე წაშლა';return;}S.deleteRequest(r.id);toast('განცხადება წაიშალა.');if(page==='request')location.href='/v2/account/';}
  }catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
  const hide=e.target.closest('[data-admin-hide]');
  if(hide){try{S.adminSetHidden(hide.dataset.adminHide,hide.dataset.hidden==='1');toast(hide.dataset.hidden==='1'?'განცხადება დაიმალა.':'განცხადება ისევ ჩანს.');}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
 });

 function renderAccountPage(){
  const root=$('#account-root');if(!root)return;
  const u=S.currentUser();
  if(!u){root.innerHTML=`<div class="account-auth"><div><span class="section-kicker">MeetAny ბეტა</span><h1>შედი ან შექმენი ანგარიში</h1><p>კლიენტები დებენ განცხადებებს, კომპანიები კი გზავნიან შეთავაზებებს. ყველა ანგარიშს სჭირდება ტელეფონის ნომერი.</p></div><div id="auth-root">${authFormHtml(new URLSearchParams(location.search).get('mode')==='register'?'register':'login',new URLSearchParams(location.search).get('role'))}</div></div>`;bindAuth($('#auth-root'));return;}
  const mine=S.listRequests({ownerId:u.id,state:'',includeHidden:true});
  const offers=S.myOffers(u);
  const matching=u.role==='company'?S.listRequests({category:u.industry}).filter(r=>r.ownerId!==u.id):[];
  const row=r=>`<li class="account-row"><div><a href="${requestHref(r)}"><b>${esc(r.title)}</b></a><small>${esc(categories[r.category]||'')} · ${esc(cities[r.city]||'')} · ${ago(r.createdAt)}</small></div><div class="account-row-meta">${stateBadge(r)}<span class="offer-count">${ic.inbox}<b>${S.offerCount(r.id)}</b></span>${S.requestState(r)!=='chosen'&&S.requestState(r)!=='hidden'?`<button type="button" class="mini-button" data-owner="extend" data-request-id="${r.id}">+${S.EXTEND_DAYS} დღე</button>`:''}</div></li>`;
  root.innerHTML=`<div class="account-grid">
   <aside class="account-card"><span class="account-avatar">${ic.user}</span><h1>${esc(u.company)}</h1><p>${esc(u.name)} · ${roleLabel(u)}</p>${verifiedBadge(u)}
    <dl><div><dt>${ic.phone}ტელეფონი</dt><dd>${esc(u.phone)}</dd></div><div><dt>${ic.mail}ელფოსტა</dt><dd>${esc(u.email)}</dd></div><div><dt>${icon('map-pin')}ქალაქი</dt><dd>${esc(cities[u.city]||'')}</dd></div>${u.industry?`<div><dt>${icon('briefcase-business')}მიმართულება</dt><dd>${esc(categories[u.industry]||'')}</dd></div>`:''}</dl>
    <p class="account-privacy">${ic.lock} ტელეფონი და ელფოსტა ჩანს მხოლოდ მაშინ, როცა შეთავაზება აირჩევა.</p>
    <div class="account-actions"><button class="button" data-market="new-request">${icon('plus')} დადე განცხადება</button>${u.role==='admin'?'<a class="button button-outline" href="/v2/admin/">ადმინ-პანელი</a>':''}<button class="button button-outline" data-beta="logout">გასვლა</button></div>
   </aside>
   <div class="account-main">
    ${u.role==='company'?`<section class="account-section"><h2>შენთვის შესაბამისი განცხადებები <span>${matching.length}</span></h2><p class="section-description">ღია განცხადებები მიმართულებით „${esc(categories[u.industry]||'')}“. რეალურ ვერსიაში ახალზე შეტყობინებას მიიღებ ელფოსტით.</p>${matching.length?`<div class="req-grid compact">${matching.slice(0,4).map(requestCard).join('')}</div>`:'<p class="empty-line">ამ მიმართულებით ღია განცხადება ახლა არ არის.</p>'}</section>
    <section class="account-section"><h2>ჩემი შეთავაზებები <span>${offers.length}</span></h2>${offers.length?`<ul class="account-list">${offers.map(o=>{const r=S.getRequest(o.requestId);return r?`<li class="account-row"><div><a href="${requestHref(r)}"><b>${esc(r.title)}</b></a><small>${money(o.price)} · ${ago(o.createdAt)}</small></div><div class="account-row-meta">${o.status==='chosen'?'<span class="offer-status chosen">'+icon('check')+'არჩეულია</span>':o.status==='declined'?'<span class="offer-status declined">არ აირჩიეს</span>':stateBadge(r)}</div></li>`:'';}).join('')}</ul>`:'<p class="empty-line">ჯერ შეთავაზება არ გაგიგზავნია. <a href="/v2/requests/">ნახე განცხადებები</a></p>'}</section>`:''}
    <section class="account-section"><h2>ჩემი განცხადებები <span>${mine.length}</span></h2>${mine.length?`<ul class="account-list">${mine.map(row).join('')}</ul>`:`<p class="empty-line">განცხადება ჯერ არ გაქვს. <button class="link-button" data-market="new-request">დადე პირველი</button></p>`}</section>
   </div></div>`;
 }

 function renderAdminPage(){
  const root=$('#admin-root');if(!root)return;
  const u=S.currentUser();
  if(u?.role!=='admin'){root.innerHTML=`<div class="empty-state req-missing">${ic.lock}<h1>ადმინ-პანელი</h1><p>ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.</p><button class="button" data-demo-login="u-admin">შედი როგორც ადმინი (დემო)</button></div>`;return;}
  const st=S.stats(),tab=new URLSearchParams(location.search).get('tab')==='users'?'users':'requests';
  const reqs=S.listRequests({state:'',includeHidden:true}),users=S.allUsers();
  root.innerHTML=`<div class="admin-head"><div><span class="section-kicker">MeetAny ბეტა</span><h1>ადმინ-პანელი</h1></div><button class="button button-outline" data-beta="reset">ბეტას განულება</button></div>
   <div class="admin-stats">${[['მომხმარებელი',st.users],['კომპანია',st.companies],['დადასტურებული',st.verified],['ღია განცხადება',st.open],['შეთავაზება',st.offers],['არჩეული გარიგება',st.chosen]].map(([l,v])=>`<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
   <div class="req-state-tabs admin-tabs" role="group"><a href="?tab=requests" aria-pressed="${tab==='requests'}">განცხადებები (${reqs.length})</a><a href="?tab=users" aria-pressed="${tab==='users'}">მომხმარებლები (${users.length})</a></div>
   ${tab==='requests'?`<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>განცხადება</th><th>ავტორი</th><th>სტატუსი</th><th>შეთავ.</th><th>მოქმედება</th></tr></thead><tbody>${reqs.map(r=>{const o=S.userById(r.ownerId);return `<tr class="${r.hidden?'is-muted':''}"><td><a href="${requestHref(r)}">${esc(r.title)}</a><small>${esc(categories[r.category]||'')} · ${ago(r.createdAt)}</small></td><td>${esc(o?.company||'—')}<small>${esc(o?.phone||'')}</small></td><td>${stateBadge(r)}</td><td>${S.offerCount(r.id)}</td><td class="admin-actions"><button type="button" class="mini-button" data-admin-hide="${r.id}" data-hidden="${r.hidden?'0':'1'}">${r.hidden?ic.eye+'გამოჩენა':ic.ban+'დამალვა'}</button><button type="button" class="mini-button danger" data-admin-delete="${r.id}">${ic.trash}წაშლა</button></td></tr>`;}).join('')}</tbody></table></div>`
   :`<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>მომხმარებელი</th><th>როლი</th><th>კონტაქტი</th><th>სტატუსი</th><th>მოქმედება</th></tr></thead><tbody>${users.map(x=>`<tr class="${x.blocked?'is-muted':''}"><td><b>${esc(x.company)}</b><small>${esc(x.name)} · ${esc(cities[x.city]||'')}</small></td><td>${roleLabel(x)}${x.industry?`<small>${esc(categories[x.industry]||'')}</small>`:''}</td><td>${esc(x.phone)}<small>${esc(x.email)}</small></td><td>${x.blocked?'<span class="req-state req-state-hidden">დაბლოკილი</span>':verifiedBadge(x)||'<span class="muted">აქტიური</span>'}</td><td class="admin-actions">${x.role==='company'?`<button type="button" class="mini-button" data-admin-verify="${x.id}" data-value="${x.verified?'0':'1'}">${ic.shield}${x.verified?'დადასტ. მოხსნა':'დადასტურება'}</button>`:''}${x.role!=='admin'?`<button type="button" class="mini-button ${x.blocked?'':'danger'}" data-admin-block="${x.id}" data-value="${x.blocked?'0':'1'}">${ic.ban}${x.blocked?'განბლოკვა':'დაბლოკვა'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`}`;
 }
 document.addEventListener('click',e=>{
  const del=e.target.closest('[data-admin-delete]');
  if(del){if(!del.dataset.confirm){del.dataset.confirm='1';del.innerHTML=ic.trash+'დაადასტურე';return;}try{S.adminDeleteRequest(del.dataset.adminDelete);toast('განცხადება წაიშალა.');}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
  const ver=e.target.closest('[data-admin-verify]');
  if(ver){try{S.adminSetVerified(ver.dataset.adminVerify,ver.dataset.value==='1');toast(ver.dataset.value==='1'?'კომპანია დადასტურდა.':'დადასტურება მოიხსნა.');}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
  const blk=e.target.closest('[data-admin-block]');
  if(blk){try{S.adminSetBlocked(blk.dataset.adminBlock,blk.dataset.value==='1');toast(blk.dataset.value==='1'?'მომხმარებელი დაიბლოკა.':'მომხმარებელი განიბლოკა.');}catch(err){toast(err.userMessage||'ვერ შესრულდა.');}}
 });

 function renderHomeRequests(){
  const root=$('#latest-requests');if(!root)return;
  const st=S.stats(),latest=S.listRequests().slice(0,3);
  root.innerHTML=`<div class="section-heading"><div><span class="section-kicker">ახალი — ბეტა</span><h2>ბოლო განცხადებები</h2><p class="section-description">დადე, რა გჭირდება, და კომპანიები თავად გამოგიგზავნიან შეთავაზებებს ფასით.</p></div><a class="text-link" href="/v2/requests/">ყველა განცხადება ${icon('arrow-right')}</a></div>
   <div class="home-counters"><div><b>${st.open}</b><span>ღია განცხადება</span></div><div><b>${st.companies}</b><span>კომპანია</span></div><div><b>${st.offers}</b><span>გაგზავნილი შეთავაზება</span></div><div class="home-counters-cta"><button class="button" data-market="new-request">${icon('plus')} დადე განცხადება</button></div></div>
   <div class="req-grid three">${latest.map(requestCard).join('')}</div>`;
 }

 const renderers={requests:renderRequestsPage,request:renderRequestPage,account:renderAccountPage,admin:renderAdminPage};
 function renderAll(){renderHeaderUser();renderers[page]?.();renderHomeRequests();}
 enhanceHeader();renderAll();
 S.subscribe(renderAll);
})();
