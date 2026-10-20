#!/usr/bin/env python3
"""Passe le CRM aux couleurs de Werner Immobilier : noir et orange.

Ce que fait le script, sur tous les .ts, .tsx et .css de src/ :
  · les bleus de la marque Emilio (marine, « bleu Emilio » #34496e, bleu du
    site #22497D et leurs teintes pâles) deviennent des anthracites et des gris
    neutres, à luminosité équivalente ;
  · les dorés (#c9a84c et sa famille) et l'orange du site Emilio (#E68B23)
    deviennent l'orange de Werner (#EE7623) et ses nuances ;
  · les couleurs qui portent un sens restent : les palettes Tailwind (bleu
    « info », ambre « attention », vert, rouge, ardoise neutre…).
Les écritures rgb()/rgba() suivent la même règle. Relançable : une couleur
déjà convertie ne bouge plus.

    python3 outils/couleurs-werner.py            # convertit
    python3 outils/couleurs-werner.py --essai    # compte seulement
"""
import colorsys
import pathlib
import re
import sys

ORANGE = '#f08c42'   # orange Werner, doux (choix d'Alexandre, 20/10/2026)

# Correspondances fixes : les couleurs pivots de la marque
FIXES = {
    '#e68b23': ORANGE,      # orange du site Emilio → orange Werner
    '#a95808': '#c2621c',   # orange foncé (texte orange sur fond clair)
    '#f2b266': '#f7b07a',   # orange clair (sur fond sombre)
    '#c9a84c': ORANGE,      # doré → orange
    '#e8c96a': '#f7b07a',
    '#a07c28': '#c2621c',
    '#34496e': '#2e3034',   # « bleu Emilio » du CRM → anthracite Werner (noir grisé)
    '#3a5178': '#3b3e43',
    '#2e4166': '#26282c',
    '#22497d': '#2e3034',   # bleu du site → anthracite
    '#22497c': '#2e3034',
    '#13243d': '#232528',   # encre
    '#1a2332': '#25272b',   # ancien marine
    '#f5f8fc': '#f6f6f7',   # fond de l'espace client
}

# Palettes Tailwind (et quelques neutres) qui portent un sens : on n'y touche pas
TAILWIND = set('''
#f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a #020617
#f9fafb #f3f4f6 #e5e7eb #d1d5db #9ca3af #6b7280 #4b5563 #374151 #1f2937 #111827
#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #172554
#f0f9ff #e0f2fe #bae6fd #7dd3fc #38bdf8 #0ea5e9 #0284c7 #0369a1 #075985 #0c4a6e
#eef2ff #e0e7ff #c7d2fe #a5b4fc #818cf8 #6366f1 #4f46e5 #4338ca #3730a3 #312e81
#fffbeb #fef3c7 #fde68a #fcd34d #fbbf24 #f59e0b #d97706 #b45309 #92400e #78350f
#fefce8 #fef9c3 #fef08a #fde047 #facc15 #eab308 #ca8a04 #a16207 #854d0e #713f12
#fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12
'''.split())


def hls(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hls(r, g, b)


def hexa(hh, l, s):
    r, g, b = colorsys.hls_to_rgb(hh, max(0, min(1, l)), max(0, min(1, s)))
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


def convertir(h):
    h = h.lower()
    if h in FIXES:
        return FIXES[h]
    if h in TAILWIND:
        return h
    hh, l, s = hls(h)
    deg = hh * 360
    # Bleus de la marque → noirs et gris neutres (une pointe de chaleur)
    if 198 <= deg <= 236 and s >= 0.18:
        if l < 0.42:
            return hexa(220 / 360, 0.17 + (l - 0.10) * 0.55, 0.05)
        if l < 0.80:
            return hexa(30 / 360, l, 0.04)
        return hexa(30 / 360, l, min(s, 0.6) * 0.12)
    # Dorés → oranges Werner, même luminosité
    if 36 <= deg <= 50 and s >= 0.35:
        if l >= 0.86:
            return hexa(25 / 360, l, min(1.0, s))
        if l >= 0.62:
            return hexa(26 / 360, l, 0.88)
        if l >= 0.45:
            return hexa(24 / 360, 0.53, 0.86)
        return hexa(24 / 360, l, 0.85)
    return h


HEX = re.compile(r'#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])')
RGB = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*([,)])')


def long6(h):
    return '#' + ''.join(c * 2 for c in h[1:]) if len(h) == 4 else h


def remplace_hex(m):
    brut = m.group(0)
    h = long6(brut.lower())
    n = convertir(h)
    if n == h:
        return brut
    return n if brut[1:].islower() or not brut[1:].isalpha() else n.upper()


def remplace_rgb(m):
    r, g, b = (int(m.group(i)) for i in (1, 2, 3))
    if max(r, g, b) > 255:
        return m.group(0)
    h = '#%02x%02x%02x' % (r, g, b)
    n = convertir(h)
    if n == h:
        return m.group(0)
    nr, ng, nb = (int(n[i:i + 2], 16) for i in (1, 3, 5))
    debut = m.group(0)[:m.group(0).index('(') + 1]
    return f'{debut}{nr}, {ng}, {nb}{m.group(4)}'


def main():
    essai = '--essai' in sys.argv
    total = fichiers = 0
    for p in sorted(pathlib.Path('src').rglob('*')):
        if p.suffix not in ('.ts', '.tsx', '.css') or not p.is_file():
            continue
        avant = p.read_text()
        apres = RGB.sub(remplace_rgb, HEX.sub(remplace_hex, avant))
        if apres != avant:
            n = sum(1 for a, b in zip(HEX.findall(avant), HEX.findall(apres)) if a != b)
            total += n
            fichiers += 1
            if not essai:
                p.write_text(apres)
    print(f'{"(essai) " if essai else ""}{fichiers} fichiers, ~{total} couleurs hexadécimales converties')


if __name__ == '__main__':
    main()
