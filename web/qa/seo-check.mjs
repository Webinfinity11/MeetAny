import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BASE || 'http://localhost:3705';
const out = new URL('./p7-seo/', import.meta.url);
await mkdir(new URL('shots/', out), { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const local = value => { const u = new URL(value, base); return `${base}${u.pathname}${u.search}`; };
const rows = [];
try {
  const robots = await fetch(`${base}/robots.txt`).then(r => r.text());
  for (const path of ['/matching/', '/deals/', '/onboarding/', '/offers/', '/compare-offers/']) check(robots.includes(`Disallow: ${path}`), `robots: ${path}`);
  check(!robots.includes('Disallow: /og'), 'robots: OG allowed');
  const sitemap = await fetch(`${base}/sitemap.xml`);
  check(sitemap.status === 200, 'sitemap status');
  const urls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].replaceAll('&amp;', '&'));
  const requests = urls.filter(u => u.includes('/requests/view/'));
  const companies = urls.filter(u => u.includes('/companies/view/'));
  check(requests.length >= 3 && companies.length >= 3, '3 request/company samples available');
  const samples = new Set([...urls.filter(u => !u.includes('/view/')), ...requests.slice(0, 3), ...companies.slice(0, 3)]);
  const titles = new Set(), images = new Set();
  let companyWithLogo, companyWithoutLogo;
  for (const url of urls) {
    const response = await fetch(local(url), { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
    check(response.status === 200, `${url}: HTTP ${response.status}`);
    const metadata = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const meta = name => doc.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.content || '';
      return { title: doc.title, description: meta('description'), robots: meta('robots'), canonical: doc.querySelector('link[rel=canonical]')?.href,
        ogTitle: meta('og:title'), ogDescription: meta('og:description'), image: meta('og:image'),
        json: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => el.textContent) };
    }, await response.text());
    check(!metadata.robots.includes('noindex'), `${url}: noindex`);
    if (url.includes('/companies/view/')) {
      for (const raw of metadata.json) {
        try {
          const data = JSON.parse(raw);
          if (data['@type'] === 'Organization') {
            if (data.logo) companyWithLogo ||= url;
            else companyWithoutLogo ||= url;
          }
        } catch { failures.push(`${url}: invalid JSON-LD`); }
      }
    }
    if (!samples.has(url)) continue;
    check(Boolean(metadata.title) && !titles.has(metadata.title), `${url}: missing/duplicate title`);
    titles.add(metadata.title);
    check(metadata.description.length >= 50 && metadata.description.length <= 160, `${url}: description ${metadata.description.length}`);
    check(metadata.canonical === url, `${url}: canonical ${metadata.canonical}`);
    check(metadata.ogTitle === metadata.title && metadata.ogDescription === metadata.description && !!metadata.image, `${url}: OG metadata`);
    if (metadata.image && !images.has(metadata.image)) {
      images.add(metadata.image);
      const image = await fetch(metadata.image);
      check(image.status === 200 && /^image\/(png|jpeg|webp)/.test(image.headers.get('content-type') || ''), `${url}: OG image response`);
      await image.arrayBuffer();
    }
    const types = [];
    for (const json of metadata.json) {
      try { const data = JSON.parse(json); types.push(...(data['@graph'] || [data]).map(item => item['@type'])); }
      catch { failures.push(`${url}: invalid JSON-LD`); }
    }
    const path = new URL(url).pathname;
    const expected = path === '/' ? ['WebSite', 'Organization'] : path === '/requests/view/' ? ['BreadcrumbList', 'Demand'] : path === '/companies/view/' ? ['Organization'] : [];
    check(expected.every(type => types.includes(type)), `${url}: JSON-LD types ${types}`);
    rows.push({ url, title: metadata.title, description: metadata.description, length: metadata.description.length, types: types.join(', ') });
  }
  for (const [kind, sample] of [['request', requests.slice(0, 3)], ['company', [...new Set([...companies.slice(0, 3), companyWithLogo, companyWithoutLogo].filter(Boolean))]]]) {
    for (const [index, url] of sample.entries()) {
      const id = new URL(url).searchParams.get('id');
      const response = await fetch(`${base}/og?kind=${kind}&id=${id}`);
      check(response.status === 200 && response.headers.get('content-type')?.includes('image/png'), `${kind} ${id}: dynamic PNG`);
      check(response.headers.get('cache-control')?.includes('s-maxage=86400'), `${kind}: cache`);
      const png = Buffer.from(await response.arrayBuffer());
      check(png.length > 24 && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `${kind}: PNG dimensions`);
      await writeFile(new URL(`shots/og-${kind}-${index}.png`, out), png);
    }
  }
  check(Boolean(companyWithLogo && companyWithoutLogo), 'company logo and initials samples available');
  for (const kind of ['request', 'company']) {
    const path = kind === 'request' ? 'requests' : 'companies';
    const id = '00000000-0000-4000-8000-000000000000';
    const html = await fetch(`${base}/${path}/view/?id=${id}`, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } }).then(r => r.text());
    check(/name="robots" content="[^"]*noindex/.test(html), `${kind}: unknown ID noindex`);
    const response = await fetch(`${base}/og?kind=${kind}&id=${id}`);
    check(response.status === 200 && response.headers.get('content-type')?.includes('image/png'), `${kind}: unknown fallback`);
    await writeFile(new URL(`shots/og-${kind}-unknown.png`, out), Buffer.from(await response.arrayBuffer()));
  }
  console.table(rows.map(({ url, title, length, types }) => ({ path: new URL(url).pathname + new URL(url).search, title, length, types })));
  console.log(`Sitemap: ${urls.length}; samples: ${rows.length}; errors: ${failures.length}`);
  await writeFile(new URL('results.json', out), JSON.stringify({ sitemapCount: urls.length, rows, failures }, null, 2));
  failures.forEach(error => console.error(error));
} finally { await browser.close(); }
process.exitCode = failures.length ? 1 : 0;
