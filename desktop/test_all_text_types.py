# -*- coding: utf-8 -*-
import ezdxf

# Create a new DXF document
doc = ezdxf.new('R2010')
msp = doc.modelspace()

# Add different types of text entities
print("Creating comprehensive text test file...")

# 1. Regular TEXT entities with same style and height (should be cached)
msp.add_text("텍스트 1", dxfattribs={
    'insert': (10, 10),
    'height': 2.5,
    'style': 'STANDARD'
})

msp.add_text("텍스트 2", dxfattribs={
    'insert': (10, 15),
    'height': 2.5,
    'style': 'STANDARD'
})

msp.add_text("텍스트 3", dxfattribs={
    'insert': (10, 20),
    'height': 2.5,
    'style': 'STANDARD'
})

# 2. TEXT with different height (new cache entry)
msp.add_text("큰 텍스트", dxfattribs={
    'insert': (10, 30),
    'height': 5.0,
    'style': 'STANDARD'
})

# 3. TEXT with rotation
msp.add_text("회전된 텍스트", dxfattribs={
    'insert': (30, 10),
    'height': 3.0,
    'rotation': 45
})

# 4. MTEXT entities
msp.add_mtext("멀티라인\n텍스트\n예제", dxfattribs={
    'insert': (50, 10),
    'char_height': 2.0,
    'width': 20
})

msp.add_mtext("Another\nMultiline\nText", dxfattribs={
    'insert': (50, 25),
    'char_height': 2.0,
    'width': 20
})

# 5. Create a block with ATTDEF (attribute definition)
block = doc.blocks.new('TEST_BLOCK')
block.add_attdef('LABEL', (0, 0), dxfattribs={
    'height': 1.5,
    'text': 'Default Label'
})

# Insert block with attributes
block_ref = msp.add_blockref('TEST_BLOCK', (70, 10))
block_ref.add_attrib('LABEL', '속성 텍스트', (70, 10), dxfattribs={
    'height': 1.5
})

# 6. Add some reference geometry
msp.add_line((0, 0), (80, 0))  # X-axis
msp.add_line((0, 0), (0, 40))  # Y-axis

# Add grid lines for reference
for i in range(10, 81, 10):
    msp.add_line((i, -2), (i, 2))  # Vertical grid
    
for i in range(10, 41, 10):
    msp.add_line((-2, i), (2, i))  # Horizontal grid

# Save the file
doc.saveas('comprehensive_text_test.dxf')
print("Comprehensive text test file created!")
print("This file contains:")
print("- 3 TEXT entities with same style/height (should use cached rendering)")
print("- 1 TEXT with different height")
print("- 1 Rotated TEXT")
print("- 2 MTEXT entities")
print("- 1 ATTRIB in block")
print("- Reference grid lines")