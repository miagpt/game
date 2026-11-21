import {cp,mkdir,rm,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','404.html'])await cp(path.join(root,name),path.join(out,name));
for(const name of ['assets/css/style.css','assets/js/main.js','assets/js/rules.js']){const dest=path.join(out,name);await mkdir(path.dirname(dest),{recursive:true});await cp(path.join(root,name),dest)}
// Explicit photo allowlist: only images actually referenced by the shipped pages/game.
const photos=['cat-face.webp','puppies.webp','cat-tree.webp','cat-bag.webp','archi-puppy.webp','cat-cushion.webp','puppies-close.webp','cat-nap.webp'];
for(const name of photos){const dest=path.join(out,'assets/img/family',name);await mkdir(path.dirname(dest),{recursive:true});await cp(path.join(root,'assets/img/family',name),dest)}
await writeFile(path.join(out,'.nojekyll'),'');
console.log(`Pages artifact built from an allowlist (${photos.length} referenced photos; no source archives or video).`);
