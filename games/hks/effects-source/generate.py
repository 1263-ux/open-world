#!/usr/bin/env python3
"""Generate original, tintable effect artwork; no source images are read.
Requires Inkscape. Geometry is original vector work.
"""
from pathlib import Path
import subprocess
out = Path(__file__).resolve().parent.parent / 'public/assets/effects'
out.mkdir(parents=True, exist_ok=True)
# Names are semantic rather than the upstream third-party sprite names.
shapes = {
 'star': (34,36, '<path d="M50 4 L57 38 L87 18 L65 44 L96 50 L65 56 L87 82 L57 62 L50 96 L43 62 L13 82 L35 56 L4 50 L35 44 L13 18 L43 38 Z" fill="white"/>'),
 'ring': (42,42, '<circle cx="50" cy="50" r="37" fill="none" stroke="white" stroke-width="9" opacity=".9"/><circle cx="50" cy="50" r="26" fill="none" stroke="white" stroke-width="2" opacity=".45"/>'),
 'dust': (16,16, '<path d="M18 60 Q15 32 40 28 Q52 12 66 30 Q85 31 82 58 Q88 77 63 78 L37 80 Q18 78 18 60Z" fill="white" opacity=".9"/>'),
 'slash': (22,32, '<path d="M12 88 Q39 11 88 12 Q50 34 29 92 Q32 53 55 30 Q29 47 12 88Z" fill="white"/>'),
 'whirlwind': (100,100, '<g fill="none" stroke="white" stroke-linecap="round"><path d="M50 6 Q89 9 94 46 Q91 28 72 23 Q53 19 40 28" stroke-width="8"/><path d="M92 50 Q89 89 52 94 Q70 91 76 72 Q81 53 72 40" stroke-width="8"/><path d="M50 94 Q11 91 6 54 Q9 72 28 77 Q47 81 60 72" stroke-width="8"/><path d="M8 50 Q11 11 48 6 Q30 9 24 28 Q19 47 28 60" stroke-width="8"/><circle cx="50" cy="50" r="14" stroke-width="4" opacity=".7"/></g>'),
 'bolt': (64,64, '<path d="M54 4 L23 53 L44 48 L34 96 L77 36 L55 41 Z" fill="white"/><path d="M48 18 L36 43" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>'),
 'spark': (12,16, '<path d="M50 3 L60 38 L91 20 L67 47 L96 54 L65 60 L80 89 L54 68 L43 97 L38 65 L9 79 L31 54 L5 45 L37 41 Z" fill="white"/>'),
 'water-drop': (34,90, '<path d="M50 4 C44 25 19 52 19 69 A31 28 0 0 0 81 69 C81 52 56 25 50 4Z" fill="white" opacity=".92"/><path d="M36 55 Q26 72 37 80" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".65"/>'),
 'impact': (22,22, '<path d="M50 3 L58 29 L76 11 L70 36 L97 31 L77 49 L97 59 L70 63 L80 89 L58 72 L50 97 L42 72 L20 89 L30 63 L3 59 L23 49 L3 31 L30 36 L24 11 L42 29Z" fill="white"/>'),
 'impact-ring': (28,12, '<ellipse cx="50" cy="50" rx="44" ry="33" fill="none" stroke="white" stroke-width="11"/><ellipse cx="50" cy="50" rx="30" ry="19" fill="none" stroke="white" stroke-width="3" opacity=".5"/>'),
 'heal': (20,20, '<path d="M39 8 H61 V39 H92 V61 H61 V92 H39 V61 H8 V39 H39Z" fill="white"/><circle cx="50" cy="50" r="46" fill="none" stroke="white" stroke-width="3" opacity=".6"/>'),
 'boss-ring': (256,256, '<g fill="none" stroke="white"><circle cx="50" cy="50" r="43" stroke-width="3"/><circle cx="50" cy="50" r="36" stroke-width="1" opacity=".7"/><path d="M50 3 L54 15 M97 50 L85 54 M50 97 L46 85 M3 50 L15 46 M17 17 L26 26 M83 17 L74 26 M83 83 L74 74 M17 83 L26 74" stroke-width="3" stroke-linecap="round"/></g>'),
 'ice-shard': (16,32, '<path d="M50 4 L80 38 L63 91 L39 97 L19 49Z" fill="white" opacity=".9"/><path d="M50 4 L48 50 L63 91 M19 49 L48 50 L80 38" fill="none" stroke="#aaddff" stroke-width="3"/>'),
 'ice-orb': (38,38, '<circle cx="50" cy="50" r="38" fill="white" opacity=".8"/><g stroke="#aaddff" stroke-width="4" fill="none"><path d="M50 15 V85 M20 32 L80 68 M20 68 L80 32"/><circle cx="50" cy="50" r="28"/></g>'),
 'ice-crack': (34,90, '<path d="M51 2 L41 28 L59 39 L40 55 L53 70 L43 98 M41 28 L21 21 M59 39 L80 31 M40 55 L20 64 M53 70 L76 79" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
}
for name,(w,h,body) in shapes.items():
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 100 100" preserveAspectRatio="none">{body}</svg>'
 source=Path(__file__).resolve().parent / f'{name}.svg'
 source.write_text(svg+'\n')
 subprocess.run(['inkscape',str(source),'--export-filename',str(out/f'{name}.png')],check=True)
print(f'Generated {len(shapes)} original textures')
