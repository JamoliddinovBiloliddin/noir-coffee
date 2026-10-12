import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { SEGMENTS } from '../src/config.js';
import path from 'node:path';

const manifest=JSON.parse(await readFile('public/animations/manifest.json','utf8'));
const report={source:{frames:0,bytes:0,hashesUnchanged:true},profiles:{},directories:{},qualitySamples:[]};
for(const profile of ['original','desktop','mobile']){
  const base=profile==='original'?'public/animations':`public/animations/${profile}`;
  const result=profile==='original'?report.source:(report.profiles[profile]={frames:0,bytes:0,maxFrameBytes:0});
  for(const segment of SEGMENTS){
    const files=await readdir(path.join(base,segment));
    if(files.filter(f=>f.endsWith('.webp')).length!==240)throw new Error(`Invalid frame count ${profile}/${segment}`);
    for(let i=1;i<=240;i++){
      const name=`frame_${String(i).padStart(4,'0')}.webp`,file=path.join(base,segment,name),data=await readFile(file);
      result.frames++;result.bytes+=data.length;result.maxFrameBytes=Math.max(result.maxFrameBytes||0,data.length);
      if(profile==='original'&&createHash('sha256').update(data).digest('hex')!==manifest.sourceHashes[`${segment}/${name}`])throw new Error('Original frame changed: '+file);
    }
  }
}
async function walk(directory){let bytes=0,files=0;for(const e of await readdir(directory,{withFileTypes:true})){const p=path.join(directory,e.name);if(e.isDirectory()){const r=await walk(p);bytes+=r.bytes;files+=r.files;}else{bytes+=(await stat(p)).size;files++;}}return {files,bytes};}
for(const dir of ['public','dist'])report.directories[dir]=await walk(dir);
for(const profile of ['desktop','mobile'])for(const segment of [SEGMENTS[0],SEGMENTS[6],SEGMENTS[9]]){
  const settings=manifest.profiles[profile],name='frame_0120.webp';
  const reference=await sharp(`public/animations/${segment}/${name}`).resize(settings.width,settings.height).removeAlpha().raw().toBuffer();
  const optimized=await sharp(`public/animations/${profile}/${segment}/${name}`).removeAlpha().raw().toBuffer();
  let error=0;for(let i=0;i<reference.length;i++)error+=(reference[i]-optimized[i])**2;
  const mse=error/reference.length;report.qualitySamples.push({profile,segment,psnrDecibels:mse?10*Math.log10(255**2/mse):Infinity});
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/asset-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
