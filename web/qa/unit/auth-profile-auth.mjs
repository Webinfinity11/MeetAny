// Local-only authentication fixture for auth-profile.browser.mjs. Never deploy.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const auth='http://localhost:4407';
const db=new pg.Pool({connectionString:'postgresql://localhost/meetany_preview_1791892006000'});
const {privateKey,publicKey}=await generateKeyPair('EdDSA');
const jwk={...await exportJWK(publicKey),kid:'auth-profile-qa',alg:'EdDSA',use:'sig'};
const sessions=new Map();
const server=http.createServer(async(req,res)=>{
 try {
 const origin=req.headers.origin;
 if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):3407$/.test(origin)){res.writeHead(403).end();return;}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 const session=/auth_profile_qa=([^;]+)/.exec(req.headers.cookie||'')?.[1];let user=sessions.get(session);
 let data;
 if(req.url==='/.well-known/jwks.json')data={keys:[jwk]};
 else if(req.url==='/get-session')data=user?{user}:null;
 else if(req.url==='/token'||req.url==='/token/anonymous'){
  const who=req.url==='/token'?user:null;
  data={token:await new SignJWT(who?{role:'authenticated',email:who.email,emailVerified:true}:{role:'anonymous'}).setProtectedHeader({alg:'EdDSA',kid:jwk.kid}).setSubject(who?.id||'anonymous').setIssuer(auth).setAudience(auth).setIssuedAt().setExpirationTime('1h').sign(privateKey)};
 } else if(req.url==='/sign-in/email'||req.url==='/sign-up/email'){
  let body='';for await(const part of req)body+=part;const input=JSON.parse(body);
  if(req.url==='/sign-up/email'){
   if(!/^e2e\+\d+@meetany\.local$/.test(input.email))throw new Error('QA signup only');
   user=(await db.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,true) returning id,name,email',[randomUUID(),input.name,input.email])).rows[0];
  } else user=(await db.query('select id,name,email from neon_auth."user" where email=$1',[input.email])).rows[0];
  if(!user)throw new Error('Unknown local fixture');
  const key=randomUUID();sessions.set(key,user);res.setHeader('Set-Cookie',`auth_profile_qa=${key}; HttpOnly; SameSite=Lax; Path=/`);data={user};
 } else if(req.url==='/sign-out'){sessions.delete(session);res.setHeader('Set-Cookie','auth_profile_qa=; Max-Age=0; Path=/');data={success:true};}
 else {res.statusCode=404;data={};}
 res.end(JSON.stringify(data));
 }catch{res.statusCode=400;res.end(JSON.stringify({message:'Local fixture authentication failed'}));}
});
server.listen(4407,'127.0.0.1',()=>console.log('Local auth fixture ready on 4407'));
