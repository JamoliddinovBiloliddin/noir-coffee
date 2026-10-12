import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SequenceEngine } from './sequence-engine.js';
import { PlaybackClock } from './playback-clock.js';
import { CHAPTERS, FRAME_COUNT, FPS, DURATION_SECONDS, chapterForFrame, clamp } from './config.js';

export class TourController {
  constructor(canvas, journey, options={}) {
    this.canvas=canvas;this.journey=journey;this.options=options;
    this.clock=new PlaybackClock();this.active=true;this.startupCancelled=false;
    this.startupDeadline=null;this.lastPlan=0;this.lastUi='';this.programmaticY=null;
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.drawHistory=[];this.longTasks=[];this.boundaries=[];
    performance.setResourceTimingBufferSize?.(12000);
    this.engine=new SequenceEngine(canvas,{
      automatic:true,
      onDraw:index=>{
        this.clock.state.actualDrawnFrameIndex=index;
        this.options.onChapter?.(chapterForFrame(index));
        if(import.meta.env.DEV||import.meta.env.VITE_ENABLE_DIAGNOSTICS==='true')
          this.drawHistory.push({index,time:this.clock.state.currentTimeSeconds,wall:performance.now()});
      }
    });
    this.trigger=ScrollTrigger.create({trigger:journey,start:'top top',end:'bottom bottom',
      invalidateOnRefresh:true,onRefresh:self=>{
        this.engine.resize();
        if(this.clock.state.isPlaying)this.scrollToProgress(this.clock.state.playbackProgress);
        else this.manualProgress(self.progress);
      },onUpdate:self=>{
        if(!this.clock.state.isPlaying)this.manualProgress(self.progress);
      }});
    this.listeners=[];
    const listen=(target,event,fn,settings)=>{
      target.addEventListener(event,fn,settings);this.listeners.push(()=>target.removeEventListener(event,fn,settings));
    };
    const interrupt=()=>this.pause(true);
    listen(window,'wheel',interrupt,{passive:true});
    listen(window,'touchstart',interrupt,{passive:true});
    listen(window,'touchmove',interrupt,{passive:true});
    listen(window,'pointerdown',event=>{
      // Control clicks manage their own state. Capture scrollbar dragging too.
      if(!event.target.closest?.('.tour-controls'))interrupt();
    },{capture:true,passive:true});
    listen(window,'keydown',event=>{
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      if(['PageUp','PageDown','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End',' '].includes(event.key))interrupt();
    });
    // Detect scrollbar/accessibility scrolling that has no wheel or key event.
    listen(window,'scroll',()=>{
      if(this.clock.state.isPlaying&&this.programmaticY!==null&&Math.abs(scrollY-this.programmaticY)>3)this.pause(true);
    },{passive:true});
    listen(document,'visibilitychange',()=>{
      if(document.hidden){this.startupCancelled=true;this.pause(false,'hidden');}
      // Returning to the tab always requires explicit Resume.
    });
    listen(this.motion,'change',()=>{
      this.startupCancelled=true;this.pause(false,this.motion.matches?'reduced':'paused');
      this.manualProgress(this.trigger.progress);this.publish();
    });
    listen(window,'resize',()=>this.engine.resize(),{passive:true});
    try{
      this.observer=new PerformanceObserver(list=>{
        for(const entry of list.getEntries())this.longTasks.push({start:entry.startTime,duration:entry.duration});
      });this.observer.observe({type:'longtask',buffered:true});
    }catch{}
    if(this.motion.matches){this.startupCancelled=true;this.clock.state.status='reduced';}
    if(scrollY>3){this.startupCancelled=true;this.clock.state.status='paused';}
    this.manualProgress(this.trigger.progress);
    this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
    if(import.meta.env.DEV||import.meta.env.VITE_ENABLE_DIAGNOSTICS==='true')window.__NOIR_PLAYER__=this;
  }
  manualProgress(progress){
    if(!this.active||this.clock.state.isPlaying)return;
    const p=clamp(progress,0,1),index=Math.round(p*(FRAME_COUNT-1));
    this.clock.seek(p===1?DURATION_SECONDS:index/FPS);
    this.engine.seek(this.motion.matches&&index<FRAME_COUNT-1?CHAPTERS[chapterForFrame(index)].from:index);
    this.options.onProgress?.(p);
  }
  scrollToProgress(progress){
    if(!this.trigger)return;
    const y=this.trigger.start+progress*(this.trigger.end-this.trigger.start);
    this.programmaticY=Math.round(y);
    window.scrollTo({top:y,behavior:'instant'});
  }
  play(){
    this.startupCancelled=true;
    if(this.motion.matches||document.hidden)return;
    this.engine.setAutomatic(true);this.engine.seek(this.clock.state.targetFrameIndex);
    this.clock.play();this.publish();
  }
  pause(interrupted=true,reason='paused'){
    this.startupCancelled=true;this.clock.pause(interrupted,reason);this.engine.setAutomatic(false);this.publish();
  }
  replay(){
    this.pause(false);this.clock.metrics={bufferingMilliseconds:0,stallMilliseconds:0,activeMilliseconds:0};
    this.drawHistory=[];this.boundaries=[];this.clock.seek(0);this.engine.seek(0);this.scrollToProgress(0);
    this.options.onProgress?.(0);this.play();
  }
  goToChapter(index){
    this.pause(true);this.clock.seek(CHAPTERS[index].from/FPS);
    this.engine.seek(CHAPTERS[index].from);
    // Manual scrub coordinates use the last frame endpoint. Land inside the
    // selected frame's scroll cell, including the later chapter boundaries.
    this.scrollToProgress((CHAPTERS[index].from+.15)/(FRAME_COUNT-1));
    ScrollTrigger.update();this.options.onProgress?.(this.clock.state.playbackProgress);this.publish();
  }
  skip(){
    this.pause(true);this.clock.seek(DURATION_SECONDS);this.engine.seek(FRAME_COUNT-1);
    this.scrollToProgress(1);this.options.onProgress?.(1);this.clock.state.status='complete';this.publish();
  }
  tick(timestamp){
    if(!this.active)return;
    const state=this.clock.state;
    if(!document.hidden){
      if(!this.startupCancelled){
        if(this.engine.readyCount(0,12)>=12){
          this.startupDeadline??=timestamp+1000;state.status='ready';
          if(timestamp>=this.startupDeadline)this.play();
        }
      }
      if(state.isPlaying){
        const sequence=state.currentSequence;
        const changed=this.clock.tick(timestamp,(_,next)=>{
          if(!this.engine.has(next))return false;
          return !state.isBuffering||this.engine.readyCount(next,8)>=Math.min(8,FRAME_COUNT-next);
        });
        if(changed)this.engine.seek(state.targetFrameIndex);
        if(sequence!==state.currentSequence)this.boundaries.push({sequence:state.currentSequence,time:state.currentTimeSeconds,wall:timestamp});
        this.scrollToProgress(state.playbackProgress);
        this.options.onProgress?.(state.playbackProgress);
      }
      if(timestamp-this.lastPlan>250){this.engine.plan();this.lastPlan=timestamp;}
    }
    this.canvas.dataset.timeSeconds=state.currentTimeSeconds.toFixed(6);
    this.canvas.dataset.playbackStatus=state.status;
    this.options.onTime?.(state.currentTimeSeconds);
    this.publish();this.raf=requestAnimationFrame(this.tick);
  }
  publish(){
    const state=this.clock.state,key=[state.isPlaying,state.status,this.motion.matches].join(':');
    this.canvas.dataset.playbackStatus=state.status;
    this.canvas.dataset.timeSeconds=state.currentTimeSeconds.toFixed(6);
    if(key===this.lastUi)return;this.lastUi=key;
    this.options.onState?.({...state,reduced:this.motion.matches});
  }
  diagnostics(){
    return {state:{...this.clock.state},clock:{...this.clock.metrics},engine:{...this.engine.stats},
      cacheBytes:this.engine.decodedBytes(),memoryBudget:this.engine.memoryBudget,
      boundaries:this.boundaries,drawHistory:this.drawHistory,longTasks:this.longTasks,
      heapBytes:performance.memory?.usedJSHeapSize};
  }
  destroy(){
    this.active=false;cancelAnimationFrame(this.raf);this.trigger.kill();this.engine.destroy();
    for(const remove of this.listeners)remove();this.observer?.disconnect();
    if(window.__NOIR_PLAYER__===this)delete window.__NOIR_PLAYER__;
  }
}
