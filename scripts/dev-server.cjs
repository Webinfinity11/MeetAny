// Local static server for dist/ that applies vercel.json redirects and rewrites the way Vercel does
// (redirects first, then the filesystem, then rewrites), so local URLs match production.
// It also runs the Vercel Functions in api/ (web-standard `export default { fetch }` handlers) with the
// env from .env.local and .env.dev.local (gitignored; see DESIGN-SYSTEM.md / README "Local").
// Run: node scripts/dev-server.cjs [port]   (default 4031)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const PORT = Number(process.argv[2]) || 4031;
for (const name of ['.env.local', '.env.dev.local']) {
  let text = ''; try { text = fs.readFileSync(path.join(__dirname, '..', name), 'utf8'); } catch { continue; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (!m || m[1] in process.env && name === '.env.local') continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// Minimal path-to-regexp: ":name(re)", ":name*" and ":name" segments.
function compile(source) {
  const names = [];
  const re = source.replace(/[.+^${}|[\]\\]/g, '\\$&').replace(/:(\w+)(\([^)]*\))?(\*)?/g, (_, name, group, star) => {
    names.push(name);
    return group ? group.replace(/^\(/, '(').replace(/\\\|/g, '|') : star ? '(.*)' : '([^/]+)';
  });
  return { re: new RegExp('^' + re + '$'), names };
}
const rules = list => (list || []).map(r => ({ ...r, ...compile(r.source) }));
const redirects = rules(conf.redirects), rewrites = rules(conf.rewrites);
function apply(rule, pathname) {
  const m = rule.re.exec(pathname); if (!m) return null;
  let dest = rule.destination;
  rule.names.forEach((n, i) => { dest = dest.split(':' + n + '*').join(m[i + 1] || '').split(':' + n).join(m[i + 1] || ''); });
  return dest.replace(/\/{2,}/g, '/');
}
function file(pathname) {
  let f = path.join(ROOT, decodeURIComponent(pathname));
  if (!f.startsWith(ROOT)) return null;
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); return fs.statSync(f).isFile() ? f : null; } catch { return null; }
}
async function runFunction(req, res, target) {
  const name = /^\/api\/([a-z0-9-]+)$/.exec(target.pathname)?.[1];
  const file = name && path.join(__dirname, '..', 'api', name + '.js');
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  try {
    const mod = await import(require('url').pathToFileURL(file).href);
    const out = await mod.default.fetch(new Request(target.href, { method: req.method, headers, body }));
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (err) { console.error('api/' + name + ':', err); res.writeHead(500); res.end('function error'); }
}
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let target = url;
    for (const r of rewrites) {
      const dest = apply(r, url.pathname);
      if (dest) { target = new URL(dest, url); for (const [k, v] of url.searchParams) if (!target.searchParams.has(k)) target.searchParams.append(k, v); break; }
    }
    return runFunction(req, res, target);
  }
  for (const r of redirects) {
    const dest = apply(r, url.pathname);
    if (dest) { res.writeHead(r.permanent ? 308 : 307, { Location: dest + url.search }); return res.end(); }
  }
  let f = file(url.pathname);
  if (!f) for (const r of rewrites) { const dest = apply(r, url.pathname); if (dest && (f = file(dest))) break; }
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`MeetAny dev server: http://127.0.0.1:${PORT}/  (dist + vercel.json rules)`));
