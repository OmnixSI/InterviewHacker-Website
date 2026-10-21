from pathlib import Path
import math
p=Path(__file__).resolve().parent/'og.svg'
parts=['''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="glow"><stop stop-color="#7552ab" stop-opacity=".4"/><stop offset="1" stop-color="#07090b" stop-opacity="0"/></radialGradient><linearGradient id="title"><stop stop-color="#e0ffb9"/><stop offset=".6" stop-color="#c5ff65"/><stop offset="1" stop-color="#a193ff"/></linearGradient></defs><rect width="1200" height="630" fill="#07090b"/><ellipse cx="902" cy="300" rx="380" ry="330" fill="url(#glow)"/><g fill="#c5ff65"><rect x="58" y="47" width="5" height="15"/><rect x="67" y="40" width="5" height="29"/><rect x="76" y="44" width="5" height="21"/><rect x="85" y="51" width="5" height="9"/></g><text x="104" y="61" fill="#eff3ec" font-family="Arial,sans-serif" font-size="25">InterviewHacker</text><text x="58" y="152" fill="#839777" font-family="monospace" font-size="11" letter-spacing="2.5">THE REALTIME CONVERSATION ENGINE</text><text x="55" y="268" fill="#edf1ed" font-family="PingFang SC,sans-serif" font-size="77" font-weight="600">让思路，</text><text x="55" y="371" fill="url(#title)" font-family="PingFang SC,sans-serif" font-size="77" font-weight="600">领先下一句。</text><text x="60" y="449" fill="#91a586" font-family="PingFang SC,sans-serif" font-size="19">双路感知 · 上下文编排 · 实时提词</text><text x="58" y="568" fill="#6d825f" font-family="monospace" font-size="10" letter-spacing="2">NATIVE macOS / APPLE SILICON / v1.8.0</text>''']
for v in range(28):
 for u in range(100):
  a=u/100*math.tau;b=v/28*math.tau;r=1.42+.37*math.cos(b)
  x=math.cos(a)*r;y=math.sin(b)*.37;z=math.sin(a)*r
  x,z=x*math.cos(.65)-z*math.sin(.65),x*math.sin(.65)+z*math.cos(.65)
  y,z=y*math.cos(-.55)-z*math.sin(-.55),y*math.sin(-.55)+z*math.cos(-.55)
  x,y=x*math.cos(-.28)-y*math.sin(-.28),x*math.sin(-.28)+y*math.cos(-.28)
  sc=190/(1+z*.12);px=920+x*sc;py=303+y*sc
  parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{1.1+(z+2)*.13:.1f}" fill="'+('#a193ff' if (u+v)%4==0 else '#c5ff65')+f'" opacity="{.33+(z+2)*.1:.2f}"/>')
parts.append('''<g transform="translate(875 254) rotate(-12 46 46)"><rect x="-7" y="-7" width="105" height="105" rx="15" fill="none" stroke="#a193ff" stroke-opacity=".25"/><rect width="92" height="92" rx="12" fill="#211d2e" stroke="#a193ff" stroke-opacity=".7"/><text x="31" y="42" font-family="Arial" font-size="28" fill="#e1ffbd">IH</text><text x="21" y="65" font-family="monospace" font-size="7" fill="#a49bc0" letter-spacing="1">CONTEXT</text><text x="24" y="76" font-family="monospace" font-size="7" fill="#a49bc0" letter-spacing="1">ENGINE</text></g><path d="M0 610H1200" stroke="#c5ff65" stroke-width="20"/></svg>''')
p.write_text(''.join(parts))
