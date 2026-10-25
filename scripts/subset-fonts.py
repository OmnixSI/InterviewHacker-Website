#!/usr/bin/env python3
"""Subset Final's fonts to the characters its pages actually use.

Usage: python3 scripts/subset-fonts.py --src <dir with the original font files>
Needs fontTools and brotli (pip install fonttools brotli). Run after `npm run final:build`.

The originals are not committed (Noto Sans SC alone is 17 MB). Fetch them from their OFL sources:
  SmileySans-Oblique.ttf       github.com/atelier-anchor/smiley-sans  (release v2.0.1)
  NotoSansSC[wght].ttf         github.com/google/fonts  ofl/notosanssc
  NotoSerifSC[wght].ttf        github.com/google/fonts  ofl/notoserifsc
  InstrumentSerif-Regular.ttf, InstrumentSerif-Italic.ttf  github.com/google/fonts  ofl/instrumentserif

Smiley Sans reserves the names "Smiley" and "得意黑", and Noto Sans SC / Noto Serif SC reserve "Source",
so the subsets are renamed IH Display, IH Sans and IH Serif as the SIL OFL requires for modified versions.
"""
import argparse, json, re
from html.parser import HTMLParser
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FINAL = ROOT / 'public' / 'final'
OUT = FINAL / 'assets' / 'fonts'
ASCII = ''.join(chr(c) for c in range(0x20, 0x7f))
PUNCT = '‘’“”—–…·×→←↗↩⌘⇧\\¶§©®™°±·「」『』《》〈〉【】、。，；：？！（）·￥％⌃⌥'


def page_text():
    texts = [(FINAL / 'index.html').read_text('utf-8'), (FINAL / 'en' / 'index.html').read_text('utf-8')]
    texts += [p.read_text('utf-8') for p in (FINAL / 'scripts').glob('*.js')]
    texts.append((ROOT / 'scripts' / 'final-i18n' / 'demo.json').read_text('utf-8'))
    return texts


class SerifText(HTMLParser):
    """Collects text set in the serif faces: headings and the window's document-style titles."""
    TAGS = {'h1', 'h2', 'h3', 'h4', 'h5'}
    CLASSES = {'a-section', 'a-n', 'sh-n', 'leaf__title', 'paper__title', 'install__n'}

    def __init__(self):
        super().__init__()
        self.stack, self.out = [], []

    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'input', 'img', 'use', 'path', 'i', 'meta', 'link'):
            if tag == 'input':
                self.out.append(dict(attrs).get('value') or '')
            return
        cls = set((dict(attrs).get('class') or '').split())
        serif = tag in self.TAGS or bool(cls & self.CLASSES) or (self.stack and self.stack[-1][0] == 'tpl-tabs' and tag == 'b')
        marker = 'tpl-tabs' if 'tpl-tabs' in cls else ('serif' if serif else '')
        self.stack.append((marker, tag))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][1] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if any(m == 'serif' for m, _ in self.stack):
            self.out.append(data)


class DisplayText(HTMLParser):
    """Collects text set in the display faces: h1/h2, FAQ questions and anything with the "d" class."""
    TAGS = {'h1', 'h2', 'summary'}
    CLASSES = {'d', 'display', 'audio__src', 'cmac__call', 'tpl-tabs'}

    def __init__(self):
        super().__init__()
        self.stack, self.out = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ('data-draft', 'data-draft-word'):
            if a.get(key):
                self.out.append(a[key])
        if tag in ('br', 'input', 'img', 'use', 'path', 'meta', 'link'):
            if tag == 'input' and 'd' in (a.get('class') or '').split():
                self.out.append(a.get('value') or '')
            return
        cls = set((a.get('class') or '').split())
        self.stack.append((tag in self.TAGS or bool(cls & self.CLASSES), tag))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][1] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if any(on for on, _ in self.stack):
            self.out.append(data)


def display_text(html):
    parser = DisplayText()
    parser.feed(re.sub(r'<script\b[\s\S]*?</script>', '', html))
    return ''.join(parser.out)


def serif_text(html):
    parser = SerifText()
    parser.feed(re.sub(r'<script\b[\s\S]*?</script>', '', html))
    return ''.join(parser.out)


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
    zh, en = texts[0], texts[1]
    every = set(''.join(texts)) | set(ASCII) | set(PUNCT)
    every = ''.join(sorted(c for c in every if c >= ' '))
    demo = json.loads((ROOT / 'scripts' / 'final-i18n' / 'demo.json').read_text('utf-8'))
    examples = ''.join(t for lang in demo.values() for t in lang['guess']['examples'])
    serif = ''.join(sorted(c for c in set(serif_text(zh) + serif_text(en) + examples) | set(ASCII) | set(PUNCT) if c >= ' '))
    lives = ''.join(t['live'] for lang in demo.values() for t in lang['types'])
    display = ''.join(sorted(c for c in set(display_text(zh) + display_text(en) + examples + lives) | set(ASCII) | set(PUNCT) if c >= ' '))
    sizes = {
        'display/ih-display.woff2': build(args.src / 'SmileySans-Oblique.ttf', OUT / 'display/ih-display.woff2', display, 'IH Display'),
        'serif/ih-serif.woff2': build(args.src / 'NotoSerifSC[wght].ttf', OUT / 'serif/ih-serif.woff2', serif, 'IH Serif', (500, 600)),
        'sans/ih-sans.woff2': build(args.src / 'NotoSansSC[wght].ttf', OUT / 'sans/ih-sans.woff2', every, 'IH Sans', (400, 500)),
        'serif/instrument-serif.woff2': build(args.src / 'InstrumentSerif-Regular.ttf', OUT / 'serif/instrument-serif.woff2', ASCII + PUNCT + 'éèàçïô№'),
        'serif/instrument-serif-italic.woff2': build(args.src / 'InstrumentSerif-Italic.ttf', OUT / 'serif/instrument-serif-italic.woff2', ASCII + PUNCT + 'éèàçïô№'),
    }
    (OUT / 'charset.json').write_text(json.dumps({'display': display, 'serif': serif, 'sans': every}, ensure_ascii=False, indent=0) + '\n', 'utf-8')
    for k, v in sizes.items():
        print(f'{k}: {v / 1024:.0f} KB')


if __name__ == '__main__':
    main()
