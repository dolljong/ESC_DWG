# -*- coding: utf-8 -*-
import ezdxf

# Create a new DXF document
doc = ezdxf.new('R2010')
msp = doc.modelspace()

# Add Korean text entities
msp.add_text("안녕하세요", dxfattribs={
    'insert': (10, 10),
    'height': 2.5,
    'rotation': 0
})

msp.add_text("DXF 텍스트", dxfattribs={
    'insert': (10, 20),
    'height': 5,
    'rotation': 0
})

msp.add_text("한글 텍스트 테스트", dxfattribs={
    'insert': (10, 30),
    'height': 3,
    'rotation': 30
})

# Add reference lines
msp.add_line((0, 0), (50, 0))
msp.add_line((0, 0), (0, 40))

# Add a rectangle showing text height of 2.5 units
msp.add_line((30, 10), (40, 10))
msp.add_line((30, 10), (30, 12.5))
msp.add_line((30, 12.5), (40, 12.5))
msp.add_line((40, 10), (40, 12.5))
msp.add_text("높이 2.5", dxfattribs={'insert': (42, 10), 'height': 2})

# Save the file
doc.saveas('test_korean.dxf')
print("Korean DXF file created successfully!")