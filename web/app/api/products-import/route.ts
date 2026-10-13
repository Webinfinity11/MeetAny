import { verifyNeonJwt, myProfile } from "../../lib/neon-jwt.js";
import { MAX_XLSX_BYTES, readProductXlsx } from "../../lib/xlsx-lite.js";

export const runtime = "nodejs";
const json = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
 let claims;
 try { claims = await verifyNeonJwt(request.headers.get("authorization")); }
 catch { return json(401, { error: "ფაილის ასატვირთად შედით ანგარიშში." }); }
 try {
  const profile = await myProfile(claims);
  if (!("sub" in claims) || !profile || profile.id !== claims.sub || profile.blocked || profile.role !== "company") return json(403, { error: "იმპორტი ხელმისაწვდომია კომპანიის ანგარიშისთვის." });
 } catch { return json(502, { error: "ანგარიში ვერ შემოწმდა. სცადეთ ხელახლა." }); }
 if (Number(request.headers.get("content-length")) > MAX_XLSX_BYTES) return json(413, { error: "ფაილის მაქსიმალური ზომაა 2 მბ." });
 if (!request.body) return json(400, { error: "აირჩიეთ XLSX ფაილი." });
 const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
 try {
  for (;;) {
   const { value, done } = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > MAX_XLSX_BYTES) { await reader.cancel(); return json(413, { error: "ფაილის მაქსიმალური ზომაა 2 მბ." }); }
   chunks.push(value);
  }
  return json(200, { rows: readProductXlsx(Buffer.concat(chunks)) });
 } catch (err) { return json(400, { error: err instanceof Error ? err.message : "ფაილი ვერ წაიკითხა. გამოიყენეთ შაბლონი." }); }
 finally { reader.releaseLock(); }
}
