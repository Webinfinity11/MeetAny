// Builds the v2 beta marketplace pages and wires them into existing v2 pages.
// Idempotent: run `node scripts/generate-market.cjs` after changing market files or v2 markup.
// Design 01 (dist root) is never touched.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.join(__dirname, '..', 'dist'), v2 = path.join(root, 'v2');
const SITE = 'https://meet-any.vercel.app';
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(v2, f))).digest('hex').slice(0, 12);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const assets = `<link rel="stylesheet" href="/v2/market.css?v=${hash('market.css')}"><script src="/v2/market-store.js?v=${hash('market-store.js')}" defer></script><script src="/v2/market.js?v=${hash('market.js')}" defer></script>`;

// Seeded demo requests, read from the store itself so share pages always match the data.
const ctx = { window: { addEventListener() {} }, Date, Math, JSON, String, Number, Object, Error, Set, URLSearchParams };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(v2, 'market-store.js'), 'utf8'), ctx);
const store = ctx.window.MarketStore;
const seeded = store.listRequests({ state: '' }).filter(r => r.slug);

function wire(html) {
  html = html.replace(/<link rel="stylesheet" href="\/v2\/market\.css[^>]*>|<script src="\/v2\/market(?:-store)?\.js[^>]*><\/script>/g, '');
  html = html.replace('</head>', assets + '</head>');
  if (!html.includes('class="nav-requests"'))
    html = html.replace(/(<a href="\/v2\/categories\/" class="nav-categories">[^<]*<\/a>)/, '$1<a href="/v2/requests/" class="nav-requests">განცხადებები</a>');
  if (!html.includes('<span>დაიწყე კავშირი</span><a href="/v2/requests/">'))
    html = html.replace(/(<div class="footer-nav"><span>დაიწყე კავშირი<\/span>)/, '$1<a href="/v2/requests/">განცხადებები</a>');
  return html;
}

// Existing v2 pages: home, catalog, company profiles.
const existing = [path.join(v2, 'index.html'), path.join(v2, 'categories', 'index.html'),
  ...fs.readdirSync(path.join(v2, 'companies')).map(d => path.join(v2, 'companies', d, 'index.html'))].filter(f => fs.existsSync(f));
for (const file of existing) {
  let html = wire(fs.readFileSync(file, 'utf8'));
  // The home page layout stays as designed; the board is reached from the navigation.
  html = html.replace('<section class="latest-requests" id="latest-requests" aria-label="ბოლო განცხადებები"></section>', '');
  fs.writeFileSync(file, html);
}

// New pages share the catalog page shell (header, footer, dialogs).
const shell = fs.readFileSync(path.join(v2, 'categories', 'index.html'), 'utf8');
const head = shell.slice(0, shell.indexOf('<main')), tail = shell.slice(shell.indexOf('</main>') + 7);
function page({ file, title, description, bodyAttrs = '', main, og }) {
  let top = head.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace('<body class="design-two">', `<body class="design-two"${bodyAttrs}>`)
    .replace(/<a class="design-switch" href="[^"]*">/, '<a class="design-switch" href="/">');
  const meta = og ? `<meta property="og:type" content="website"><meta property="og:site_name" content="MeetAny"><meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.description)}"><meta property="og:url" content="${SITE}${og.path}"><meta property="og:image" content="${SITE}${og.image}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${SITE}${og.path}">` : '';
  top = top.replace('</head>', meta + '</head>');
  const out = path.join(v2, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, top + main + tail);
}

page({ file: 'requests/index.html', title: 'განცხადებები — MeetAny', description: 'ბიზნესის საჭიროებები: დადე განცხადება და მიიღე კომპანიების შეთავაზებები ფასით.', bodyAttrs: ' data-market-page="requests"',
  main: '<main id="main"><div id="requests-root"></div></main>',
  og: { title: 'განცხადებები — MeetAny', description: 'დადე, რა გჭირდება, და კომპანიები გამოგიგზავნიან შეთავაზებებს.', path: '/v2/requests/', image: '/assets/photos/meeting.jpg' } });
page({ file: 'requests/view/index.html', title: 'განცხადება — MeetAny', description: 'განცხადება და შეთავაზებები MeetAny-ზე.', bodyAttrs: ' data-market-page="request"',
  main: '<main id="main" class="req-page"><div id="request-root"></div></main>' });
