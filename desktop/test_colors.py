# -*- coding: utf-8 -*-
import ezdxf

# Create a new DXF document
doc = ezdxf.new('R2010')
msp = doc.modelspace()

print("Creating color test DXF file...")

# Add lines with different colors
colors = [
    (1, 'Red'),
    (2, 'Yellow'), 
    (3, 'Green'),
    (4, 'Cyan'),
    (5, 'Blue'),
    (6, 'Magenta'),
    (8, 'Gray'),
    (9, 'Light Gray'),
    (30, 'Orange Red'),
    (40, 'Red Orange'),
    (50, 'Pink Red')
]

y_pos = 0
for color_index, color_name in colors:
    # Add line with specific color
    line = msp.add_line((0, y_pos), (20, y_pos))
    line.dxf.color = color_index
    
    # Add text label
    text = msp.add_text(f"Color {color_index}: {color_name}", dxfattribs={
        'insert': (25, y_pos-1),
        'height': 2,
        'color': color_index
    })
    
    y_pos += 5

# Add circles with different colors
x_pos = 40
y_pos = 0
for color_index, color_name in colors[:6]:  # First 6 colors
    circle = msp.add_circle((x_pos, y_pos), 2)
    circle.dxf.color = color_index
    y_pos += 8

# Add reference frame (black)
msp.add_line((0, -5), (70, -5), dxfattribs={'color': 0})  # Black line
msp.add_line((0, -5), (0, 60), dxfattribs={'color': 0})   # Black line

# Save the file
doc.saveas('color_test.dxf')
print("Color test DXF created successfully!")
print("This file contains lines, circles, and text in different colors.")