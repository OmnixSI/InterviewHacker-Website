#!/usr/bin/env python3
"""Subset Final's fonts to the characters its pages actually use.

Usage: python3 scripts/subset-fonts.py --src <dir with the original font files>
Needs fontTools and brotli (pip install fonttools brotli). Run after `npm run final:build`.

The originals are not committed (Noto Sans SC alone is 17 MB). Fetch them from their OFL sources:
  SmileySans-Oblique.ttf       github.com/atelier-anchor/smiley-sans  (release v2.0.1)
  NotoSansSC[wght].ttf         github.com/google/fonts  ofl/notosanssc
  InstrumentSerif-Regular.ttf, InstrumentSerif-Italic.ttf  github.com/google/fonts  ofl/instrumentserif

Smiley Sans reserves the names "Smiley" and "得意黑", and Noto Sans SC reserves "Source", so the
subsets are renamed IH Display and IH Sans as the SIL OFL requires for modified versions.
"""
import argparse, json, re
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FINAL = ROOT / 'public' / 'final'
OUT = FINAL / 'assets' / 'fonts'
ASCII = ''.join(chr(c) for c in range(0x20, 0x7f))
PUNCT = '‘’“”—–…·×→←↗↩⌘⇧\\¶§©®™°±·「」『』《》〈〉【】、。，；：？！（）·￥％'


def page_text():
    texts = [(FINAL / 'index.html').read_text('utf-8'), (FINAL / 'en' / 'index.html').read_text('utf-8')]
    texts += [p.read_text('utf-8') for p in (FINAL / 'scripts').glob('*.js')]
    texts.append((ROOT / 'scripts' / 'final-i18n' / 'demo.json').read_text('utf-8'))
    return texts


def display_text(html):
    """Text set in the display face: headings, the wordmark and a few display-styled labels."""
    picks = re.findall(r'<(h[1-3])\b[^>]*>([\s\S]*?)</\1>', html)
    chunks = [body for _, body in picks]
    chunks += re.findall(r'class="(?:wordmark|slide__title|download__title)"[^>]*>([\s\S]*?)</', html)
    chunks += re.findall(r'data-draft="([^"]*)"', html)
    chunks += re.findall(r'class="call__tile[^"]*"><b>([^<]*)<', html)
    chunks += re.findall(r'class="cmac__call"><span><b>([^<]*)<', html)
    chunks += re.findall(r'<p data-line[^>]*>([\s\S]*?)</p>', html)
    chunks += re.findall(r'class="mini-slide__page"><span[^>]*>[^<]*</span><b>([^<]*)<', html)
    # Walkthrough step titles are set by script from the demo data.
    demo = json.loads((ROOT / 'scripts' / 'final-i18n' / 'demo.json').read_text('utf-8'))
    chunks += [step['title'] for lang in demo.values() for step in lang['ui'].get('guide', [])]
    return re.sub(r'<[^>]+>', '', ''.join(chunks))


def rename(font, family):
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID == 4:
            rec.string = f'{family} Regular'
        elif rec.nameID == 6:
            rec.string = family.replace(' ', '') + '-Regular'
        elif rec.nameID in (3, 17, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)


def build(src, dest, chars, family=None, wght=None):
    font = TTFont(src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'locl', 'ccmp', 'mark', 'mkmk', 'palt', 'vert']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    # Limit the weight axis after subsetting (instancing first trips over the full glyph set).
    if wght and 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    if family:
        rename(font, family)
    dest.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(dest)
    return dest.stat().st_size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, type=Path)
    args = ap.parse_args()
    texts = page_text()
    zh = texts[0]
    every = set(''.join(texts)) | set(ASCII) | set(PUNCT)
    every = ''.join(sorted(c for c in every if c >= ' '))
    display = ''.join(sorted(set(display_text(zh)) | set(display_text(texts[1])) | set(ASCII) | set(PUNCT) | set('InterviewHacker')))
    sizes = {
        'display/ih-display.woff2': build(args.src / 'SmileySans-Oblique.ttf', OUT / 'display/ih-display.woff2', display, 'IH Display'),
        'sans/ih-sans.woff2': build(args.src / 'NotoSansSC[wght].ttf', OUT / 'sans/ih-sans.woff2', every, 'IH Sans', (400, 500)),
        'serif/instrument-serif.woff2': build(args.src / 'InstrumentSerif-Regular.ttf', OUT / 'serif/instrument-serif.woff2', ASCII + PUNCT + 'éèàçïô№'),
        'serif/instrument-serif-italic.woff2': build(args.src / 'InstrumentSerif-Italic.ttf', OUT / 'serif/instrument-serif-italic.woff2', ASCII + PUNCT + 'éèàçïô№'),
    }
    (OUT / 'charset.json').write_text(json.dumps({'display': display, 'sans': every}, ensure_ascii=False, indent=0) + '\n', 'utf-8')
    for k, v in sizes.items():
        print(f'{k}: {v / 1024:.0f} KB')


if __name__ == '__main__':
    main()
