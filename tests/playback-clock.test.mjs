import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock, frameAtTime } from '../src/playback-clock.js';
import { frameUrl } from '../src/config.js';

test('all 10 eight-second boundaries and one-based filenames are exact',()=>{
  for(let sequence=0;sequence<10;sequence++){
    assert.equal(frameAtTime(sequence*8),sequence*240);
    assert.equal(frameAtTime((sequence+1)*8-1/3000),sequence*240+239);
    assert.match(frameUrl(sequence*240),/frame_0001\.webp$/);
    assert.match(frameUrl(sequence*240+239),/frame_0240\.webp$/);
  }
  assert.equal(frameAtTime(80),2399);assert.equal(frameAtTime(100),2399);
  assert.equal(frameAtTime(-1),0);
});
for(const hz of [30,60,120,144])test(`80 active seconds at ${hz} Hz, all 2400 frames delivered`,()=>{
  const clock=new PlaybackClock(),seen=new Set([0]);clock.play();clock.tick(0);
  for(let tick=1;tick<=hz*80+2&&clock.state.isPlaying;tick++){
    clock.tick(tick*1000/hz);seen.add(clock.state.targetFrameIndex);
  }
  assert.equal(clock.state.currentTimeSeconds,80);assert.equal(clock.state.status,'complete');
  assert.equal(seen.size,2400);assert.ok(Math.abs(clock.metrics.activeMilliseconds-80000)<.001);
});
test('buffering, intentional pause and resume exclude inactive time',()=>{
  const clock=new PlaybackClock();clock.play();clock.tick(0);clock.tick(20);
  const frozen=clock.state.currentTimeSeconds;
  clock.tick(40,()=>false);clock.tick(60,()=>false);
  assert.equal(clock.state.currentTimeSeconds,frozen);assert.equal(clock.state.isBuffering,true);
  clock.pause();clock.tick(3000);assert.equal(clock.state.currentTimeSeconds,frozen);
  clock.play();clock.tick(4000);clock.tick(4020);
  assert.equal(clock.state.currentTimeSeconds,frozen+.02);assert.equal(clock.metrics.bufferingMilliseconds,40);
  clock.seek(1539/30);assert.equal(clock.state.targetFrameIndex,1539);
});
test('a blocked RAF cannot silently skip prepared frames',()=>{
  const clock=new PlaybackClock();clock.play();clock.tick(0);clock.tick(2000);
  assert.equal(clock.state.targetFrameIndex,1);assert.ok(clock.metrics.stallMilliseconds>1900);
});
