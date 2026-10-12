export const SEGMENTS = [
  '01_hero_01-02',
  '02_hero_to_cluster_02-03',
  '03_cluster_03-04',
  '04_cluster_to_roast_04-05',
  '05_roasting_05-06',
  '06_roast_to_grind_06-07',
  '07_grinding_07-08',
  '08_grind_to_brew_08-09',
  '09_brewing_09-10',
  '10_final_cup_10-11',
];
export const FRAMES_PER_SEGMENT = 240;
export const FRAME_COUNT = SEGMENTS.length * FRAMES_PER_SEGMENT;
export const FPS = 30;
export const SEQUENCE_SECONDS = FRAMES_PER_SEGMENT / FPS;
export const DURATION_SECONDS = FRAME_COUNT / FPS;
const environment = import.meta.env || {};
export const FRAME_VARIANT = environment.VITE_FRAME_VARIANT || 'optimized';
export const FRAMES_BASE_URL = (environment.VITE_FRAMES_BASE_URL || `${environment.BASE_URL || '/'}animations`).replace(/\/+$/, '');

// Story beats intentionally align with 240-frame clip boundaries, ensuring clean narrative cues.
export const CHAPTERS = [
  { id:'beginning', label:'The beginning', eyebrow:'01 / A single beginning', title:['EVERY GREAT','RITUAL','BEGINS SMALL.'], body:'A moment of stillness. A single bean. The promise of something extraordinary.', from:0, poster:'./posters/hero.webp', side:'left' },
  { id:'origin', label:'The origin', eyebrow:'02 / Beautifully selected', title:['EVERY BEAN','HAS A','STORY.'], body:'A little more character in every detail. Nature gives us the beginning; care makes it exceptional.', from:240, poster:'./posters/origin.webp', side:'left' },
  { id:'roast', label:'The roast', eyebrow:'03 / Crafted with patience', title:['TIME. HEAT.','A LITTLE','MAGIC.'], body:'Carefully developed to bring out depth, balance and rich, beautiful notes.', from:720, poster:'./posters/roast.webp', side:'right' },
  { id:'grind', label:'The grind', eyebrow:'04 / Released aroma', title:['THE ART','IS IN THE','DETAILS.'], body:'Every fragment carries the aroma of what comes next. Precision becomes possibility.', from:1440, poster:'./posters/grind.webp', side:'left' },
  { id:'brew', label:'The brew', eyebrow:'05 / A slower kind of energy', title:['LET THE','MOMENT','UNFOLD.'], body:'Rich espresso, poured with intention. A ritual worth taking your time for.', from:1920, poster:'./posters/brew.webp', side:'left' },
  { id:'cup', label:'The perfect cup', eyebrow:'06 / The moment is yours', title:['MADE TO','BE SAVOURED.'], body:'From one extraordinary bean to the perfect cup. Some things are worth slowing down for.', from:2160, poster:'./posters/cup.webp', side:'left' },
];
export const clamp = (x,min,max)=>Math.min(max,Math.max(min,x));
export function chapterForFrame(f){for(let i=CHAPTERS.length-1;i>=0;i--)if(f>=CHAPTERS[i].from)return i;return 0;}
export function frameUrl(index, profile='original'){
  const i=clamp(index|0,0,FRAME_COUNT-1);
  const folder=SEGMENTS[Math.floor(i/FRAMES_PER_SEGMENT)];
  const filename=`frame_${String(i%FRAMES_PER_SEGMENT+1).padStart(4,'0')}.webp`;
  const variant = profile==='original' ? '' : `${profile}/`;
  return `${FRAMES_BASE_URL}/${variant}${folder}/${filename}`;
}
