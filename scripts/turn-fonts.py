#!/usr/bin/env python3
"""Subset Turn's Chinese fonts to the characters its pages use.

Usage (from the repo root, after `npm run turn:build`):
  python3 scripts/turn-fonts.py --src <dir with the original fonts>           exact subsets for the current copy
  python3 scripts/turn-fonts.py --src <dir> --dev                              broad subsets (GB2312 level 1) while copy changes
  options: --out <dir> (default public/turn/assets/fonts), --display/--sans-400/--sans-500/--serif-500/--serif-600 <file>
           to point at one source directly. A collection is given as file.ttc#index; without #index the first face whose
           (typographic) family name ends in "SC" is used, e.g. "Noto Sans CJK SC" (index 2).
Needs fontTools and brotli: pip install fonttools brotli

Sources (all SIL OFL 1.1; the originals are not committed). Put them anywhere under --src, keeping their file names:
  SmileySans-Oblique.ttf                       github.com/atelier-anchor/smiley-sans, release v2.0.1
  NotoSansSC-Regular.otf, NotoSansSC-Medium.otf github.com/notofonts/noto-cjk, Sans release, SubsetOTF/SC
  NotoSerifSC-Medium.otf, NotoSerifSC-SemiBold.otf
                                               github.com/notofonts/noto-cjk, release Serif2.003, 14_NotoSerifSC.zip (SubsetOTF/SC)
If the Noto Sans SC files are missing, NotoSansCJK-Regular.ttc / -Medium.ttc (the "Noto Sans CJK SC" face) are used
from --src or the usual Linux font folders; they are the same design.

Output: display/ih-display.woff2 (IH Display ← Smiley Sans Oblique), sans/ih-sans-400.woff2 and -500 (IH Sans ←
Noto Sans SC), serif-sc/ih-serif-500.woff2 and -600 (IH Serif ← Noto Serif SC), an OFL.txt beside each, and
charset.json listing the characters each family covers (scripts/check.mjs compares the pages with it).
Smiley Sans reserves "Smiley" and "得意黑" and Noto Sans CJK reserves "Source", so the subsets are renamed, as the OFL
requires for modified versions; Noto Serif SC is renamed too, for consistency.

Which characters go where (exact mode), read from public/turn/index.html, public/turn/en/index.html and
public/turn/scripts/*.js (code and string literals; whole-line comments are skipped):
  IH Display  text inside h1–h3, elements with class t-hero / t-h2 / t-h3 / t-display or data-font="display", and
              elements with any class whose CSS rule uses var(--f-display)
  IH Serif    text inside elements with class t-quote / voice-them, data-font="serif", or a class whose CSS rule
              uses var(--f-them) / var(--f-serif) (which falls back to IH Serif for Chinese), plus the non-ASCII
              characters of the scripts (they stream lines of the other side)
  IH Sans     everything on both pages, in the scripts and in CSS content strings
Attribute values inside those elements count too (scripts swap data-* text in).
Each also keeps printable ASCII (Chinese text mixes Latin, digits and punctuation) and common CJK punctuation.
Layout features kept: kern liga calt locl ccmp mark mkmk palt halt chws vhal vchw vert vrt2 vpal vkrn (where the
font has them). CSS text-spacing-trim needs `halt` or `chws`; Smiley Sans has neither, so a `halt` is synthesized
from the punctuation's ink bounds (see add_halt).
"""
import argparse, json, re, sys
from html.parser import HTMLParser
from pathlib import Path
from fontTools import subset
from fontTools.otlLib import builder as otl
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont, TTCollection
from fontTools.ttLib.tables import otTables as ot

ROOT = Path(__file__).resolve().parent.parent
TURN = ROOT / 'public' / 'turn'
OUT = TURN / 'assets' / 'fonts'
ASCII = ''.join(chr(c) for c in range(0x20, 0x7f))
PUNCT = ('‘’“”—–…·•×÷±°≈≤≥→←↑↓↗↩№‰§©®™¥€£「」『』《》〈〉【】〔〕〖〗、。，；：？！（）［］｛｝｟｠·￥％＃＆＊＋－＝＠～〜'
         '　＿／＼｜＂＇＜＞﹏￣')
