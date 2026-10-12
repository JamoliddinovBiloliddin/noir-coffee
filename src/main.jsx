import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHAPTERS, FRAME_COUNT, chapterForFrame, clamp } from './config.js';
import { TourController } from './tour-controller.js';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

function Arrow({diagonal=false}){
  return diagonal ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18 18 6M8 6h10v10"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
}
function Logo(){return <span className="wordmark"><span className="wordmark-symbol" aria-hidden="true"><span/></span><span>NOIR<span className="wordmark-dot">.</span>COFFEE</span></span>;}

function Header({goTo}){
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>45);fn();window.addEventListener('scroll',fn,{passive:true});return()=>window.removeEventListener('scroll',fn);},[]);
  return <header className={`header ${scrolled?'header--scrolled':''}`}>
    <a className="brand" href="#top" aria-label="NOIR COFFEE home" onClick={(e)=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}}><Logo/></a>
    <nav aria-label="Main navigation" className="header-nav">
      <button onClick={()=>goTo(0)}>Our story</button>
      <button onClick={()=>goTo(2)}>The craft</button>
      <button onClick={()=>goTo(4)}>The ritual</button>
    </nav>
    <a className="header-cta" href="#collection">Explore coffee <Arrow diagonal/></a>
  </header>;
}
function ChapterOverlay({chapter,active,goTo,ready}){
  return <div className={`chapter chapter--${chapter.side} ${active?'chapter--active':''}`} key={chapter.id} aria-hidden={!active}>
    <span className="chapter-overline"><i/> {chapter.eyebrow}</span>
    {active && chapter.from===0 ? <h1 className="chapter-title">{chapter.title.map((line,i)=><span key={i}>{line}</span>)}</h1>:
      <h2 className="chapter-title">{chapter.title.map((line,i)=><span key={i}>{line}</span>)}</h2>}
    <p className="chapter-description">{chapter.body}</p>
    {active && chapter.from===0 && <button className="story-cta" onClick={()=>goTo(1)}>Discover the story <Arrow/></button>}
    {active && chapter.id==='cup' && <a className="story-cta" href="#collection">Meet your ritual <Arrow/></a>}
  </div>;
}
function StoryExperience({goToRef}){
  const journeyRef=useRef(null),canvasRef=useRef(null),engineRef=useRef(null),
    progressRef=useRef(null),meterRef=useRef(null),countRef=useRef(null),timeRef=useRef(null),stageRef=useRef(0);
  const [chapter,setChapter]=useState(0),[ready,setReady]=useState(false);
  const [playback,setPlayback]=useState({isPlaying:false,status:'loading',reduced:false});
  const goTo=(index)=>engineRef.current?.goToChapter(index);
  goToRef.current=goTo;
  useEffect(()=>{
    const player=new TourController(canvasRef.current,journeyRef.current,{
      onChapter:index=>{if(stageRef.current!==index){stageRef.current=index;setChapter(index);}setReady(true);},
      onState:setPlayback,
      onProgress:p=>{
        if(progressRef.current)progressRef.current.style.transform=`scaleX(${p})`;
        if(meterRef.current)meterRef.current.style.transform=`scaleY(${p})`;
        if(countRef.current)countRef.current.textContent=`${String(Math.round(p*100)).padStart(2,'0')}%`;
      },
      onTime:seconds=>{
        const whole=Math.floor(seconds);
        const label=`${String(Math.floor(whole/60)).padStart(2,'0')}:${String(whole%60).padStart(2,'0')}`;
        if(timeRef.current&&timeRef.current.textContent!==label)timeRef.current.textContent=label;
      }
    });
    engineRef.current=player;ScrollTrigger.refresh();
    return()=>{player.destroy();engineRef.current=null;};
  },[]);
  return <section className="journey" id="journey" ref={journeyRef} aria-label="Scroll through our coffee-making journey">
    <div className={`experience-sticky ${ready?'experience-ready':''}`}>
      <canvas ref={canvasRef} className="sequence-canvas" role="img" aria-label={`${CHAPTERS[chapter].label}: cinematic coffee animation controlled by scrolling`}/>
      <div className="canvas-haze" aria-hidden="true"/>
      <div className="top-signal"><span className="signal-line"/> THE NOIR EXPERIENCE <span className="signal-circle"/></div>
      <div className="story-content" aria-live="off">
        {CHAPTERS.map((item,i)=><ChapterOverlay key={item.id} chapter={item} active={chapter===i} goTo={goTo} ready={ready}/>)}
      </div>
      <div className="side-navigation" aria-label="Story chapters">
        <div className="side-heading">CHAPTERS</div>
        {CHAPTERS.map((stage,index)=><button
          key={stage.id}
          aria-label={`Go to chapter ${index+1}, ${stage.label}`}
          aria-current={chapter===index?'step':undefined}
          className={`side-link ${chapter===index?'side-link--active':''}`}
          onClick={()=>goTo(index)}
        ><span className="side-index">{String(index+1).padStart(2,'0')}</span><span className="side-caption">{stage.label}</span></button>)}
      </div>
      <div className="bottom-overlay">
        <div className="scroll-cue"><span className="scroll-mouse" aria-hidden="true"><span/></span><span>SCROLL TO EXPLORE</span></div>
        <div className="current-caption">{String(chapter+1).padStart(2,'0')} <span>/ 06</span></div>
        <div className="percentage" ref={countRef}>00%</div>
      </div>
      <div className="bottom-progress"><span ref={progressRef}/></div>
      <div className="mobile-progress"><span ref={meterRef}/></div>
      <div className="tour-controls" role="group" aria-label="Coffee tour playback">
        <div className="tour-control-buttons">
          <button className="tour-toggle" disabled={playback.reduced||playback.status==='complete'}
            onClick={()=>playback.isPlaying?engineRef.current?.pause():engineRef.current?.play()}
            aria-label={playback.isPlaying?'Pause tour':'Play or resume tour'}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">{playback.isPlaying?<path d="M5 4h3v12H5zm7 0h3v12h-3z"/>:<path d="m6 3 10 7-10 7z"/>}</svg>
            {playback.isPlaying?'Pause':'Play'}
          </button>
          <button onClick={()=>engineRef.current?.replay()} disabled={playback.reduced} aria-label="Replay tour">Replay</button>
          <button onClick={()=>engineRef.current?.skip()} aria-label="Skip to final cup">Skip <Arrow/></button>
        </div>
        <output className="tour-time" ref={timeRef} aria-label="Elapsed tour time">00:00</output><span className="tour-duration">/ 01:20</span>
        <span className="tour-status" role="status">{playback.reduced?'Explore at your pace':playback.status==='buffering'?'Preparing the next moment…':playback.status==='loading'?'Preparing your ritual…':playback.status==='ready'?'Your story begins in a moment':playback.status==='hidden'?'Paused while you were away':playback.status==='complete'?'The moment is yours':playback.isPlaying?'The bean-to-cup journey':'Scroll to explore'}</span>
      </div>
    </div>
  </section>;
}
function Closing({goTo}){
  return <>
    <section className="philosophy" id="collection">
      <div className="section-kicker"><span className="kicker-line"/> GOOD COFFEE. NO RUSH.</div>
      <div className="philosophy-head">
        <div><div className="philosophy-index">A LITTLE MORE ABOUT NOIR / 001</div><h2>Not just coffee.<br/><em>A way to pause.</em></h2></div>
        <div className="philosophy-copy"><p>Some moments deserve your full attention. The first aroma. The first sip. The quiet between everything else.</p><p>NOIR COFFEE is a celebration of those small, extraordinary moments — from bean to cup.</p><button onClick={()=>goTo(0)} className="plain-link">Experience it again <Arrow/></button></div>
      </div>
      <div className="postcard-grid">
        <article className="postcard"><div className="postcard-photo"><img src="./posters/origin.webp" alt="Coffee beans floating in warm natural light" loading="lazy"/></div><div className="postcard-bar"><span>01 / SOURCE</span><span>SELECTED WITH CARE</span></div></article>
        <article className="postcard"><div className="postcard-photo"><img src="./posters/grind.webp" alt="Ground coffee revealing its aroma" loading="lazy"/></div><div className="postcard-bar"><span>02 / PROCESS</span><span>MADE WITH INTENTION</span></div></article>
        <article className="postcard"><div className="postcard-photo"><img src="./posters/cup.webp" alt="Finished ivory ceramic cup of fresh espresso" loading="lazy"/></div><div className="postcard-bar"><span>03 / RITUAL</span><span>WORTH THE WAIT</span></div></article>
      </div>
    </section>
    <section className="epilogue" aria-label="Closing statement">
      <div className="epilogue-inner"><span>NOIR / THE DAILY RITUAL</span><h2>Take your time.<br/><em>Taste the moment.</em></h2><button className="epilogue-button" onClick={()=>{window.scrollTo({top:0,behavior:'smooth'});}}>Return to the beginning <Arrow diagonal/></button></div>
    </section>
    <footer className="footer"><Logo/><span>MADE FOR THE MOMENTS IN BETWEEN.</span><span>© {new Date().getFullYear()} NOIR COFFEE. CONCEPT EXPERIENCE.</span></footer>
  </>;
}
function App(){
  const goToRef=useRef(()=>{});
  return <div id="top"><a className="skip-link" href="#collection">Skip animation</a><Header goTo={(i)=>goToRef.current(i)}/><main><StoryExperience goToRef={goToRef}/><Closing goTo={(i)=>goToRef.current(i)}/></main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
