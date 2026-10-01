/** Internal QA fixtures stay accessible to their owners and administrators. */
export function isInternalTestAccount(user) {
  if (!user) return false;
  return /\be2e\b|e2e[:-]|@meetany\.local\b|სატესტო|\btest\b/i.test(`${user.name || ''} ${user.company || ''} ${user.email || ''}`);
}

export function isInternalTestRequest(request, owner) {
  return isInternalTestAccount(owner) || /^(?:ტესტრექ|test(?: request)?|e2e(?:[: -].*)?)$/i.test(request.title.trim());
}