FEATURES = ['kern', 'liga', 'calt', 'locl', 'ccmp', 'mark', 'mkmk', 'palt', 'halt', 'chws', 'vhal', 'vchw', 'vert', 'vrt2',
            'vpal', 'vkrn']
SYSTEM_DIRS = [Path('/usr/share/fonts/opentype/noto'), Path('/usr/share/fonts/noto-cjk'), Path('/usr/share/fonts/google-noto-cjk'),
               Path('/usr/share/fonts/opentype'), Path('/usr/share/fonts'), Path.home() / '.fonts', Path.home() / 'Library/Fonts']

# family key → output file, family name, weight, subfamily, candidate source names (first found wins)
FACES = {
    'display': ('display/ih-display.woff2', 'IH Display', 400, 'Regular', ['SmileySans-Oblique.ttf', 'SmileySans-Oblique.otf']),
    'sans-400': ('sans/ih-sans-400.woff2', 'IH Sans', 400, 'Regular', ['NotoSansSC-Regular.otf', 'NotoSansCJKsc-Regular.otf', 'NotoSansCJK-Regular.ttc']),
    'sans-500': ('sans/ih-sans-500.woff2', 'IH Sans', 500, 'Medium', ['NotoSansSC-Medium.otf', 'NotoSansCJKsc-Medium.otf', 'NotoSansCJK-Medium.ttc']),
    'serif-500': ('serif-sc/ih-serif-500.woff2', 'IH Serif', 500, 'Medium', ['NotoSerifSC-Medium.otf', 'NotoSerifCJKsc-Medium.otf', 'NotoSerifCJK-Medium.ttc']),
    'serif-600': ('serif-sc/ih-serif-600.woff2', 'IH Serif', 600, 'SemiBold', ['NotoSerifSC-SemiBold.otf', 'NotoSerifCJKsc-SemiBold.otf', 'NotoSerifCJK-SemiBold.ttc']),
}
ROLE = {'display': 'display', 'sans-400': 'sans', 'sans-500': 'sans', 'serif-500': 'serif', 'serif-600': 'serif'}
RESERVED = ('Smiley', '得意黑', 'Source', 'Noto')


def css_roles(lang):
    """Classes whose rules set the display or the serif face on the page in `lang` (directly, or via --f-serif, which
    falls back to IH Serif for Chinese), and the non-ASCII characters CSS `content` strings add, per face."""
    display, serif, content = {'t-hero', 't-h2', 't-h3', 't-display'}, {'t-quote', 'voice-them'}, {'display': '', 'serif': '', 'sans': ''}
    other = 'zh' if lang == 'en' else 'en'
    for p in [TURN / 'style.css', *sorted((TURN / 'styles').glob('*.css'))]:
        css = re.sub(r'/\*[\s\S]*?\*/', '', p.read_text('utf-8'))
        for selectors, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
            text = ''.join(re.findall(r'content\s*:\s*([^;]+)', body))
            wide = ''.join(c for c in text if ord(c) > 0x7e)
            content['sans'] += wide
            for selector in selectors.split(','):
                if selector.strip().startswith(':root') or re.search(rf':lang\({other}', selector):
                    continue
                classes = set(re.findall(r'\.([A-Za-z_][\w-]*)', selector))
                if re.search(r'--f-display\b|IH Display', body):
                    display |= classes
                    content['display'] += wide
                if re.search(r'--f-(?:them|serif)\b|IH Serif', body):
                    serif |= classes
                    content['serif'] += wide
    return display, serif, content


