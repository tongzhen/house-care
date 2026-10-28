"""Re-export the existing HouseCare raster artwork. Requires Pillow and NumPy.

Run from this folder: python3 generate.py
No AI generation or new logo geometry is used.
"""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'source' / 'original-icon.png'
if not SRC.exists():
    SRC.parent.mkdir(exist_ok=True)
    shutil.copyfile(ROOT.parents[1] / 'assets/icon.png', SRC)
original = Image.open(SRC).convert('RGB')
a = np.asarray(original, dtype=float)
bg = np.median(a[300:700, 130:220], axis=(0, 1))
# Unmix the white house and teal check from the sampled green background.
# A bounded interior excludes the baked white border and rounded tile corners.
white = np.median(a[500:700, 275:295], axis=(0, 1))
teal = np.median(a[535:560, 700:720], axis=(0, 1))
basis = np.stack([white-bg, teal-bg], axis=1)
weights = np.maximum((a-bg) @ np.linalg.pinv(basis).T, 0)
alpha = np.clip(weights.sum(axis=2), 0, 1)
inside = np.zeros(alpha.shape, dtype=bool)
inside[210:810, 240:800] = True
alpha[~inside] = 0
alpha[alpha < .04] = 0
alpha[alpha > .97] = 1
rgb = np.clip((a-bg*(1-alpha[..., None])) / np.maximum(alpha[..., None], .0001), 0, 255)
fg = Image.fromarray(np.dstack([rgb, alpha*255]).round().astype('uint8'), 'RGBA')
box = fg.getbbox()
glyph = fg.crop(box)
BG = tuple(bg.round().astype(int))
ICC = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()

def save(im, path):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, icc_profile=ICC, optimize=True)

def jsonfile(path, obj):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=2)+'\n')

