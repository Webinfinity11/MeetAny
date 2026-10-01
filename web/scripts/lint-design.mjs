import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const errors=[];
for(const file of files('app')) {
 if(file.endsWith('.css')&&!file.endsWith('/tokens.css'))postcss.parse(fs.readFileSync(file,'utf8')).walkDecls(d=>{
  if(!d.value.includes('url(')&&/(?:#[\da-f]{3,8}\b|rgba?\(|(?<![\w-])-?(?:\d*\.)?\d+px\b)/i.test(d.value))errors.push(`${file}:${d.source.start.line}: use a token for ${d.prop}`);
 });
 if(file.endsWith('.tsx')&&!file.endsWith('/ui/Button.tsx')){
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function walk(node){if(ts.isJsxAttribute(node)&&node.name.text==='className'&&/\bma-btn(?:\s|--)/.test(node.getText(sf))&&!/ma-btn--block/.test(node.getText(sf)))errors.push(`${file}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}: use Button`);ts.forEachChild(node,walk);}walk(sf);
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Design checks passed: shared buttons and CSS tokens.');