class Roles(HTMLParser):
    """Collects the text set in each face, following the element tree (void and self-closing elements handled)."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
    ATTRS_SKIP = {'class', 'id', 'href', 'src', 'style', 'for', 'name', 'type', 'action', 'method', 'rel', 'd', 'viewBox'}

    def __init__(self, display_classes, serif_classes):
        super().__init__(convert_charrefs=True)
        self.DISPLAY_CLASSES, self.SERIF_CLASSES = display_classes, serif_classes
        self.stack, self.text = [], {'display': [], 'serif': []}

    def _roles(self, tag, attrs):
        a = dict(attrs)
        cls, font = set((a.get('class') or '').split()), (a.get('data-font') or '').split()
        roles = set(self.stack[-1][1]) if self.stack else set()
        if tag in ('h1', 'h2', 'h3') or cls & self.DISPLAY_CLASSES or 'display' in font:
            roles.add('display')
        if cls & self.SERIF_CLASSES or 'serif' in font:
            roles.add('serif')
        if tag in ('script', 'style'):
            roles = {'skip'}
        return roles, a

    def _attrs(self, roles, a):
        # Attribute values (data-*, aria-label…) inside a role: text that scripts swap into those elements.
        for r in roles & {'display', 'serif'}:
            self.text[r] += [v for k, v in a.items() if v and k not in self.ATTRS_SKIP]

    def handle_starttag(self, tag, attrs):
        roles, a = self._roles(tag, attrs)
        self._attrs(roles, a)
        if tag not in self.VOID:
            self.stack.append((tag, roles))

    def handle_startendtag(self, tag, attrs):
        roles, a = self._roles(tag, attrs)
        self._attrs(roles, a)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        roles = self.stack[-1][1] if self.stack else set()
        if 'skip' in roles:
            return
        for r in roles:
            self.text[r].append(data)


def strip_comments(src):
    """Drops whole-line // and /* */ comments (comments after code stay: they may share a line with a string).
    scripts/check.mjs strips the same way, so both read the same text."""
    return re.sub(r'^[ \t]*//.*$', '', re.sub(r'^[ \t]*/\*[\s\S]*?\*/', '', src, flags=re.M), flags=re.M)


def script_text():
    out = []
    for p in sorted((TURN / 'scripts').glob('*.js')):
        src = strip_comments(p.read_text('utf-8'))
        out.append(src)
        out += [chr(int(h, 16)) for h in re.findall(r'\\u([0-9a-fA-F]{4})', src)]
        out += [chr(int(h, 16)) for h in re.findall(r'\\u\{([0-9a-fA-F]{1,6})\}', src)]
    return ''.join(out)


def page_sets():
    pages = [(TURN / 'index.html').read_text('utf-8'), (TURN / 'en' / 'index.html').read_text('utf-8')]
    js = script_text()
    display, serif, extra = [], [], []
    for lang, html in zip(('zh', 'en'), pages):
        display_classes, serif_classes, content = css_roles(lang)
        r = Roles(display_classes, serif_classes)
        r.feed(html)
        display += r.text['display'] + [content['display']]
        serif += r.text['serif'] + [content['serif']]
        extra.append(content['sans'])
    js_wide = ''.join(c for c in js if ord(c) > 0x7e)
    base = set(ASCII) | set(PUNCT)
    return {
        'display': set(''.join(display)) | base,
        'serif': set(''.join(serif) + js_wide) | base,
        'sans': set(''.join(pages) + ''.join(extra) + js_wide) | base,
    }


def gb2312_level1():
    chars = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return chars


def open_font(spec):
    path, _, index = str(spec).partition('#')
    path = Path(path)
    if path.suffix.lower() in ('.ttc', '.otc'):
        if index:
            return TTFont(path, fontNumber=int(index)), f'{path.name}#{index}'
        for i, face in enumerate(TTCollection(path).fonts):
            fam = face['name'].getDebugName(16) or face['name'].getDebugName(1) or ''
            if fam.endswith(' SC') and 'Mono' not in fam:
                return TTFont(path, fontNumber=i), f'{path.name}#{i}'
        raise SystemExit(f'{path}: no face whose family name ends in "SC"; pass {path}#<index>')
    return TTFont(path), path.name


def find_source(key, src, override):
    if override:
        return override
    names = FACES[key][4]
    for name in names:
        for base in ([src] if src else []):
            hit = next(iter(sorted(base.rglob(name))), None)
            if hit:
                return hit
    for name in names:
        for base in SYSTEM_DIRS:
            if base.is_dir():
                hit = next(iter(sorted(base.rglob(name))), None)
                if hit:
                    return hit
    raise SystemExit(f'No source for {key}: expected one of {", ".join(names)} under --src (or pass --{key} <file>)')


def licence_for(source, dest_dir):
    """The licence beside the source (release zips ship LICENSE / OFL.txt), else the one already in the output."""
    here = Path(str(source).partition('#')[0]).resolve().parent
    for d in [here, here.parent, here.parent.parent]:
        for name in ('OFL.txt', 'LICENSE', 'LICENSE.txt'):
            f = d / name
            if f.is_file() and 'SIL Open Font License' in f.read_text('utf-8', 'ignore'):
                return f
    for d in [dest_dir, OUT / dest_dir.name]:
        if (d / 'OFL.txt').is_file():
            return d / 'OFL.txt'
    raise SystemExit(f'No OFL licence found for {source}')


def rename(font, family, sub, weight):
    ps = family.replace(' ', '') + '-' + sub
    full = f'{family} {sub}' if sub != 'Regular' else family
    ribbi = sub in ('Regular', 'Bold', 'Italic', 'Bold Italic')
    version = (re.search(r'\d+\.\d+', font['name'].getDebugName(5) or '') or [''])[0]
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (3, 16, 17, 18, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)
    for nid, value in {1: family if ribbi else f'{family} {sub}', 2: sub if ribbi else 'Regular', 3: f'{version};IH;{ps}',
                       4: full, 6: ps}.items():
        name.removeNames(nameID=nid)
        name.setName(value, nid, 3, 1, 0x409)
    if not ribbi:
        name.setName(family, 16, 3, 1, 0x409)
        name.setName(sub, 17, 3, 1, 0x409)
    if 'CFF ' in font:
        cff = font['CFF '].cff
        old = cff.fontNames[0]
        cff.fontNames = [ps]
        top = cff.topDictIndex[0]
        top.FullName, top.FamilyName = full, family
        for fd in getattr(top, 'FDArray', None) or []:
            if getattr(fd, 'FontName', None):
                fd.FontName = fd.FontName.replace(old, ps)
    font['OS/2'].usWeightClass = weight
    left = [str(r) for r in name.names if r.nameID not in (0, 7, 8, 9, 10, 11, 12, 13, 14) and any(w in str(r) for w in RESERVED)]
    if left:
        raise SystemExit(f'{family}: reserved name left in name table: {left}')


HALT_CHARS = '，。、；：！？）」』》】〕〗〉｝］（「『《【〔〖〈｛［'


def add_halt(font):
    """Give a font without `halt` (Smiley Sans has none) a synthesized one: full-width punctuation whose ink sits in
    one half of the em is set half-width. CSS text-spacing-trim only works with fonts that carry `halt` or `chws`."""
    if 'GPOS' not in font:
        return 0
    gpos = font['GPOS'].table
    if any(fr.FeatureTag in ('halt', 'chws') for fr in gpos.FeatureList.FeatureRecord):
        return 0
    cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font['hmtx']
    em = font['head'].unitsPerEm
    values = {}
    for ch in HALT_CHARS:
        g = cmap.get(ord(ch))
        if not g or hmtx[g][0] < em * .7:
            continue
        pen = BoundsPen(gs)
        gs[g].draw(pen)
        if not pen.bounds:
            continue
        adv = hmtx[g][0]
        half, tol = round(adv / 2), adv * .03
        if pen.bounds[2] <= half + tol:  # ink on the left: closing punctuation (and SC colon, semicolon, !)
            values[g] = otl.buildValue({'XAdvance': -half})
        elif pen.bounds[0] >= half - tol:  # ink on the right: opening punctuation
            values[g] = otl.buildValue({'XPlacement': -half, 'XAdvance': -half})
    if not values:
        return 0
    lookups = gpos.LookupList.Lookup
    lookups.append(otl.buildLookup([otl.buildSinglePosSubtable(values, font.getReverseGlyphMap())]))
    gpos.LookupList.LookupCount = len(lookups)
    feature = ot.Feature()
    feature.FeatureParams, feature.LookupListIndex, feature.LookupCount = None, [len(lookups) - 1], 1
    record = ot.FeatureRecord()
    record.FeatureTag, record.Feature = 'halt', feature
    records = gpos.FeatureList.FeatureRecord + [record]
    order = sorted(range(len(records)), key=lambda i: records[i].FeatureTag)  # FeatureList stays sorted by tag
    remap = {old: new for new, old in enumerate(order)}
    gpos.FeatureList.FeatureRecord, gpos.FeatureList.FeatureCount = [records[i] for i in order], len(records)
    for sr in gpos.ScriptList.ScriptRecord:
        for ls in [sr.Script.DefaultLangSys, *[r.LangSys for r in sr.Script.LangSysRecord]]:
            if ls is None:
                continue
            ls.FeatureIndex = sorted([remap[i] for i in ls.FeatureIndex] + [remap[len(records) - 1]])
            ls.FeatureCount = len(ls.FeatureIndex)
            if ls.ReqFeatureIndex != 0xFFFF:
                ls.ReqFeatureIndex = remap[ls.ReqFeatureIndex]
    return len(values)


def build(spec, dest, chars, family, sub, weight):
    font, label = open_font(spec)
    copyright_ = font['name'].getDebugName(0) or ''
    cmap = font.getBestCmap()
    have = ''.join(sorted(c for c in chars if ord(c) in cmap))
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = FEATURES
    opts.name_IDs = ['*']
    opts.name_languages = [0x409]  # drops the Chinese names, which carry the reserved 得意黑
    opts.notdef_outline = True
    sub_ = subset.Subsetter(opts)
    sub_.populate(text=have)
    sub_.subset(font)
    rename(font, family, sub, weight)
    add_halt(font)
    dest.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(dest)
    return have, label, dest.stat().st_size, copyright_


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--src', type=Path, help='directory containing the original fonts (searched recursively)')
    ap.add_argument('--out', type=Path, default=OUT)
    ap.add_argument('--dev', action='store_true', help='broad subset: GB2312 level 1 + ASCII + punctuation (plus the page)')
    for key in FACES:
        ap.add_argument(f'--{key}', help=f'source file for {key} (file.ttc#index for a collection)')
    args = ap.parse_args()
    try:
        import brotli  # noqa: F401  (fontTools needs it for woff2)
    except ImportError:
        sys.exit('brotli is missing: pip install fonttools brotli')
    wanted = page_sets()
    if args.dev:
        broad = gb2312_level1()
        wanted = {k: v | broad for k, v in wanted.items()}
    charset, report = {}, []
    for key, (rel, family, weight, sub, _) in FACES.items():
        src = find_source(key, args.src, getattr(args, key.replace('-', '_')))
        dest = args.out / rel
        have, label, size, copyright_ = build(src, dest, wanted[ROLE[key]], family, sub, weight)
        missing = sorted(c for c in wanted[ROLE[key]] - set(PUNCT) if c not in have and ord(c) > 0x7e and not c.isspace())
        lic = licence_for(src, dest.parent)
        text = lic.read_text('utf-8')
        if 'Copyright' not in text[:400] and '©' not in text[:400] and copyright_:
            text = f'{copyright_}\n\n{text}'  # some release zips ship the bare licence; keep the notice with it
        (dest.parent / 'OFL.txt').write_text(text, 'utf-8')
        role = ROLE[key]
        charset[role] = ''.join(sorted(set(have) & set(charset[role]))) if role in charset else have
        report.append(f'{rel}: {size / 1024:.0f} KB, {len(have)} chars from {label}' + (f'; not in source: {"".join(missing)}' if missing else ''))
    out = {'mode': 'dev' if args.dev else 'exact', **{k: charset[k] for k in ('display', 'sans', 'serif')}}
    (args.out / 'charset.json').write_text(json.dumps(out, ensure_ascii=False, indent=0) + '\n', 'utf-8')
    print('\n'.join(report))
    print(f'charset.json written ({out["mode"]}) to {args.out}')


if __name__ == '__main__':
    main()