def layer(n, size, mono=False):
    g = glyph.resize((round(glyph.width*size/glyph.height), size), Image.Resampling.LANCZOS)
    if mono:
        g = Image.new('RGBA', g.size, 'white').copy().convert('RGBA')
        g.putalpha(glyph.getchannel('A').resize(g.size, Image.Resampling.LANCZOS))
    canvas = Image.new('RGBA', (n,n))
    canvas.alpha_composite(g, ((n-g.width)//2, (n-g.height)//2))
    return canvas

# Full-bleed square master, keeping the source artwork's original scale/position.
master = Image.new('RGB', original.size, BG)
master.paste(fg, mask=fg.getchannel('A'))
save(master, 'masters/icon-1024.png')
save(fg, 'masters/extracted-foreground-1024.png')
save(master, 'expo/icon.png')

slots = []
for idiom, sizes in [('iphone', [(20,[2,3]),(29,[2,3]),(40,[2,3]),(60,[2,3])]),
                     ('ipad', [(20,[1,2]),(29,[1,2]),(40,[1,2]),(76,[1,2]),(83.5,[2])]),
                     ('ios-marketing', [(1024,[1])])]:
    for size, scales in sizes:
        for scale in scales:
            n = round(size*scale)
            name = f'Icon-{idiom}-{size}@{scale}x.png'
            save(master.resize((n,n), Image.Resampling.LANCZOS), f'ios/AppIcon.appiconset/{name}')
            slots.append(dict(filename=name, idiom=idiom, size=f'{size}x{size}', scale=f'{scale}x'))
jsonfile('ios/AppIcon.appiconset/Contents.json', dict(images=slots, info=dict(author='xcode',version=1)))
save(master, 'ios-single-size/AppIcon.appiconset/Icon-1024.png')
jsonfile('ios-single-size/AppIcon.appiconset/Contents.json', dict(images=[dict(filename='Icon-1024.png',idiom='universal',platform='ios',size='1024x1024')],info=dict(author='xcode',version=1)))

# Fit every nontransparent pixel into a 64dp diameter circle, within Android's
# central 66dp safe circle. The 108dp canvas includes parallax overscan.
ys, xs = np.where(np.asarray(glyph.getchannel('A')) > 0)
radius = np.sqrt((xs-glyph.width/2)**2+(ys-glyph.height/2)**2).max()
height_dp = glyph.height * 32 / radius
adaptive = layer(1080, round(height_dp*10))
mono = layer(1080, round(height_dp*10), True)
save(adaptive.resize((1024,1024),Image.Resampling.LANCZOS), 'expo/adaptive-foreground.png')
save(mono.resize((1024,1024),Image.Resampling.LANCZOS), 'expo/adaptive-monochrome.png')
save(Image.new('RGB',(1024,1024),BG), 'expo/adaptive-background.png')

for density, scale in [('ldpi',.75),('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
    n = round(48*scale)
    # Legacy launchers receive a square or circular tile with the same safe mark.
    legacy = Image.new('RGBA',(n,n),BG+(255,))
    legacy.alpha_composite(layer(n,round(height_dp/72*n)))
    save(legacy, f'android/res/mipmap-{density}/ic_launcher.png')
    mask = Image.new('L',(n*4,n*4))
    ImageDraw.Draw(mask).ellipse((0,0,n*4-1,n*4-1),fill=255)
    legacy.putalpha(mask.resize((n,n),Image.Resampling.LANCZOS))
    save(legacy, f'android/res/mipmap-{density}/ic_launcher_round.png')
    dim = round(108*scale)
    for name, im in [('foreground',adaptive),('monochrome',mono)]:
        save(im.resize((dim,dim),Image.Resampling.LANCZOS), f'android/res/drawable-{density}/ic_launcher_{name}.png')

for api in [26,33]:
    mono_xml = '\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />' if api == 33 else ''
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/housecare_icon_background" />\n'
           '    <foreground android:drawable="@drawable/ic_launcher_foreground" />'
           f'{mono_xml}\n</adaptive-icon>\n')
    for name in ['ic_launcher','ic_launcher_round']:
        p = ROOT / f'android/res/mipmap-anydpi-v{api}/{name}.xml'
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(xml)
hex_bg = '#'+''.join(f'{c:02X}' for c in BG)
p = ROOT / 'android/res/values/housecare_icon_colors.xml'
p.parent.mkdir(parents=True,exist_ok=True)
p.write_text(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="housecare_icon_background">{hex_bg}</color>\n</resources>\n')
save(master.resize((512,512), Image.Resampling.LANCZOS).convert('RGBA'), 'android/play-store-icon-512.png')
jsonfile('expo/app-icon-config.json', {'expo':{'icon':'./assets/housecare-icons/icon.png','ios':{'icon':'./assets/housecare-icons/icon.png'},'android':{'icon':'./assets/housecare-icons/icon.png','adaptiveIcon':{'foregroundImage':'./assets/housecare-icons/adaptive-foreground.png','backgroundColor':hex_bg,'monochromeImage':'./assets/housecare-icons/adaptive-monochrome.png'}}}})

# Contact sheet: masks below are previews only, never the iOS/store exports.
sheet = Image.new('RGB',(1140,430),'#e8eceb')
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',18)
items = [('Original source',original),('iOS / store',master)]
ad = Image.new('RGBA',(1080,1080),BG+(255,)); ad.alpha_composite(adaptive)
visible = ad.crop((180,180,900,900))
themed = Image.new('RGBA',(1080,1080),'#d7e9df')
tint = Image.new('RGBA',mono.size,'#274a3b'); tint.putalpha(mono.getchannel('A')); themed.alpha_composite(tint)
items += [('Android circle',visible),('Android squircle',visible),('Android themed',themed.crop((180,180,900,900)))]
for i,(label,im) in enumerate(items):
    im = im.convert('RGBA').resize((200,200),Image.Resampling.LANCZOS)
    if i >= 1:
        mask = Image.new('L',(800,800)); md=ImageDraw.Draw(mask)
        if i in [2,4]: md.ellipse((0,0,799,799),fill=255)
        else: md.rounded_rectangle((0,0,799,799),radius=175,fill=255)
        im.putalpha(mask.resize((200,200),Image.Resampling.LANCZOS))
    sheet.paste(im,(20+i*224,65),im)
    d.text((20+i*224,290),label,fill='#173f35',font=font)
d.text((20,345),'HouseCare • Existing artwork, prepared for platform masking',fill='#173f35',font=font)
save(sheet,'preview.png')

manifest = []
for p in sorted(ROOT.rglob('*.png')):
    im=Image.open(p)
    manifest.append(dict(path=str(p.relative_to(ROOT)),width=im.width,height=im.height,mode=im.mode,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
jsonfile('manifest.json',dict(source_sha256=hashlib.sha256(SRC.read_bytes()).hexdigest(),background=hex_bg,adaptive_canvas_dp=108,adaptive_safe_diameter_dp=64,images=manifest))
print(f'Generated {len(manifest)} PNGs; background {hex_bg}; adaptive mark height {height_dp:.2f}dp')
