#!/usr/bin/env python3
"""Install the 10 Noir Coffee frame collections from a full ZIP, a folder of ZIPs, or an extracted folder."""
from pathlib import Path
from collections import Counter
import shutil,sys,zipfile
HERE=Path(__file__).resolve().parents[1]
DEST=HERE/'public'/'animations'
SEGMENTS=['01_hero_01-02','02_hero_to_cluster_02-03','03_cluster_03-04','04_cluster_to_roast_04-05','05_roasting_05-06','06_roast_to_grind_06-07','07_grinding_07-08','08_grind_to_brew_08-09','09_brewing_09-10','10_final_cup_10-11']
if len(sys.argv)<2:
 print('Usage: python scripts/install-frames.py "C:/Users/USER/Downloads"');sys.exit(1)
src=Path(sys.argv[1]).expanduser().resolve();DEST.mkdir(parents=True,exist_ok=True)
counts=Counter()
def add(seg,filename,data=None,path=None):
 if not filename.lower().endswith('.webp') or not filename.startswith('frame_'):return
 target=DEST/seg;target.mkdir(parents=True,exist_ok=True)
 if data is not None:(target/filename).write_bytes(data)
 else:shutil.copy2(path,target/filename)
 counts[seg]+=1
def read_archive(zip_path):
 with zipfile.ZipFile(zip_path) as z:
  for info in z.infolist():
   if info.is_dir() or not info.filename.endswith('.webp'):continue
   pieces=Path(info.filename.replace('\\','/')).parts
   seg=next((p for p in pieces if p in SEGMENTS),None)
   if seg is None and ('final_cup' in pieces or zip_path.stem.lower().startswith('final_cup')):seg=SEGMENTS[-1]
   if seg is None:continue
   add(seg,pieces[-1],data=z.read(info))
if src.is_file() and src.suffix.lower()=='.zip':
 read_archive(src)
elif src.is_dir():
 # Each numbered section may be extracted or still packed in a ZIP.
 for s in SEGMENTS:
  possibilities=[src/s,src/'NOIR_COFFEE_SCROLL_FRAMES'/s]
  for folder in possibilities:
   if folder.is_dir():
    for f in sorted(folder.glob('frame_*.webp')):add(s,f.name,path=f)
    break
 for z in sorted(src.glob('*.zip')):read_archive(z)
else:
 raise SystemExit(f'Cannot find {src}')
for s in SEGMENTS:
 files=list((DEST/s).glob('frame_*.webp')) if (DEST/s).exists() else []
 print(f'{s}: {len(files)}/240 '+('OK' if len(files)==240 else 'INCOMPLETE'))
print('Finished. To run: npm install && npm run dev')
