/* MeetAny marketplace UI (spec v1 §4): requests list, request detail (all role variants), company
   catalog and company profile on the ma-* component library (market.css, tokens in tokens.css),
   plus the live parts of the home page (category counts, companies, hero search).
   Account, admin, the auth dialog and the new-request dialog still use the legacy m-* bridge
   (market.css §99) until their redesign.
   Depends on app.js globals (icon, esc), shell.js (window.MeetAnyShell: header, sheets, toasts,
   copy buttons, „მეტის ნახვა“) and market-store.js (window.MarketStore: synchronous getters over
   a cache; async mutations throw Error objects with a Georgian .userMessage). */
(function(){
 'use strict';
 const S=window.MarketStore;if(!S)return;
 const Shell=window.MeetAnyShell||null;
 const {categories,cities,units,priceTypes,stateLabels}=S;
 const I=(name,extra)=>icon(name,extra);
 const E=v=>esc(v==null?'':v);
 const $=(sel,root=document)=>root.querySelector(sel);
 const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
 const page=document.body.dataset.marketPage||'';
 // Email-verified badges only while sign-up verifies email (config.js requireEmailVerification).
 const EMAIL_CHECK=(window.MEETANY_CONFIG||{}).requireEmailVerification===true;
 const params=()=>new URLSearchParams(location.search);
 const csv=v=>(v||'').split(',').filter(Boolean);
 // pages live under / (spec §2); Design 01 stays at the site root.
 const url=p=>p;
 const brand={
  whatsapp:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3"/></svg>',
  facebook:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4a22 22 0 0 0-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8z"/></svg>'
 };
 // Category icon tiles replace stock photos (spec §1.2).
 const catIcon={furniture:'armchair',construction:'hard-hat',textiles:'bed-double',food:'utensils',packaging:'package',logistics:'truck',cleaning:'sparkles',technology:'monitor',marketing:'megaphone',finance:'calculator',legal:'scale',tourism:'plane',other:'shapes'};
 const DAY=86400000,HOUR=3600000,SOON=48*HOUR,PAGE_SIZE=24,NEW_MEMBER=3;

 /* ======================================================================
    Formatting
    ====================================================================== */
 const pad=n=>String(n).padStart(2,'0');
 // Georgian number format: non-breaking space groups, comma decimals („1 000“, „48,5“).
 function num(v,max=2){
  const n=Number(v);if(!Number.isFinite(n))return '';
  const [int,frac]=Math.abs(n).toFixed(max).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').split('.');
  return (n<0?'−':'')+int.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(frac?','+frac:'');
 }
 const money=v=>v==null?'ფასი შეთანხმებით':num(v)+' ₾';
 const dmy=iso=>{const d=new Date(iso);return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();};
 // needed_by is a calendar date ('YYYY-MM-DD'); formatted without time-zone conversion.
 function dayLabel(ymd,short){const [y,m,d]=String(ymd).split('-');return short&&+y===new Date().getFullYear()?d+'.'+m:d+'.'+m+'.'+y;}
 function ago(iso){
  const s=(Date.now()-Date.parse(iso))/1000;
  if(s<60)return 'ახლახან';
  const m=Math.floor(s/60);if(m<60)return m+' წუთის წინ';
  const h=Math.floor(m/60);if(h<24)return h+' საათის წინ';
  const d=Math.floor(h/24);if(d===1)return 'გუშინ';if(d<7)return d+' დღის წინ';
  if(d<30)return Math.floor(d/7)+' კვირის წინ';
  return dmy(iso);
 }
 const msLeft=r=>Date.parse(r.expiresAt)-Date.now();
 const isSoon=r=>S.requestState(r)==='open'&&msLeft(r)<SOON;
 function leftLabel(r){
  const ms=msLeft(r);if(ms<=0)return 'ვადა ამოიწურა';
  if(ms<DAY)return 'დარჩა '+Math.max(1,Math.ceil(ms/HOUR))+' საათი';
  return 'დარჩა '+Math.ceil(ms/DAY)+' დღე';
 }
 const MONTH_FROM=['იანვრიდან','თებერვლიდან','მარტიდან','აპრილიდან','მაისიდან','ივნისიდან','ივლისიდან','აგვისტოდან','სექტემბრიდან','ოქტომბრიდან','ნოემბრიდან','დეკემბრიდან'];
 const memberSince=iso=>{const d=new Date(iso);return 'წევრია '+d.getFullYear()+' წლის '+MONTH_FROM[d.getMonth()];};
 const qtyLabel=r=>r&&r.quantity!=null&&r.unit?num(r.quantity,3)+' '+units[r.unit]:'';
 const requestHref=r=>'/requests/view/?id='+encodeURIComponent(r.id);
 const companyHref=id=>'/companies/view/?id='+encodeURIComponent(id);
 const cityName=k=>cities[k]||'';
 // Company initials; Georgian letters are never upper-cased (that would produce mtavruli).
 function initials(name){
  const clean=String(name||'?').replace(/[„“"'«»()]/g,'').replace(/^(შპს|სს|ი\/მ|ააიპ)\s+/,'').trim()||'?';
  const parts=clean.split(/\s+/).filter(Boolean);
  return [...(parts.length>1?parts[0][0]+parts[1][0]:[...clean].slice(0,2).join(''))].map(c=>/[a-z]/.test(c)?c.toUpperCase():c).join('');
 }
 const avatar=(name,mod='')=>`<span class="ma-avatar${mod?' '+mod:''}" aria-hidden="true">${E(initials(name))}</span>`;
 // Cities a company serves; 'georgia' covers everything.
 function servesList(c){
  const list=[...new Set([c.city,...(c.serviceCities||[])])].filter(k=>cities[k]);
  if(list.includes('georgia'))return cities.georgia;
  return list.map(cityName).join(', ');
 }
 function serviceOnly(c){
  const list=[...new Set(c.serviceCities||[])].filter(k=>cities[k]&&k!==c.city);
  if(list.includes('georgia'))return cities.georgia;
  return list.map(cityName).join(', ');
 }

 /* ======================================================================
    Shared components
    ====================================================================== */
 // StatusBadge (spec §5): აქტიური / მალე იწურება / არჩეულია / ვადაგასული / დახურულია / დამალულია.
 function statusBadge(r){
  const s=S.requestState(r);
  if(s==='hidden')return '<span class="ma-badge ma-badge--danger">დამალულია</span>';
  if(s==='chosen')return `<span class="ma-badge ma-badge--info">${I('check')}არჩეულია</span>`;
  if(s==='closed')return '<span class="ma-badge ma-badge--neutral">დახურულია</span>';
  if(s==='expired')return '<span class="ma-badge ma-badge--neutral">ვადაგასული</span>';
  return isSoon(r)?'<span class="ma-badge ma-badge--warning">მალე იწურება</span>':'<span class="ma-badge ma-badge--success">აქტიური</span>';
 }
 // VerifiedBadge: says what was checked and when (spec §1.3).
 function verifiedBadge(c,mod=''){
  if(!c||!c.verified)return '';
  const tip=`დადასტურებულია MeetAny-ს მიერ${c.verifiedAt?' · '+dmy(c.verifiedAt):''}<br>შემოწმდა კომპანიის მონაცემები`;
  if(mod==='icon')return `<span class="ma-verified ma-verified--icon" tabindex="0" aria-label="დადასტურებული კომპანია">${I('badge-check')}<span class="ma-verified__tip" role="tooltip">${tip}</span></span>`;
  return `<span class="ma-verified${mod==='lg'?' ma-verified--lg':''}" tabindex="0">${I('badge-check')}${mod==='lg'?'დადასტურებული კომპანია':'დადასტურებული'}<span class="ma-verified__tip" role="tooltip">${tip}</span></span>`;
 }
 const newRequestBtn=(cls='ma-btn--primary',category='')=>`<a class="ma-btn ${cls}" href="/requests/new/" data-market="new-request"${category?` data-category="${E(category)}"`:''}>${I('plus')}მოთხოვნის დამატება</a>`;
 function emptyState({iconName='search',title,text='',actions='',plain=false,heading='h2'}){
  return `<div class="ma-empty${plain?' ma-empty--plain':''}"><span class="ma-empty__icon">${I(iconName)}</span><${heading} class="ma-empty__title">${E(title)}</${heading}>${text?`<p class="ma-empty__text">${E(text)}</p>`:''}${actions?`<div class="ma-empty__actions">${actions}</div>`:''}</div>`;
 }
 function alertBox(kind,title,text='',action=''){
  const ic={info:'info',warning:'triangle-alert',danger:'circle-alert',success:'circle-check'}[kind];
  return `<div class="ma-alert ma-alert--${kind}" role="${kind==='danger'?'alert':'status'}">${I(ic)}<div class="ma-alert__body">${title?`<span class="ma-alert__title">${E(title)}</span>`:''}${text?`<span class="ma-alert__text">${E(text)}</span>`:''}</div>${action}</div>`;
 }
 const note=(text,ic='lock-keyhole')=>`<p class="ma-note">${I(ic)}<span>${E(text)}</span></p>`;
 const myOfferFor=(r,u)=>u?S.myOffers(u).find(o=>o.requestId===r.id)||null:null;

 // RequestCard (spec §5): tile or user photo, title, facts, time, days left, offer count; states mine / offered / closed.
 function requestCard(r){
  const u=S.currentUser(),state=S.requestState(r),count=S.offerCount(r.id);
  const isOwner=!!u&&u.id===r.ownerId,mine=!isOwner&&u?.role==='company'?myOfferFor(r,u):null;
  const media=r.photo?`<img class="ma-rcard__photo" src="${E(r.photo)}" alt="" loading="lazy" decoding="async" width="48" height="48">`:`<span class="ma-tile">${I(catIcon[r.category]||'shapes')}</span>`;
  const facts=[
   qtyLabel(r)?`<li class="ma-fact">${I('package')}<b>${E(qtyLabel(r))}</b></li>`:'',
   `<li class="ma-fact">${I('map-pin')}${E(cityName(r.city))}</li>`,
   r.neededBy?`<li class="ma-fact">${I('calendar-clock')}<span>${E(dayLabel(r.neededBy,true))}-მდე</span></li>`:''
  ].join('');
  let offers;
  if(mine)offers=mine.status==='chosen'?`<span class="ma-badge ma-badge--success">${I('check')}შენი აირჩიეს</span>`:`<span class="ma-badge ma-badge--info">${I('check')}შენ გაგზავნე</span>`;
  else if(count===0&&state==='open'&&!isOwner&&u?.role!=='client')offers=`<span class="ma-rcard__offers ma-rcard__offers--first">${I('sparkles')}0 შეთავაზება — იყავი პირველი</span>`;
  else offers=`<span class="ma-rcard__offers">${I('lock-keyhole')}<b>${count}</b> შეთავაზება</span>`;
  const left=state==='open'?`<span class="ma-rcard__left${isSoon(r)?' ma-rcard__left--soon':''}">${I(isSoon(r)?'hourglass':'clock')}${E(leftLabel(r))}</span>`:`<span class="ma-rcard__left">${E(stateLabels[state]||'')}</span>`;
  const cls=['ma-rcard',isOwner?'ma-rcard--mine':'',state!=='open'?'ma-rcard--closed':''].filter(Boolean).join(' ');
  return `<article class="${cls}">
   <div class="ma-rcard__top">${media}<div class="ma-rcard__kicker"><span class="ma-eyebrow">${E(categories[r.category]||'')}</span><span class="ma-rcard__time">${E(ago(r.createdAt))}</span></div>${statusBadge(r)}</div>
   <h3 class="ma-rcard__title"><a class="ma-rcard__link" href="${requestHref(r)}">${E(r.title)}</a></h3>
   <p class="ma-rcard__text">${E(r.body)}</p>
   <ul class="ma-facts">${facts}</ul>
   <div class="ma-rcard__foot">${isOwner?'<span class="ma-badge ma-badge--info ma-badge--plain">შენი მოთხოვნა</span>':''}${offers}${isOwner?'':left}</div>
  </article>`;
 }
 const skeletonCard=()=>`<article class="ma-rcard ma-rcard--skeleton" aria-hidden="true"><div class="ma-rcard__top"><span class="ma-skel ma-skel--tile"></span><div class="ma-rcard__kicker" style="gap:8px"><span class="ma-skel ma-skel--line ma-skel--w60"></span><span class="ma-skel ma-skel--line ma-skel--w40"></span></div></div><span class="ma-skel ma-skel--title"></span><span class="ma-skel ma-skel--title ma-skel--w60"></span><span class="ma-skel ma-skel--line ma-skel--w90"></span><div class="ma-rcard__foot"><span class="ma-skel ma-skel--line ma-skel--w40"></span></div></article>`;

 // CompanyCard (spec §5): initials, name, badge, industry, city / service cities, stats or „ახალი წევრი“.
 function companyCard(c){
  const st=S.companyStats(c.id),serves=serviceOnly(c);
  const foot=st.sent>=NEW_MEMBER
   ?`<div class="ma-ccard__stats"><span><b>${st.sent}</b> შეთავაზება</span><span><b>${st.chosen}</b> არჩეული</span></div>`
   :`<span class="ma-badge ma-badge--accent">ახალი წევრი</span><span class="ma-xs ma-muted">${E(memberSince(c.createdAt))}</span>`;
  return `<article class="ma-ccard">
   <div class="ma-ccard__head">${avatar(c.company,'ma-avatar--lg')}<div class="ma-ccard__id"><h3 class="ma-ccard__name"><a class="ma-ccard__link" href="${companyHref(c.id)}">${E(c.company)}</a></h3>${c.verified?`<div class="ma-ccard__badges">${verifiedBadge(c)}</div>`:''}</div></div>
   <span class="ma-eyebrow">${E(categories[c.industry]||'')}</span>
   ${c.about?`<p class="ma-ccard__about">${E(c.about)}</p>`:''}
   <ul class="ma-facts"><li class="ma-fact">${I('map-pin')}${E(cityName(c.city))}</li>${serves?`<li class="ma-fact">${I('truck')}<span>ემსახურება: ${E(serves)}</span></li>`:''}</ul>
   <div class="ma-ccard__foot">${foot}</div>
  </article>`;
 }
 const skeletonCompany=()=>`<article class="ma-ccard" aria-hidden="true"><div class="ma-skeleton ma-stack" style="--gap:12px"><div class="ma-ccard__head"><span class="ma-skel ma-skel--tile" style="width:56px;height:56px"></span><div class="ma-ccard__id" style="flex:1;gap:8px"><span class="ma-skel ma-skel--title"></span><span class="ma-skel ma-skel--line ma-skel--w40"></span></div></div><span class="ma-skel ma-skel--line ma-skel--w90"></span><span class="ma-skel ma-skel--line ma-skel--w60"></span></div></article>`;

 // ContactCard (spec §5): name, company, phone (tel:) and email (mailto:), each with „დაკოპირება“.
 function contactCard(c,{eyebrow,title,org,id}){
  const tel=String(c.phone||'').replace(/[^\d+]/g,'');
  return `<section class="ma-contact" id="${id}" tabindex="-1" aria-labelledby="${id}-name">
   <header class="ma-contact__head"><span class="ma-contact__badge">${I('handshake')}</span><div><span class="ma-eyebrow">${E(eyebrow)}</span><h3 class="ma-contact__name" id="${id}-name">${E(title)}</h3>${org?`<p class="ma-contact__org">${E(org)}</p>`:''}</div></header>
   <ul class="ma-contact__rows">
    ${c.phone?`<li class="ma-contact__row">${I('phone')}<div class="ma-contact__val"><span class="ma-contact__label">ტელეფონი</span><a class="ma-contact__value" href="tel:${E(tel)}">${E(c.phone)}</a></div><div class="ma-contact__acts"><a class="ma-btn ma-btn--primary" href="tel:${E(tel)}">${I('phone')}დარეკვა</a><button type="button" class="ma-btn ma-btn--secondary" data-ma-copy="${E(c.phone)}">${I('copy')}დაკოპირება</button></div></li>`:''}
    ${c.email?`<li class="ma-contact__row">${I('mail')}<div class="ma-contact__val"><span class="ma-contact__label">ელფოსტა</span><a class="ma-contact__value" href="mailto:${E(c.email)}">${E(c.email)}</a></div><div class="ma-contact__acts"><a class="ma-btn ma-btn--secondary" href="mailto:${E(c.email)}">${I('mail')}წერილი</a><button type="button" class="ma-btn ma-btn--secondary" data-ma-copy="${E(c.email)}">${I('copy')}დაკოპირება</button></div></li>`:''}
   </ul>
  </section>`;
 }
 // Contact of the other side: the author sees the chosen company, the chosen company sees the author.
 function contactFor(r,asAuthor,id='contact-card'){
  const c=S.contactFor(r);if(!c)return '';
  return asAuthor
   ?contactCard(c,{id,eyebrow:'კონტაქტი გაიხსნა',title:c.company||c.name,org:c.company&&c.name&&c.name!==c.company?'საკონტაქტო პირი: '+c.name:''})
   :contactCard(c,{id,eyebrow:'დამკვეთის კონტაქტი',title:c.name||c.company,org:c.company&&c.company!==c.name?c.company:''});
 }

 /* ---------- offers: terms, summary, card ---------- */
 const deliveryText=d=>d===0?'მიწოდება იმავე დღეს':'მიწოდება '+d+' დღეში';
 function offerPrice(o){
  if(o.priceType==='negotiable')return {amount:'შეთანხმებით',text:true,unit:'ფასი'};
  return {amount:money(o.price),text:false,unit:o.priceType==='unit'?'ერთეულის ფასი':'ჯამური ფასი'};
 }
 function offerTerms(o){
  const t=[];
  if(o.priceType!=='negotiable')t.push(o.vatIncluded?`<span class="ma-term ma-term--yes">${I('check')}დღგ-ს ჩათვლით</span>`:`<span class="ma-term">${I('receipt')}დღგ-ს გარეშე</span>`);
  if(o.deliveryDays!=null)t.push(`<span class="ma-term">${I('truck')}${E(deliveryText(o.deliveryDays))}</span>`);
  if(o.deliveryIncluded)t.push(`<span class="ma-term ma-term--yes">${I('check')}მიწოდება შედის ფასში</span>`);
  return t.length?`<div class="ma-ocard__terms">${t.join('')}</div>`:'';
 }
 // One line: „48 ₾ · ერთეულის ფასი · დღგ-ს ჩათვლით · მიწოდება 10 დღეში“.
 function offerSummary(o){
  const p=offerPrice(o),parts=[p.text?'ფასი შეთანხმებით':p.amount+' · '+p.unit];
  if(o.priceType!=='negotiable')parts.push(o.vatIncluded?'დღგ-ს ჩათვლით':'დღგ-ს გარეშე');
  if(o.deliveryDays!=null)parts.push(deliveryText(o.deliveryDays));
  if(o.deliveryIncluded)parts.push('მიწოდება შედის ფასში');
  return parts.join(' · ');
 }
 const longText=s=>String(s||'').length>180||(String(s||'').match(/\n/g)||[]).length>=3;
 function offerBody(o,id){
  if(!o.body)return '';
  const long=longText(o.body);
  return `<p class="ma-ocard__body${long?' ma-clamp-3':''}" id="${id}">${E(o.body)}</p>${long?`<button type="button" class="ma-link ma-ocard__more" data-ma-more aria-controls="${id}" aria-expanded="false">მეტის ნახვა</button>`:''}`;
 }
 const statsLine=c=>{const st=S.companyStats(c.id);return st.sent>=NEW_MEMBER?`${st.sent} გაგზავნილი · ${st.chosen} არჩეული`:'ახალი წევრი';};
 // OfferCard for the author (and admin): default / new / chosen / declined.
 function offerCard(o,r,{canChoose,isNew}){
  const c=S.userById(o.companyUserId)||{id:o.companyUserId,company:'კომპანია',city:''};
  const p=offerPrice(o),chosen=o.status==='chosen',declined=o.status==='declined',fresh=isNew&&!chosen&&!declined;
  const cls=['ma-ocard',chosen?'ma-ocard--chosen':'',declined?'ma-ocard--declined':'',fresh?'ma-ocard--new':''].filter(Boolean).join(' ');
  const edited=o.updatedAt&&Date.parse(o.updatedAt)-Date.parse(o.createdAt)>60000;
  const meta=[cityName(c.city),declined?'არ აირჩიეს':statsLine(c),ago(o.createdAt)+(edited?' · განახლდა':'')].filter(Boolean);
  return `<article class="${cls}" id="offer-${E(o.id)}" aria-label="${E(c.company)} — შეთავაზება">
   <header class="ma-ocard__head">${avatar(c.company)}
    <div class="ma-ocard__who"><div class="ma-ocard__name-row"><a class="ma-ocard__name" href="${companyHref(c.id)}">${E(c.company)}</a>${chosen?`<span class="ma-badge ma-badge--success">${I('check')}არჩეულია</span>`:verifiedBadge(c)}${fresh?'<span class="ma-sr-only">ახალი შეთავაზება</span>':''}</div>
     <div class="ma-meta">${meta.map(x=>`<span>${E(x)}</span>`).join('')}</div></div>
    <div class="ma-ocard__price"><span class="ma-ocard__amount${p.text?' ma-ocard__amount--text':''}">${E(p.amount)}</span><span class="ma-ocard__unit">${E(p.unit)}</span></div>
   </header>
   ${offerTerms(o)}
   ${offerBody(o,'ob-'+o.id)}
   ${canChoose&&!declined&&!chosen?`<footer class="ma-ocard__actions"><a class="ma-btn ma-btn--secondary" href="${companyHref(c.id)}">კომპანიის პროფილი</a><button type="button" class="ma-btn ma-btn--primary" data-choose="${E(o.id)}">${I('check')}არჩევა</button></footer>`:''}
  </article>`;
 }

 /* ---------- sheets: confirm (ChooseSheet and friends) and „შედგა!“ ---------- */
 function sheetEl(id,cls='ma-sheet'){
  let d=document.getElementById(id);
  if(!d){d=document.createElement('dialog');d.id=id;document.body.append(d);}
  d.className=cls;d.setAttribute('aria-labelledby',id+'-title');
  return d;
 }
 const openSheet=d=>{if(Shell)Shell.openSheet(d);else d.showModal();};
 const closeSheet=d=>{if(Shell)Shell.closeSheet(d,true);else if(d.open)d.close();};
 const sheetHead=(id,title)=>`<div class="ma-sheet__header"><h2 class="ma-sheet__title" id="${id}-title">${E(title)}</h2><button type="button" class="ma-sheet__close" data-ma-sheet-close aria-label="დახურვა">${I('x')}</button></div>`;
 // Irreversible or destructive actions go through one sheet that states the consequences.
 // Loading and errors stay inside the sheet (spec §5 ChooseSheet).
 function confirmSheet({title,text='',summary='',bullets=[],confirmLabel,confirmIcon='',danger=false,errorTitle='ვერ შესრულდა',action,after}){
  const d=sheetEl('ma-confirm');
  d.innerHTML=`${sheetHead('ma-confirm',title)}
   <div class="ma-sheet__body">${summary?`<p class="ma-confirm__summary">${E(summary)}</p>`:''}${text?`<p class="ma-lead">${E(text)}</p>`:''}
    ${bullets.length?`<ul class="ma-consequences">${bullets.map(([ic,t])=>`<li><span class="ma-consequences__icon">${I(ic)}</span><span>${E(t)}</span></li>`).join('')}</ul>`:''}
    <div data-confirm-error></div></div>
   <div class="ma-sheet__footer"><button type="button" class="ma-btn ma-btn--secondary" data-ma-sheet-close>გაუქმება</button><button type="button" class="ma-btn ${danger?'ma-btn--danger':'ma-btn--primary'}" data-confirm-ok>${confirmIcon?I(confirmIcon):''}<span>${E(confirmLabel)}</span></button></div>`;
  const ok=$('[data-confirm-ok]',d),errBox=$('[data-confirm-error]',d);
  ok.addEventListener('click',async()=>{
   if(ok.classList.contains('is-loading'))return;
   ok.classList.add('is-loading');ok.setAttribute('aria-busy','true');errBox.innerHTML='';
   try{await action();closeSheet(d);after?.();}
   catch(err){if(!err.userMessage)console.error(err);errBox.innerHTML=alertBox('danger',errorTitle,err.userMessage||'რაღაც ვერ შესრულდა. სცადე თავიდან.');}
   finally{ok.classList.remove('is-loading');ok.removeAttribute('aria-busy');}
  });
  openSheet(d);
 }
 function celebrate(requestId){
  const r=S.getRequest(requestId);if(!r)return;
  const d=sheetEl('ma-celebrate','ma-sheet ma-sheet--celebrate');
  d.innerHTML=`<div class="ma-sheet__header" style="padding-bottom:0"><span style="flex:1"></span><button type="button" class="ma-sheet__close" data-ma-sheet-close aria-label="დახურვა">${I('x')}</button></div>
   <div class="ma-sheet__body"><span class="ma-celebrate__mark">${I('handshake')}</span><h2 class="ma-celebrate__title" id="ma-celebrate-title">შედგა!</h2><p class="ma-lead">კონტაქტები გაიხსნა ორივე მხარისთვის. დაუკავშირდი და შეათანხმეთ დეტალები.</p>${contactFor(r,true,'contact-card-sheet')}</div>
   <div class="ma-sheet__footer"><button type="button" class="ma-btn ma-btn--primary ma-btn--block" data-ma-sheet-close>გასაგებია</button></div>`;
  d.addEventListener('close',()=>{$('#contact-card')?.focus();},{once:true});
  openSheet(d);
 }

 /* ---------- small utilities ---------- */
 let legacyToastTimer;
 function toast(message,type='success'){
  if(Shell)return Shell.toast(message,{type});
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.append(t);}
  t.textContent=message;t.classList.add('market-toast','is-visible');clearTimeout(legacyToastTimer);legacyToastTimer=setTimeout(()=>t.classList.remove('is-visible'),3200);
 }
 // Re-rendering keeps keyboard focus on the control that had it (matched by id).
 function keepFocus(root,fn){
  const a=document.activeElement,id=a&&root.contains(a)?a.id:'';
  fn();
  if(id){const el=document.getElementById(id);if(el&&el!==document.activeElement)el.focus({preventScroll:true});}
 }
 function setQuery(obj,defaults={}){
  const q=new URLSearchParams();
  for(const [k,v] of Object.entries(obj))if(v&&v!==defaults[k])q.set(k,v);
  const s=q.toString();
  history.replaceState(history.state,'',location.pathname+(s?'?'+s:''));
 }
 const debounce=(fn,ms)=>{let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
 async function busy(control,fn){if(control?.disabled)return;if(control)control.disabled=true;try{return await fn();}finally{if(control)control.disabled=false;}}
 async function shareRequest(r){
  const url=location.origin+requestHref(r);
  if(navigator.share){try{await navigator.share({title:r.title,text:r.title+' — MeetAny',url});return;}catch(err){if(err?.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(url);toast('ბმული დაკოპირდა.','info');}catch{toast(url,'info');}
 }

 /* ======================================================================
    Legacy dialogs (auth, new request) — kept until the full-page redesign (spec §4.4, §4.8)
    ====================================================================== */
 function dialogShell(){
  let dialog=$('#form-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='form-dialog';dialog.setAttribute('aria-labelledby','form-title');dialog.innerHTML=`<button class="close-button" data-close aria-label="დახურვა">${I('x')}</button><div id="form-content"></div>`;document.body.append(dialog);}
  if(!dialog.dataset.bound){dialog.dataset.bound='1';dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))dialog.close();});}
  return dialog;
 }
 function openDialog(html,kind=''){Shell?.closeMenu?.();const dialog=dialogShell();$('#form-content').innerHTML=html;dialog.dataset.market=kind||'dialog';if(!dialog.open)dialog.showModal();dialog.scrollTop=0;return dialog;}
 function closeDialog(){const d=$('#form-dialog');if(d?.open)d.close();}
 function showError(form,err){let box=$('.m-error',form);if(!box){box=document.createElement('p');box.className='m-error';box.setAttribute('role','alert');form.prepend(box);}box.textContent=err.userMessage||'რაღაც ვერ შესრულდა. სცადე თავიდან.';box.scrollIntoView({block:'nearest'});if(!err.userMessage)console.error(err);}
 const formData=form=>Object.fromEntries(new FormData(form).entries());
 const submitOf=form=>form.querySelector('[type="submit"]');
 const optionList=(obj,selected,blank)=>(blank?`<option value="">${E(blank)}</option>`:'')+Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===selected?'selected':''}>${E(v)}</option>`).join('');

 /* ---------- auth ---------- */
 const seg=mode=>`<div class="m-seg" role="tablist"><button type="button" role="tab" aria-selected="${mode!=='register'}" data-auth-mode="login">შესვლა</button><button type="button" role="tab" aria-selected="${mode==='register'}" data-auth-mode="register">რეგისტრაცია</button></div>`;
 function authFormHtml(mode,role){
  if(mode==='reset')return resetHtml();
  if(mode!=='register')return `${seg('login')}<form id="login-form" class="m-form" novalidate>
    <div class="m-field"><label for="login-email">ელფოსტა</label><input id="login-email" name="email" type="email" required autocomplete="email" placeholder="name@company.ge"></div>
    <div class="m-field"><label for="login-password">პაროლი</label><input id="login-password" name="password" type="password" autocomplete="current-password"></div>
    <button class="m-btn m-btn-primary m-btn-block" type="submit">შესვლა ${I('arrow-right')}</button>
    <p class="m-hint" style="margin:0"><button type="button" class="m-link" data-auth-mode="reset">დაგავიწყდა პაროლი?</button></p>
   </form>`;
  const company=role==='company';
  return `${seg('register')}<form id="register-form" class="m-form" novalidate>
   <fieldset class="m-roles"><legend>ვინ ხარ?</legend>
    <label><input type="radio" name="role" value="client" ${company?'':'checked'}><span><b>მჭირდება მომსახურება ან პროდუქცია</b><small>დაწერე მოთხოვნა და მიიღე შეთავაზებები</small></span></label>
    <label><input type="radio" name="role" value="company" ${company?'checked':''}><span><b>ვთავაზობ მომსახურებას ან პროდუქციას</b><small>ნახე მოთხოვნები და გაუგზავნე შეთავაზება</small></span></label>
   </fieldset>
   <div class="m-grid2"><div class="m-field"><label for="reg-name">სახელი და გვარი *</label><input id="reg-name" name="name" required maxlength="80" autocomplete="name"></div>
    <div class="m-field"><label for="reg-company" data-company-label>${company?'კომპანიის დასახელება *':'კომპანია / ობიექტი <small>არასავალდებულო</small>'}</label><input id="reg-company" name="company" maxlength="100" autocomplete="organization"></div></div>
   <div class="m-grid2"><div class="m-field"><label for="reg-phone">მობილური ტელეფონი *</label><input id="reg-phone" name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="+995 5XX XXX XXX" value="+995 "><span class="m-hint">ჩანს მხოლოდ მაშინ, როცა შეთავაზება აირჩევა.</span></div>
    <div class="m-field"><label for="reg-email">ელფოსტა *</label><input id="reg-email" name="email" type="email" required maxlength="120" autocomplete="email" placeholder="name@company.ge"></div></div>
   <div class="m-grid2"><div class="m-field"><label for="reg-city">ქალაქი *</label><select id="reg-city" name="city" required>${optionList(cities,'tbilisi')}</select></div>
    <div class="m-field" data-industry-field ${company?'':'hidden'}><label for="reg-industry">საქმიანობის მიმართულება *</label><select id="reg-industry" name="industry">${optionList(categories,'','აირჩიე')}</select></div></div>
   <div class="m-field"><label for="reg-password">პაროლი *</label><input id="reg-password" name="password" type="password" required minlength="${S.PASSWORD_MIN}" autocomplete="new-password"><span class="m-hint">მინიმუმ ${S.PASSWORD_MIN} სიმბოლო.</span></div>
   <label class="m-check"><input type="checkbox" name="acceptTerms" value="1" required><span>ვეთანხმები <a href="/terms/" target="_blank" rel="noopener">წესებსა და პერსონალური მონაცემების დამუშავებას</a></span></label>
   <button class="m-btn m-btn-primary m-btn-block" type="submit">ანგარიშის შექმნა ${I('arrow-right')}</button>
  </form>`;
 }
 function resetHtml(){
  const email=S.pendingResetEmail();
  if(!email)return `<h2 style="font-size:20px;margin:0 0 6px">პაროლის აღდგენა</h2><p class="m-hint" style="margin:0 0 14px">მიუთითე ანგარიშის ელფოსტა. გამოგიგზავნით კოდს, რომლითაც ახალ პაროლს დააყენებ.</p>
   <form id="reset-request-form" class="m-form" novalidate><div class="m-field"><label for="reset-email">ელფოსტა</label><input id="reset-email" name="email" type="email" required autocomplete="email"></div>
   <button class="m-btn m-btn-primary m-btn-block" type="submit">კოდის გაგზავნა ${I('send')}</button>
   <p class="m-hint" style="margin:0"><button type="button" class="m-link" data-auth-mode="login">დაბრუნება შესვლაზე</button></p></form>`;
  return `<div class="m-success" role="status"><h3>${I('mail')} ${E(S.CHECK_EMAIL_MESSAGE)}</h3><p>კოდი გაიგზავნა მისამართზე ${E(email)}, თუ ასეთი ანგარიში არსებობს.</p></div>
   <form id="reset-form" class="m-form" novalidate style="margin-top:16px"><div class="m-field"><label for="reset-code">ელფოსტაზე მიღებული კოდი</label><input id="reset-code" name="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="10"></div>
   <div class="m-field"><label for="reset-password">ახალი პაროლი</label><input id="reset-password" name="password" type="password" required minlength="${S.PASSWORD_MIN}" autocomplete="new-password"><span class="m-hint">მინიმუმ ${S.PASSWORD_MIN} სიმბოლო.</span></div>
   <button class="m-btn m-btn-primary m-btn-block" type="submit">პაროლის შეცვლა და შესვლა ${I('arrow-right')}</button>
   <p class="m-hint" style="margin:0"><button type="button" class="m-link" data-reset-again>სხვა ელფოსტა ან ახალი კოდი</button></p></form>`;
 }
 function checkEmailHtml(email){return `${seg('register')}
   <div class="m-success" role="status"><h3>${I('mail')} ${E(S.CHECK_EMAIL_MESSAGE)}</h3><p>${E(email)}</p></div>
   <form id="code-form" class="m-form" novalidate style="margin-top:16px">
    <div class="m-field"><label for="otp-code">ელფოსტაზე მიღებული კოდი</label><input id="otp-code" name="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="10"></div>
    <button class="m-btn m-btn-primary m-btn-block" type="submit">დადასტურება ${I('arrow-right')}</button>
    <p class="m-hint" style="margin:0"><button type="button" class="m-link" data-resend-code>კოდის ხელახლა გაგზავნა</button></p>
   </form>`;}
 function completeProfileHtml(p){
  const box=document.createElement('div');box.innerHTML=authFormHtml('register',p.role);
  const form=$('#register-form',box);
  for(const [k,v] of Object.entries(p))if(v&&form.elements[k]&&form.elements[k].type!=='radio')form.elements[k].setAttribute('value',v);
  const email=form.elements.email;email.setAttribute('value',p.email||'');email.setAttribute('readonly','');
  form.elements.password.closest('.m-field').remove();
  return box.innerHTML;
 }
 function showAuthState(root,onDone,err){
  if(S.needsProfile()){root.innerHTML=completeProfileHtml(S.pendingProfile()||{});bindAuthForms(root,onDone);if(err&&err.code!=='PROFILE_REQUIRED')showError($('#register-form',root),err);return true;}
  return false;
 }
 function welcome(user,onDone){toast('შეხვედი როგორც '+user.company);onDone?.(user);}
 function showCodeStep(root,onDone,email){root.innerHTML=checkEmailHtml(email);bindAuthForms(root,onDone);$('#otp-code',root)?.focus();}
 function bindAuth(root,{onDone}={}){
  root.addEventListener('click',e=>{
   const tab=e.target.closest('[data-auth-mode]');if(tab){root.innerHTML=authFormHtml(tab.dataset.authMode);bindAuthForms(root,onDone);root.querySelector('input:not([type=radio])')?.focus();}
  });
  bindAuthForms(root,onDone);
 }
 function bindAuthForms(root,onDone){
  const reg=$('#register-form',root),login=$('#login-form',root),code=$('#code-form',root),resetReq=$('#reset-request-form',root),reset=$('#reset-form',root);
  if(reg){
   reg.addEventListener('change',e=>{if(e.target.name==='role'){const company=e.target.value==='company';$('[data-industry-field]',reg).hidden=!company;$('[data-company-label]',reg).innerHTML=company?'კომპანიის დასახელება *':'კომპანია / ობიექტი <small>არასავალდებულო</small>';}});
   reg.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(reg),async()=>{try{const d=formData(reg);const user=await S.register({...d,acceptTerms:!!d.acceptTerms});if(user.confirmationPending){showCodeStep(root,onDone,user.email);toast(S.CHECK_EMAIL_MESSAGE,'info');return;}toast('ანგარიში შეიქმნა. მოგესალმებით, '+user.name.split(' ')[0]+'!');onDone?.(user);}catch(err){if(err.code==='PROFILE_REQUIRED'&&showAuthState(root,onDone))return;showError(reg,err);}});});
  }
  if(code){
   code.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(code),async()=>{try{const user=await S.verifyEmailCode(code.elements.code.value);toast('ანგარიში შეიქმნა. მოგესალმებით, '+user.name.split(' ')[0]+'!');onDone?.(user);}catch(err){if(showAuthState(root,onDone,err))return;showError(code,err);}});});
   const resend=$('[data-resend-code]',code);
   resend.addEventListener('click',()=>busy(resend,async()=>{try{await S.resendCode();toast(S.CHECK_EMAIL_MESSAGE,'info');}catch(err){showError(code,err);}}));
  }
  if(login)login.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(login),async()=>{const d=formData(login);try{welcome(await S.login(d.email,d.password),onDone);}catch(err){if(err.code==='MA408'){showCodeStep(root,onDone,S.pendingEmail()||d.email);toast(S.CHECK_EMAIL_MESSAGE,'info');return;}if(showAuthState(root,onDone,err))return;showError(login.isConnected?login:($('#login-form')||login),err);}});});
  if(resetReq)resetReq.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(resetReq),async()=>{try{await S.requestPasswordReset(resetReq.elements.email.value);root.innerHTML=resetHtml();bindAuthForms(root,onDone);$('#reset-code',root)?.focus();}catch(err){showError(resetReq,err);}});});
  if(reset){
   reset.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(reset),async()=>{try{const d=formData(reset);welcome(await S.resetPassword(d.code,d.password),onDone);}catch(err){if(showAuthState(root,onDone,err))return;showError(reset,err);}});});
   $('[data-reset-again]',reset).addEventListener('click',()=>{try{sessionStorage.removeItem('meetany.resetEmail');}catch{}location.reload();});
  }
 }
 function openAuth(mode='login',role){
  openDialog(`<h2 id="form-title">${mode==='register'?'შექმენი ანგარიში':'შედი ანგარიშში'}</h2><p class="m-dialog-lead">${role==='company'?'დაარეგისტრირე კომპანია და უპასუხე ბიზნესების მოთხოვნებს.':'კლიენტები წერენ მოთხოვნებს, კომპანიები კი უგზავნიან შეთავაზებებს.'}</p><div id="auth-root">${authFormHtml(mode,role)}</div>`,'auth');
  bindAuth($('#auth-root'),{onDone:closeDialog});
 }

 /* ---------- document-level actions (header, menu, footer, cards) ---------- */
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-market="logout"]');if(!b)return;
  e.preventDefault();
  busy(b,async()=>{try{await S.logout();closeDialog();toast('გამოხვედი ანგარიშიდან.','info');if(['account','admin'].includes(page))location.href=url('/account/');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
 });
 // Legacy "add company" buttons lead to a real company registration (app.js has a demo form for them).
 document.addEventListener('click',e=>{const add=e.target.closest('[data-action="add-company"]');if(add){e.preventDefault();e.stopImmediatePropagation();if(S.currentUser())location.href=url('/account/');else openAuth('register','company');}},true);

 /* ---------- request form dialog (create + edit), with quantity + unit and needed-by ---------- */
 function resizePhoto(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.size)return resolve(null);
   if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))return reject(Object.assign(new Error(),{userMessage:'ატვირთე JPG, PNG, WEBP ან GIF სურათი.'}));
   if(file.size>12*1024*1024)return reject(Object.assign(new Error(),{userMessage:'სურათი უნდა იყოს 12 MB-ზე ნაკლები.'}));
   const img=new Image(),url=URL.createObjectURL(file);
   img.onload=()=>{const scale=Math.min(1,1400/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',0.82));};
   img.onerror=()=>{URL.revokeObjectURL(url);reject(Object.assign(new Error(),{userMessage:'სურათი ვერ წავიკითხეთ.'}));};
   img.src=url;
  });
 }
 function openRequestForm({edit=null,category=''}={}){
  const u=S.currentUser();
  if(!u){openAuth('login');toast('მოთხოვნის დასამატებლად შედი ანგარიშში ან დარეგისტრირდი.','info');return;}
  const r=edit||{};
  const today=S.todayDate(),max=S.maxNeededBy();
  // An edited request may keep a stored date that is in the past now (the server accepts it unchanged).
  const minDate=r.neededBy&&r.neededBy<today?r.neededBy:today;
  openDialog(`<span class="section-kicker">${edit?'მოთხოვნის რედაქტირება':'ახალი მოთხოვნა'}</span><h2 id="form-title">${edit?'შეასწორე მოთხოვნა':'რა გჭირდება?'}</h2>
   <p class="m-dialog-lead">${edit?'შეცვლა შესაძლებელია, სანამ პირველი შეთავაზება მოვა.':'მოკლედ აღწერე საჭიროება. კომპანიები გამოგიგზავნიან შეთავაზებებს, რომლებსაც მხოლოდ შენ ნახავ.'}</p>
   <form id="request-form" class="m-form" novalidate>
    <div class="m-field"><label for="nr-title">სათაური *</label><input id="nr-title" name="title" required minlength="5" maxlength="120" value="${E(r.title)}" placeholder="მაგ.: 1000 საბანკეტო სკამი, ბათუმი"></div>
    <div class="m-grid2"><div class="m-field"><label for="nr-category">კატეგორია *</label><select id="nr-category" name="category" required>${optionList(categories,r.category||category,'აირჩიე კატეგორია')}</select></div>
    <div class="m-field"><label for="nr-city">ქალაქი *</label><select id="nr-city" name="city" required>${optionList(cities,r.city||u.city||'tbilisi')}</select></div></div>
    <div class="m-grid2"><div class="m-field"><label for="nr-quantity">რაოდენობა <small>არასავალდებულო</small></label><div class="m-qty"><input id="nr-quantity" name="quantity" inputmode="decimal" autocomplete="off" maxlength="16" value="${r.quantity!=null?E(String(r.quantity).replace('.',',')):''}" placeholder="მაგ.: 1000"><select name="unit" aria-label="რაოდენობის ერთეული">${optionList(units,r.unit||'pcs')}</select></div></div>
    <div class="m-field"><label for="nr-needed">საჭიროა თარიღამდე <small>არასავალდებულო</small></label><input id="nr-needed" name="neededBy" type="date" min="${minDate}" max="${max}" value="${E(r.neededBy)}"></div></div>
    <div class="m-field"><label for="nr-body">აღწერა *</label><textarea id="nr-body" name="body" required minlength="10" maxlength="2000" rows="5" placeholder="ზომა, მასალა, ხარისხი, მიწოდების ადგილი…">${E(r.body)}</textarea><span class="m-hint">კარგი მოთხოვნა: რაოდენობა, ზომა/მასალა, მიწოდების ადგილი, ვადა.</span></div>
    ${edit?'':`<div class="m-field m-file"><span class="m-label">ფოტო <small>არასავალდებულო · JPG, PNG, WEBP</small></span>
     <label class="m-file-drop">${I('upload')}<span data-file-label>აირჩიე ფოტო ან ჩააგდე აქ</span><input id="nr-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
     <div class="m-file-preview" hidden><img alt="არჩეული ფოტო"><button type="button" class="m-btn m-btn-ghost m-btn-sm" data-photo-remove>${I('trash-2')} მოშორება</button></div></div>`}
    <p class="m-hint" style="margin:0">${I('clock')} მოთხოვნა ${S.REQUEST_DAYS} დღე იქნება აქტიური. ვადის გაგრძელება შეგიძლია მოთხოვნის გვერდიდან.</p>
    <div class="m-dialog-actions"><button type="button" class="m-btn m-btn-secondary" data-close>გაუქმება</button><button class="m-btn m-btn-primary" type="submit">${edit?'შენახვა':'გამოქვეყნება'} ${I('arrow-right')}</button></div>
   </form>`,'request');
  const form=$('#request-form');let photo=null;
  const input=form.elements.photo;
  if(input){
   const preview=$('.m-file-preview',form),label=$('[data-file-label]',form);
   const setPhoto=(data,name)=>{photo=data;preview.hidden=!data;if(data)$('img',preview).src=data;label.textContent=data?name:'აირჩიე ფოტო ან ჩააგდე აქ';};
   input.addEventListener('change',async e=>{const f=e.target.files[0];try{setPhoto(await resizePhoto(f),f?.name||'');}catch(err){e.target.value='';setPhoto(null);showError(form,err);}});
   $('[data-photo-remove]',form).addEventListener('click',()=>{input.value='';setPhoto(null);});
  }
  form.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(form),async()=>{try{const d=formData(form);delete d.photo;
   // updateRequest replaces every field: quantity, unit and neededBy are always sent (blank = cleared).
   if(edit){await S.updateRequest(edit.id,d);closeDialog();toast('მოთხოვნა განახლდა.');return;}
   const created=await S.createRequest({...d,photo});closeDialog();toast('მოთხოვნა გამოქვეყნდა.');location.href=requestHref(created);}catch(err){showError(form,err);}});});
 }
 document.addEventListener('click',e=>{
  const nr=e.target.closest('[data-market="new-request"]');if(nr){e.preventDefault();Shell?.closeMenu?.();openRequestForm({category:nr.dataset.category||''});return;}
  if(e.target.closest('[data-market="login"]')){e.preventDefault();openAuth('login');return;}
  if(e.target.closest('[data-market="register-company"]')){e.preventDefault();openAuth('register','company');return;}
  const ed=e.target.closest('[data-edit-request]');if(ed){const r=S.getRequest(ed.dataset.editRequest);if(r)openRequestForm({edit:r});}
 });

 /* ======================================================================
    4.2 Requests list /requests/?category=&city=&q=&sort=
    ====================================================================== */
 const RQ_SORTS={new:'ახალი',ending:'მალე იწურება',few:'ცოტა შეთავაზებით'};
 const RQ_DEFAULTS={sort:'new'};
 let rqLimit=PAGE_SIZE;
 function rqFilters(){
  const p=params();
  const category=csv(p.get('category')).find(k=>Object.hasOwn(categories,k))||'';
  const city=csv(p.get('city')).filter(k=>Object.hasOwn(cities,k)).join(',');
  const sort=Object.hasOwn(RQ_SORTS,p.get('sort'))?p.get('sort'):'new';
  return {q:(p.get('q')||'').trim().slice(0,200),category,city,sort};
 }
 // A request for „მთელი საქართველო“ is relevant to every city filter.
 const rqMatchCity=(r,city)=>!city||city.split(',').includes(r.city)||r.city==='georgia';
 function rqList(f,{ignore}={}){
  let list=S.listRequests({q:f.q,category:ignore==='category'?'':f.category}).filter(r=>rqMatchCity(r,f.city));
  if(f.sort==='ending')list=list.sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt));
  if(f.sort==='few')list=list.sort((a,b)=>S.offerCount(a.id)-S.offerCount(b.id)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return list;
 }
 // Company interests for the „შეიძლება დაინტერესდე“ row: its industry and the cities it serves.
 function companyInterest(u){
  if(u?.role!=='company')return null;
  const list=[...new Set([u.city,...(u.serviceCities||[])])].filter(k=>cities[k]);
  return {industry:Object.hasOwn(categories,u.industry)?u.industry:'',cities:list.includes('georgia')?'':list.join(',')};
 }
 function cityOptions(selected,allLabel){
  const multi=csv(selected).length>1;
  return `<option value="">${E(allLabel)}</option>${multi?`<option value="${E(selected)}" selected>შენი ქალაქები (${csv(selected).length})</option>`:''}${Object.entries(cities).map(([k,v])=>`<option value="${k}"${!multi&&k===selected?' selected':''}>${E(v)}</option>`).join('')}`;
 }
 function mountRequests(root){
  const f=rqFilters(),u=S.currentUser(),interest=companyInterest(u);
  rqLimit=PAGE_SIZE;
  const catPill=(k,label)=>`<button type="button" class="ma-pill" data-cat="${k}" aria-pressed="false">${k?I(catIcon[k]):''}<span>${E(label)}</span><span class="ma-pill__count">0</span></button>`;
  const suggest=interest&&(interest.industry||interest.cities)?`<div class="ma-suggest" role="group" aria-labelledby="rq-suggest-label"><span class="ma-suggest__label" id="rq-suggest-label">შეიძლება დაინტერესდე</span><div class="ma-pills ma-pills--scroll">
    ${interest.industry?`<button type="button" class="ma-pill" data-suggest="industry" aria-pressed="false">${I(catIcon[interest.industry])}<span>${E(categories[interest.industry])}</span></button>`:''}
    ${interest.cities?`<button type="button" class="ma-pill" data-suggest="cities" aria-pressed="false">${I('map-pin')}<span>${E(csv(interest.cities).map(cityName).join(', '))}</span></button>`:''}
   </div></div>`:'';
  root.innerHTML=`<div class="ma-container ma-page">
   <div class="ma-page-head"><div class="ma-page-head__text"><h1 class="ma-h1">მოთხოვნები</h1><p class="ma-page-head__count" id="rq-count" aria-live="polite"></p></div></div>
   <div class="ma-filterbar">
    <div class="ma-filterbar__row">
     <form class="ma-filterbar__search ma-search" role="search" id="rq-search"><label class="ma-sr-only" for="rq-q">მოთხოვნების ძიება</label><div class="ma-affix"><span class="ma-affix__icon">${I('search')}</span><input class="ma-input" id="rq-q" name="q" type="search" value="${E(f.q)}" placeholder="რას ეძებ? მაგ. სკამი, ბეტონი" maxlength="200" autocomplete="off" enterkeyhint="search"></div></form>
     <label class="ma-sr-only" for="rq-city">ქალაქი</label><select class="ma-select ma-filterbar__select ma-md-up" id="rq-city">${cityOptions(f.city,'ყველა ქალაქი')}</select>
     <label class="ma-sr-only" for="rq-sort">დალაგება</label><select class="ma-select ma-filterbar__select ma-md-up" id="rq-sort">${Object.entries(RQ_SORTS).map(([k,v])=>`<option value="${k}"${k===f.sort?' selected':''}>დალაგება: ${E(v)}</option>`).join('')}</select>
    </div>
    <div class="ma-pills ma-pills--scroll" role="group" aria-label="კატეგორია" id="rq-cats">
     <button type="button" class="ma-pill ma-pill--trigger ma-md-down" id="rq-filter-open" aria-haspopup="dialog">${I('sliders-horizontal')}<span>ფილტრი</span><span class="ma-pill__count" hidden></span></button>
     ${catPill('','ყველა')}${Object.entries(categories).map(([k,v])=>catPill(k,v)).join('')}
    </div>
    ${suggest}
   </div>
   <div id="rq-results"></div>
  </div>`;
  // Mobile filter sheet: city + sort (no <form>, so closing never asks to discard).
  const sheet=sheetEl('rq-filter-sheet');
  sheet.innerHTML=`${sheetHead('rq-filter-sheet','ფილტრი')}
   <div class="ma-sheet__body"><div class="ma-field"><label class="ma-field__label" for="rq-city-m">ქალაქი</label><select class="ma-select" id="rq-city-m">${cityOptions(f.city,'ყველა ქალაქი')}</select></div>
    <fieldset class="ma-field"><legend class="ma-field__label">დალაგება</legend><div class="ma-stack" style="--gap:0">${Object.entries(RQ_SORTS).map(([k,v])=>`<label class="ma-check"><input type="radio" name="rq-sort-m" value="${k}"${k===f.sort?' checked':''}><span>${E(v)}</span></label>`).join('')}</div></fieldset></div>
   <div class="ma-sheet__footer"><button type="button" class="ma-btn ma-btn--secondary" id="rq-sheet-clear">გასუფთავება</button><button type="button" class="ma-btn ma-btn--primary" id="rq-sheet-show" data-ma-sheet-close>ჩვენება</button></div>`;
  const apply=next=>{setQuery({...rqFilters(),...next},RQ_DEFAULTS);rqLimit=PAGE_SIZE;renderRqResults(root);};
  const q=$('#rq-q',root);
  $('#rq-search',root).addEventListener('submit',e=>{e.preventDefault();apply({q:q.value.trim()});q.blur();});
  q.addEventListener('input',debounce(()=>{if(q.value.trim()!==rqFilters().q)apply({q:q.value.trim()});},300));
  $('#rq-city',root).addEventListener('change',e=>apply({city:e.target.value}));
  $('#rq-sort',root).addEventListener('change',e=>apply({sort:e.target.value}));
  $('#rq-cats',root).addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b&&!b.disabled)apply({category:b.dataset.cat===rqFilters().category?'':b.dataset.cat});});
  $('.ma-suggest',root)?.addEventListener('click',e=>{
   const b=e.target.closest('[data-suggest]');if(!b)return;const cur=rqFilters();
   if(b.dataset.suggest==='industry')apply({category:cur.category===interest.industry?'':interest.industry});
   else apply({city:cur.city===interest.cities?'':interest.cities});
  });
  $('#rq-filter-open',root).addEventListener('click',()=>{syncRqSheet();openSheet(sheet);});
  $('#rq-city-m',sheet).addEventListener('change',e=>apply({city:e.target.value}));
  sheet.addEventListener('change',e=>{if(e.target.name==='rq-sort-m')apply({sort:e.target.value});});
  $('#rq-sheet-clear',sheet).addEventListener('click',()=>apply({city:'',sort:'new'}));
  renderRqResults(root);
 }
 function syncRqSheet(){
  const f=rqFilters(),sheet=$('#rq-filter-sheet');if(!sheet)return;
  const sel=$('#rq-city-m',sheet);if(document.activeElement!==sel)sel.innerHTML=cityOptions(f.city,'ყველა ქალაქი');
  $$('input[name="rq-sort-m"]',sheet).forEach(i=>{i.checked=i.value===f.sort;});
  const n=rqList(f).length;$('#rq-sheet-show',sheet).textContent=n?`${n} მოთხოვნის ჩვენება`:'ჩვენება';
 }
 function renderRqResults(root){
  const f=rqFilters(),u=S.currentUser(),interest=companyInterest(u);
  const list=rqList(f),total=S.listRequests().length;
  // Pills: counts under the other active filters; zero-count pills stay visible but inactive.
  const byCat=rqList(f,{ignore:'category'}).reduce((m,r)=>(m[r.category]=(m[r.category]||0)+1,m),{});
  const allCount=Object.values(byCat).reduce((a,b)=>a+b,0);
  $$('[data-cat]',root).forEach(b=>{
   const k=b.dataset.cat,n=k?byCat[k]||0:allCount,on=k===f.category;
   b.setAttribute('aria-pressed',String(on));b.querySelector('.ma-pill__count').textContent=n;
   b.disabled=!on&&!n&&!!k;b.classList.toggle('is-empty',b.disabled);
  });
  $$('[data-suggest]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.suggest==='industry'?f.category===interest?.industry:!!interest?.cities&&f.city===interest.cities)));
  const city=$('#rq-city',root);if(city&&document.activeElement!==city)city.innerHTML=cityOptions(f.city,'ყველა ქალაქი');
  const sort=$('#rq-sort',root);if(sort)sort.value=f.sort;
  const q=$('#rq-q',root);if(q&&document.activeElement!==q)q.value=f.q;
  const active=(f.city?1:0)+(f.sort!=='new'?1:0),trig=$('#rq-filter-open .ma-pill__count',root);
  if(trig){trig.hidden=!active;trig.textContent=active;$('#rq-filter-open',root).setAttribute('aria-label',active?`ფილტრი, აქტიური: ${active}`:'ფილტრი');}
  $('#rq-count',root).textContent=`${list.length} ღია მოთხოვნა`;
  syncRqSheet();
  const out=$('#rq-results',root);
  if(!total){out.innerHTML=emptyState({iconName:'clipboard-list',title:'ჯერ ღია მოთხოვნა არ არის. იყავი პირველი.',text:'დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ ფასს და პირობებს.',actions:newRequestBtn()});return;}
  if(!list.length){out.innerHTML=emptyState({iconName:'search',title:'ამ ფილტრით მოთხოვნა ვერ მოიძებნა',text:'შეცვალე ან გაასუფთავე ფილტრი.',actions:'<button type="button" class="ma-btn ma-btn--primary" data-rq-clear>ფილტრის გასუფთავება</button>',plain:true});return;}
  const shown=list.slice(0,rqLimit);
  out.innerHTML=`<h2 class="ma-sr-only">შედეგები</h2><div class="ma-grid">${shown.map(requestCard).join('')}</div>${list.length>shown.length?`<div class="ma-more"><button type="button" class="ma-btn ma-btn--secondary" data-rq-more>მეტის ჩვენება (${list.length-shown.length})</button></div>`:''}`;
 }
 document.addEventListener('click',e=>{
  const root=$('#requests-root');if(!root)return;
  if(e.target.closest('[data-rq-clear]')){setQuery({},RQ_DEFAULTS);renderRqResults(root);$('#rq-q',root)?.focus();}
  if(e.target.closest('[data-rq-more]')){const grid=$('#rq-results .ma-grid',root),before=grid?grid.children.length:0;rqLimit+=PAGE_SIZE;renderRqResults(root);$('#rq-results .ma-grid',root)?.children[before]?.querySelector('a')?.focus();}
 });
 function skeletonRequests(root){
  root.innerHTML=`<div class="ma-container ma-page" aria-busy="true"><div class="ma-page-head"><div class="ma-page-head__text"><h1 class="ma-h1">მოთხოვნები</h1><p class="ma-page-head__count">იტვირთება…</p></div></div><div class="ma-skeleton ma-stack" style="--gap:12px;margin-bottom:24px"><span class="ma-skel ma-skel--search"></span><span class="ma-skel ma-skel--pills"></span></div><div class="ma-grid ma-skeleton">${skeletonCard().repeat(6)}</div></div>`;
 }

 /* ======================================================================
    4.3 Request detail /requests/view/?id=
    ====================================================================== */
 const ui={id:null,tab:'offers',sort:'new',editOffer:false,seenBefore:null};
 const currentRequest=()=>{const id=params().get('id');return id?S.getRequest(id):null;};
 // „ახალი“ offers: created after the author's previous visit (localStorage, per request).
 function seenBefore(r){
  if(ui.seenBefore&&ui.seenBefore.id===r.id)return ui.seenBefore.at;
  let map={};try{map=JSON.parse(localStorage.getItem('meetany.seen')||'{}')||{};}catch{}
  const at=map[r.id]||null;ui.seenBefore={id:r.id,at};
  map[r.id]=new Date().toISOString();
  try{localStorage.setItem('meetany.seen',JSON.stringify(map));}catch{}
  return at;
 }
 // Price sort compares only within the same price type: unit, then total, then negotiable.
 const TYPE_ORDER=['unit','total','negotiable'];
 function sortOffers(offers,mode){
  const list=[...offers];
  if(mode==='price')return list.sort((a,b)=>TYPE_ORDER.indexOf(a.priceType)-TYPE_ORDER.indexOf(b.priceType)||(a.price??0)-(b.price??0)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return list.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 }
 function bestPrices(offers){
  const best={};
  for(const t of ['unit','total']){const g=offers.filter(o=>o.priceType===t&&o.price!=null&&o.status!=='declined');if(g.length>1)best[t]=Math.min(...g.map(o=>o.price));}
  return best;
 }
 function offerListHtml(r,offers,opts){
  const sorted=sortOffers(offers,ui.sort);
  if(ui.sort!=='price')return sorted.map(o=>offerCard(o,r,opts(o))).join('');
  let html='',type='';
  for(const o of sorted){if(o.priceType!==type){type=o.priceType;html+=`<h3 class="ma-offers__group">${E(priceTypes[type])}</h3>`;}html+=offerCard(o,r,opts(o));}
  return html;
 }
 function compareHtml(r,offers,canChoose){
  const sorted=sortOffers(offers,'price'),best=bestPrices(offers);
  const cell=o=>{
   const c=S.userById(o.companyUserId)||{id:o.companyUserId,company:'კომპანია',city:''},st=S.companyStats(o.companyUserId);
   return {c,price:o.priceType==='negotiable'?'შეთანხმებით':money(o.price),isBest:best[o.priceType]!=null&&o.price===best[o.priceType],
    type:o.priceType==='negotiable'?'—':priceTypes[o.priceType],vat:o.priceType==='negotiable'?'—':o.vatIncluded?'ჩათვლით':'გარეშე',
    delivery:[o.deliveryDays!=null?(o.deliveryDays===0?'იმავე დღეს':o.deliveryDays+' დღე'):'',o.deliveryIncluded?'შედის ფასში':''].filter(Boolean).join(' · ')||'—',
    record:st.sent>=NEW_MEMBER?`${st.chosen} / ${st.sent}`:'ახალი წევრი'};
  };
  const action=(o,block)=>canChoose&&o.status==='sent'?`<button type="button" class="ma-btn ma-btn--secondary ${block?'ma-btn--block':'ma-btn--sm'}" data-choose="${E(o.id)}">არჩევა</button>`:o.status==='chosen'?`<span class="ma-badge ma-badge--success">${I('check')}არჩეულია</span>`:'';
  const rows=sorted.map(o=>{const x=cell(o);return `<tr${o.status==='declined'?' class="is-declined"':''}><th scope="row"><a class="ma-link" href="${companyHref(x.c.id)}">${E(x.c.company)}</a></th><td class="${x.isBest?'is-best':''}">${E(x.price)}${x.isBest?'<span class="ma-sr-only"> — საუკეთესო ფასი ამ ტიპში</span>':''}</td><td>${E(x.type)}</td><td>${E(x.vat)}</td><td>${E(x.delivery)}</td><td>${E(cityName(x.c.city)||'—')}</td><td>${E(x.record)}</td><td>${x.c.verified?verifiedBadge(x.c,'icon'):'<span aria-label="არა">—</span>'}</td>${canChoose?`<td>${action(o)}</td>`:''}</tr>`;}).join('');
  const cards=sorted.map(o=>{const x=cell(o),act=action(o,true);return `<div class="ma-card ma-compare-card${o.status==='declined'?' is-declined':''}"><div class="ma-compare-card__head"><a class="ma-compare-card__name" href="${companyHref(x.c.id)}">${E(x.c.company)}</a>${x.c.verified?verifiedBadge(x.c,'icon'):''}</div><dl class="ma-kv"><div><dt>ფასი</dt><dd class="${x.isBest?'is-best':''}">${E(x.price)}</dd></div><div><dt>ფასის ტიპი</dt><dd>${E(x.type)}</dd></div><div><dt>დღგ</dt><dd>${E(x.vat)}</dd></div><div><dt>მიწოდება</dt><dd>${E(x.delivery)}</dd></div><div><dt>ქალაქი</dt><dd>${E(cityName(x.c.city)||'—')}</dd></div><div><dt>არჩეული / გაგზავნილი</dt><dd>${E(x.record)}</dd></div></dl>${act?`<div class="ma-compare-card__act">${act}</div>`:''}</div>`;}).join('');
  return `<p class="ma-small ma-muted ma-compare-note">საუკეთესო ფასი მოინიშნება მხოლოდ ერთი ტიპის ფასებს შორის (ერთეულის ან ჯამური).</p>
   <div class="ma-compare-wrap" tabindex="0" role="region" aria-label="შეთავაზებების შედარების ცხრილი"><table class="ma-compare"><thead><tr><th scope="col">კომპანია</th><th scope="col">ფასი</th><th scope="col">ფასის ტიპი</th><th scope="col">დღგ</th><th scope="col">მიწოდება</th><th scope="col">ქალაქი</th><th scope="col">არჩ. / გაგზ.</th><th scope="col">დადასტ.</th>${canChoose?'<th scope="col"><span class="ma-sr-only">მოქმედება</span></th>':''}</tr></thead><tbody>${rows}</tbody></table></div>
   <div class="ma-compare-cards" role="region" aria-label="შეთავაზებების შედარება" tabindex="0">${cards}</div>`;
 }
 const isNewOffer=(o,seen)=>o.status==='sent'&&(!seen||Date.parse(o.createdAt)>Date.parse(seen));
 // Author (and admin): tabs „შეთავაზებები (n)“ | „შედარება“.
 function offersSection(r,offers,{canChoose,forAdmin}){
  if(!offers.length){
   return `<section class="ma-section ma-offers" id="offers" aria-labelledby="offers-title"><h2 class="ma-section__title" id="offers-title">შეთავაზებები</h2>${forAdmin?emptyState({iconName:'inbox',title:'შეთავაზება ჯერ არ არის',plain:true,heading:'h3'}):emptyState({iconName:'inbox',title:'ჯერ შეთავაზება არ მოსულა',text:'მოთხოვნა უკვე ჩანს კომპანიებისთვის. გააზიარე ბმული — ასე მეტი კომპანია ნახავს.',actions:`<button type="button" class="ma-btn ma-btn--secondary" data-share>${I('share-2')}გააზიარე მოთხოვნა</button>`,heading:'h3'})}</section>`;
  }
  const seen=forAdmin?null:seenBefore(r);
  const opts=o=>({canChoose,isNew:!forAdmin&&isNewOffer(o,seen)});
  const tabs=offers.length>1;
  if(!tabs)ui.tab='offers';
  const sortSel=tabs?`<div class="ma-offers__bar"><label class="ma-small ma-muted" for="offer-sort">დალაგება</label><select class="ma-select ma-offers__sort" id="offer-sort"><option value="new"${ui.sort==='new'?' selected':''}>ახალი პირველი</option><option value="price"${ui.sort==='price'?' selected':''}>ფასი: იაფიდან</option></select></div>`:'';
  return `<section class="ma-section ma-offers" id="offers" aria-labelledby="offers-title">
   <h2 class="${tabs?'ma-sr-only':'ma-section__title'}" id="offers-title">შეთავაზებები${tabs?'':` <span class="ma-tab__count">${offers.length}</span>`}</h2>
   ${tabs?`<div class="ma-tabs" role="tablist" aria-label="შეთავაზებები"><button type="button" class="ma-tab" role="tab" id="tab-offers" aria-controls="panel-offers" aria-selected="${ui.tab==='offers'}" tabindex="${ui.tab==='offers'?0:-1}">შეთავაზებები<span class="ma-tab__count">${offers.length}</span></button><button type="button" class="ma-tab" role="tab" id="tab-compare" aria-controls="panel-compare" aria-selected="${ui.tab==='compare'}" tabindex="${ui.tab==='compare'?0:-1}">შედარება</button></div>`:''}
   <div class="ma-offers__panel" ${tabs?'role="tabpanel" aria-labelledby="tab-offers"':''} id="panel-offers"${ui.tab==='offers'?'':' hidden'}>${sortSel}<div class="ma-stack" id="offer-list" style="--gap:12px">${offerListHtml(r,offers,opts)}</div></div>
   ${tabs?`<div class="ma-offers__panel" role="tabpanel" id="panel-compare" aria-labelledby="tab-compare"${ui.tab==='compare'?'':' hidden'}>${compareHtml(r,offers,canChoose)}</div>`:''}
  </section>`;
 }
 function bindOffersSection(root,r,offers,opts){
  const tabs=$$('[role="tab"]',root);
  const select=t=>{ui.tab=t;tabs.forEach(b=>{const on=b.id==='tab-'+t;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});$('#panel-offers',root).hidden=t!=='offers';const pc=$('#panel-compare',root);if(pc)pc.hidden=t!=='compare';};
  tabs.forEach(b=>{
   b.addEventListener('click',()=>select(b.id.slice(4)));
   b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(b),n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();select(tabs[n].id.slice(4));});
  });
  $('#offer-sort',root)?.addEventListener('change',e=>{ui.sort=e.target.value;$('#offer-list',root).innerHTML=offerListHtml(r,offers,opts);});
 }

 /* ---------- OfferForm (company): price type, price, VAT, delivery, text; the draft autosaves ---------- */
 const draftKey=id=>'meetany.offerDraft.'+id;
 function loadDraft(id){try{return JSON.parse(localStorage.getItem(draftKey(id))||'null');}catch{return null;}}
 function saveDraft(id,v){try{localStorage.setItem(draftKey(id),JSON.stringify(v));}catch{}}
 function clearDraft(id){try{localStorage.removeItem(draftKey(id));}catch{}}
 const fieldErr=id=>`<span class="ma-field__error" id="${id}-err" hidden>${I('circle-alert')}<span></span></span>`;
 function offerFormHtml(r,mine){
  const editing=!!mine;
  const d=editing?{priceType:mine.priceType,price:mine.price!=null?String(mine.price).replace('.',','):'',vatIncluded:mine.vatIncluded,deliveryDays:mine.deliveryDays??'',deliveryIncluded:mine.deliveryIncluded,body:mine.body||''}
   :{priceType:r.quantity>1&&r.unit&&r.unit!=='service'?'unit':'total',price:'',vatIncluded:false,deliveryDays:'',deliveryIncluded:false,body:'',...(loadDraft(r.id)||{})};
  const pt=Object.hasOwn(priceTypes,d.priceType)?d.priceType:'total';
  const segLabel={unit:'ერთეულის',total:'ჯამური',negotiable:'შეთანხმებით'};
  const qty=qtyLabel(r);
  return `<form class="ma-oform${pt==='negotiable'?' is-negotiable':''}" id="offer-form" novalidate data-editing="${editing?1:0}">
   <div data-form-alert></div>
   <div class="ma-oform__price">
    <div class="ma-field"><span class="ma-field__label" id="of-type-label">ფასის ტიპი</span><div class="ma-seg" role="radiogroup" aria-labelledby="of-type-label">${TYPE_ORDER.map(k=>`<label class="ma-seg__opt"><input type="radio" name="priceType" value="${k}"${k===pt?' checked':''}><span>${segLabel[k]}</span></label>`).join('')}</div>${fieldErr('of-type')}</div>
    <div class="ma-form__row ma-oform__row">
     <div class="ma-field ma-oform__amount"><label class="ma-field__label" for="of-price" data-amount-label>${pt==='unit'?'ფასი ერთეულზე':'ჯამური ფასი'}</label><div class="ma-affix"><input class="ma-input ma-input--num" id="of-price" name="price" inputmode="decimal" autocomplete="off" maxlength="16" value="${E(d.price)}" aria-describedby="of-price-err${qty?' of-price-help':''}"><span class="ma-affix__suffix">₾</span></div>${qty?`<span class="ma-field__help" id="of-price-help">მოთხოვნა: ${E(qty)}</span>`:''}${fieldErr('of-price')}</div>
     <div class="ma-field"><label class="ma-field__label" for="of-days">მიწოდების ვადა</label><div class="ma-affix"><input class="ma-input ma-input--num" id="of-days" name="deliveryDays" inputmode="numeric" autocomplete="off" maxlength="3" value="${E(d.deliveryDays)}" aria-describedby="of-days-err"><span class="ma-affix__suffix">დღე</span></div>${fieldErr('of-days')}</div>
    </div>
   </div>
   <div class="ma-oform__checks"><label class="ma-check ma-oform__vat"><input type="checkbox" name="vatIncluded" value="1"${d.vatIncluded?' checked':''}><span>ფასი დღგ-ს ჩათვლით</span></label><label class="ma-check"><input type="checkbox" name="deliveryIncluded" value="1"${d.deliveryIncluded?' checked':''}><span>მიწოდება შედის ფასში</span></label></div>
   <div class="ma-field"><div class="ma-field__top"><label class="ma-field__label" for="of-body">შეთავაზების ტექსტი</label><span class="ma-field__counter" id="of-body-count" aria-hidden="true">${String(d.body).length} / 2000</span></div><textarea class="ma-textarea" id="of-body" name="body" rows="5" maxlength="2000" placeholder="მასალა, გარანტია, ნიმუში, მიწოდების პირობები…" aria-describedby="of-body-help of-body-err">${E(d.body)}</textarea><span class="ma-field__help" id="of-body-help">მინიმუმ 10 სიმბოლო.</span>${fieldErr('of-body')}</div>
   <div class="ma-oform__submit"><button type="submit" class="ma-btn ma-btn--primary ma-btn--lg ma-btn--block">${I(editing?'check':'send')}<span>${editing?'ცვლილებების შენახვა':'შეთავაზების გაგზავნა'}</span></button>${editing?'<button type="button" class="ma-btn ma-btn--ghost ma-btn--block" data-offer-cancel-edit>გაუქმება</button>':''}${note('შენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.')}</div>
  </form>`;
 }
 const ERR_FIELD={MA204:'of-body',MA205:'of-price',MA211:'of-price',MA212:'of-price',MA213:'of-days',MA210:'of-type'};
 function setFieldError(form,id,message){
  const box=$('#'+id+'-err',form);if(!box)return false;
  box.hidden=!message;$('span',box).textContent=message||'';
  const input=id==='of-type'?null:$('#'+id,form);
  if(input){if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');}
  box.closest('.ma-field')?.classList.toggle('ma-field--error',!!message);
  return true;
 }
 // The offer draft autosaves, so closing the mobile sheet never loses text: undo the shell's dirty flag
 // (this document listener runs after shell.js's, which sets it).
 document.addEventListener('input',e=>{const f=e.target.closest?.('#offer-form');if(f)delete f.dataset.maDirty;});
 function bindOfferForm(form,r){
  const editing=form.dataset.editing==='1';
  const values=()=>{const fd=new FormData(form);return {priceType:fd.get('priceType')||'total',price:String(fd.get('price')||'').trim(),vatIncluded:!!fd.get('vatIncluded'),deliveryDays:String(fd.get('deliveryDays')||'').trim(),deliveryIncluded:!!fd.get('deliveryIncluded'),body:String(fd.get('body')||'')};};
  const sync=()=>{const v=values();form.classList.toggle('is-negotiable',v.priceType==='negotiable');$('[data-amount-label]',form).textContent=v.priceType==='unit'?'ფასი ერთეულზე':'ჯამური ფასი';};
  form.addEventListener('change',e=>{if(e.target.name==='priceType'){sync();setFieldError(form,'of-price','');setFieldError(form,'of-type','');}if(!editing)saveDraft(r.id,values());});
  form.addEventListener('input',e=>{
   if(e.target.name==='body'){const n=e.target.value.length,c=$('#of-body-count',form);c.textContent=n+' / 2000';c.classList.toggle('is-over',n>2000);}
   if(e.target.id)setFieldError(form,e.target.id,'');
   if(!editing)saveDraft(r.id,values());
  });
  $('[data-offer-cancel-edit]',form)?.addEventListener('click',()=>{ui.editOffer=false;closeOfferSheet();renderRequestPage();$('#my-offer')?.focus();});
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const btn=submitOf(form);if(btn.classList.contains('is-loading'))return;
   const v=values();$('[data-form-alert]',form).innerHTML='';
   ['of-type','of-price','of-days','of-body'].forEach(id=>setFieldError(form,id,''));
   const bad=[];
   if(v.priceType!=='negotiable'&&!v.price){setFieldError(form,'of-price','მიუთითე ფასი ან აირჩიე „შეთანხმებით“.');bad.push('of-price');}
   if(v.body.trim().length<10){setFieldError(form,'of-body','აღწერე შეთავაზება მინიმუმ 10 სიმბოლოთი.');bad.push('of-body');}
   if(bad.length){$('#'+bad[0],form)?.focus();return;}
   btn.classList.add('is-loading');btn.setAttribute('aria-busy','true');
   try{
    await S.sendOffer(r.id,v);
    clearDraft(r.id);ui.editOffer=false;
    closeOfferSheet();renderRequestPage();
    toast(editing?'შეთავაზება განახლდა.':'შეთავაზება გაიგზავნა. მას მხოლოდ ავტორი ნახავს.');
    $('#my-offer')?.focus();
   }catch(err){
    const id=ERR_FIELD[err.code];
    if(!(id&&setFieldError(form,id,err.userMessage)))$('[data-form-alert]',form).innerHTML=alertBox('danger','შეთავაზება ვერ გაიგზავნა',(err.userMessage||'რაღაც ვერ შესრულდა. სცადე თავიდან.')+(editing?'':' ტექსტი შენახულია.'));
    if(!err.userMessage)console.error(err);
    (id?$('#'+id,form):$('[data-form-alert]',form))?.scrollIntoView({block:'nearest'});
    if(id)$('#'+id,form)?.focus();
   }finally{if(btn.isConnected){btn.classList.remove('is-loading');btn.removeAttribute('aria-busy');}}
  });
 }
 // Below 1024 the form opens as a full-screen sheet; the same node moves there and back, so typed text stays.
 function offerSheet(){
  const d=sheetEl('offer-sheet','ma-sheet ma-sheet--full ma-sheet--wide');
  if(!d.dataset.bound){
   d.dataset.bound='1';
   d.addEventListener('close',()=>{const box=$('#offer-box'),slot=$('#offer-slot');if(box&&slot&&!slot.contains(box))slot.append(box);});
   matchMedia('(min-width:1024px)').addEventListener('change',e=>{if(e.matches)closeOfferSheet();});
  }
  return d;
 }
 function openOfferSheet(){
  const box=$('#offer-box');if(!box)return;
  const d=offerSheet();
  d.innerHTML=`${sheetHead('offer-sheet',ui.editOffer?'შეთავაზების რედაქტირება':'შეთავაზების გაგზავნა')}<div class="ma-sheet__body" data-offer-sheet-body></div>`;
  $('[data-offer-sheet-body]',d).append(box);
  openSheet(d);
  $('#of-price',box)?.focus();
 }
 function closeOfferSheet(){const d=$('#offer-sheet');if(d?.open)closeSheet(d);}

 /* ---------- role panels (aside) ---------- */
 const activity=(r,count)=>`<div class="ma-activity"><span>${I('lock-keyhole')}შეთავაზებები: <b>${count}</b></span>${S.requestState(r)==='open'?`<span>${I(isSoon(r)?'hourglass':'clock')}${E(leftLabel(r))}</span>`:''}</div>`;
 function closedPanel(r,u){
  const s=S.requestState(r);
  const text=s==='chosen'?'ავტორმა მომწოდებელი უკვე აირჩია.':s==='expired'?'მოთხოვნის ვადა ამოიწურა.':s==='closed'?'ავტორმა მოთხოვნა დახურა.':'მოთხოვნა დამალულია.';
  const cat=u?.role==='company'&&u.industry?u.industry:r.category;
  return `<section class="ma-panel"><h2 class="ma-panel__title">მოთხოვნა შეთავაზებებს აღარ იღებს</h2><p class="ma-panel__text">${E(text)}</p><div class="ma-panel__actions"><a class="ma-btn ma-btn--secondary" href="/requests/?category=${encodeURIComponent(cat)}">სხვა მოთხოვნები</a></div></section>`;
 }
 function companyPanel(r,u,mine,count){
  const state=S.requestState(r);
  if(u.blocked)return `<section class="ma-panel">${alertBox('danger','ანგარიში დაბლოკილია','შეთავაზების გაგზავნა შეუძლებელია. დაუკავშირდი MeetAny-ს გუნდს.')}</section>`;
  if(mine?.status==='chosen'){
   return `<section class="ma-ocard ma-ocard--chosen ma-mine-result" id="my-offer" tabindex="-1" aria-labelledby="my-offer-title"><div class="ma-ocard__flag"><span class="ma-badge ma-badge--success">${I('check')}არჩეულია</span></div><h2 class="ma-h3" id="my-offer-title">შენი შეთავაზება აირჩიეს!</h2><p class="ma-panel__text">დაუკავშირდი დამკვეთს და შეათანხმეთ დეტალები.</p><p class="ma-small ma-mine-result__sum">${E(offerSummary(mine))}</p></section>${contactFor(r,false)}`;
  }
  if(mine?.status==='declined'){
   return `<section class="ma-panel" id="my-offer" tabindex="-1"><div><span class="ma-badge ma-badge--neutral">არ აირჩიეს</span></div><h2 class="ma-panel__title">მოთხოვნაზე სხვა შეთავაზება აირჩიეს.</h2><p class="ma-panel__text">შენი შეთავაზება: ${E(offerSummary(mine))}</p><div class="ma-panel__actions"><a class="ma-btn ma-btn--secondary" href="/requests/${u.industry?'?category='+encodeURIComponent(u.industry):''}">სხვა მოთხოვნები შენი დარგიდან</a></div></section>`;
  }
  if(mine&&!(ui.editOffer&&state==='open')){
   const edited=mine.updatedAt&&Date.parse(mine.updatedAt)-Date.parse(mine.createdAt)>60000;
   return `<section class="ma-panel" id="my-offer" tabindex="-1" aria-labelledby="my-offer-title">
    <div class="ma-alert ma-alert--success">${I('circle-check')}<div class="ma-alert__body"><h2 class="ma-alert__title" id="my-offer-title">შეთავაზება გაგზავნილია · ელოდება არჩევას</h2><span class="ma-alert__text">${E(offerSummary(mine))}</span></div></div>
    ${offerBody(mine,'my-offer-body')}
    <div class="ma-meta"><span>გაიგზავნა ${E(ago(mine.createdAt))}</span>${edited?`<span>განახლდა ${E(ago(mine.updatedAt))}</span>`:''}</div>
    ${state==='open'?`<div class="ma-panel__actions"><button type="button" class="ma-btn ma-btn--secondary" data-offer-edit>${I('pencil')}რედაქტირება</button><button type="button" class="ma-btn ma-btn--danger-quiet" data-withdraw="${E(mine.id)}">შეთავაზების გაუქმება</button></div>`:`<p class="ma-panel__text">${E(state==='expired'?'მოთხოვნის ვადა ამოიწურა — ავტორი ახლა ვერ აირჩევს.':'მოთხოვნა დახურულია.')}</p>`}
    ${note('შეთავაზებას მხოლოდ მოთხოვნის ავტორი ხედავს.')}
   </section>`;
  }
  if(state!=='open')return closedPanel(r,u);
  const label=mine?'შეთავაზების რედაქტირება':'შეთავაზების გაგზავნა';
  return `<section class="ma-panel ma-offer-panel" aria-labelledby="offer-panel-title"><h2 class="ma-panel__title" id="offer-panel-title">${label}</h2>${activity(r,count)}
   <div id="offer-slot" class="ma-lg-up"><div id="offer-box">${offerFormHtml(r,mine)}</div></div>
   <div class="ma-lg-down ma-stack" style="--gap:12px"><button type="button" class="ma-btn ma-btn--primary ma-btn--lg ma-btn--block" data-offer-open>${I('send')}${label}</button>${note('შენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.')}</div>
  </section>`;
 }
 function anonPanel(r,count){
  if(S.requestState(r)!=='open')return closedPanel(r,null);
  return `<section class="ma-panel"><h2 class="ma-panel__title">შეთავაზების გასაგზავნად შედი როგორც კომპანია</h2>${activity(r,count)}<p class="ma-panel__text">შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ნახავს — სხვები მხოლოდ რაოდენობას.</p><div class="ma-panel__actions"><button type="button" class="ma-btn ma-btn--primary" data-market="login">შესვლა</button><button type="button" class="ma-btn ma-btn--secondary" data-market="register-company">კომპანიის რეგისტრაცია</button></div></section>`;
 }
 function buyerPanel(r,count){
  return `<section class="ma-panel"><h2 class="ma-panel__title">გჭირდება მსგავსი?</h2>${activity(r,count)}<p class="ma-panel__text">დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ ფასს და პირობებს.</p><div class="ma-panel__actions">${newRequestBtn('ma-btn--primary',r.category)}</div>${note('შეთავაზებებს ხედავს მხოლოდ მოთხოვნის ავტორი.')}</section>`;
 }
 function authorPanel(r,count){
  const s=S.requestState(r),reopen=s==='expired'||s==='closed';
  return `<section class="ma-panel" aria-labelledby="author-panel-title"><h2 class="ma-panel__title" id="author-panel-title">შენი მოთხოვნა</h2>
   <dl class="ma-kv"><div><dt>სტატუსი</dt><dd>${statusBadge(r)}</dd></div><div><dt>შეთავაზებები</dt><dd>${count}</dd></div>${s==='open'?`<div><dt>აქტიურია</dt><dd>${E(dmy(r.expiresAt))}-მდე</dd></div>`:s==='expired'?`<div><dt>ვადა ამოიწურა</dt><dd>${E(dmy(r.expiresAt))}</dd></div>`:''}</dl>
   ${s==='open'?`<div class="ma-panel__actions"><button type="button" class="ma-btn ma-btn--secondary" data-owner="extend">${I('clock-plus')}ვადის გაგრძელება (+${S.EXTEND_DAYS} დღე)</button></div>`:''}
   ${reopen?`<div class="ma-panel__actions"><button type="button" class="ma-btn ma-btn--primary" data-owner="extend">${I('clock-plus')}ხელახლა გახსნა ${S.EXTEND_DAYS} დღით</button></div>`:''}
   ${note('შეთავაზებებს მხოლოდ შენ ხედავ — სხვები მხოლოდ რაოდენობას.')}
  </section>`;
 }
 function adminPanel(r){
  const owner=S.userById(r.ownerId);
  return `<section class="ma-panel ma-admin-bar" aria-labelledby="admin-bar-title"><h2 class="ma-panel__title" id="admin-bar-title">${I('shield-check')} ადმინი</h2>
   <p class="ma-panel__text">ავტორი: ${E(owner?.company||'—')}${owner?.blocked?' · დაბლოკილია':''}</p>
   <div class="ma-panel__actions">
    ${r.hidden?`<button type="button" class="ma-btn ma-btn--secondary" data-adm="unhide">${I('eye')}გამოჩენა</button>`:`<button type="button" class="ma-btn ma-btn--danger-quiet" data-adm="hide">${I('eye-off')}დამალვა</button>`}
    ${owner&&owner.role!=='admin'?(owner.blocked?`<button type="button" class="ma-btn ma-btn--secondary" data-adm="unblock">${I('user-round-check')}ავტორის განბლოკვა</button>`:`<button type="button" class="ma-btn ma-btn--danger-quiet" data-adm="block">${I('ban')}ავტორის დაბლოკვა</button>`):''}
    <button type="button" class="ma-btn ma-btn--danger-quiet" data-adm="delete">${I('trash-2')}მოთხოვნის წაშლა</button>
   </div></section>`;
 }
 function ownerMenu(r,count){
  const s=S.requestState(r),editable=count===0&&['open','closed','expired'].includes(s);
  const items=[
   editable?`<button type="button" class="ma-menu__item" role="menuitem" data-edit-request="${E(r.id)}">${I('pencil')}რედაქტირება</button>`:'',
   s==='open'?`<button type="button" class="ma-menu__item" role="menuitem" data-owner="extend">${I('clock-plus')}ვადის გაგრძელება (+${S.EXTEND_DAYS} დღე)</button>`:'',
   s==='expired'||s==='closed'?`<button type="button" class="ma-menu__item" role="menuitem" data-owner="extend">${I('clock-plus')}ხელახლა გახსნა (${S.EXTEND_DAYS} დღე)</button>`:'',
   `<button type="button" class="ma-menu__item" role="menuitem" data-share>${I('share-2')}გაზიარება</button>`,
   '<div class="ma-menu__sep" role="separator"></div>',
   s==='open'?`<button type="button" class="ma-menu__item ma-menu__item--danger" role="menuitem" data-owner="close">${I('circle-x')}დახურვა</button>`:'',
   `<button type="button" class="ma-menu__item ma-menu__item--danger" role="menuitem" data-owner="delete">${I('trash-2')}წაშლა</button>`
  ].join('');
  return `<div class="ma-menu"><button type="button" class="ma-menu__trigger ma-detail-head__manage" aria-haspopup="menu" aria-expanded="false" aria-controls="owner-menu">${I('ellipsis')}<span>მართვა</span></button><div class="ma-menu__list" id="owner-menu" role="menu" aria-label="მოთხოვნის მართვა" hidden>${items}</div></div>`;
 }
 function shareRow(r){
  const url=location.origin+requestHref(r),text=r.title+' — MeetAny';
  return `<div class="ma-share"><span class="ma-share__label">გაზიარება</span>
   <button type="button" class="ma-btn ma-btn--secondary ma-btn--sm" data-ma-copy="${E(url)}">${I('link')}<span>ბმულის კოპირება</span></button>
   <a class="ma-btn ma-btn--secondary ma-btn--sm" href="https://wa.me/?text=${encodeURIComponent(text+'\n'+url)}" target="_blank" rel="noopener">${brand.whatsapp}<span>WhatsApp</span></a>
   <a class="ma-btn ma-btn--secondary ma-btn--sm" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">${brand.facebook}<span>Facebook</span></a>
  </div>`;
 }
 function renderRequestPage(){
  const root=$('#request-root');if(!root)return;
  closeOfferSheet();
  const r=currentRequest(),u=S.currentUser();
  const isAdmin=u?.role==='admin'&&!u.blocked,isOwner=!!u&&!!r&&u.id===r.ownerId;
  if(!r||(r.hidden&&!isAdmin&&!isOwner)){
   document.title='მოთხოვნა მიუწვდომელია — MeetAny';
   root.innerHTML=`<div class="ma-container ma-page">${emptyState({iconName:'search',title:'ეს მოთხოვნა აღარ არის ხელმისაწვდომი',text:'შესაძლოა ავტორმა წაშალა ან ბმული არასწორია.',actions:'<a class="ma-btn ma-btn--primary" href="/requests/">სხვა მოთხოვნები</a>',heading:'h1'})}</div>`;
   return;
  }
  if(ui.id!==r.id){ui.id=r.id;ui.tab='offers';ui.sort='new';ui.editOffer=false;ui.seenBefore=null;}
  document.title=r.title+' — მოთხოვნა | MeetAny';
  const owner=S.userById(r.ownerId),state=S.requestState(r),count=S.offerCount(r.id);
  const offers=S.visibleOffers(r.id,u),mine=u&&!isOwner?offers.find(o=>o.companyUserId===u.id)||null:null;
  const facts=[
   ['package','რაოდენობა',qtyLabel(r)],
   ['map-pin','ქალაქი',cityName(r.city)],
   ['calendar-clock','საჭიროა თარიღამდე',r.neededBy?dayLabel(r.neededBy):''],
   ['layout-grid','კატეგორია',categories[r.category]||'']
  ].filter(([,,value])=>value).map(([ic,label,value])=>`<div class="ma-factgrid__item"><dt class="ma-factgrid__label">${I(ic)}${label}</dt><dd class="ma-factgrid__value${value?'':' is-empty'}">${value?E(value):'<span aria-hidden="true">—</span><span class="ma-sr-only">არ არის მითითებული</span>'}</dd></div>`).join('');
  const metaParts=[`გამოქვეყნდა ${E(ago(r.createdAt))}`];
  if(state==='open')metaParts.push(E(leftLabel(r)));else if(state==='expired')metaParts.push('ვადა ამოიწურა '+E(dmy(r.expiresAt)));
  metaParts.push(`<b>${count}</b> შეთავაზება`);
  const ownerName=owner?.company||owner?.name||'მომხმარებელი';
  const authorBlock=`<section class="ma-author-block" aria-labelledby="author-label"><span class="ma-eyebrow" id="author-label">მოთხოვნის ავტორი</span><div class="ma-author">${avatar(ownerName)}<div class="ma-author__id">${owner?.role==='company'?`<a class="ma-author__name ma-author__link" href="${companyHref(owner.id)}">${E(ownerName)}</a>`:`<span class="ma-author__name">${E(ownerName)}</span>`}<div class="ma-cluster" style="--gap:4px 8px">${owner?`<span class="ma-small ma-muted">${E([cityName(owner.city),owner.createdAt?memberSince(owner.createdAt):''].filter(Boolean).join(' · '))}</span>`:''}${EMAIL_CHECK?`<span class="ma-badge ma-badge--neutral">${I('mail-check')}ელფოსტა დადასტურებულია</span>`:''}</div></div></div></section>`;
  // Role variant: panel (aside), mobile action bar, blocks under the head, lower main section.
  let aside='',bar='',afterHead='',lower='';
  const canChoose=isOwner&&state==='open';
  if(isOwner){
   if(r.hidden)afterHead=alertBox('danger','მოთხოვნა დამალულია ადმინისტრაციის მიერ','ის აღარ ჩანს სიაში და ახალ შეთავაზებებს ვეღარ მიიღებს.');
   else if(state==='chosen')afterHead=contactFor(r,true);
   else if(state==='open'&&isSoon(r))afterHead=alertBox('warning','მოთხოვნა მალე იწურება',leftLabel(r)+'. გააგრძელე, თუ ჯერ არ აგირჩევია.',`<button type="button" class="ma-btn ma-btn--secondary ma-btn--sm ma-alert__action" data-owner="extend">ვადის გაგრძელება</button>`);
   else if((state==='expired'||state==='closed')&&offers.some(o=>o.status==='sent'))afterHead=alertBox('info',state==='expired'?'ვადა ამოიწურა':'მოთხოვნა დახურულია','შეთავაზების ასარჩევად ხელახლა გახსენი მოთხოვნა.',`<button type="button" class="ma-btn ma-btn--secondary ma-btn--sm ma-alert__action" data-owner="extend">ხელახლა გახსნა</button>`);
   lower=offersSection(r,offers,{canChoose,forAdmin:false});
   aside=authorPanel(r,count);
   if(state==='open')bar=count?`<div class="ma-actionbar"><div class="ma-actionbar__info"><b>${count} შეთავაზება</b><span>${E(leftLabel(r))}</span></div><a class="ma-btn ma-btn--primary" href="#offers" data-scroll="offers">შეთავაზებები</a></div>`:`<div class="ma-actionbar"><button type="button" class="ma-btn ma-btn--primary" data-share>${I('share-2')}გააზიარე მოთხოვნა</button></div>`;
   else if(state==='expired'||state==='closed')bar=`<div class="ma-actionbar"><button type="button" class="ma-btn ma-btn--primary" data-owner="extend">${I('clock-plus')}ხელახლა გახსნა</button></div>`;
  }else if(isAdmin){
   lower=offersSection(r,offers,{canChoose:false,forAdmin:true});
   aside=adminPanel(r);
  }else if(u?.role==='company'){
   aside=companyPanel(r,u,mine,count);
   if(mine?.status==='chosen')bar=`<div class="ma-actionbar"><div class="ma-actionbar__info"><b>შენი შეთავაზება აირჩიეს!</b><span>კონტაქტი გაიხსნა</span></div><a class="ma-btn ma-btn--primary" href="#contact-card" data-scroll="contact-card">${I('phone')}კონტაქტი</a></div>`;
   else if(mine?.status==='sent'&&!ui.editOffer)bar=`<div class="ma-actionbar"><div class="ma-actionbar__info"><b>შეთავაზება გაგზავნილია</b><span>ელოდება არჩევას</span></div><a class="ma-btn ma-btn--secondary" href="#my-offer" data-scroll="my-offer">ნახვა</a></div>`;
   else if(state==='open'&&!u.blocked&&(!mine||ui.editOffer))bar=`<div class="ma-actionbar"><button type="button" class="ma-btn ma-btn--primary" data-offer-open>${I('send')}${mine?'შეთავაზების რედაქტირება':'შეთავაზების გაგზავნა'}</button></div>`;
  }else if(u){
   aside=buyerPanel(r,count);
   bar=`<div class="ma-actionbar">${newRequestBtn('ma-btn--primary',r.category)}</div>`;
  }else{
   aside=anonPanel(r,count);
   if(state==='open')bar=`<div class="ma-actionbar"><div class="ma-actionbar__info"><b>${count} შეთავაზება</b><span>${E(leftLabel(r))}</span></div><button type="button" class="ma-btn ma-btn--primary" data-market="login">შესვლა</button></div>`;
  }
  if(isAdmin&&isOwner)aside+=adminPanel(r);
  const photo=r.photo?`<figure class="ma-photo"><a href="${E(r.photo)}" target="_blank" rel="noopener"><img src="${E(r.photo)}" alt="მოთხოვნის ფოტო" loading="lazy" decoding="async"><span class="ma-sr-only">ფოტოს სრულად ნახვა (ახალ ფანჯარაში)</span></a></figure>`:'';
  keepFocus(root,()=>{
   root.innerHTML=`<div class="ma-container ma-page">
    <nav class="ma-crumbs" aria-label="ნავიგაცია"><a href="/requests/">მოთხოვნები</a>${I('chevron-right')}<a href="/requests/?category=${encodeURIComponent(r.category)}">${E(categories[r.category]||'')}</a></nav>
    <div class="ma-layout">
     <div class="ma-layout__main">
      <header class="ma-detail-head">
       <div class="ma-detail-head__row"><div class="ma-cluster">${statusBadge(r)}${isOwner?'<span class="ma-badge ma-badge--info ma-badge--plain">შენი მოთხოვნა</span>':''}</div>${isOwner?ownerMenu(r,count):''}</div>
       <h1 class="ma-h1 ma-detail-head__title">${E(r.title)}</h1>
       <dl class="ma-factgrid">${facts}</dl>
       <div class="ma-meta">${metaParts.map(x=>`<span>${x}</span>`).join('')}</div>
      </header>
      ${afterHead}
      <section class="ma-detail-body" aria-label="აღწერა"><p class="ma-prose">${E(r.body)}</p>${photo}</section>
      ${authorBlock}
      ${lower}
      ${shareRow(r)}
     </div>
     <aside class="ma-layout__aside" aria-label="მოქმედებები">${aside}</aside>
    </div>
    ${bar}
   </div>`;
  });
  if(lower&&offers.length){
   const seen=ui.seenBefore?.at;
   bindOffersSection(root,r,offers,o=>({canChoose,isNew:isOwner&&isNewOffer(o,seen)}));
  }
  const form=$('#offer-form',root);if(form)bindOfferForm(form,r);
 }
 function skeletonRequest(root){
  root.innerHTML=`<div class="ma-container ma-page" aria-busy="true"><span class="ma-sr-only">იტვირთება…</span><div class="ma-layout ma-skeleton"><div class="ma-layout__main"><div class="ma-stack" style="--gap:14px"><span class="ma-skel ma-skel--line ma-skel--w40"></span><span class="ma-skel ma-skel--badge"></span><span class="ma-skel ma-skel--h1"></span><span class="ma-skel ma-skel--block ma-skel--facts"></span><span class="ma-skel ma-skel--line ma-skel--w60"></span><span class="ma-skel ma-skel--line ma-skel--w90"></span><span class="ma-skel ma-skel--line ma-skel--w90"></span><span class="ma-skel ma-skel--line ma-skel--w60"></span></div></div><div class="ma-layout__aside"><div class="ma-card ma-stack" style="--gap:12px"><span class="ma-skel ma-skel--title"></span><span class="ma-skel ma-skel--block ma-skel--facts"></span><span class="ma-skel ma-skel--block"></span><span class="ma-skel ma-skel--btn" style="width:100%"></span></div></div></div></div>`;
 }
 // Detail page actions.
 document.addEventListener('click',e=>{
  const t=e.target;
  const scroll=t.closest('[data-scroll]');
  if(scroll){const el=document.getElementById(scroll.dataset.scroll);if(el){e.preventDefault();el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');el.focus({preventScroll:true});}return;}
  if(t.closest('[data-share]')){const r=currentRequest();if(r)shareRequest(r);return;}
  if(t.closest('[data-offer-open]')){if(matchMedia('(min-width:1024px)').matches)$('#of-price')?.focus();else openOfferSheet();return;}
  if(t.closest('[data-offer-edit]')){ui.editOffer=true;renderRequestPage();if(matchMedia('(min-width:1024px)').matches)$('#of-price')?.focus();else openOfferSheet();return;}
  const choose=t.closest('[data-choose]');
  if(choose){
   const r=currentRequest(),o=r&&S.visibleOffers(r.id).find(x=>x.id===choose.dataset.choose);if(!o)return;
   const name=S.userById(o.companyUserId)?.company||'კომპანია';
   confirmSheet({title:`აირჩიო „${name}“-ს შეთავაზება?`,summary:offerSummary(o),
    bullets:[['phone','შენი ტელეფონი და ელფოსტა გაეგზავნება კომპანიას'],['eye','შენ დაინახავ მის კონტაქტს'],['lock-keyhole','მოთხოვნა დაიხურება და სხვა შეთავაზებებს ვეღარ აირჩევ']],
    confirmLabel:'დიახ, ვირჩევ',confirmIcon:'check',errorTitle:'არჩევა ვერ მოხერხდა',
    action:async()=>{try{await S.chooseOffer(o.id);}catch(err){if(err.code==='MA209')err.userMessage='კომპანიამ შეთავაზება ახლახან შეცვალა. გადახედე განახლებულ ვერსიას და სცადე თავიდან.';throw err;}},
    after:()=>celebrate(r.id)});
   return;
  }
  const wd=t.closest('[data-withdraw]');
  if(wd){
   confirmSheet({title:'შეთავაზების გაუქმება?',text:'ავტორი ვეღარ დაინახავს შენს შეთავაზებას. ახლის გაგზავნა შეგიძლია, სანამ მოთხოვნა ღიაა.',confirmLabel:'დიახ, გაუქმება',danger:true,
    action:()=>S.withdrawOffer(wd.dataset.withdraw),after:()=>toast('შეთავაზება გაუქმდა.','info')});
   return;
  }
  const own=t.closest('[data-owner]');
  if(own){
   const r=(own.dataset.requestId&&S.getRequest(own.dataset.requestId))||currentRequest();if(!r)return;
   const kind=own.dataset.owner;
   if(kind==='extend'){const reopen=S.requestState(r)!=='open';busy(own,async()=>{try{await S.extendRequest(r.id);toast(reopen?`მოთხოვნა ხელახლა გაიხსნა ${S.EXTEND_DAYS} დღით.`:`ვადა გაგრძელდა ${S.EXTEND_DAYS} დღით.`);}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});return;}
   if(kind==='close')confirmSheet({title:'მოთხოვნის დახურვა?',text:`კომპანიები ვეღარ გამოგიგზავნიან შეთავაზებებს და ვერც აირჩევ. ხელახლა გახსნა შეგიძლია ${S.EXTEND_DAYS} დღით.`,confirmLabel:'დიახ, დახურვა',danger:true,action:()=>S.closeRequest(r.id),after:()=>toast('მოთხოვნა დაიხურა.','info')});
   if(kind==='delete')confirmSheet({title:'მოთხოვნის წაშლა?',text:'მოთხოვნა სამუდამოდ წაიშლება. ამის გაუქმება შეუძლებელია.',confirmLabel:'დიახ, წაშლა',danger:true,action:()=>S.deleteRequest(r.id),after:()=>{toast('მოთხოვნა წაიშალა.','info');if(page==='request')location.href=url('/account/');}});
   return;
  }
  const adm=t.closest('[data-adm]');
  if(adm){
   const r=currentRequest();if(!r)return;const owner=S.userById(r.ownerId),k=adm.dataset.adm;
   if(k==='unhide')busy(adm,async()=>{try{await S.adminSetHidden(r.id,false);toast('მოთხოვნა ისევ ჩანს.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
   if(k==='unblock')busy(adm,async()=>{try{await S.adminSetBlocked(r.ownerId,false);toast('ავტორი განიბლოკა.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
   if(k==='hide')confirmSheet({title:'მოთხოვნის დამალვა?',text:'მოთხოვნა გაქრება სიიდან და კომპანიები ვეღარ გამოგზავნიან შეთავაზებებს. ავტორი მას კვლავ დაინახავს.',confirmLabel:'დამალვა',danger:true,action:()=>S.adminSetHidden(r.id,true),after:()=>toast('მოთხოვნა დაიმალა.','info')});
   if(k==='block')confirmSheet({title:`დავბლოკო „${owner?.company||'ავტორი'}“?`,text:'დაბლოკილი ანგარიში ვეღარ გამოაქვეყნებს მოთხოვნებს და ვეღარ გაგზავნის შეთავაზებებს.',confirmLabel:'დაბლოკვა',danger:true,action:()=>S.adminSetBlocked(r.ownerId,true),after:()=>toast('ავტორი დაიბლოკა.','info')});
   if(k==='delete')confirmSheet({title:'მოთხოვნის წაშლა?',text:'მოთხოვნა და მისი შეთავაზებები სამუდამოდ წაიშლება.',confirmLabel:'დიახ, წაშლა',danger:true,action:()=>S.adminDeleteRequest(r.id),after:()=>{toast('მოთხოვნა წაიშალა.','info');location.href=url('/admin/');}});
  }
 });

 /* ======================================================================
    4.5 Companies catalog /companies/?industry=&city=&verified=1&q=
    ====================================================================== */
 let coLimit=PAGE_SIZE;
 function coFilters(){
  const p=params();
  const industry=csv(p.get('industry')).find(k=>Object.hasOwn(categories,k))||'';
  const city=csv(p.get('city')).find(k=>Object.hasOwn(cities,k))||'';
  return {q:(p.get('q')||'').trim().slice(0,200),industry,city,verified:p.get('verified')==='1'?'1':''};
 }
 // The city filter matches the service cities too (store: servesCity).
 const coList=(f,{ignore}={})=>S.listCompanies({q:f.q,industry:ignore==='industry'?'':f.industry,city:f.city,verified:!!f.verified});
 function mountCompanies(root){
  const f=coFilters();coLimit=PAGE_SIZE;
  const pill=(k,label)=>`<button type="button" class="ma-pill" data-ind="${k}" aria-pressed="false">${k?I(catIcon[k]):''}<span>${E(label)}</span><span class="ma-pill__count">0</span></button>`;
  root.innerHTML=`<div class="ma-container ma-page">
   <div class="ma-page-head"><div class="ma-page-head__text"><h1 class="ma-h1">კომპანიები</h1><p class="ma-page-head__count" id="co-count" aria-live="polite"></p></div></div>
   <div class="ma-filterbar">
    <div class="ma-filterbar__row">
     <form class="ma-filterbar__search ma-search" role="search" id="co-search"><label class="ma-sr-only" for="co-q">კომპანიების ძიება</label><div class="ma-affix"><span class="ma-affix__icon">${I('search')}</span><input class="ma-input" id="co-q" name="q" type="search" value="${E(f.q)}" placeholder="კომპანია, პროდუქტი ან მომსახურება" maxlength="200" autocomplete="off" enterkeyhint="search"></div></form>
     <div class="ma-co-controls"><label class="ma-sr-only" for="co-city">ქალაქი (მომსახურების ჩათვლით)</label><select class="ma-select ma-filterbar__select" id="co-city"><option value="">ყველა ქალაქი</option>${Object.entries(cities).map(([k,v])=>`<option value="${k}"${k===f.city?' selected':''}>${E(v)}</option>`).join('')}</select>
      <label class="ma-switch"><input type="checkbox" role="switch" id="co-verified"${f.verified?' checked':''}>მხოლოდ დადასტურებული</label></div>
    </div>
    <div class="ma-pills ma-pills--scroll" role="group" aria-label="დარგი" id="co-inds">${pill('','ყველა')}${Object.entries(categories).map(([k,v])=>pill(k,v)).join('')}</div>
   </div>
   <div id="co-results"></div>
  </div>`;
  const apply=next=>{setQuery({...coFilters(),...next});coLimit=PAGE_SIZE;renderCoResults(root);};
  const q=$('#co-q',root);
  $('#co-search',root).addEventListener('submit',e=>{e.preventDefault();apply({q:q.value.trim()});q.blur();});
  q.addEventListener('input',debounce(()=>{if(q.value.trim()!==coFilters().q)apply({q:q.value.trim()});},300));
  $('#co-city',root).addEventListener('change',e=>apply({city:e.target.value}));
  $('#co-verified',root).addEventListener('change',e=>apply({verified:e.target.checked?'1':''}));
  $('#co-inds',root).addEventListener('click',e=>{const b=e.target.closest('[data-ind]');if(b&&!b.disabled)apply({industry:b.dataset.ind===coFilters().industry?'':b.dataset.ind});});
  renderCoResults(root);
 }
 function renderCoResults(root){
  const f=coFilters(),list=coList(f);
  const byInd=coList(f,{ignore:'industry'}).reduce((m,c)=>(m[c.industry]=(m[c.industry]||0)+1,m),{});
  const all=Object.values(byInd).reduce((a,b)=>a+b,0);
  $$('[data-ind]',root).forEach(b=>{const k=b.dataset.ind,n=k?byInd[k]||0:all,on=k===f.industry;b.setAttribute('aria-pressed',String(on));b.querySelector('.ma-pill__count').textContent=n;b.disabled=!on&&!n&&!!k;b.classList.toggle('is-empty',b.disabled);});
  const city=$('#co-city',root);if(city)city.value=f.city;
  const ver=$('#co-verified',root);if(ver)ver.checked=!!f.verified;
  const q=$('#co-q',root);if(q&&document.activeElement!==q)q.value=f.q;
  $('#co-count',root).textContent=`${list.length} კომპანია`;
  const out=$('#co-results',root);
  if(!list.length){
   const filtered=!!(f.q||f.industry||f.city||f.verified);
   out.innerHTML=emptyState({iconName:'building-2',title:'კომპანია ვერ მოიძებნა',text:'გამოაქვეყნე მოთხოვნა — შესაბამისი კომპანიები თავად გიპოვიან.',actions:newRequestBtn()+(filtered?'<button type="button" class="ma-btn ma-btn--ghost" data-co-clear>ფილტრის გასუფთავება</button>':''),plain:filtered});
   return;
  }
  const shown=list.slice(0,coLimit);
  out.innerHTML=`<h2 class="ma-sr-only">შედეგები</h2><div class="ma-grid">${shown.map(companyCard).join('')}</div>${list.length>shown.length?`<div class="ma-more"><button type="button" class="ma-btn ma-btn--secondary" data-co-more>მეტის ჩვენება (${list.length-shown.length})</button></div>`:''}`;
 }
 document.addEventListener('click',e=>{
  const root=$('#companies-root');if(!root)return;
  if(e.target.closest('[data-co-clear]')){setQuery({});renderCoResults(root);$('#co-q',root)?.focus();}
  if(e.target.closest('[data-co-more]')){const grid=$('#co-results .ma-grid',root),before=grid?grid.children.length:0;coLimit+=PAGE_SIZE;renderCoResults(root);$('#co-results .ma-grid',root)?.children[before]?.querySelector('a')?.focus();}
 });
 function skeletonCompanies(root){
  root.innerHTML=`<div class="ma-container ma-page" aria-busy="true"><div class="ma-page-head"><div class="ma-page-head__text"><h1 class="ma-h1">კომპანიები</h1><p class="ma-page-head__count">იტვირთება…</p></div></div><div class="ma-skeleton ma-stack" style="--gap:12px;margin-bottom:24px"><span class="ma-skel ma-skel--search"></span><span class="ma-skel ma-skel--pills"></span></div><div class="ma-grid">${skeletonCompany().repeat(6)}</div></div>`;
 }

 /* ======================================================================
    4.6 Company profile /companies/view/?id=
    ====================================================================== */
 function completeness(c){
  const items=[
   ['კომპანიის დასახელება და დარგი',!!(c.company&&c.industry)],
   ['ქალაქები, სადაც მუშაობ',c.serviceCities.length>0],
   ['„ჩვენს შესახებ“ — 2-3 წინადადება',String(c.about||'').trim().length>=60],
   ['„რას გთავაზობთ“ — მინიმუმ 3',c.offers.length>=3],
   ['„რას ვეძებთ“ — მინიმუმ 1',c.seeks.length>=1]
  ];
  return {items,pct:Math.round(items.filter(x=>x[1]).length/items.length*100)};
 }
 function renderCompanyPage(){
  const root=$('#company-root');if(!root)return;
  const id=params().get('id'),c=id?S.getCompany(id):null,u=S.currentUser();
  if(!c){
   document.title='კომპანია ვერ მოიძებნა — MeetAny';
   root.innerHTML=`<div class="ma-container ma-page">${emptyState({iconName:'building-2',title:'კომპანია ვერ მოიძებნა',text:'შესაძლოა პროფილი წაიშალა ან დროებით შეჩერებულია.',actions:'<a class="ma-btn ma-btn--primary" href="/companies/">ყველა კომპანია</a>',heading:'h1'})}</div>`;
   return;
  }
  document.title=c.company+' — კომპანია | MeetAny';
  const st=S.companyStats(c.id),isMe=!!u&&u.id===c.id,serves=servesList(c),isNew=st.sent<NEW_MEMBER;
  const stats=isNew
   ?`<div class="ma-stats ma-profile-stats"><div class="ma-stat ma-stat--new"><span class="ma-stat__icon">${I('sparkles')}</span><div><span class="ma-stat__value">ახალი წევრი</span><span class="ma-stat__label">ჯერ ${NEW_MEMBER}-ზე ნაკლები შეთავაზება</span></div></div></div>`
   :`<div class="ma-stats ma-profile-stats"><div class="ma-stat"><span class="ma-stat__value">${st.sent}</span><span class="ma-stat__label">გაგზავნილი შეთავაზება</span></div><div class="ma-stat"><span class="ma-stat__value">${st.chosen}</span><span class="ma-stat__label">არჩეული</span></div></div>`;
  const chips=list=>`<ul class="ma-chips">${list.map(x=>`<li class="ma-chip">${E(x)}</li>`).join('')}</ul>`;
  const requests=S.listRequests({ownerId:c.id});
  const check=isMe?completeness(c):null;
  const checklist=check&&check.pct<100?`<section class="ma-panel ma-profile-check" aria-labelledby="pc-title"><div class="ma-stepper"><div class="ma-stepper__label"><span id="pc-title">პროფილის შევსება ${check.pct}%</span></div><div class="ma-progress" role="progressbar" aria-labelledby="pc-title" aria-valuenow="${check.pct}" aria-valuemin="0" aria-valuemax="100"><span class="ma-progress__fill" style="--value:${check.pct}%"></span></div></div><ul class="ma-checklist">${check.items.map(([t,done])=>`<li class="${done?'is-done':''}">${I(done?'circle-check':'circle-x')}<span>${E(t)}<span class="ma-sr-only">${done?' — შევსებულია':' — შესავსებია'}</span></span></li>`).join('')}</ul><div><a class="ma-btn ma-btn--secondary" href="/account/?tab=profile">${I('pencil')}რედაქტირება</a></div></section>`:'';
  const section=(title,body)=>`<section class="ma-section ma-profile-sec"><h2 class="ma-section__title">${E(title)}</h2>${body}</section>`;
  const emptyLine=t=>`<p class="ma-muted">${E(t)}</p>`;
  root.innerHTML=`<div class="ma-band ma-profile-band"><div class="ma-container">
    <nav class="ma-crumbs" aria-label="ნავიგაცია"><a href="/companies/">კომპანიები</a>${I('chevron-right')}<a href="/companies/?industry=${encodeURIComponent(c.industry||'')}">${E(categories[c.industry]||'')}</a></nav>
    <div class="ma-profile-head">${avatar(c.company,'ma-avatar--xl')}
     <div class="ma-profile-head__id">
      <h1 class="ma-profile-head__name">${E(c.company)}</h1>
      ${c.verified?`<div class="ma-cluster">${verifiedBadge(c,'lg')}</div>`:''}
      <div class="ma-meta"><span>${I('briefcase-business')}${E(categories[c.industry]||'')}</span><span>${I('map-pin')}${E(cityName(c.city))}</span></div>
      ${serves?`<p class="ma-small ma-profile-serves">${I('truck')}<span>ემსახურება: ${E(serves)}</span></p>`:''}
      ${stats}
      ${isMe?'':note('კონტაქტი გაიხსნება, როცა მის შეთავაზებას აირჩევ.')}
     </div>
     <div class="ma-profile-head__actions">${isMe?`<a class="ma-btn ma-btn--secondary" href="/account/?tab=profile">${I('pencil')}რედაქტირება</a>`:newRequestBtn('ma-btn--primary',c.industry)}</div>
    </div>
   </div></div>
   <div class="ma-container ma-page">
    <div class="ma-layout">
     <div class="ma-layout__main">
      ${checklist}
      ${section('ჩვენს შესახებ',c.about?`<p class="ma-prose">${E(c.about)}</p>`:emptyLine(isMe?'აღწერა ჯერ არ დაგიმატებია. დაწერე 2-3 წინადადება — ასე კლიენტები უფრო მეტად გენდობიან.':'კომპანიას აღწერა ჯერ არ დაუმატებია.'))}
      ${section('რას გთავაზობთ',c.offers.length?chips(c.offers):emptyLine('ჯერ არ არის მითითებული.'))}
      ${c.seeks.length||isMe?section('რას ვეძებთ',c.seeks.length?chips(c.seeks):emptyLine('ჯერ არ არის მითითებული.')):''}
      ${requests.length?section('ღია მოთხოვნები',`<div class="ma-grid ma-grid--2">${requests.map(requestCard).join('')}</div>`):''}
     </div>
     <aside class="ma-layout__aside" aria-label="კომპანიის ფაქტები">
      <section class="ma-panel" aria-labelledby="facts-title"><h2 class="ma-panel__title" id="facts-title">ფაქტები</h2>
       <dl class="ma-kv">
        <div><dt>დარგი</dt><dd>${E(categories[c.industry]||'—')}</dd></div>
        <div><dt>ქალაქი</dt><dd>${E(cityName(c.city)||'—')}</dd></div>
        ${serves?`<div><dt>ემსახურება</dt><dd>${E(serves)}</dd></div>`:''}
        <div><dt>MeetAny-ზე</dt><dd>${E(memberSince(c.createdAt))}</dd></div>
        <div><dt>დადასტურება</dt><dd>${c.verified?`დადასტურებულია${c.verifiedAt?' '+E(dmy(c.verifiedAt)):''}`:'ჯერ არ არის'}</dd></div>
        ${EMAIL_CHECK?'<div><dt>ელფოსტა</dt><dd>დადასტურებულია</dd></div>':''}
       </dl>
       ${note(isMe?'ტელეფონი და ელფოსტა პროფილზე არასდროს ჩანს.':'ტელეფონი და ელფოსტა გაიხსნება, როცა მის შეთავაზებას აირჩევ.')}
      </section>
     </aside>
    </div>
   </div>`;
 }
 function skeletonProfile(root){
  root.innerHTML=`<div class="ma-band" aria-busy="true"><div class="ma-container ma-skeleton"><div class="ma-profile-head"><span class="ma-skel ma-skel--avatar-xl"></span><div class="ma-stack" style="--gap:12px"><span class="ma-skel ma-skel--h1"></span><span class="ma-skel ma-skel--line ma-skel--w40"></span><span class="ma-skel ma-skel--block ma-skel--facts"></span></div></div></div></div><div class="ma-container ma-page"><span class="ma-sr-only">იტვირთება…</span><div class="ma-layout ma-skeleton"><div class="ma-layout__main"><div class="ma-stack" style="--gap:12px"><span class="ma-skel ma-skel--title ma-skel--w40"></span><span class="ma-skel ma-skel--line ma-skel--w90"></span><span class="ma-skel ma-skel--line ma-skel--w60"></span></div></div><div class="ma-layout__aside"><div class="ma-card"><span class="ma-skel ma-skel--block"></span></div></div></div></div>`;
 }

 /* ======================================================================
    Account (legacy m-* layout until its redesign)
    ====================================================================== */
 function legacyStateBadge(r){
  const s=S.requestState(r);
  if(s==='open'){const d=S.daysLeft(r);return `<span class="m-badge ${d<=3?'warn':'ok'}">${I(d<=3?'hourglass':'clock')}${d<=1?'ბოლო დღე':d+' დღე დარჩა'}</span>`;}
  const cls={chosen:'brand',hidden:'danger'}[s]||'';
  return `<span class="m-badge ${cls}">${E(stateLabels[s])}</span>`;
 }
 const roleLabel=u=>u.role==='company'?'კომპანია':u.role==='admin'?'ადმინი':'კლიენტი';
 function profileFormHtml(u){
  const company=u.role==='company';
  return `<form id="profile-form" class="m-form" novalidate>
   <div class="m-grid2"><div class="m-field"><label for="pf-name">სახელი და გვარი *</label><input id="pf-name" name="name" required maxlength="80" value="${E(u.name)}" autocomplete="name"></div>
    <div class="m-field"><label for="pf-company">${company?'კომპანიის დასახელება *':'კომპანია / ობიექტი <small>არასავალდებულო</small>'}</label><input id="pf-company" name="company" maxlength="100" value="${E(u.company===u.name&&!company?'':u.company)}" autocomplete="organization"></div></div>
   <div class="m-grid2"><div class="m-field"><label for="pf-city">ქალაქი *</label><select id="pf-city" name="city">${optionList(cities,u.city)}</select></div>
    ${company?`<div class="m-field"><label for="pf-industry">მიმართულება *</label><select id="pf-industry" name="industry">${optionList(categories,u.industry||'','აირჩიე')}</select></div>`:'<div></div>'}</div>
   ${company?`<div class="m-field"><label for="pf-about">კომპანიის შესახებ <small>მაქს. 1000 სიმბოლო</small></label><textarea id="pf-about" name="about" maxlength="1000" rows="5" placeholder="რას აკეთებთ, რამდენი ხანია მუშაობთ, ვისთან თანამშრომლობთ…">${E(u.about)}</textarea></div>
   <div class="m-grid2"><div class="m-field"><label for="pf-offers">რას ვთავაზობთ <small>თითო ხაზზე ერთი, მაქს. 8</small></label><textarea id="pf-offers" name="offers" rows="5" placeholder="საბანკეტო სკამები&#10;მაგიდები შეკვეთით">${E(u.offers.join('\n'))}</textarea></div>
    <div class="m-field"><label for="pf-seeks">რას ვეძებთ <small>თითო ხაზზე ერთი, მაქს. 8</small></label><textarea id="pf-seeks" name="seeks" rows="5" placeholder="ხის მასალის მომწოდებელი&#10;დისტრიბუტორი ბათუმში">${E(u.seeks.join('\n'))}</textarea></div></div>
   <fieldset class="m-field" style="border:0;padding:0;margin:0"><legend class="m-label" style="margin-bottom:8px">რომელ ქალაქებს ემსახურებით?</legend><div class="m-cities">${Object.entries(cities).map(([k,v])=>`<label><input type="checkbox" name="serviceCities" value="${k}" ${u.serviceCities.includes(k)?'checked':''}>${E(v)}</label>`).join('')}</div></fieldset>`:''}
   <p class="m-hint" style="margin:0">ტელეფონისა და ელფოსტის შესაცვლელად დაუკავშირდი MeetAny-ს გუნდს.</p>
   <div class="m-actions"><button class="m-btn m-btn-primary" type="submit">${I('check')} შენახვა</button><a class="m-btn m-btn-secondary" href="/account/">გაუქმება</a></div>
  </form>`;
 }
 function renderAccountPage(){
  const root=$('#account-root');if(!root)return;
  const u=S.currentUser(),p=params();
  if(!u){
   const mode=p.get('tab')==='register'||p.get('mode')==='register'?'register':p.get('tab')==='reset'||S.pendingResetEmail()?'reset':'login';
   root.innerHTML=`<div class="m-wrap m-page"><div class="m-auth">
    <div><h1>${mode==='register'?'შექმენი ანგარიში':'შედი ანგარიშში'}</h1><p class="m-auth-lead">MeetAny აკავშირებს ბიზნესებს: კლიენტები წერენ მოთხოვნებს, კომპანიები კი უგზავნიან შეთავაზებებს ფასით.</p>
     <ul class="m-auth-points"><li>${I('lock')}<span>შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ხედავს — კონკურენტები ერთმანეთის ფასს ვერ ხედავენ.</span></li><li>${I('phone')}<span>ტელეფონი და ელფოსტა ჩანს მხოლოდ მაშინ, როცა შეთავაზება აირჩევა.</span></li><li>${I('badge-check')}<span>კომპანიებს MeetAny-ს გუნდი ამოწმებს და ანიჭებს „დადასტურებულის“ ნიშანს.</span></li></ul></div>
    <div class="m-panel" id="auth-root">${authFormHtml(mode,p.get('role'))}</div></div></div>`;
   const ar=$('#auth-root');bindAuth(ar);if(!showAuthState(ar)&&S.pendingEmail()&&mode!=='reset')showCodeStep(ar,undefined,S.pendingEmail());return;
  }
  const tab=p.get('tab')==='profile'?'profile':'overview';
  const mine=S.listRequests({ownerId:u.id,state:'',includeHidden:true});
  const offers=S.myOffers(u);
  const matching=u.role==='company'?S.listRequests({category:u.industry}).filter(r=>r.ownerId!==u.id):[];
  const requestLine=r=>`<li><div><a href="${requestHref(r)}">${E(r.title)}</a><small>${E(categories[r.category]||'')} · ${E(cityName(r.city))} · ${E(ago(r.createdAt))} · ${S.offerCount(r.id)} შეთავაზება</small></div><div class="m-actions">${legacyStateBadge(r)}${['open','expired','closed'].includes(S.requestState(r))?`<button type="button" class="m-btn m-btn-secondary m-btn-sm" data-owner="extend" data-request-id="${r.id}">+${S.EXTEND_DAYS} დღე</button>`:''}</div></li>`;
  const offerLine=o=>{const r=S.getRequest(o.requestId);return r?`<li><div><a href="${requestHref(r)}">${E(r.title)}</a><small>${E(offerSummary(o))} · ${E(ago(o.createdAt))}</small></div><div class="m-actions">${o.status==='chosen'?`<span class="m-badge ok">${I('check')}არჩეულია</span>`:o.status==='declined'?'<span class="m-badge">არ აირჩიეს</span>':legacyStateBadge(r)}</div></li>`:'';};
  const incomplete=u.role==='company'&&!u.about&&!u.offers.length;
  root.innerHTML=`<div class="m-wrap m-page"><div class="m-account">
   <aside class="m-panel m-account-card"><span class="ma-avatar ma-avatar--xl" aria-hidden="true">${E(initials(u.company))}</span><h1>${E(u.company)}</h1><div class="m-sub">${E(u.name)} · ${roleLabel(u)}</div>
    <div class="m-badges">${u.verified?`<span class="m-badge ok">${I('badge-check')}დადასტურებული</span>`:''}${u.blocked?'<span class="m-badge danger">დაბლოკილია</span>':''}</div>
    <div class="m-kv"><div>${I('phone')}<b>${E(u.phone)}</b></div><div>${I('mail')}<b>${E(u.email)}</b></div><div>${I('map-pin')}<span>${E(cityName(u.city))}</span></div>${u.industry?`<div>${I('briefcase-business')}<span>${E(categories[u.industry]||'')}</span></div>`:''}</div>
    <div class="m-side-actions">
     <button class="m-btn m-btn-primary" data-market="new-request">${I('plus')} მოთხოვნის დამატება</button>
     ${u.role==='company'?`<a class="m-btn m-btn-secondary" href="${companyHref(u.id)}">${I('eye')} საჯარო პროფილი</a>`:''}
     ${u.role==='admin'?`<a class="m-btn m-btn-secondary" href="/admin/">${I('settings')} ადმინ-პანელი</a>`:''}
     <button class="m-btn m-btn-ghost" data-market="logout">${I('log-out')} გასვლა</button>
    </div>
    <div class="m-lock" style="margin-top:14px">${I('lock')}<span>ტელეფონი და ელფოსტა ჩანს მხოლოდ მაშინ, როცა შეთავაზება აირჩევა.</span></div>
   </aside>
   <div>
    <nav class="m-tabs" style="margin-bottom:20px" aria-label="ანგარიშის განყოფილებები"><a href="/account/" ${tab==='overview'?'aria-current="page"':''}>მიმოხილვა</a><a href="/account/?tab=profile" ${tab==='profile'?'aria-current="page"':''}>${u.role==='company'?'კომპანიის პროფილი':'პროფილი'}</a></nav>
    ${tab==='profile'?`<section class="m-section"><h2>${u.role==='company'?'კომპანიის პროფილი':'პროფილი'}</h2><p class="m-lead">${u.role==='company'?'ეს ინფორმაცია ჩანს შენს საჯარო პროფილზე და კომპანიების კატალოგში.':'სახელი და კომპანია ჩანს შენს მოთხოვნებზე.'}</p><div class="m-panel">${profileFormHtml(u)}</div></section>`:`
    ${incomplete?`<div class="m-lock" style="margin-bottom:20px;background:var(--blue-50)">${I('info')}<span>შეავსე კომპანიის პროფილი — აღწერა და „რას ვთავაზობთ“ ჩანს კატალოგში და ეხმარება კლიენტებს შენს არჩევაში. <a href="/account/?tab=profile">პროფილის შევსება</a></span></div>`:''}
    ${u.role==='company'?`<section class="m-section"><h2>ღია მოთხოვნები შენი მიმართულებით <span class="m-badge">${matching.length}</span></h2><p class="m-lead">„${E(categories[u.industry]||'')}“</p>${matching.length?`<ul class="m-rows">${matching.slice(0,5).map(r=>`<li><div><a href="${requestHref(r)}">${E(r.title)}</a><small>${E(cityName(r.city))} · ${E(ago(r.createdAt))} · ${S.offerCount(r.id)} შეთავაზება</small></div><div class="m-actions">${legacyStateBadge(r)}</div></li>`).join('')}</ul>${matching.length>5?`<p><a class="m-btn m-btn-ghost" href="/requests/?category=${E(u.industry)}">ყველა (${matching.length}) ${I('arrow-right')}</a></p>`:''}`:'<p class="m-empty-line">ამ მიმართულებით ღია მოთხოვნა ახლა არ არის.</p>'}</section>
    <section class="m-section"><h2>ჩემი შეთავაზებები <span class="m-badge">${offers.length}</span></h2>${offers.length?`<ul class="m-rows">${offers.map(offerLine).join('')}</ul>`:'<p class="m-empty-line">ჯერ შეთავაზება არ გაგიგზავნია. <a href="/requests/">ნახე მოთხოვნები</a></p>'}</section>`:''}
    <section class="m-section"><h2>ჩემი მოთხოვნები <span class="m-badge">${mine.length}</span></h2>${mine.length?`<ul class="m-rows">${mine.map(requestLine).join('')}</ul>`:`<p class="m-empty-line">მოთხოვნა ჯერ არ გაქვს. <button class="m-link" data-market="new-request">დაამატე პირველი</button></p>`}</section>`}
   </div></div></div>`;
  const form=$('#profile-form');
  if(form)form.addEventListener('submit',e=>{e.preventDefault();busy(submitOf(form),async()=>{try{const d=formData(form);d.serviceCities=[...form.querySelectorAll('input[name="serviceCities"]:checked')].map(x=>x.value);await S.updateProfile(d);toast('პროფილი შენახულია.');}catch(err){showError(form,err);}});});
 }

 /* ======================================================================
    Admin (legacy m-* layout until its redesign)
    ====================================================================== */
 function renderAdminPage(){
  const root=$('#admin-root');if(!root)return;
  const u=S.currentUser();
  if(u?.role!=='admin'){root.innerHTML=`<div class="m-wrap m-page"><div class="m-empty">${I('lock')}<h1>ადმინ-პანელი</h1><p>ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.</p>${u?'':'<div class="m-actions"><button class="m-btn m-btn-primary" data-market="login">შესვლა</button></div>'}</div></div>`;return;}
  const st=S.stats(),tab=params().get('tab')==='users'?'users':'requests';
  const reqs=S.listRequests({state:'',includeHidden:true}),users=S.allUsers();
  root.innerHTML=`<section class="m-head"><div class="m-wrap"><h1>ადმინ-პანელი</h1><p>მოდერაცია: მოთხოვნების დამალვა, მომხმარებლების დაბლოკვა და კომპანიების დადასტურება.</p></div></section>
   <div class="m-wrap m-page">
   <div class="m-kpis">${[['მომხმარებელი',st.users],['კომპანია',st.companies],['დადასტურებული',st.verified],['ღია მოთხოვნა',st.open],['შეთავაზება',st.offers],['არჩეული გარიგება',st.chosen]].map(([l,v])=>`<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
   <nav class="m-tabs" style="margin-bottom:16px"><a href="?tab=requests" ${tab==='requests'?'aria-current="page"':''}>მოთხოვნები (${reqs.length})</a><a href="?tab=users" ${tab==='users'?'aria-current="page"':''}>მომხმარებლები (${users.length})</a></nav>
   ${tab==='requests'?`<div class="m-table-wrap"><table class="m-table"><thead><tr><th>მოთხოვნა</th><th>ავტორი</th><th>სტატუსი</th><th>შეთავ.</th><th>მოქმედება</th></tr></thead><tbody>${reqs.map(r=>{const o=S.userById(r.ownerId);return `<tr class="${r.hidden?'is-muted':''}"><td><a href="${requestHref(r)}">${E(r.title)}</a><small>${E(categories[r.category]||'')} · ${E(ago(r.createdAt))}</small></td><td>${E(o?.company||'—')}<small>${E(o?.phone||'')}</small></td><td>${legacyStateBadge(r)}</td><td>${S.offerCount(r.id)}</td><td><div class="m-actions"><button type="button" class="m-btn m-btn-secondary m-btn-sm" data-admin-hide="${r.id}" data-hidden="${r.hidden?'0':'1'}">${I(r.hidden?'eye':'ban')}${r.hidden?'გამოჩენა':'დამალვა'}</button><button type="button" class="m-btn m-btn-danger m-btn-sm" data-admin-delete="${r.id}">${I('trash-2')}წაშლა</button></div></td></tr>`;}).join('')}</tbody></table></div>`
   :`<div class="m-table-wrap"><table class="m-table"><thead><tr><th>მომხმარებელი</th><th>როლი</th><th>კონტაქტი</th><th>სტატუსი</th><th>მოქმედება</th></tr></thead><tbody>${users.map(x=>`<tr class="${x.blocked?'is-muted':''}"><td>${x.role==='company'?`<a href="${companyHref(x.id)}">${E(x.company)}</a>`:`<b>${E(x.company)}</b>`}<small>${E(x.name)} · ${E(cityName(x.city))}</small></td><td>${roleLabel(x)}${x.industry?`<small>${E(categories[x.industry]||'')}</small>`:''}</td><td>${E(x.phone)}<small>${E(x.email)}</small></td><td>${x.blocked?'<span class="m-badge danger">დაბლოკილი</span>':x.verified?`<span class="m-badge ok">${I('badge-check')}დადასტურებული${x.verifiedAt?' '+E(dmy(x.verifiedAt)):''}</span>`:'<span class="m-badge">აქტიური</span>'}</td><td><div class="m-actions">${x.role==='company'?`<button type="button" class="m-btn m-btn-secondary m-btn-sm" data-admin-verify="${x.id}" data-value="${x.verified?'0':'1'}">${I('shield-check')}${x.verified?'დადასტ. მოხსნა':'დადასტურება'}</button>`:''}${x.role!=='admin'?`<button type="button" class="m-btn m-btn-sm ${x.blocked?'m-btn-secondary':'m-btn-danger'}" data-admin-block="${x.id}" data-value="${x.blocked?'0':'1'}">${I('ban')}${x.blocked?'განბლოკვა':'დაბლოკვა'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`}
   </div>`;
 }
 document.addEventListener('click',e=>{
  const hide=e.target.closest('[data-admin-hide]');
  if(hide)busy(hide,async()=>{try{await S.adminSetHidden(hide.dataset.adminHide,hide.dataset.hidden==='1');toast(hide.dataset.hidden==='1'?'მოთხოვნა დაიმალა.':'მოთხოვნა ისევ ჩანს.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
  const del=e.target.closest('[data-admin-delete]');
  if(del){if(!del.dataset.confirm){del.dataset.confirm='1';del.innerHTML=I('trash-2')+'დაადასტურე';del.classList.add('is-confirm');return;}busy(del,async()=>{try{await S.adminDeleteRequest(del.dataset.adminDelete);toast('მოთხოვნა წაიშალა.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});}
  const ver=e.target.closest('[data-admin-verify]');
  if(ver)busy(ver,async()=>{try{await S.adminSetVerified(ver.dataset.adminVerify,ver.dataset.value==='1');toast(ver.dataset.value==='1'?'კომპანია დადასტურდა.':'დადასტურება მოიხსნა.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
  const blk=e.target.closest('[data-admin-block]');
  if(blk)busy(blk,async()=>{try{await S.adminSetBlocked(blk.dataset.adminBlock,blk.dataset.value==='1');toast(blk.dataset.value==='1'?'მომხმარებელი დაიბლოკა.':'მომხმარებელი განიბლოკა.','info');}catch(err){toast(err.userMessage||'ვერ შესრულდა.','info');}});
 });

 /* ======================================================================
    Home: live category counts, real companies (verified first), hero search
    ====================================================================== */
 // The older home layout (body.design-two) has #featured-companies styled by the legacy m-* rows.
 function legacyCompanyRow(c){
  const st=S.companyStats(c.id),tags=c.offers.slice(0,3).map(t=>`<span class="m-chip plain">${E(t)}</span>`).join('');
  return `<article class="m-company"><span class="m-avatar" style="background:var(--action)" aria-hidden="true">${E(initials(c.company))}</span><div><h3><a href="${companyHref(c.id)}">${E(c.company)}</a>${c.verified?`<span class="m-verified">${I('badge-check')}დადასტურებული</span>`:''}</h3><div class="m-sub">${E(categories[c.industry]||'')} · ${E(cityName(c.city))}</div>${c.about?`<p>${E(c.about)}</p>`:''}${tags?`<div class="m-tags">${tags}</div>`:''}</div>
   <div class="m-company-side"><span class="m-count">${I('send')}<b>${st.sent}</b>შეთავაზება${st.chosen?' · '+st.chosen+' არჩეული':''}</span><a class="m-btn m-btn-secondary m-btn-sm" href="${companyHref(c.id)}">პროფილი ${I('arrow-right')}</a></div></article>`;
 }
 function renderLegacyHome(){
  const featured=$('#featured-companies');if(!featured)return;
  const all=S.listCompanies(),list=[...all.filter(c=>c.verified),...all.filter(c=>!c.verified)].slice(0,3);
  featured.classList.add('m-list');featured.classList.remove('company-grid');
  featured.innerHTML=list.length?list.map(legacyCompanyRow).join(''):`<div class="m-empty">${I('store')}<h2>კომპანიები მალე გამოჩნდება</h2><p>დაარეგისტრირე შენი კომპანია და იყავი პირველი კატალოგში.</p><div class="m-actions"><button class="m-btn m-btn-primary" data-market="register-company">დაარეგისტრირე კომპანია</button></div></div>`;
  $$('a[href^="/categories/"]').forEach(a=>{a.href='/companies/';});
 }
 function renderHome(){
  renderLegacyHome();
  const box=$('#home-companies');if(!box)return;
  $$('[data-cat-count]').forEach(el=>{const n=S.listCompanies({industry:el.dataset.catCount}).length;el.textContent=n?n+' კომპანია':'';});
  const all=S.listCompanies(),list=[...all.filter(c=>c.verified),...all.filter(c=>!c.verified)].slice(0,6);
  box.removeAttribute('aria-busy');
  box.innerHTML=list.length?`<div class="ma-grid">${list.map(companyCard).join('')}</div>`:emptyState({iconName:'building-2',title:'კომპანიები მალე გამოჩნდება',text:'დაარეგისტრირე შენი კომპანია და იყავი პირველი კატალოგში.',actions:'<button type="button" class="ma-btn ma-btn--primary" data-market="register-company">კომპანიის რეგისტრაცია</button>',heading:'h3'});
 }
 // Hero search: the segmented control picks the list the query goes to (companies or requests).
 $('#home-search')?.addEventListener('change',e=>{if(e.target.name==='where')e.currentTarget.action=e.target.value;});
 $('#home-search')?.addEventListener('submit',e=>{const f=e.currentTarget;f.querySelectorAll('[name=where]').forEach(r=>r.disabled=true);setTimeout(()=>f.querySelectorAll('[name=where]').forEach(r=>r.disabled=false));});

 /* ======================================================================
    Wiring
    ====================================================================== */
 const renderers={
  requests:()=>{const root=$('#requests-root');if(root)mountRequests(root);},
  request:renderRequestPage,
  companies:()=>{const root=$('#companies-root');if(root)mountCompanies(root);},
  company:renderCompanyPage,
  account:renderAccountPage,
  admin:renderAdminPage,
  home:renderHome
 };
 const skeletons={requests:['#requests-root',skeletonRequests],request:['#request-root',skeletonRequest],companies:['#companies-root',skeletonCompanies],company:['#company-root',skeletonProfile]};
 const pageRoots=['#requests-root','#request-root','#companies-root','#company-root','#account-root','#admin-root'];
 // Without a configured, reachable backend the page shows one calm message instead of broken data.
 function renderUnavailable(){
  $('#home-companies-section')?.setAttribute('hidden','');
  pageRoots.forEach(sel=>{const root=$(sel);if(root)root.innerHTML=`<div class="ma-container ma-page">${emptyState({iconName:'refresh-cw',title:S.UNAVAILABLE_MESSAGE,text:'სცადე ცოტა ხანში — გვერდი თავიდან ჩატვირთე.',actions:'<button type="button" class="ma-btn ma-btn--secondary" data-reload>თავიდან ცდა</button>',heading:'h1'})}</div>`;});
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-reload]'))location.reload();});
 // Loading shows skeletons in the final layout, never a blank page (spec §4).
 function renderSkeleton(){const s=skeletons[page];if(!s)return;const root=$(s[0]);if(root&&!root.children.length)s[1](root);}
 function renderAll(){
  if(!S.isReady())return;
  // The shell also subscribes itself; calling it here keeps the header right even if it ran before the store existed.
  try{Shell?.renderUser?.(S.currentUser());}catch(err){console.error(err);}
  if(!S.isAvailable()){renderUnavailable();return;}
  try{(renderers[page]||renderHome)();}catch(err){console.error(err);}
  // /requests/new/ : open the new-request form once, over the list; the address becomes the list URL.
  if(document.body.dataset.open==='new-request'){delete document.body.dataset.open;history.replaceState(history.state,'','/requests/'+location.search);try{openRequestForm({category:new URLSearchParams(location.search).get('category')||''});}catch(err){console.error(err);}}
 }
 if(!S.isReady())renderSkeleton();
 S.subscribe(renderAll);
 S.ready().then(renderAll);
})();
