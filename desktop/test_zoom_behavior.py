# -*- coding: utf-8 -*-
import ezdxf

# Create a test DXF with content spread across a large area
doc = ezdxf.new('R2010')
msp = doc.modelspace()

# Create a grid of content to test zoom behavior
for i in range(0, 101, 10):
    for j in range(0, 101, 10):
        # Add a small rectangle at each grid point
        msp.add_line((i-1, j-1), (i+1, j-1))
        msp.add_line((i+1, j-1), (i+1, j+1))
        msp.add_line((i+1, j+1), (i-1, j+1))
        msp.add_line((i-1, j+1), (i-1, j-1))
        
        # Add text at some grid points
        if i % 20 == 0 and j % 20 == 0:
            msp.add_text(f"({i},{j})", dxfattribs={
                'insert': (i, j-3),
                'height': 2
            })

# Add some larger shapes for reference
msp.add_circle((50, 50), 15)
msp.add_line((0, 0), (100, 100))
msp.add_line((0, 100), (100, 0))

# Save the file
doc.saveas('zoom_test.dxf')
print("Zoom test DXF created with grid pattern from (0,0) to (100,100)")
print("Use zoom to rectangle tool to test the new zoom behavior.")