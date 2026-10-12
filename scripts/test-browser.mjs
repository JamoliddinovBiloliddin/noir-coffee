import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base=process.env.TEST_BASE_URL||'http://localhost:5173';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'chrome',headless:true});
const report={base,startedAt:new Date().toISOString(),tests:[],fullTours:[]};
const hash=data=>createHash('sha256').update(data).digest('hex');
const waitFrame=(page,index)=>page.waitForFunction(index=>Number(document.querySelector('canvas').dataset.renderedFrame)===index,index,{timeout:20000});
async function open(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',...options});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/animations/'))errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base,{waitUntil:'domcontentloaded'});await waitFrame(page,0);
  return {context,page,errors};
}
try{
  // Real 80-second tours, not accelerated clocks. Use --quick to skip these.
  if(!process.argv.includes('--quick'))for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
    const {context,page,errors}=await open({viewport});
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='playing',{},{timeout:20000});
    const wallStart=await page.evaluate(()=>performance.now());
    const samples=[];
    for(const target of [120,720,1539,2399]){
      await page.waitForFunction(target=>Number(document.querySelector('canvas').dataset.renderedFrame)>=target,target,{timeout:180000});
      const sample=await page.evaluate(()=>{const c=document.querySelector('canvas');return {index:Number(c.dataset.renderedFrame),time:Number(c.dataset.timeSeconds),pixels:c.toDataURL(),y:scrollY};});
      samples.push({index:sample.index,time:sample.time,canvasPixelHash:hash(sample.pixels),scrollY:sample.y});
      if(target===1539||target===2399)await writeFile(`artifacts/${name}-tour-${target}.png`,Buffer.from(sample.pixels.split(',')[1],'base64'));
    }
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='complete',null,{timeout:20000});
    const wallEnd=await page.evaluate(()=>performance.now());
    const diagnostics=await page.evaluate(()=>window.__NOIR_PLAYER__?.diagnostics());
    const result={name,wallSeconds:(wallEnd-wallStart)/1000,samples,errors};
    if(diagnostics){
      result.activeSeconds=diagnostics.state.currentTimeSeconds;
      result.bufferingSeconds=diagnostics.clock.bufferingMilliseconds/1000;
      result.stallSeconds=diagnostics.clock.stallMilliseconds/1000;
      result.drawnFrames=new Set(diagnostics.drawHistory.map(d=>d.index)).size;
      result.droppedFrames=2400-result.drawnFrames;
      result.sequenceFrameCounts=Array.from({length:10},(_,sequence)=>new Set(diagnostics.drawHistory.filter(d=>Math.floor(d.index/240)===sequence).map(d=>d.index)).size);
      result.boundaries=diagnostics.boundaries;result.engine=diagnostics.engine;
      result.longTasks=diagnostics.longTasks;result.heapBytes=diagnostics.heapBytes;
      result.cacheBytes=diagnostics.cacheBytes;result.memoryBudget=diagnostics.memoryBudget;
      assert.equal(result.activeSeconds,80);assert.equal(result.drawnFrames,2400);assert.equal(result.droppedFrames,0);
      assert.ok(result.cacheBytes<=result.memoryBudget);
    }
    result.network=await page.evaluate(()=>{
      const entries=performance.getEntriesByType('resource').filter(e=>e.name.includes('/animations/'));
      const sorted=entries.map(e=>e.duration).sort((a,b)=>a-b);
      return {requests:entries.length,transferBytes:entries.reduce((n,e)=>n+e.transferSize,0),p95Milliseconds:sorted[Math.floor(sorted.length*.95)],maxMilliseconds:sorted.at(-1)};
    });
    assert.equal(errors.length,0);assert.ok(new Set(samples.map(s=>s.canvasPixelHash)).size>=3);
    report.fullTours.push(result);console.log('Tour:',JSON.stringify(result));
    await context.close();await writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));
  }
  const {context,page,errors}=await open();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='playing');
  await page.getByRole('button',{name:'Pause tour',exact:true}).click();
  let time=Number(await page.locator('canvas').getAttribute('data-time-seconds'));
  await page.waitForTimeout(350);assert.equal(Number(await page.locator('canvas').getAttribute('data-time-seconds')),time);
  await page.getByRole('button',{name:'Play or resume tour'}).click();
  await page.waitForTimeout(400);assert.ok(Number(await page.locator('canvas').getAttribute('data-time-seconds'))>time);
  await page.mouse.wheel(0,500);await page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='paused');
  await page.waitForTimeout(100);time=Number(await page.locator('canvas').getAttribute('data-time-seconds'));
  await page.waitForTimeout(400);assert.equal(Number(await page.locator('canvas').getAttribute('data-time-seconds')),time);
  report.tests.push('pause, resume, wheel interruption, no unsolicited restart');
  const pixels=[];
  for(const target of [1440,1490,1539,1600,1679,1600,1539,1490,1440]){
    await page.evaluate(index=>{const j=document.querySelector('.journey');scrollTo({top:Math.round((j.offsetHeight-innerHeight)*index/2399),behavior:'instant'});},target);
    await waitFrame(page,target);pixels.push({target,hash:hash(await page.locator('canvas').evaluate(c=>c.toDataURL()))});
  }
  assert.equal(new Set(pixels.slice(0,5).map(p=>p.hash)).size,5);
  for(const reverse of pixels.slice(5))assert.equal(reverse.hash,pixels.find(p=>p.target===reverse.target).hash);
  report.tests.push('forward and reverse Canvas pixel comparisons');report.manualPixels=pixels;
  await page.getByRole('button',{name:'Go to chapter 3, The roast'}).click();await waitFrame(page,720);
  assert.equal(await page.locator('canvas').getAttribute('data-playback-status'),'paused');
  await page.getByRole('button',{name:'Replay tour'}).click();await page.waitForTimeout(200);
  assert.ok(Number(await page.locator('canvas').getAttribute('data-time-seconds'))<1);
  await page.keyboard.press('PageDown');assert.equal(await page.locator('canvas').getAttribute('data-playback-status'),'paused');
  report.tests.push('chapter navigation, replay and keyboard interruption');
  if(base.includes(':5173')){
    await page.getByRole('button',{name:'Play or resume tour'}).click();
    const session=await context.newCDPSession(page);
    await session.send('Page.setWebLifecycleState',{state:'frozen'});await page.waitForTimeout(200);
    await session.send('Page.setWebLifecycleState',{state:'active'});
    // visibility is tested with a separate tab as lifecycle frozen is not hidden.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='hidden');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(200);assert.equal(await page.locator('canvas').getAttribute('data-playback-status'),'hidden');
    report.tests.push('hidden tab pauses and requires explicit resume');
  }
  await context.close();assert.equal(errors.length,0);
  const widths=[320,360,375,390,430,768,1024,1280,1440,1920,2560];report.layouts=[];
  for(const width of widths){
    const height=width<=430?844:width<1024?900:1080;
    const {context,page,errors}=await open({viewport:{width,height},reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Skip to final cup'}).click();
    await waitFrame(page,2399);
    const layout=await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll('.tour-controls button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
      const title=document.querySelector('.chapter--active .chapter-title').getBoundingClientRect();
      return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,buttons,title:{left:title.left,right:title.right,top:title.top,bottom:title.bottom},status:document.querySelector('canvas').dataset.playbackStatus};
    });
    assert.ok(layout.documentWidth<=width,`Overflow at ${width}`);
    for(const b of layout.buttons)assert.ok(b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=height&&b.height>=44,`Button clipped at ${width}`);
    if([320,390,1440,2560].includes(width))await page.screenshot({path:`artifacts/layout-${width}.png`});
    report.layouts.push({width,height,...layout});await context.close();assert.equal(errors.length,0);
  }
  report.tests.push('all 11 responsive widths and reduced-motion presentation');
  const slow=await open({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await slow.page.touchscreen.tap(200,500);assert.equal(await slow.page.locator('canvas').getAttribute('data-playback-status'),'paused');
  await slow.page.getByRole('button',{name:'Skip to final cup'}).click();await waitFrame(slow.page,2399);
  await slow.page.route('**/animations/**',async route=>{await new Promise(r=>setTimeout(r,400));try{await route.continue();}catch{}});
  await slow.page.getByRole('button',{name:'Replay tour'}).click();
  await slow.page.waitForFunction(()=>document.querySelector('canvas').dataset.playbackStatus==='buffering');
  const before=Number(await slow.page.locator('canvas').getAttribute('data-time-seconds'));
  await slow.page.waitForTimeout(200);assert.equal(Number(await slow.page.locator('canvas').getAttribute('data-time-seconds')),before);
  await slow.page.waitForFunction(before=>Number(document.querySelector('canvas').dataset.timeSeconds)>before,before,{timeout:20000});
  assert.equal(await slow.page.locator('canvas').getAttribute('data-render-source'),'frame');
  report.tests.push('touch interruption, slow-network buffering freezes active clock and recovers');
  await slow.context.close();assert.equal(slow.errors.length,0);
  console.log('PASS:',report.tests.join('; '));
}finally{
  await writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));
  if(report.fullTours.length)await writeFile('artifacts/full-tour-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
