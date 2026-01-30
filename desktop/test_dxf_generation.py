import ezdxf

# Test the DXF generation functionality
doc = ezdxf.new('R2010')
msp = doc.modelspace()

# Add a line
msp.add_line((0, 0), (10, 10))

# Add a circle
msp.add_circle((5, 5), 3)

# Add a polyline
points = [(0, 0), (5, 0), (5, 5), (0, 5), (0, 0)]
msp.add_lwpolyline(points)

# Save the DXF file
doc.saveas('test_generated.dxf')
print("Test DXF file generated successfully!")