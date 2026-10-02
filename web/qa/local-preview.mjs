import assert from 'node:assert/strict';
import nextEnv from '@next/env';
export function assertLocalPreview(origin){
 nextEnv.loadEnvConfig(process.cwd());
 const dsn=process.env.MEETANY_LOCAL_DATABASE_URL;
 assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local origin required');
 assert(dsn&&['localhost','127.0.0.1'].includes(new URL(dsn).hostname)&&/^\/meetany_preview_\d+$/.test(new URL(dsn).pathname),'Isolated local preview database required');
}
