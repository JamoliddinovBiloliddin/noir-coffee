import sharp from 'sharp';
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENTS } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'public/animations');
const profiles = { desktop: {width:1280, height:720, quality:82}, mobile:{width:768, height:432, quality:80} };
let previous={};try{previous=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8'));}catch{}
const manifest = {version:1, sourceFrames:2400, sourceBytes:0, sourceHashes:{}, profiles:{}, generatedAt:new Date().toISOString()};
for (const segment of SEGMENTS) {
  const files = await readdir(path.join(base,segment));
  const expected = Array.from({length:240},(_,i)=>`frame_${String(i+1).padStart(4,'0')}.webp`);
  if (files.filter(f=>f.endsWith('.webp')).length!==240 || expected.some(f=>!files.includes(f))) throw new Error(`Invalid source sequence: ${segment}`);
}
let next = 0;
sharp.concurrency(1);
await Promise.all(Array.from({length:4},async()=>{
  while(next<2400){
    const index=next++, segment=SEGMENTS[Math.floor(index/240)], name=`frame_${String(index%240+1).padStart(4,'0')}.webp`;
    const source=await readFile(path.join(base,segment,name));
    manifest.sourceBytes+=source.length;
    manifest.sourceHashes[`${segment}/${name}`]=createHash('sha256').update(source).digest('hex');
    for(const [profile,settings] of Object.entries(profiles)){
      const directory=path.join(base,profile,segment);await mkdir(directory,{recursive:true});
      const target=path.join(directory,name);
      // Reuse generated output only when its profile contract matches.
      let existing=false;
      try {
        const m=await sharp(target).metadata(),prior=previous.profiles?.[profile];
        existing=m.width===settings.width&&m.height===settings.height&&prior?.quality===settings.quality
          &&previous.sourceHashes?.[`${segment}/${name}`]===manifest.sourceHashes[`${segment}/${name}`];
      }catch{}
      if(!existing)await sharp(source).resize(settings.width,settings.height,{fit:'fill'}).webp({quality:settings.quality,effort:4}).toFile(target);
      const size=(await stat(target)).size;
      manifest.profiles[profile] ||= {...settings,frames:0,bytes:0};
      manifest.profiles[profile].frames++;manifest.profiles[profile].bytes+=size;
    }
    if(index%240===239)console.log(`Optimized ${segment}`);
  }
}));
await writeFile(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({sourceBytes:manifest.sourceBytes,profiles:manifest.profiles},null,2));
