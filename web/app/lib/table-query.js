// Parameterized, RLS-scoped table reads. UUID cursors avoid offset drift between pages.
export const TABLES = new Set(['requests', 'offers', 'profiles']);
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_LIMIT = 1000, MAX_IN = 500;
const bad = (message, code = 'PGRST100') => Object.assign(new Error(message), { status: 400, api: { message, code, details: null, hint: null } });

const q = (name) => '"' + name + '"';

// ---------------------------------------------------------------- GET /<table>
export function tableQuery(table, params) {
  if (!TABLES.has(table)) throw Object.assign(bad('unknown table', 'PGRST205'), { status: 404 });
  const select = params.get('select') || '*';
  const cols = select === '*' ? '*' : select.split(',').map((c) => {
    if (!IDENT.test(c)) throw bad('bad select');
    return q(c);
  }).join(', ');
  const where = [], values = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'path'].includes(key)) continue;
    if (!IDENT.test(key)) throw bad('bad filter column');
    let m;
    if ((m = /^(eq|gt)\.(.*)$/s.exec(raw))) {
      if (m[1] === 'gt' && key !== 'id') throw bad('cursor must use id');
      values.push(m[2]); where.push(`${q(key)} ${m[1] === 'gt' ? '>' : '='} $${values.length}`);
    }
    else if ((m = /^in\.\((.*)\)$/s.exec(raw))) {
      const list = m[1] === '' ? [] : m[1].split(',').map((v) => v.replace(/^"(.*)"$/, '$1'));
      if (list.length > MAX_IN) throw bad('too many values');
      values.push(list); where.push(`${q(key)}::text = any($${values.length}::text[])`);
    }
    else if (raw === 'is.null') where.push(`${q(key)} is null`);
    else if (raw === 'not.is.null') where.push(`${q(key)} is not null`);
    else throw bad('unsupported filter');
  }
  const order = (params.get('order') || '').split(',').filter(Boolean).map((o) => {
    const m = /^([a-z_][a-z0-9_]*)\.(asc|desc)(?:\.nulls(first|last))?$/.exec(o);
    if (!m) throw bad('bad order');
    return `${q(m[1])} ${m[2]}${m[3] ? ' nulls ' + m[3] : ''}`;
  });
  const limit = params.has('limit') ? Number(params.get('limit')) : MAX_LIMIT;
  if (!Number.isInteger(limit) || limit < 0) throw bad('bad limit');
  const sql = `select coalesce(json_agg(t), '[]'::json) as j from (select ${cols} from public.${q(table)}`
    + (where.length ? ' where ' + where.join(' and ') : '')
    + (order.length ? ' order by ' + order.join(', ') : '')
    + ` limit ${Math.min(limit, MAX_LIMIT)}) t`;
  return { sql, values };
}

