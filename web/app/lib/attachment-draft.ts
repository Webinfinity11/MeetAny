export function attachmentDraft(key:string,storage:Storage|undefined=typeof localStorage!=="undefined"?localStorage:undefined) {
 try { const old=storage?.getItem(key);if(old&&/^[0-9a-f-]{36}$/i.test(old))return old;const id=crypto.randomUUID();storage?.setItem(key,id);return id; } catch { return crypto.randomUUID(); }
}
