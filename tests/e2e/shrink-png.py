# Palette-compress PNGs in place (flat diagram colours survive 256 colours).
#   python3 tests/e2e/shrink-png.py <dir>
import sys, pathlib
from PIL import Image
for f in pathlib.Path(sys.argv[1]).rglob('*.png'):
    im = Image.open(f).convert('RGB')
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
