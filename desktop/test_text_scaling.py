# -*- coding: utf-8 -*-
import matplotlib.pyplot as plt
from matplotlib.textpath import TextPath
from matplotlib.patches import PathPatch
from matplotlib.transforms import Affine2D
import matplotlib.font_manager as fm

# Configure Korean font
plt.rcParams['font.family'] = ['Malgun Gothic', 'NanumGothic', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False

fig, ax = plt.subplots(figsize=(10, 8))

# Draw grid lines for reference
for i in range(0, 21, 5):
    ax.axhline(y=i, color='gray', linewidth=0.5, alpha=0.5)
    ax.axvline(x=i, color='gray', linewidth=0.5, alpha=0.5)

# Draw text at different heights
texts = [
    ("높이 2.5", (5, 5), 2.5, 0),
    ("높이 5", (5, 10), 5, 0),
    ("회전 30도", (15, 5), 3, 30),
]

# Find Korean font
font_path = None
for font in fm.fontManager.ttflist:
    if 'Malgun Gothic' in font.name:
        font_path = font.fname
        break

prop = fm.FontProperties(fname=font_path) if font_path else fm.FontProperties()

for text, pos, height, rotation in texts:
    # Create text path
    tp = TextPath((0, 0), text, size=1, prop=prop)
    
    # Get bounds and scale
    bbox = tp.get_extents()
    scale = height / bbox.height if bbox.height > 0 else height
    
    # Transform
    transform = Affine2D().scale(scale, scale).rotate_deg(rotation).translate(pos[0], pos[1])
    
    # Add patch
    patch = PathPatch(tp, facecolor='black', edgecolor='none', 
                     transform=transform + ax.transData)
    ax.add_patch(patch)
    
    # Draw height reference line
    ax.plot([pos[0]-1, pos[0]-1], [pos[1], pos[1]+height], 'r-', linewidth=1)
    ax.text(pos[0]-1.5, pos[1]+height/2, f'{height}', fontsize=8, ha='right', va='center')

ax.set_xlim(0, 20)
ax.set_ylim(0, 20)
ax.set_aspect('equal')
ax.set_title('Text Scaling Test - Text height matches drawing units')
plt.show()