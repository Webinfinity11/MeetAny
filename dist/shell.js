/* MeetAny shell behaviour (loaded on every page, after app.js and before market.js).
   Owns: the mobile menu sheet (#ma-mnav), dropdown menus (.ma-menu), the active nav link, the
   role-specific header parts, toasts (.ma-toasts), copy buttons, „მეტის ნახვა“ toggles and
   .ma-sheet dialogs. Markup: scripts/shell.html. Styles: market.css (ma-* classes).
   Public API: window.MeetAnyShell = {renderUser, toast, openSheet, closeSheet, closeMenus, setActiveNav}.
   The header re-renders itself from window.MarketStore when present; market.js may also call
   MeetAnyShell.renderUser(user) — rendering is idempotent. */
(function(){
 'use strict';
 const doc=document,$=(s,r=doc)=>r.querySelector(s),$$=(s,r=doc)=>[...r.querySelectorAll(s)];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Same versioned sprite URL as the static markup, so icons come from one cached file.
 const sprite=($('.ma-header use,.ma-mnav use')?.getAttribute('href')||'/icons.svg#x').split('#')[0];
 const ic=(name,cls='')=>`<svg class="icon${cls?' '+cls:''}" aria-hidden="true"><use href="${sprite}#${name}"></use></svg>`;

 /* ---------- active navigation ---------- */
 function setActiveNav(key){
  if(key===undefined){
   const page=doc.body.dataset.marketPage||'',path=location.pathname;
   key={requests:'requests',request:'requests',companies:'companies',company:'companies'}[page]
    ||(path.startsWith('/requests')?'requests':path.startsWith('/companies')?'companies':'');
  }
  $$('[data-nav]').forEach(a=>{if(a.dataset.nav===key&&key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 }

 /* ---------- mobile menu sheet ---------- */
 const mnav=$('#ma-mnav'),openBtn=$('[data-shell="menu-open"]');
 function openMenu(){if(!mnav||mnav.open)return;mnav.showModal();openBtn?.setAttribute('aria-expanded','true');$('[data-shell="menu-close"]',mnav)?.focus();}
 function closeMenu(){if(mnav?.open)mnav.close();}
 if(mnav){
  openBtn?.addEventListener('click',openMenu);
  mnav.addEventListener('close',()=>{openBtn?.setAttribute('aria-expanded','false');if(!doc.querySelector('dialog[open]'))openBtn?.focus({preventScroll:true});});
  // Any navigation or action inside the menu closes it first (actions such as login then open their own dialog).
  mnav.addEventListener('click',e=>{
   if(e.target.closest('[data-shell="menu-close"],a[href],[data-market]'))closeMenu();
   else if(e.target===mnav){const r=mnav.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();}
  });
  matchMedia('(min-width:1024px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
 }

 /* ---------- dropdown menus (.ma-menu > .ma-menu__trigger + .ma-menu__list[hidden]) ---------- */
 function closeMenus(except){
  $$('.ma-menu__trigger[aria-expanded="true"]').forEach(t=>{if(t===except)return;t.setAttribute('aria-expanded','false');const l=listOf(t);if(l)l.hidden=true;});
 }
 const listOf=t=>t.getAttribute('aria-controls')?doc.getElementById(t.getAttribute('aria-controls')):t.closest('.ma-menu')?.querySelector('.ma-menu__list');
 const items=l=>$$('.ma-menu__item:not(:disabled)',l);
 doc.addEventListener('click',e=>{
  const t=e.target.closest('.ma-menu__trigger');
  if(t){const l=listOf(t);if(!l)return;const open=t.getAttribute('aria-expanded')!=='true';closeMenus(t);t.setAttribute('aria-expanded',String(open));l.hidden=!open;if(open&&e.detail===0)items(l)[0]?.focus();return;}
  if(e.target.closest('.ma-menu__item'))closeMenus();
  else if(!e.target.closest('.ma-menu__list'))closeMenus();
 });
 doc.addEventListener('keydown',e=>{
  const list=e.target.closest?.('.ma-menu__list'),trigger=e.target.closest?.('.ma-menu__trigger');
  if(e.key==='Escape'&&(list||trigger)){const menu=(list||trigger).closest('.ma-menu');const t=$('.ma-menu__trigger',menu);if(t?.getAttribute('aria-expanded')==='true'){e.preventDefault();closeMenus();t.focus();}return;}
  if(trigger&&e.key==='ArrowDown'){e.preventDefault();const l=listOf(trigger);closeMenus(trigger);trigger.setAttribute('aria-expanded','true');l.hidden=false;items(l)[0]?.focus();return;}
  if(list&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();const all=items(list),i=all.indexOf(doc.activeElement);all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus();}
 });
 doc.addEventListener('focusout',e=>{const menu=e.target.closest?.('.ma-menu');if(menu&&e.relatedTarget&&!menu.contains(e.relatedTarget))closeMenus();});

 /* ---------- role-specific header ---------- */
 function initials(name){
  const clean=String(name||'?').replace(/[„“"'«»()]/g,'').replace(/^(შპს|სს|ი\/მ|ააიპ)\s+/,'').trim();
  const parts=clean.split(/\s+/).filter(Boolean);
  // Latin only: upper-casing Georgian would produce mtavruli code points.
  return [...(parts.length>1?parts[0][0]+parts[1][0]:clean.slice(0,2))].map(c=>/[a-z]/.test(c)?c.toUpperCase():c).join('');
 }
 const newRequestBtn=(cls,label=true)=>`<a class="ma-btn ma-btn--primary ${cls}" href="/requests/new/" data-market="new-request">${ic('plus')}${label?'<span class="ma-header__cta-label">მოთხოვნის დამატება</span>':'მოთხოვნის დამატება'}</a>`;
 function accountLinks(u){
  const company=u.role==='company';
  const links=company
   ?[['send','ჩემი შეთავაზებები','/account/?tab=offers'],['building-2','საჯარო პროფილი','/companies/view/?id='+encodeURIComponent(u.id)],['plus','მოთხოვნის დამატება','/requests/new/','new-request'],['settings','პარამეტრები','/account/?tab=settings']]
   :[['clipboard-list','ჩემი მოთხოვნები','/account/?tab=requests'],['user-round','პროფილი','/account/?tab=profile'],['settings','პარამეტრები','/account/?tab=settings']];
  if(u.role==='admin')links.unshift(['shield-check','ადმინი','/admin/']);
  return links;
 }
 function renderUser(u){
  const slot=$('[data-shell-slot="actions"]'),menuAcc=$('[data-shell-slot="menu-account"]'),menuFoot=$('[data-shell-slot="menu-foot"]');
  if(!slot)return;
  const key=u?[u.id,u.role,u.company,u.name,u.email,u.industry].join('|'):'anon';
  if(slot.dataset.user===key)return;slot.dataset.user=key;
  if(!u){
   slot.innerHTML=`<a class="ma-btn ma-btn--ghost ma-header__login" href="/account/" data-market="login">შესვლა</a>${newRequestBtn('ma-header__cta')}`;
   if(menuAcc)menuAcc.innerHTML=`<span class="ma-eyebrow">ანგარიში</span><a class="ma-mnav__link" href="/account/" data-market="login">${ic('user-round')}შესვლა</a><a class="ma-mnav__link" href="/account/?tab=register&amp;role=company" data-market="register-company">${ic('store')}კომპანიის რეგისტრაცია</a>`;
   if(menuFoot)menuFoot.innerHTML=newRequestBtn('ma-btn--lg ma-btn--block',false);
   return;
  }
  const company=u.role==='company',name=u.company||u.name||'ანგარიში';
  const primary=company
   ?`<a class="ma-btn ma-btn--primary ma-header__cta" href="/requests/${u.industry?'?category='+encodeURIComponent(u.industry):''}">${ic('search')}<span class="ma-header__cta-label">მოთხოვნების ნახვა</span></a>`
   :newRequestBtn('ma-header__cta');
  const links=accountLinks(u).filter(l=>l[0]!=='shield-check');
  const item=([icon,label,href,market])=>`<a class="ma-menu__item" role="menuitem" href="${esc(href)}"${market?` data-market="${market}"`:''}>${ic(icon)}${esc(label)}</a>`;
  slot.innerHTML=`${u.role==='admin'?`<a class="ma-btn ma-btn--ghost ma-header__admin" href="/admin/">${ic('shield-check')}ადმინი</a>`:''}${primary}
   <div class="ma-menu ma-header__account"><button type="button" class="ma-menu__trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="ma-account-menu" title="${esc(name)}"><span class="ma-avatar ma-avatar--sm" aria-hidden="true">${esc(initials(name))}</span><span>${esc(name)}</span>${ic('chevron-down')}</button>
    <div class="ma-menu__list" id="ma-account-menu" role="menu" hidden><div class="ma-menu__head"><b>${esc(name)}</b><span>${esc(u.email||'')}</span></div>${links.map(item).join('')}<div class="ma-menu__sep" role="separator"></div><button type="button" class="ma-menu__item ma-menu__item--danger" role="menuitem" data-market="logout">${ic('log-out')}გასვლა</button></div></div>`;
  if(menuAcc)menuAcc.innerHTML=`<span class="ma-eyebrow">ანგარიში</span><div class="ma-mnav__user"><span class="ma-avatar" aria-hidden="true">${esc(initials(name))}</span><div><b>${esc(name)}</b><span>${esc(u.email||'')}</span></div></div>${accountLinks(u).map(([icon,label,href,market])=>`<a class="ma-mnav__link" href="${esc(href)}"${market?` data-market="${market}"`:''}>${ic(icon)}${esc(label)}</a>`).join('')}<button type="button" class="ma-mnav__link ma-mnav__link--danger" data-market="logout">${ic('log-out')}გასვლა</button>`;
  if(menuFoot)menuFoot.innerHTML=company
   ?`<a class="ma-btn ma-btn--primary ma-btn--lg ma-btn--block" href="/requests/${u.industry?'?category='+encodeURIComponent(u.industry):''}">${ic('search')}მოთხოვნების ნახვა</a>`
   :newRequestBtn('ma-btn--lg ma-btn--block',false);
 }

 /* ---------- toasts: success / info, 5s, closable ---------- */
 function toast(message,{type='success',timeout=5000}={}){
  let box=$('#ma-toasts');
  if(!box){box=doc.createElement('div');box.className='ma-toasts';box.id='ma-toasts';box.setAttribute('aria-live','polite');doc.body.append(box);}
  const t=doc.createElement('div');t.className='ma-toast ma-toast--'+(type==='info'?'info':'success');t.setAttribute('role','status');
  t.innerHTML=`${ic(type==='info'?'info':'circle-check')}<span class="ma-toast__text">${esc(message)}</span><button type="button" class="ma-toast__close" aria-label="დახურვა">${ic('x')}</button>`;
  const remove=()=>{if(!t.isConnected)return;t.classList.add('is-leaving');setTimeout(()=>t.remove(),220);};
  t.querySelector('.ma-toast__close').addEventListener('click',remove);
  box.append(t);while(box.children.length>3)box.firstElementChild.remove();
  let timer=setTimeout(remove,timeout);
  t.addEventListener('mouseenter',()=>clearTimeout(timer));t.addEventListener('mouseleave',()=>{timer=setTimeout(remove,2000);});
  return t;
 }

 /* ---------- VerifiedBadge tooltip: keep it inside the viewport (sets --tip-x) ---------- */
 function placeTip(e){
  const tip=e.target.closest?.('.ma-verified')?.querySelector('.ma-verified__tip');if(!tip)return;
  tip.style.setProperty('--tip-x','0px');
  const r=tip.getBoundingClientRect(),vw=doc.documentElement.clientWidth,over=r.right-(vw-12),under=12-r.left;
  tip.style.setProperty('--tip-x',(over>0?-over:under>0?under:0)+'px');
 }
 doc.addEventListener('mouseover',placeTip);doc.addEventListener('focusin',placeTip);

 /* ---------- copy buttons: <button data-ma-copy="text"> ---------- */
 doc.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ma-copy]');if(!b)return;
  try{await navigator.clipboard.writeText(b.dataset.maCopy);toast('დაკოპირდა: '+b.dataset.maCopy,{type:'info'});}
  catch{toast(b.dataset.maCopy,{type:'info'});}
 });

 /* ---------- „მეტის ნახვა“: <button data-ma-more aria-controls="id" aria-expanded="false"> ---------- */
 doc.addEventListener('click',e=>{
  const b=e.target.closest('[data-ma-more]');if(!b)return;
  const target=doc.getElementById(b.getAttribute('aria-controls'));if(!target)return;
  const open=!target.classList.contains('is-expanded');target.classList.toggle('is-expanded',open);
  b.setAttribute('aria-expanded',String(open));b.textContent=open?'ნაკლების ჩვენება':'მეტის ნახვა';
 });

 /* ---------- sheets: <dialog class="ma-sheet">; close only via [data-ma-sheet-close] or Esc.
      A form marked data-ma-dirty="1" asks before closing, so typed work is never lost. ---------- */
 const openers=new WeakMap();
 const confirmClose=d=>!d.querySelector('form[data-ma-dirty="1"]')||confirm('შეყვანილი ტექსტი არ შეინახება. დავხურო?');
 function openSheet(d,opener=doc.activeElement){if(!d||d.open)return;openers.set(d,opener);d.showModal();(d.querySelector('[autofocus]')||d.querySelector('.ma-sheet__close'))?.focus();}
 function closeSheet(d,force){if(!d?.open)return false;if(!force&&!confirmClose(d))return false;d.close();return true;}
 doc.addEventListener('click',e=>{const c=e.target.closest('[data-ma-sheet-close]');if(c)closeSheet(c.closest('dialog'));});
 doc.addEventListener('cancel',e=>{const d=e.target;if(d.matches?.('.ma-sheet')&&!confirmClose(d))e.preventDefault();},true);
 doc.addEventListener('close',e=>{const d=e.target;if(d.matches?.('.ma-sheet')){const o=openers.get(d);if(o?.isConnected)o.focus({preventScroll:true});}},true);
 doc.addEventListener('input',e=>{const f=e.target.closest?.('.ma-sheet form');if(f)f.dataset.maDirty='1';});

 /* ---------- wire-up ---------- */
 setActiveNav();
 window.MeetAnyShell={renderUser,toast,openSheet,closeSheet,closeMenus,setActiveNav,openMenu,closeMenu};
 // Deferred scripts run in order, so MarketStore (loaded after this file) exists by DOMContentLoaded.
 const hook=()=>{const S=window.MarketStore;if(!S?.subscribe)return;const r=()=>{try{if(S.isReady())renderUser(S.currentUser());}catch(err){console.error(err);}};S.subscribe(r);S.ready?.().then(r,()=>{});r();};
 // Deferred scripts run while readyState is already 'interactive', so wait for the store explicitly.
 if(window.MarketStore||doc.readyState==='complete')hook();else doc.addEventListener('DOMContentLoaded',hook,{once:true});
})();
