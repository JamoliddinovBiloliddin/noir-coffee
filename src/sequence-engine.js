import { frameUrl, FRAME_VARIANT, FRAME_COUNT, FRAMES_PER_SEGMENT, CHAPTERS, chapterForFrame, clamp } from './config.js';

export class SequenceEngine {
  constructor(canvas, options={}) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.mobile=window.matchMedia('(max-width: 760px)').matches;
    this.profile=FRAME_VARIANT==='original'?'original':this.mobile?'mobile':'desktop';
    this.decodeWidth=this.profile==='original'?(this.mobile?960:1600):this.mobile?768:1280;
    this.decodeHeight=Math.round(this.decodeWidth*9/16);
    const constrained=navigator.deviceMemory&&navigator.deviceMemory<=4;
    this.memoryBudget=(this.mobile?48:constrained?96:144)*1024*1024;
    this.limit=Math.max(16,Math.floor(this.memoryBudget/(this.decodeWidth*this.decodeHeight*4)));
    this.concurrency=this.mobile?3:4;
    this.current=0;this.previousFrame=0;this.direction=1;this.automatic=options.automatic||false;
    this.decoded=new Map();this.pending=new Map();this.inflight=new Map();this.failures=new Map();
    this.active=true;this.hasDrawn=false;this.hasFrame=false;this.lastShown=-1;this.dirty=true;
    this.onFirstFrame=options.onFirstFrame||(()=>{});this.onDraw=options.onDraw||(()=>{});
    this.stats={draws:0,requests:0,bytes:0,decodeMilliseconds:0,maxDecodedBytes:0,errors:0,evictions:0};
    this.poster=new Image();this.poster.decoding='async';this.posterKey=CHAPTERS[0].poster;
    this.poster.onload=()=>{if(this.active&&!this.hasFrame)this.draw();};
    this.poster.src=this.posterKey;
    this.resize();this.seek(0);
  }
  resize(){
    if(!this.active)return;
    const ratio=Math.min(devicePixelRatio||1,this.mobile?1.5:1.4);
    const width=Math.max(1,Math.round(this.canvas.clientWidth*ratio));
    const height=Math.max(1,Math.round(this.canvas.clientHeight*ratio));
    if(this.canvas.width===width&&this.canvas.height===height)return;
    this.canvas.width=width;this.canvas.height=height;this.dirty=true;
    this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.draw();
  }
  setAutomatic(value){this.automatic=value;this.direction=1;this.plan();}
  seek(frame){
    if(!this.active)return;
    const next=clamp(Math.round(frame),0,FRAME_COUNT-1);
    if(!this.automatic&&next!==this.current)this.direction=Math.sign(next-this.current);
    const changed=this.current!==next;if(changed)this.previousFrame=this.current;this.current=next;
    this.canvas.dataset.requestedFrame=String(next);
    this.draw();
    if(changed||!this.decoded.has(next)||!this.pending.size)this.plan();
  }
  plan(){
    if(!this.active)return;
    const slow=navigator.connection?.saveData||navigator.connection?.effectiveType==='2g';
    const ahead=Math.min(this.limit-8,slow?12:this.mobile?20:30),back=5;
    const desired=new Map([[this.current,0]]);
    for(let d=1;d<=ahead;d++)desired.set(this.current+d*this.direction,d);
    for(let d=1;d<=back;d++)desired.set(this.current-d*this.direction,ahead+d);
    // Sequence boundary images stay in the prioritized rolling buffer.
    const boundary=(Math.floor(this.current/FRAMES_PER_SEGMENT)+1)*FRAMES_PER_SEGMENT;
    if(this.direction>0&&boundary-this.current<=ahead){desired.set(boundary-1,1);desired.set(boundary,2);}
    this.pending.clear();
    for(const [index,priority] of desired){
      if(index<0||index>=FRAME_COUNT||this.decoded.has(index)||this.inflight.has(index))continue;
      if((this.failures.get(index)?.retryAt||0)>performance.now())continue;
      this.pending.set(index,priority);
    }
    for(const [index,controller] of this.inflight){
      if(!desired.has(index)&&Math.abs(index-this.current)>40){controller.abort();this.inflight.delete(index);}
    }
    if(this.pending.has(this.current)&&this.inflight.size>=this.concurrency){
      // Keep the previous demand request alive on nearby manual scrubs. Its
      // completed decode can bridge the gap while the latest demand loads.
      const candidates=[...this.inflight.keys()].filter(index=>index!==this.previousFrame);
      const farthest=candidates.sort((a,b)=>Math.abs(b-this.current)-Math.abs(a-this.current))[0];
      this.inflight.get(farthest).abort();this.inflight.delete(farthest);
    }
    this.pump();
  }
  pump(){
    if(!this.active)return;
    while(this.inflight.size<this.concurrency&&this.pending.size){
      const index=[...this.pending].sort((a,b)=>a[1]-b[1])[0][0];
      this.pending.delete(index);
      const controller=new AbortController();this.inflight.set(index,controller);
      this.load(index,controller).finally(()=>{
        if(this.inflight.get(index)===controller)this.inflight.delete(index);
        if(this.active)this.pump();
      });
    }
  }
  async load(index,controller){
    try{
      this.stats.requests++;
      const response=await fetch(frameUrl(index,this.profile),{signal:controller.signal,cache:'force-cache'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const blob=await response.blob();this.stats.bytes+=blob.size;
      if(controller.signal.aborted||!this.active)return;
      const start=performance.now();let image;
      try{
        image=await createImageBitmap(blob,{resizeWidth:this.decodeWidth,resizeHeight:this.decodeHeight,resizeQuality:'high'});
      }catch{
        image=await new Promise((resolve,reject)=>{
          const url=URL.createObjectURL(blob),fallback=new Image();fallback.decoding='async';
          fallback.onload=()=>{URL.revokeObjectURL(url);resolve(fallback);};
          fallback.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('WebP decode failed'));};fallback.src=url;
        });
      }
      this.stats.decodeMilliseconds+=performance.now()-start;
      if(controller.signal.aborted||!this.active){image.close?.();return;}
      this.failures.delete(index);this.decoded.set(index,image);this.trim();
      // Preserve the prior fix: every completed decode can improve the current
      // image. draw() selects against the latest target, never the completed ID.
      this.draw();
      this.stats.maxDecodedBytes=Math.max(this.stats.maxDecodedBytes,this.decodedBytes());
    }catch(error){
      if(error.name==='AbortError'||controller.signal.aborted||!this.active)return;
      this.stats.errors++;
      const attempts=(this.failures.get(index)?.attempts||0)+1;
      this.failures.set(index,{attempts,retryAt:performance.now()+Math.min(10000,500*2**Math.min(attempts,5)),message:error.message});
      console.warn('Animation frame '+index+' unavailable; will retry.',error.message);
      if(!this.hasFrame)this.drawPoster();
    }
  }
  decodedBytes(){let bytes=0;for(const image of this.decoded.values())bytes+=image.width*image.height*4;return bytes;}
  trim(){
    if(this.decoded.size<=this.limit&&this.decodedBytes()<=this.memoryBudget)return;
    const cost=index=>{
      const delta=(index-this.current)*this.direction;
      return delta<0?Math.abs(delta)*4:delta;
    };
    // Direction-weighted LRU; Map order breaks ties in favor of recent use.
    const keys=[...this.decoded.keys()].sort((a,b)=>cost(b)-cost(a));
    for(const index of keys){
      if(this.decoded.size<=this.limit&&this.decodedBytes()<=this.memoryBudget)break;
      if(index===this.lastShown||index===this.current)continue;
      this.decoded.get(index).close?.();this.decoded.delete(index);this.stats.evictions++;
    }
  }
  has(index){return this.decoded.has(index);}
  readyCount(index=this.current,count=8){
    let available=0;for(let i=index;i<Math.min(FRAME_COUNT,index+count);i++){if(!this.has(i))break;available++;}return available;
  }
  drawPoster(){
    if(this.hasFrame)return;
    const key=CHAPTERS[chapterForFrame(this.current)].poster;
    if(key!==this.posterKey){this.posterKey=key;this.poster.src=key;return;}
    if(this.poster.complete&&this.poster.naturalWidth){this.renderImage(this.poster);this.canvas.dataset.renderSource='poster';}
  }
  renderImage(image){
    const W=this.canvas.width,H=this.canvas.height,c=this.ctx;
    c.fillStyle='#f4efe8';c.fillRect(0,0,W,H);
    const sw=image.width||image.naturalWidth,sh=image.height||image.naturalHeight;
    if(!sw||!sh)return;
    // A separate lower safe zone on mobile keeps the product out of text.
    const scale=this.mobile?Math.min(W/sw,H/sh)*1.55:Math.max(W/sw,H/sh);
    const w=sw*scale,h=sh*scale;c.drawImage(image,(W-w)/2,(H-h)/2,w,h);this.hasDrawn=true;
  }
  drawFrame(index){
    if(!this.dirty&&index===this.lastShown)return;
    const image=this.decoded.get(index);
    this.renderImage(image);this.dirty=false;this.lastShown=index;
    this.decoded.delete(index);this.decoded.set(index,image);
    this.canvas.dataset.renderedFrame=String(index);this.canvas.dataset.renderSource='frame';
    this.stats.draws++;this.onDraw(index);
    if(!this.hasFrame){this.hasFrame=true;this.onFirstFrame();}
  }
  draw(){
    if(!this.active||!this.ctx)return;
    if(this.has(this.current)){this.drawFrame(this.current);return;}
    let closest=-1,distance=Infinity;
    for(const index of this.decoded.keys()){
      if(this.automatic&&index>this.current)continue;
      const diff=Math.abs(index-this.current);if(diff<distance){closest=index;distance=diff;}
    }
    if(closest>=0&&distance<=65)this.drawFrame(closest);
    else if(this.hasFrame&&this.has(this.lastShown))this.drawFrame(this.lastShown);
    else this.drawPoster();
  }
  destroy(){
    this.active=false;this.pending.clear();
    for(const controller of this.inflight.values())controller.abort();this.inflight.clear();
    for(const bitmap of this.decoded.values())bitmap.close?.();this.decoded.clear();
    this.failures.clear();this.poster.onload=null;
  }
}