for (const r of seeded) {
  const description = r.body.length > 180 ? r.body.slice(0, 177) + '…' : r.body;
  page({ file: `requests/${r.slug}/index.html`, title: `${r.title} — განცხადება | MeetAny`, description,
    bodyAttrs: ` data-market-page="request" data-request-id="${r.id}"`,
    main: '<main id="main" class="req-page"><div id="request-root"></div></main>',
    og: { title: r.title, description, path: `/v2/requests/${r.slug}/`, image: r.photo } });
}
page({ file: 'account/index.html', title: 'ჩემი ანგარიში — MeetAny', description: 'შესვლა, რეგისტრაცია, ჩემი განცხადებები და შეთავაზებები.', bodyAttrs: ' data-market-page="account"',
  main: '<main id="main" class="account-page"><div id="account-root"></div></main>' });
page({ file: 'admin/index.html', title: 'ადმინ-პანელი — MeetAny', description: 'MeetAny-ს ადმინისტრირება.', bodyAttrs: ' data-market-page="admin"',
  main: '<main id="main" class="account-page"><div id="admin-root"></div></main>' });
page({ file: 'terms/index.html', title: 'წესები და კონფიდენციალურობა — MeetAny', description: 'MeetAny-ს გამოყენების წესები და პერსონალური მონაცემების დამუშავება.', bodyAttrs: ' data-market-page="terms"',
  main: `<main id="main" class="terms-page"><span class="section-kicker">MeetAny ბეტა</span><h1>წესები და კონფიდენციალურობა</h1>
<p class="beta-banner">ეს არის ბეტა-ვერსიის სამუშაო ტექსტი. რეალურ გაშვებამდე მას იურისტი გადახედავს. ბეტაში შეყვანილი მონაცემები ინახება მხოლოდ თქვენს ბრაუზერში და სერვერზე არ იგზავნება.</p>
<h2>1. რას აკეთებს MeetAny</h2><p>MeetAny აკავშირებს ბიზნესებს: მომხმარებელი აქვეყნებს განცხადებას საჭიროების შესახებ, კომპანიები კი უგზავნიან წერილობით შეთავაზებებს. MeetAny არ არის გარიგების მხარე, არ იღებს გადახდას და არ აგებს პასუხს პროდუქტის ან მომსახურების ხარისხზე. პირობებს მხარეები ერთმანეთთან პირდაპირ თანხმდებიან.</p>
<h2>2. ანგარიში</h2><ul><li>რეგისტრაციისთვის საჭიროა სახელი, ელფოსტა და მობილური ტელეფონის ნომერი.</li><li>კომპანიის ანგარიშის რეგისტრაციისას მიუთითეთ რეალური დასახელება და საქმიანობის მიმართულება.</li><li>ერთ ადამიანს ან კომპანიას შეიძლება ჰქონდეს ერთი ანგარიში.</li></ul>
<h2>3. განცხადებები და შეთავაზებები</h2><ul><li>განცხადება აქტიურია 14 დღე; ავტორს შეუძლია მისი გაგრძელება ან დახურვა.</li><li>შეთავაზების ტექსტს და ფასს ხედავს მხოლოდ განცხადების ავტორი. სხვა მომხმარებლები ხედავენ მხოლოდ შეთავაზებების რაოდენობას.</li><li>აკრძალულია ყალბი, შეცდომაში შემყვანი ან სარეკლამო (სპამ) განცხადებები. ასეთ განცხადებას ადმინისტრაცია მალავს, ხოლო ანგარიშს შეიძლება დაბლოკოს.</li></ul>
<h2>4. პერსონალური მონაცემები</h2><ul><li>ტელეფონი და ელფოსტა საჯაროდ არ ჩანს. ისინი ეჩვენება მხოლოდ მეორე მხარეს მას შემდეგ, რაც განცხადების ავტორი აირჩევს შეთავაზებას.</li><li>მონაცემებს ვიყენებთ მხოლოდ პლატფორმის მუშაობისთვის და შეტყობინებების გასაგზავნად. მესამე მხარეს არ გადაეცემა.</li><li>შეგიძლიათ ნებისმიერ დროს მოითხოვოთ ანგარიშისა და მონაცემების წაშლა.</li></ul>
<h2>5. კონტაქტი</h2><p>კითხვებისა და საჩივრებისთვის მიმართეთ MeetAny-ს გუნდს.</p></main>` });

console.log(`wired ${existing.length} existing v2 pages; built ${5 + seeded.length} marketplace pages (${seeded.length} share pages)`);
