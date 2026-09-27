"""Print the Literata H outline as SVG: uv run --with fonttools scripts/icon-mark.py FONT.ttf.

The output uses outlines so asset generation never depends on host fonts.
"""
import sys
from io import BytesIO
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

source = BytesIO(urlopen(sys.argv[1], timeout=30).read()) if sys.argv[1].startswith('https://') else sys.argv[1]
font = instantiateVariableFont(TTFont(source), {"wght": 700, "opsz": 48})
glyphs = font.getGlyphSet()
pen = SVGPathPen(glyphs)
glyphs[font.getBestCmap()[ord("H")]].draw(pen)
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Heirloom">
  <style>:root {{ --color-paper: #faf8f5; --color-ink: #2c221e; --color-terracotta: #c85a32; }}</style>
  <rect width="512" height="512" fill="#faf8f5"/>
  <path d="{pen.getCommands()}" transform="translate(112 358) scale(.34 -.34)" fill="#2c221e"/>
  <circle cx="382" cy="344" r="18" fill="#c85a32"/>
</svg>''')
