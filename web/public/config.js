/* MeetAny public client config (public values only; see README "the home").
   authUrl:    Neon Auth URL, or the same-origin rewrite '/api/auth' (vercel.json) so the session cookie is first-party.
   dataApiUrl: '/api/db', the MeetAny API (api/db.js; PostgREST-style subset, replaces the Neon Data API).
   uploadUrl:  Vercel Function that authorizes photo uploads to Vercel Blob.
   Never put a connection string, password or token here. While the placeholders stay,
   the marketplace shows "სერვისი დროებით მიუწვდომელია". */
window.MEETANY_CONFIG = window.MEETANY_CONFIG || {
  authUrl: 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth',
  dataApiUrl: '/api/db',
  uploadUrl: '/api/blob-upload',
  // false while sign-up has no email code step (see README): hides the „email verified“ badges.
  requireEmailVerification: false
};
