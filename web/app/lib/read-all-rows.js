// All catalog/account filters currently run in the browser. Read every page before
// replacing that cache, rather than silently treating the first 1000 rows as complete.
export async function readAllRows(read, path) {
  const result = [];
  let after = '';
  for (;;) {
    const page = await read(path + '&order=id.asc&limit=1000' + (after ? '&id=gt.' + encodeURIComponent(after) : ''));
    if (!Array.isArray(page)) throw new Error('Invalid table response');
    for (const row of page) {
      if (typeof row.id !== 'string' || row.id <= after) throw new Error('Invalid table cursor');
      after = row.id;
      result.push(row);
    }
    if (page.length < 1000) return result;
  }
}
