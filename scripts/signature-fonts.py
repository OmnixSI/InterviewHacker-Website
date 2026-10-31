#!/usr/bin/env python3
"""Create Signature's self-hosted Chinese font subsets from its current source copy.

Usage, after all page and script copy is complete:
    python3 scripts/signature-fonts.py --src /path/to/original-fonts

Requires fonttools and brotli. The source directory must contain these unmodified,
SIL OFL 1.1 fonts from the official notofonts/noto-cjk repository:
  https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf
  https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf

The originals are intentionally not committed. Run this after editing Signature's
templates, demo data, CSS or JavaScript, then rebuild the localized pages. Both
faces receive the same requested character set, including characters in dynamic
copy. charset.json records actual output cmap coverage, not merely requested text.

Modified families are named IH Signature Sans / IH Signature Serif. Original
copyright and license records remain intact; the accompanying OFL files in the
assets directory must be retained when distributing the subsets.
"""

import argparse
import html
import json
import re
import unicodedata
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / 'scripts' / 'signature-i18n'
SITE = ROOT / 'public' / 'signature'
OUT = SITE / 'assets' / 'fonts'
FACES = {
    'sans': ('NotoSansSC-Regular.otf', 'ih-signature-sans.woff2', 'IH Signature Sans'),
    'serif': ('NotoSerifSC-Regular.otf', 'ih-signature-serif.woff2', 'IH Signature Serif'),
}
FEATURES = [
    'kern', 'liga', 'calt', 'locl', 'ccmp', 'mark', 'mkmk', 'palt', 'halt',
    'chws', 'vhal', 'vchw', 'vert', 'vrt2', 'vpal', 'vkrn',
]
# Printable ASCII, the entire CJK Symbols and Punctuation block, and fullwidth
# punctuation / Latin forms. Unencoded characters are left to the CSS fallbacks.
BASE = set(range(0x20, 0x7F)) | set(range(0x3000, 0x3040)) | set(range(0xFF01, 0xFF66))
BASE |= {ord(c) for c in '‘’“”—–…·•×÷±°≈≤≥→←↑↓↗↩№‰§©®™¥€£⌘⇧'}


def source_files():
    files = set(TEMPLATES.rglob('*.html'))
    demo = TEMPLATES / 'demo.json'
    if demo.exists():
        files.add(demo)
    files.update((SITE / 'scripts').glob('*.js'))
    css = SITE / 'style.css'
    if css.exists():
        files.add(css)
    if not any(p.suffix == '.html' for p in files):
        raise SystemExit('No Signature HTML templates found; finish the page copy before subsetting.')
    return sorted(files)


def collect_characters(files):
    """Read source, never execute it. Include templates, attributes and JS strings."""
    chars = set(BASE)
    for path in files:
        text = html.unescape(path.read_text(encoding='utf-8'))
        # Escaped Unicode literals can appear in JS, JSON, and CSS content values.
        literals = re.findall(r'\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})', text)
        for brace, short in literals:
            point = int(brace or short, 16)
            if point <= 0x10FFFF and not 0xD800 <= point <= 0xDFFF:
                chars.add(point)
        if path.suffix == '.css':
            for literal in re.findall(r'\\([0-9a-fA-F]{1,6})(?:\s|(?=[^0-9a-fA-F])|$)', text):
                point = int(literal, 16)
                if point <= 0x10FFFF and not 0xD800 <= point <= 0xDFFF:
                    chars.add(point)
        chars.update(ord(c) for c in text if c.isprintable() or c == '\u3000')
    return chars


def is_han(point):
    return unicodedata.name(chr(point), '').startswith(('CJK UNIFIED IDEOGRAPH', 'CJK COMPATIBILITY IDEOGRAPH'))


def rename(font, family):
    """Replace modified font identifiers while preserving attribution and licensing."""
    ps = family.replace(' ', '') + '-Regular'
    replacements = {
        1: family, 2: 'Regular', 3: f'{ps};SignatureSubset', 4: f'{family} Regular',
        6: ps, 16: family, 17: 'Regular', 18: f'{family} Regular',
        21: family, 22: 'Regular',
    }
    names = font['name']
    for record in list(names.names):
        if record.nameID in replacements:
            names.setName(replacements[record.nameID], record.nameID, record.platformID,
                          record.platEncID, record.langID)
        elif record.nameID == 25:
            names.removeNames(nameID=25)
    # Ensure modern Unicode readers see the renamed family even if the source
    # omitted a typographic name record.
    for name_id, value in replacements.items():
        names.setName(value, name_id, 3, 1, 0x409)
    if 'CFF ' in font:
        cff = font['CFF '].cff
        cff.fontNames = [ps for _ in cff.fontNames]
        for top in cff.topDictIndex:
            top.FamilyName = family
            top.FullName = f'{family} Regular'


def make_subset(path, family, characters):
    font = TTFont(path, recalcTimestamp=False)
    available = set(font.getBestCmap() or {})
    missing_han = sorted(point for point in characters - available if is_han(point))
    if missing_han:
        font.close()
        detail = ''.join(chr(point) for point in missing_han)
        raise SystemExit(f'{path.name} does not contain required Chinese characters: {detail}')
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = FEATURES
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_outline = True
    options.recalc_timestamp = False
    sub = subset.Subsetter(options)
    sub.populate(unicodes=characters & available)
    sub.subset(font)
    rename(font, family)
    font.flavor = 'woff2'
    return font


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--src', required=True, type=Path, help='Directory containing both original .otf files')
    args = parser.parse_args()
    missing = [filename for filename, _, _ in FACES.values() if not (args.src / filename).is_file()]
    if missing:
        parser.error('Missing original font files: ' + ', '.join(missing))

    files = source_files()
    characters = collect_characters(files)
    prepared = {}
    try:
        # Validate both inputs before replacing any distributable font.
        for role, (original, _, family) in FACES.items():
            prepared[role] = make_subset(args.src / original, family, characters)
        OUT.mkdir(parents=True, exist_ok=True)
        coverage = {}
        for role, font in prepared.items():
            target = OUT / FACES[role][1]
            font.save(target)
            coverage[role] = ''.join(chr(point) for point in sorted(font.getBestCmap() or {}))
            print(f'{target.relative_to(ROOT)}: {target.stat().st_size / 1024:.1f} KB, {len(coverage[role])} characters')
        (OUT / 'charset.json').write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Read {len(files)} source files; requested {len(characters)} characters for both faces.')
    finally:
        for font in prepared.values():
            font.close()


if __name__ == '__main__':
    main()
