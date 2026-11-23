/* Сборочный скрипт для GitHub Pages: собирает dist/ из allowlist.
   В опубликованный артефакт не попадают вложения, архивы,
   исходные документы, тесты, старый семейный сайт в family/
   и служебные файлы. Запуск: node tools/build-site.mjs */

import { cp, mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

const PAGES = ['index.html', 'play.html', 'love.html', '404.html', 'site.webmanifest', 'sw.js'];
const DIRS = ['assets/css', 'assets/js', 'assets/fonts', 'assets/img'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const page of PAGES) {
  await cp(path.join(root, page), path.join(out, page));
}

for (const dir of DIRS) {
  await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
}

await writeFile(path.join(out, '.nojekyll'), '');

/* Проверяем, что в артефакт не попали архивы, документы и тесты. */
const forbidden = /\.(zip|md|mjs|webp)$|MASTER-CONTEXT/i;
const offenders = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (forbidden.test(entry.name)) offenders.push(path.relative(out, full));
  }
}
await walk(out);
if (offenders.length) {
  console.error('В артефакт попали лишние файлы:', offenders.join(', '));
  process.exitCode = 1;
}

let bytes = 0;
let files = 0;
async function weigh(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await weigh(full);
    else {
      bytes += (await stat(full)).size;
      files += 1;
    }
  }
}
await weigh(out);

if (!process.exitCode) {
  console.log(`Pages: ${files} файлов, ${(bytes / 1024).toFixed(0)} КБ (allowlist: страницы, assets, манифест, сервис-воркер).`);
}
