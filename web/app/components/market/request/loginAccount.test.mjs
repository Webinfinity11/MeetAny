import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("./loginAccount.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { loginAccount } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("login normalizes email, preserves password and announces the completed session", async () => {
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type) };
  let credentials;
  await loginAccount({ login: async (...args) => { credentials = args; assert.equal(events.length, 0); } }, " user@example.com ", " secret ");
  assert.deepEqual(credentials, ["user@example.com", " secret "]);
  assert.deepEqual(events, ["meetany:auth"]);
  delete globalThis.window;
});

test("login masks password-only errors and retains service errors for the shared form", async () => {
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type) };
  await assert.rejects(loginAccount({ login: async () => { throw { userMessage: "პაროლი არასწორია." }; } }, "a@b.ge", "wrong"), { userMessage: "ელფოსტა ან პაროლი არასწორია." });
  const unavailable = { userMessage: "სერვისი მიუწვდომელია." };
  await assert.rejects(loginAccount({ login: async () => { throw unavailable; } }, "a@b.ge", "wrong"), error => error === unavailable);
  assert.deepEqual(events, ["meetany:auth", "meetany:auth"]);
  delete globalThis.window;
});
