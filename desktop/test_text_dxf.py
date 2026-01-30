import ezdxf

# Create a new DXF document
doc = ezdxf.new('R2010')
msp = doc.modelspace()

# Add some text entities
msp.add_text("Hello DXF!", dxfattribs={
    'insert': (10, 10),
    'height': 5,
    'rotation': 0
})

msp.add_text("Rotated Text", dxfattribs={
    'insert': (30, 20),
    'height': 3,
    'rotation': 45
})

msp.add_text("Small Text", dxfattribs={
    'insert': (10, 30),
    'height': 2
})

# Add MTEXT (multiline text)
msp.add_mtext("This is\nmultiline\ntext", dxfattribs={
    'insert': (50, 10),
    'char_height': 4,
    'width': 20
})

# Add some geometric shapes for reference
msp.add_line((0, 0), (60, 0))
msp.add_line((0, 0), (0, 40))
msp.add_circle((30, 30), 5)

# Save the file
doc.saveas('test_with_text.dxf')
print("DXF file with text created successfully!")