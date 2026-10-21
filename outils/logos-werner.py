#!/usr/bin/env python3
"""Les logos de Werner Immobilier : sa signature (le vrai logo, octobre 2026)
et, pour les icônes, un « W » en attendant mieux.

La signature vient de outils/logo-werner-masque.png : la forme du logo
(son SVG, celui du site wernerimmobilier.com), en niveaux de gris, que ce
script colore. Écrit, aux mêmes noms et aux mêmes tailles que les logos
d'Emilio (le code n'a pas à changer) :
  · public/logo_high_resolution.png / _white.png      2625 × 1101
  · public/logos/logo-emilio-800.png / -blanc-800.png   800 × 336
  · public/logos/e-*.png, src/app/apple-icon.png, src/app/favicon.ico
  · les deux logos en base64 de src/lib/mandat-logo.ts (PDF des mandats)
  · l'icône en base64 de src/app/icon.tsx

    python3 outils/logos-werner.py
"""
import base64
import io
import pathlib
import re

from PIL import Image, ImageDraw, ImageFilter, ImageFont

NOIR = (46, 48, 52, 255)       # #2e3034, anthracite
BLANC = (255, 255, 255, 255)
ORANGE = (240, 140, 66, 255)   # #f08c42
GRAS = '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'
MOYEN = '/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf'


def police(chemin, taille):
    return ImageFont.truetype(chemin, taille)


MASQUE = pathlib.Path(__file__).with_name('logo-werner-masque.png')


def logo(largeur, hauteur, encre, marge=0.035):
    """La signature de Werner, centrée, à la couleur demandée. Le trait est
    un peu épaissi : ces logos s'affichent souvent petits (mails, PDF)."""
    m = Image.open(MASQUE).convert('L').filter(ImageFilter.MaxFilter(5))
    w = int(largeur * (1 - 2 * marge))
    h = round(w * m.height / m.width)
    if h > hauteur * (1 - 2 * marge):
        h = int(hauteur * (1 - 2 * marge))
        w = round(h * m.width / m.height)
    alpha = m.resize((w, h), Image.LANCZOS)
    trace = Image.new('RGBA', (w, h), encre)
    trace.putalpha(alpha)
    im = Image.new('RGBA', (largeur, hauteur), (0, 0, 0, 0))
    im.alpha_composite(trace, ((largeur - w) // 2, (hauteur - h) // 2))
    return im


def monogramme(taille, fond, encre, marge=0.0, coins=0.0):
    """Le « W » de Werner, un trait orange dessous."""
    im = Image.new('RGBA', (taille, taille), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if fond is not None:
        r = int(taille * coins)
        d.rounded_rectangle([0, 0, taille - 1, taille - 1], radius=r, fill=fond)
    zone = taille * (1 - 2 * marge)
    f = police(GRAS, int(zone * 0.62))
    bb = d.textbbox((0, 0), 'W', font=f)
    lw, lh = bb[2] - bb[0], bb[3] - bb[1]
    trait_h = max(1, int(zone * 0.06))
    gap = int(zone * 0.07)
    total = lh + gap + trait_h
    x = (taille - lw) / 2 - bb[0]
    y = (taille - total) / 2 - bb[1]
    d.text((x, y), 'W', font=f, fill=encre)
    tw = lw * 0.42
    yt = (taille - total) / 2 + lh + gap
    d.rectangle([(taille - tw) / 2, yt, (taille + tw) / 2, yt + trait_h], fill=ORANGE)
    return im


def b64(im, largeur=None):
    if largeur:
        h = round(im.height * largeur / im.width)
        im = im.resize((largeur, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def main():
    racine = pathlib.Path('.')
    logo(2625, 1101, NOIR).save(racine / 'public/logo_high_resolution.png', optimize=True)
    logo(2625, 1101, BLANC).save(racine / 'public/logo_high_resolution_white.png', optimize=True)
    logo(800, 336, NOIR).save(racine / 'public/logos/logo-emilio-800.png', optimize=True)
    logo(800, 336, BLANC).save(racine / 'public/logos/logo-emilio-blanc-800.png', optimize=True)

    for t, nom in ((180, 'e-180.png'), (192, 'e-192.png'), (512, 'e-512.png')):
        monogramme(t, NOIR, BLANC, marge=0.12, coins=0.22).save(racine / 'public/logos' / nom, optimize=True)
    monogramme(512, NOIR, BLANC, marge=0.22).save(racine / 'public/logos/e-maskable-512.png', optimize=True)
    monogramme(96, None, BLANC, marge=0.08).save(racine / 'public/logos/e-silhouette-96.png', optimize=True)
    monogramme(1000, NOIR, BLANC, marge=0.12).convert('RGB').save(racine / 'public/logos/e-blanc-sur-bleu-1000.png', optimize=True)
    monogramme(1000, BLANC, NOIR, marge=0.12).convert('RGB').save(racine / 'public/logos/e-bleu-sur-blanc-1000.png', optimize=True)
    monogramme(180, NOIR, BLANC, marge=0.12, coins=0.22).save(racine / 'src/app/apple-icon.png', optimize=True)
    ico = monogramme(64, NOIR, BLANC, marge=0.06, coins=0.18)
    ico.save(racine / 'src/app/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    # Les base64 : l'icône d'onglet (icon.tsx) et les logos du PDF (mandat-logo.ts)
    p = racine / 'src/app/icon.tsx'
    s = p.read_text()
    s = re.sub(r"const E = 'data:image/png;base64,[^']*'", "const E = 'data:image/png;base64," + b64(ico) + "'", s)
    p.write_text(s)
    p = racine / 'src/lib/mandat-logo.ts'
    s = p.read_text()
    s = re.sub(r"export const LOGO_MARINE = '[^']*'", "export const LOGO_MARINE = '" + b64(logo(2625, 1101, NOIR), 720) + "'", s)
    s = re.sub(r"export const LOGO_BLANC = '[^']*'", "export const LOGO_BLANC = '" + b64(logo(2625, 1101, BLANC), 720) + "'", s)
    p.write_text(s)
    print('logos de Werner écrits')


if __name__ == '__main__':
    main()
