// Builds the MeetAny pages from scripts/shell.html and wires the home page (dist/index.html).
// Idempotent: run `node scripts/generate-market.cjs` after changing market files, icons or the shell.
// The archived Design 01 (dist/v1, hidden) is never touched.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', 'dist');
const SITE = 'https://meet-any.vercel.app';
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 12);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = `/icons.svg?v=${hash('icons.svg')}`;
// Two stylesheets per page (spec §3): tokens.css (the only token source) + market.css (components).
// Scripts are deferred and run in order after app.js (in the shell head): shell.js (header, menu,
// sheets, toasts), the public config, the store (Neon via fetch) and market.js (screens).
const styles = `<link rel="stylesheet" href="/tokens.css?v=${hash('tokens.css')}"><link rel="stylesheet" href="/market.css?v=${hash('market.css')}">`;
const scripts = `<script src="/shell.js?v=${hash('shell.js')}" defer></script><script src="/config.js?v=${hash('config.js')}" defer></script><script src="/market-store.js?v=${hash('market-store.js')}" defer></script><script src="/market.js?v=${hash('market.js')}" defer></script>`;
const withIcons = html => html.replace(/\/icons\.svg\?v=[0-9a-zA-Z]+/g, ICONS).replace(/\/app\.js\?v=[0-9a-zA-Z]+/g, `/app.js?v=${hash('app.js')}`);

const shell = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8').replace(/^<!--[\s\S]*?-->\n/, '');
const block = name => shell.match(new RegExp(`<!--SHELL:${name}-->[\\s\\S]*?<!--/SHELL:${name}-->`))[0];
const shellHeader = block('header'), shellFooter = block('footer');

// The home page keeps its hand-maintained layout; its styles live in home.css (tokens only). It gets tokens.css + market.css + home.css, the shared shell and scripts.
function wireHome(html) {
  html = html.replace(/<link rel="stylesheet" href="\/(?:style|refinement|industry-objects|mobile-polish|interface-polish)\.css[^>]*>|<link rel="stylesheet" href="\/(?:tokens|market|design|home)\.css[^>]*>|<script src="\/(?:shell|market(?:-store)?|config|home)\.js[^"]*"[^>]*><\/script>/g, '');
  // home.css goes before market.css, as the old sheets did, so shared shell components keep their cascade.
  html = html.replace('</head>', styles.replace('<link rel="stylesheet" href="/market.css', `<link rel="stylesheet" href="/home.css?v=${hash('home.css')}"><link rel="stylesheet" href="/market.css`) + scripts + `<script src="/home.js?v=${hash('home.js')}" defer></script>` + '</head>');
  html = html.replace(/<!--SHELL:header-->[\s\S]*?<!--\/SHELL:header-->|<header class="header">[\s\S]*?<\/header>/, () => shellHeader);
  html = html.replace(/<!--SHELL:footer-->[\s\S]*?<!--\/SHELL:footer-->|<footer>[\s\S]*?<\/footer>/, () => shellFooter);
  if (!html.includes('id="ma-toasts"')) html = html.replace('</body>', '<div class="ma-toasts" id="ma-toasts" aria-live="polite" aria-atomic="false"></div>\n</body>');
  html = html.replace(/href="\/categories\/(?:\?[^"]*)?"/g, 'href="/companies/"').replace(/action="\/categories\/"/g, 'action="/companies/"');
  html = html.replace('<section class="latest-requests" id="latest-requests" aria-label="ბოლო განცხადებები"></section>', '');
  return withIcons(html);
}
const home = path.join(root, 'index.html');
fs.writeFileSync(home, wireHome(fs.readFileSync(home, 'utf8')));

function page({ file, title, description, bodyAttrs = '', main, og }) {
  let html = shell.replace('<title>MeetAny</title>', `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace('<body class="ma">', `<body class="ma"${bodyAttrs}>`)
    .replace('<!--MAIN-->', () => main)
    .replace(/<!--\/?SHELL:[a-z]+-->/g, '');
  const meta = og ? `<meta property="og:type" content="website"><meta property="og:site_name" content="MeetAny"><meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.description)}"><meta property="og:url" content="${SITE}${og.path}"><meta property="og:image" content="${SITE}${og.image}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${SITE}${og.path}">` : '';
  html = html.replace('</head>', styles + scripts + meta + '</head>');
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, withIcons(html));
}

page({ file: 'requests/index.html', title: 'მოთხოვნები — MeetAny', description: 'ბიზნესის საჭიროებები: დადე განცხადება და მიიღე კომპანიების შეთავაზებები ფასით.', bodyAttrs: ' data-market-page="requests"',
  main: '<div id="requests-root"></div>',
  og: { title: 'მოთხოვნები — MeetAny', description: 'დადე, რა გჭირდება, და კომპანიები გამოგიგზავნიან შეთავაზებებს.', path: '/requests/', image: '/assets/photos/meeting.jpg' } });
// /requests/new/ opens the new-request form over the list (the full-page form comes in a later run).
page({ file: 'requests/new/index.html', title: 'მოთხოვნის დამატება — MeetAny', description: 'დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ ფასს და პირობებს.', bodyAttrs: ' data-market-page="requests" data-open="new-request"',
  main: '<div id="requests-root"></div>' });
