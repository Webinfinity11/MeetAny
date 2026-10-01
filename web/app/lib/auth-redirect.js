/** Only a local absolute path may be used after authentication. */
export function safeNext(value) {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return null;
 try {const url=new URL(value,'https://meetany.invalid');return url.origin==='https://meetany.invalid'?url.pathname+url.search+url.hash:null;}catch{return null;}
}
