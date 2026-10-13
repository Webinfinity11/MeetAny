import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

// TODO 2026-10-13: ძველი გეომეტრია; მხოლოდ სახელისა და მნიშვნელობის ზუსტი წყვილები.
export const TOKEN_EXCEPTIONS = new Map([
  ["--radius-xs","calc(var(--theme-radius) * .6) => calc(8px * .6)"], // app/styles/tokens.css:142
  ["--radius-sm","calc(var(--theme-radius) * .6) => calc(8px * .6)"], // app/styles/tokens.css:143
  ["--radius-lg","calc(var(--theme-radius) * 1.2) => calc(8px * 1.2)"], // app/styles/tokens.css:145
  ["--radius-xl","calc(var(--theme-radius) * 1.6) => calc(8px * 1.6)"], // app/styles/tokens.css:146
  ["--space-hairline","1px => 1px"], // app/styles/tokens.css:193
  ["--space-control-y","10px => 10px"], // app/styles/tokens.css:194
  ["--space-control-x","18px => 18px"], // app/styles/tokens.css:195
  ["--space-control-roomy","14px => 14px"], // app/styles/tokens.css:196
  ["--space-control-lg-x","22px => 22px"], // app/styles/tokens.css:197
  ["--space-control-sm-y","7px => 7px"], // app/styles/tokens.css:198
  ["--space-compact","6px => 6px"], // app/styles/tokens.css:200
  ["--space-three-quarter","3px => 3px"], // app/styles/tokens.css:201
  ["--space-field-y","9px => 9px"], // app/styles/tokens.css:202
  ["--space-affix","42px => 42px"], // app/styles/tokens.css:204
  ["--space-half","2px => 2px"], // app/styles/tokens.css:206
  ["--space-control-tight","5px => 5px"], // app/styles/tokens.css:215
  ["--space-list-indent","1.25em => 1.25em"], // app/styles/tokens.css:218
  ["--space-section-compact","30px => 30px"], // app/styles/tokens.css:225
  ["--space-panel-legacy","26px => 26px"], // app/styles/tokens.css:227
  ["--space-affix-compact","38px => 38px"], // app/styles/tokens.css:228
  ["--size-neg-80","-80px => -80px"], // app/styles/tokens.css:235
  ["--size-34","34px => 34px"], // app/styles/tokens.css:247
  ["--size-420","420px => 420px"], // app/styles/tokens.css:251
  ["--size-180","180px => 180px"], // app/styles/tokens.css:254
  ["--size-62","62px => 62px"], // app/styles/tokens.css:258
  ["--size-1p5","1.5px => 1.5px"], // app/styles/tokens.css:265
  ["--size-220","220px => 220px"], // app/styles/tokens.css:267
  ["--size-116","116px => 116px"], // app/styles/tokens.css:271
  ["--size-neg-56","-56px => -56px"], // app/styles/tokens.css:272
  ["--size-neg-48","-48px => -48px"], // app/styles/tokens.css:273
  ["--size-neg-24","-24px => -24px"], // app/styles/tokens.css:274
  ["--size-148","148px => 148px"], // app/styles/tokens.css:276
  ["--size-132","132px => 132px"], // app/styles/tokens.css:278
  ["--size-196","196px => 196px"], // app/styles/tokens.css:280
  ["--size-neg-42","-42px => -42px"], // app/styles/tokens.css:281
  ["--size-neg-18","-18px => -18px"], // app/styles/tokens.css:282
  ["--size-neg-65","-65px => -65px"], // app/styles/tokens.css:283
  ["--size-142","142px => 142px"], // app/styles/tokens.css:284
  ["--size-11","11px => 11px"], // app/styles/tokens.css:287
  ["--size-19","19px => 19px"], // app/styles/tokens.css:288
  ["--size-212","212px => 212px"], // app/styles/tokens.css:292
  ["--size-neg-3","-3px => -3px"], // app/styles/tokens.css:296
  ["--size-46","46px => 46px"], // app/styles/tokens.css:297
  ["--size-150","150px => 150px"], // app/styles/tokens.css:298
  ["--size-380","380px => 380px"], // app/styles/tokens.css:299
  ["--size-300","300px => 300px"], // app/styles/tokens.css:308
  ["--size-130","130px => 130px"], // app/styles/tokens.css:309
  ["--size-neg-2","-2px => -2px"], // app/styles/tokens.css:310
  ["--size-190","190px => 190px"], // app/styles/tokens.css:311
  ["--size-164","164px => 164px"], // app/styles/tokens.css:312
  ["--size-188","188px => 188px"], // app/styles/tokens.css:313
  ["--size-23","23px => 23px"], // app/styles/tokens.css:314
  ["--size-neg-12","-12px => -12px"], // app/styles/tokens.css:326
  ["--size-50","50px => 50px"], // app/styles/tokens.css:329
  ["--size-neg-8","-8px => -8px"], // app/styles/tokens.css:330
  ["--size-neg-7","-7px => -7px"], // app/styles/tokens.css:331
  ["--size-84","84px => 84px"], // app/styles/tokens.css:333
  ["--size-74","74px => 74px"], // app/styles/tokens.css:334
  ["--size-124","124px => 124px"], // app/styles/tokens.css:337
  ["--size-neg-28","-28px => -28px"], // app/styles/tokens.css:338
  ["--size-neg-16","-16px => -16px"], // app/styles/tokens.css:340
  ["--size-70","70px => 70px"], // app/styles/tokens.css:341
  ["--size-neg-p5","-.5px => -.5px"], // app/styles/tokens.css:347
  ["--size-340","340px => 340px"], // app/styles/tokens.css:348
  ["--size-92","92px => 92px"], // app/styles/tokens.css:349
  ["--size-210","210px => 210px"], // app/styles/tokens.css:351
  ["--size-neg-1","-1px => -1px"], // app/styles/tokens.css:353
  ["--size-neg-4","-4px => -4px"], // app/styles/tokens.css:355
  ["--size-820","820px => 820px"], // app/styles/tokens.css:356
  ["--size-460","460px => 460px"], // app/styles/tokens.css:358
  ["--size-neg-5","-5px => -5px"], // app/styles/tokens.css:363
  ["--size-140","140px => 140px"], // app/styles/tokens.css:364
  ["--size-76","76px => 76px"], // app/styles/tokens.css:366
  ["--size-54","54px => 54px"], // app/styles/tokens.css:367
  ["--size-260","260px => 260px"], // app/styles/tokens.css:369
  ["--size-neg-6","-6px => -6px"], // app/styles/tokens.css:370
  ["--size-1","1px => 1px"], // app/styles/tokens.css:375
  ["--size-3","3px => 3px"], // app/styles/tokens.css:377
  ["--size-2","2px => 2px"], // app/styles/tokens.css:378
  ["--size-6","6px => 6px"], // app/styles/tokens.css:380
  ["--size-14","14px => 14px"], // app/styles/tokens.css:384
  ["--size-18","18px => 18px"], // app/styles/tokens.css:387
  ["--size-5","5px => 5px"], // app/styles/tokens.css:388
  ["--size-30","30px => 30px"], // app/styles/tokens.css:389
  ["--size-13","13px => 13px"], // app/styles/tokens.css:390
  ["--size-7","7px => 7px"], // app/styles/tokens.css:391
  ["--size-10","10px => 10px"], // app/styles/tokens.css:392
  ["--size-15","15px => 15px"], // app/styles/tokens.css:393
  ["--size-9","9px => 9px"], // app/styles/tokens.css:395
  ["--size-999","999px => 999px"], // app/styles/tokens.css:396
  ["--size-38","38px => 38px"], // app/styles/tokens.css:399
  ["--size-26","26px => 26px"], // app/styles/tokens.css:402
  ["--size-22","22px => 22px"], // app/styles/tokens.css:403
  ["--size-21","21px => 21px"], // app/styles/tokens.css:407
  ["--size-42","42px => 42px"], // app/styles/tokens.css:408
  ["--size-17","17px => 17px"], // app/styles/tokens.css:410
]);
// TODO 2026-10-13: კომპონენტის მფლობელმა უნდა გადაიყვანოს სკალაზე / 44px მინიმუმზე.
// ფაილი, სელექტორი, თვისება და მნიშვნელობა ერთად ზღუდავს თითო გამონაკლისს.
export const DECLARATION_EXCEPTIONS = new Set([
  ["app/components/Header.module.css",".ma-header__menu-btn,.ma-mnav__close","height","var(--size-40)"], // app/components/Header.module.css:150
  ["app/components/market/admin.module.css",".testSwitch input","height","var(--size-1)"], // app/components/market/admin.module.css:198
  ["app/components/market/catalog/Catalog.module.css",".verified input","height","var(--size-24)"], // app/components/market/catalog/Catalog.module.css:29
  ["app/components/market/catalog/Catalog.module.css",".mobileRequestFilters .filterCheck input","height","var(--size-18)"], // app/components/market/catalog/Catalog.module.css:170
  ["app/components/market/engagement.module.css",".alertChoice input","height","var(--size-18)"], // app/components/market/engagement.module.css:52
  ["app/components/market/engagement.module.css",".chatSearch input","height","var(--size-24)"], // app/components/market/engagement.module.css:115
  ["app/components/market/onboarding.module.css",".checkboxes input","height","var(--space-4)"], // app/components/market/onboarding.module.css:102
  ["app/styles/pages/account.css",".gallery-field__tools button","height","var(--size-28)"], // app/styles/pages/account.css:452
  ["app/styles/pages/catalog.css",".catalog-header--center .home-search-seg .ma-input","height","var(--size-26)"], // app/styles/pages/catalog.css:306
  ["app/styles/pages/catalog.css",".filter-switch input","height","var(--size-1)"], // app/styles/pages/catalog.css:400
  ["app/styles/pages/catalog.css",".view-switch button","min-height","var(--size-34)"], // app/styles/pages/catalog.css:765
  ["app/styles/pages/catalog.css",".view-switch button","min-height","var(--size-38)"], // app/styles/pages/catalog.css:790
  ["app/styles/pages/homepage.css",".market-search-types input","height","var(--size-1)"], // app/styles/pages/homepage.css:64
  ["app/styles/pages/homepage.css",".ma .home-hero .home-search-entry--framed .ma-input","height","var(--size-40)"], // app/styles/pages/homepage.css:73
  ["app/styles/primitives.css",".ma-textarea","min-height","var(--size-132)"], // app/styles/primitives.css:53
  ["app/styles/primitives.css",".ma-check input","height","var(--size-20)"], // app/styles/primitives.css:61
  ["app/styles/search.css",".home-search-seg .ma-input,\n.home-search-seg select","height","var(--size-26)"], // app/styles/search.css:69
  ["app/styles/search.css",".home-search-seg .ma-input,\n.home-search-seg select","min-height","0"], // app/styles/search.css:70
  ["app/styles/search.css",".ma .home-search-entry--framed .home-search-seg .ma-input","height","var(--size-54)"], // app/styles/search.css:313
].map(entry => JSON.stringify(entry)));
export const RADII = new Set(['0', '0px', '2px', '4px', '8px', '12px', '16px', '24px', '999px', '50%']);
const dimensionToken = /^--(?:space-|size-|btn-h(?:-|$)|field-h(?:-|$)|radius-)/;
const rawPx = /(?<![\w-])-?(?:\d*\.)?\d+px\b/i;
export const onScale = n => Number.isFinite(n) && n >= 0 && n % (n <= 64 ? 4 : 8) === 0;
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);