page({ file: 'requests/view/index.html', title: 'მოთხოვნა — MeetAny', description: 'განცხადება და შეთავაზებები MeetAny-ზე.', bodyAttrs: ' data-market-page="request"',
  main: '<div id="request-root"></div>' });
page({ file: 'companies/index.html', title: 'კომპანიები — MeetAny', description: 'MeetAny-ზე დარეგისტრირებული მომწოდებლები და მომსახურების კომპანიები: რას სთავაზობენ და სად მუშაობენ.', bodyAttrs: ' data-market-page="companies"',
  main: '<div id="companies-root"></div>',
  og: { title: 'კომპანიები — MeetAny', description: 'მომწოდებლები და მომსახურების კომპანიები საქართველოში.', path: '/companies/', image: '/assets/photos/meeting.jpg' } });
page({ file: 'companies/view/index.html', title: 'კომპანია — MeetAny', description: 'კომპანიის პროფილი MeetAny-ზე.', bodyAttrs: ' data-market-page="company"',
  main: '<div id="company-root"></div>' });
page({ file: 'account/index.html', title: 'ჩემი ანგარიში — MeetAny', description: 'შესვლა, რეგისტრაცია, ჩემი განცხადებები, შეთავაზებები და კომპანიის პროფილი.', bodyAttrs: ' data-market-page="account"',
  main: '<div id="account-root"></div>' });
page({ file: 'admin/index.html', title: 'ადმინ-პანელი — MeetAny', description: 'MeetAny-ს ადმინისტრირება.', bodyAttrs: ' data-market-page="admin"',
  main: '<div id="admin-root"></div>' });
page({ file: 'terms/index.html', title: 'წესები და კონფიდენციალურობა — MeetAny', description: 'MeetAny-ს გამოყენების წესები და პერსონალური მონაცემების დამუშავება.', bodyAttrs: ' data-market-page="terms"',
  main: `<div class="ma-container ma-page ma-terms"><span class="ma-eyebrow ma-eyebrow--brand">MeetAny</span><h1>წესები და კონფიდენციალურობა</h1>
<p class="ma-alert ma-alert--info" style="display:block">მონაცემები უსაფრთხოდ ინახება სერვერზე. ტელეფონი და ელფოსტა საჯაროდ არ ქვეყნდება.</p>
<h2>1. რას აკეთებს MeetAny</h2><p>MeetAny აკავშირებს ბიზნესებს: მომხმარებელი აქვეყნებს განცხადებას საჭიროების შესახებ, კომპანიები კი უგზავნიან წერილობით შეთავაზებებს. MeetAny არ არის გარიგების მხარე, არ იღებს გადახდას და არ აგებს პასუხს პროდუქტის ან მომსახურების ხარისხზე. პირობებს მხარეები ერთმანეთთან პირდაპირ თანხმდებიან.</p>
<h2>2. ანგარიში</h2><ul><li>რეგისტრაციისთვის საჭიროა სახელი, ელფოსტა და მობილური ტელეფონის ნომერი. ელფოსტა დასტურდება კოდით.</li><li>კომპანიის ანგარიშის რეგისტრაციისას მიუთითეთ რეალური დასახელება და საქმიანობის მიმართულება.</li><li>ერთ ადამიანს ან კომპანიას შეიძლება ჰქონდეს ერთი ანგარიში.</li></ul>
<h2>3. განცხადებები და შეთავაზებები</h2><ul><li>განცხადება აქტიურია 14 დღე; ავტორს შეუძლია მისი გაგრძელება ან დახურვა. განცხადების შეცვლა შესაძლებელია პირველ შეთავაზებამდე.</li><li>შეთავაზების ტექსტს და ფასს ხედავს მხოლოდ განცხადების ავტორი. სხვა მომხმარებლები ხედავენ მხოლოდ შეთავაზებების რაოდენობას.</li><li>აკრძალულია ყალბი, შეცდომაში შემყვანი ან სარეკლამო (სპამ) განცხადებები. ასეთ განცხადებას ადმინისტრაცია მალავს, ხოლო ანგარიშს შეიძლება დაბლოკოს.</li></ul>
<h2>4. კომპანიის პროფილი</h2><ul><li>კომპანიის საჯარო პროფილზე ჩანს დასახელება, მიმართულება, ქალაქი, აღწერა, „რას ვთავაზობთ“, „რას ვეძებთ“ და გაგზავნილი/არჩეული შეთავაზებების რაოდენობა.</li><li>„დადასტურებული“ ნიშანს MeetAny-ს გუნდი ანიჭებს კომპანიის მონაცემების გადამოწმების შემდეგ.</li></ul>
<h2>5. პერსონალური მონაცემები</h2><ul><li>ტელეფონი და ელფოსტა საჯაროდ არ ჩანს. ისინი ეჩვენება მხოლოდ მეორე მხარეს მას შემდეგ, რაც განცხადების ავტორი აირჩევს შეთავაზებას.</li><li>მონაცემებს ვიყენებთ მხოლოდ პლატფორმის მუშაობისთვის და შეტყობინებების გასაგზავნად. მესამე მხარეს არ გადაეცემა.</li><li>შეგიძლიათ ნებისმიერ დროს მოითხოვოთ ანგარიშისა და მონაცემების წაშლა.</li></ul>
<h2 id="contact">6. კონტაქტი</h2><p>კითხვებისა და საჩივრებისთვის მიმართეთ MeetAny-ს გუნდს.</p></div>` });

console.log('wired the home page; built 8 pages');
