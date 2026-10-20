#!/usr/bin/env python3
"""Logos PROVISOIRES de Werner Immobilier (en attendant son vrai logo).

Écrit, aux mêmes noms et aux mêmes tailles que les logos d'Emilio (le code
n'a pas à changer) :
  · public/logo_high_resolution.png / _white.png      2625 × 1101
  · public/logos/logo-emilio-800.png / -blanc-800.png   800 × 336
  · public/logos/e-*.png, src/app/apple-icon.png, src/app/favicon.ico
  · les deux logos en base64 de src/lib/mandat-logo.ts (PDF des mandats)
  · l'icône en base64 de src/app/icon.tsx

Pour mettre le vrai logo de Werner : remplacer ce script par ses fichiers,
aux mêmes noms et tailles, puis régénérer les base64 (voir la fin du script).

    python3 outils/logos-werner.py
"""
import base64
import io
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

NOIR = (46, 48, 52, 255)       # #2e3034, anthracite
BLANC = (255, 255, 255, 255)
ORANGE = (240, 140, 66, 255)   # #f08c42
GRAS = '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'
MOYEN = '/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf'


def police(chemin, taille):
    return ImageFont.truetype(chemin, taille)


def texte_espace(draw, xy, texte, fnt, fill, espacement):
    """Écrit un texte lettre par lettre avec un espacement (tracking)."""
    x, y = xy
    for c in texte:
        draw.text((x, y), c, font=fnt, fill=fill)
        x += draw.textlength(c, font=fnt) + espacement
    return x


def largeur_espace(draw, texte, fnt, espacement):
    return sum(draw.textlength(c, font=fnt) for c in texte) + espacement * (len(texte) - 1)


def logo(largeur, hauteur, encre):
    """« WERNER » en grand, un trait orange, « IMMOBILIER » espacé dessous."""
    im = Image.new('RGBA', (largeur, hauteur), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    h1 = int(hauteur * 0.40)
    f1 = police(GRAS, h1)
    esp1 = int(h1 * 0.06)
    w1 = largeur_espace(d, 'WERNER', f1, esp1)
    # si trop large, on réduit
    while w1 > largeur * 0.9:
        h1 = int(h1 * 0.95)
        f1 = police(GRAS, h1)
        esp1 = int(h1 * 0.06)
        w1 = largeur_espace(d, 'WERNER', f1, esp1)
    h2 = int(hauteur * 0.105)
    f2 = police(MOYEN, h2)
    esp2 = int(h2 * 0.55)
    w2 = largeur_espace(d, 'IMMOBILIER', f2, esp2)
    trait_h = max(2, int(hauteur * 0.022))
    trait_w = int(w1 * 0.16)
    # mise en page verticale, centrée
    bbox1 = d.textbbox((0, 0), 'W', font=f1)
    haut1 = bbox1[3] - bbox1[1]
    bbox2 = d.textbbox((0, 0), 'I', font=f2)
    haut2 = bbox2[3] - bbox2[1]
    gap1, gap2 = int(hauteur * 0.07), int(hauteur * 0.07)
    total = haut1 + gap1 + trait_h + gap2 + haut2
    y0 = (hauteur - total) // 2
    x1 = (largeur - w1) / 2
    texte_espace(d, (x1, y0 - bbox1[1]), 'WERNER', f1, encre, esp1)
    yt = y0 + haut1 + gap1
    d.rectangle([(largeur - trait_w) / 2, yt, (largeur + trait_w) / 2, yt + trait_h], fill=ORANGE)
    y2 = yt + trait_h + gap2
    texte_espace(d, ((largeur - w2) / 2, y2 - bbox2[1]), 'IMMOBILIER', f2, encre, esp2)
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
    print('logos provisoires de Werner écrits')


if __name__ == '__main__':
    main()
