# Palette-compress PNGs in place (flat diagram colours survive 256 colours),
# keeping their resolution (pHYs), which documents use for the natural size.
#   python3 tests/e2e/shrink-png.py <dir>
import sys, pathlib
from PIL import Image
for f in pathlib.Path(sys.argv[1]).rglob('*.png'):
    im = Image.open(f)
    dpi = im.info.get('dpi')
    q = im.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(f, optimize=True, **({'dpi': dpi} if dpi else {}))