// მხოლოდ არითმეტიკის AST იკითხება; CSS არასოდეს სრულდება JavaScript-ად.
function arithmetic(source) {
  const sf = ts.createSourceFile('value.ts', `(${source})`, ts.ScriptTarget.Latest, true);
  function value(n) {
    if (!n) return NaN;
    if (ts.isParenthesizedExpression(n)) return value(n.expression);
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (ts.isPrefixUnaryExpression(n)) return n.operator === ts.SyntaxKind.MinusToken ? -value(n.operand) : n.operator === ts.SyntaxKind.PlusToken ? value(n.operand) : NaN;
    if (ts.isBinaryExpression(n)) {
      const a = value(n.left), b = value(n.right);
      switch (n.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken: return a + b;
        case ts.SyntaxKind.MinusToken: return a - b;
        case ts.SyntaxKind.AsteriskToken: return a * b;
        case ts.SyntaxKind.SlashToken: return a / b;
      }
    }
    return NaN;
  }
  return sf.parseDiagnostics.length ? NaN : value(sf.statements[0]?.expression);
}
function resolve(value, tokens, seen = new Set()) {
  let previous;
  do {
    previous = value;
    value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name, fallback) => {
      if (seen.has(name)) return 'unresolved';
      const next = new Set(seen).add(name);
      return tokens.has(name) ? resolve(tokens.get(name), tokens, next) : fallback ?? 'unresolved';
    });
  } while (value !== previous && value.includes('var('));
  return value;
}
function pixels(value, tokens) {
  const resolved = resolve(value, tokens).trim();
  if (resolved === '0') return 0;
  if (!resolved.includes('px') || /[^\d\s.pxcalc()+*/-]/.test(resolved)) return NaN;
  return arithmetic(resolved.replace(/px\b/g, '').replace(/calc\(/g, '('));
}
function interactive(selector) {
  // ზომა ეკუთვნის ბოლო ელემენტს; ღილაკის შიგნით ხატულა კონტროლი არ არის.
  const target = selector.trim().split(/\s+|>/).at(-1);
  if (/::/.test(target)) return false;
  return /^(?:button|input|select|textarea)(?=[.#[:]|$)/.test(target)
    || /\[role=["']?(?:button|combobox|textbox)["']?\]/.test(target)
    || /\.(?:ma-(?:btn|input|select|textarea|pill|chip)(?=[.:#[]|--|$)|[\w-]*(?:__|-)btn(?=[.:#[]|--|$))/.test(target);
}

export function lintSources(sources, { allowLegacy = true } = {}) {
  const errors = [], tokens = new Map();
  const css = [...sources].filter(([file]) => file.endsWith('.css')).map(([file, source]) => [file, postcss.parse(source, { from: file })]);
  for (const [, root] of css.filter(([file]) => file.endsWith('/tokens.css'))) root.walkDecls(d => tokens.set(d.prop, d.value));
  const add = (file, line, message) => errors.push(`${file}:${line}: ${message}`);
  for (const [file, root] of css) root.walkDecls(d => {
    const line = d.source.start.line;
    if (/(?:linear|radial|conic)-gradient\s*\(/i.test(d.value) && !/^(?:-webkit-)?mask(?:-image)?$/.test(d.prop)) add(file, line, 'გრადიენტი დაუშვებელია');
    if (file.endsWith('/tokens.css')) {
      if (!dimensionToken.test(d.prop)) return;
      const radius = d.prop.startsWith('--radius-');
      const n = pixels(d.value, tokens);
      const valid = radius ? RADII.has(resolve(d.value, tokens)) || RADII.has(`${n}px`) : onScale(n);
      if (!valid && !(allowLegacy && TOKEN_EXCEPTIONS.get(d.prop) === `${d.value} => ${resolve(d.value, tokens)}`)) add(file, line, `${d.prop}: მნიშვნელობა სკალის გარეთაა (${d.value})`);
      return;
    }
    const key = JSON.stringify([file, d.parent.selector, d.prop, d.value]);
    if (allowLegacy && DECLARATION_EXCEPTIONS.has(key)) return;
    if (/^(?:min-height|height|width|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|(?:row-|column-)?gap)$/.test(d.prop) && /calc\(/i.test(d.value) && rawPx.test(d.value)) {
      add(file, line, `${d.prop}: calc()-ში ნედლი px შეცვალეთ ტოკენით`);
    } else if (!d.value.includes('url(') && /(?:#[\da-f]{3,8}\b|rgba?\(|(?<![\w-])-?(?:\d*\.)?\d+px\b)/i.test(d.value)) {
      add(file, line, `${d.prop}: გამოიყენეთ ზომის/ფერის ტოკენი`);
    }
    if (/^(?:min-height|height)$/.test(d.prop) && d.parent.type === 'rule' && d.parent.selectors.some(interactive)) {
      if (/^(?:auto|inherit|initial|unset|revert|100%|fit-content|max-content|min-content)$/.test(d.value)) return;
      const n = pixels(d.value, tokens);
      if (!onScale(n) || n < 44) add(file, line, `${d.prop}: ინტერაქტიული ელემენტი უნდა იყოს სკალაზე და მინიმუმ 44px (${d.value})`);
    }
  });
  for (const [file, source] of sources) {
    if (!file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(node) {
      if (ts.isJsxAttribute(node)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        if (!file.endsWith('/ui/Button.tsx') && node.name.text === 'className' && /\bma-btn(?:\s|--|["'`])/.test(node.getText(sf)) && !/ma-btn--block/.test(node.getText(sf))) add(file, line, 'გამოიყენეთ საერთო Button კომპონენტი');
        if (node.name.text === 'style' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isObjectLiteralExpression(node.initializer.expression)) {
          let ancestor = node.parent, svg = false;
          while (ancestor) {
            if ((ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText(sf) === 'svg') || (ts.isJsxSelfClosingElement(ancestor) && ancestor.tagName.getText(sf) === 'svg')) svg = true;
            ancestor = ancestor.parent;
          }
          if (!svg) for (const prop of node.initializer.expression.properties) {
            if (ts.isPropertyAssignment(prop) && /^(height|width)$/.test(prop.name.getText(sf).replace(/["']/g, '')) && Number.isFinite(arithmetic(prop.initializer.getText(sf)))) add(file, sf.getLineAndCharacterOfPosition(prop.getStart(sf)).line + 1, `${prop.name.getText(sf)}: inline style-ში ნედლი რიცხვის ნაცვლად გამოიყენეთ ტოკენი`);
          }
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(sf);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const errors = lintSources(new Map(files('app').map(file => [file, fs.readFileSync(file, 'utf8')])));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('დიზაინის შემოწმება წარმატებულია: სკალა, შეხების ზომები, CSS ტოკენები და საერთო Button.');
}
