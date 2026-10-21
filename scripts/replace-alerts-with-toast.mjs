import fs from 'fs';
import path from 'path';

const root = path.resolve('WhithinMessenger.Client/src');
const files = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(jsx|js)$/.test(name)) files.push(p);
  }
}

walk(root);

let changed = 0;

for (const file of files) {
  if (file.includes(`${path.sep}appToast.js`)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!/\balert\s*\(/.test(src)) continue;

  const before = src;
  src = src.replace(/\balert\s*\(/g, 'appToast.alert(');
  if (src === before) continue;

  if (!/from ['"].*appToast['"]/.test(src)) {
    const target = path.join(root, 'shared/lib/utils/appToast.js');
    let rel = path.relative(path.dirname(file), target).replace(/\\/g, '/').replace(/\.js$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;

    const lines = src.split('\n');
    let insertAt = 0;
    let i = 0;
    while (i < lines.length) {
      if (/^import\s/.test(lines[i])) {
        while (
          i < lines.length &&
          !/;\s*$/.test(lines[i]) &&
          !/from\s+['"][^'"]+['"]\s*;?\s*$/.test(lines[i])
        ) {
          i += 1;
        }
        insertAt = i + 1;
        i += 1;
        continue;
      }
      if (lines[i].trim() === '' && insertAt > 0) {
        i += 1;
        continue;
      }
      break;
    }
    lines.splice(insertAt, 0, `import { appToast } from '${rel}';`);
    src = lines.join('\n');
  }

  fs.writeFileSync(file, src);
  changed += 1;
  console.log('updated', path.relative(process.cwd(), file));
}

console.log('files changed', changed);
