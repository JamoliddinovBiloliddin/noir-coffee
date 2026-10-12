import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { SEGMENTS } from './src/config.js';

export default defineConfig(({command,mode})=>{
  const env=loadEnv(mode,process.cwd(),'');
  const remote=!!env.VITE_FRAMES_BASE_URL;
  const original=env.VITE_FRAME_VARIANT==='original';
  return {
    plugins:[react(),{
      name:'noir-production-assets',
      async buildStart(){
        if(command!=='build')return;
        if(remote){
          if(!/^https:\/\//.test(env.VITE_FRAMES_BASE_URL))throw new Error('Production VITE_FRAMES_BASE_URL must use HTTPS.');
          return;
        }
        const profiles=original?['']:['desktop','mobile'];
        for(const profile of profiles)for(const segment of SEGMENTS)for(let frame=1;frame<=240;frame++){
          const filename=`frame_${String(frame).padStart(4,'0')}.webp`;
          try{await access(path.join('public/animations',profile,segment,filename));}
          catch{throw new Error('Required animation assets are missing. Restore prepared assets or run npm run assets:optimize with all original source frames present.');}
        }
      },
      async closeBundle(){
        if(command!=='build')return;
        for(const entry of ['posters','favicon.svg','og-image.jpg'])await cp(path.join('public',entry),path.join('dist',entry),{recursive:true});
        if(remote)return;
        await mkdir('dist/animations',{recursive:true});
        if(original){for(const segment of SEGMENTS)await cp(path.join('public/animations',segment),path.join('dist/animations',segment),{recursive:true});}
        else{for(const profile of ['desktop','mobile'])await cp(path.join('public/animations',profile),path.join('dist/animations',profile),{recursive:true});}
        // Ship only public profile metadata; source provenance hashes stay local.
        try{
          const manifest=JSON.parse(await readFile('public/animations/manifest.json','utf8'));
          const {writeFile}=await import('node:fs/promises');
          await writeFile('dist/animations/manifest.json',JSON.stringify({version:manifest.version,profiles:manifest.profiles}));
        }catch{}
      }
    }],
    publicDir:command==='build'?false:'public',
    server:{host:'0.0.0.0',port:5173,strictPort:true},
    preview:{host:'0.0.0.0',port:4173,strictPort:true},
    build:{target:'es2022',sourcemap:false},
  };
});
