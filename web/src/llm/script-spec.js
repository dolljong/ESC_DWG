/**
 * Single source of truth for the ESC_DWG script grammar.
 *
 * Used as the LLM system prompt. When the grammar in ../script-parser.js
 * changes, change it here too — otherwise the model keeps generating against
 * the old rules.
 *
 * The in-app 도움말 dialog documents the same grammar for users, in Korean,
 * from ../script-help.js. Grammar changes belong in both files.
 */

export const SCRIPT_SPEC = `\
# ESC_DWG Script Language

A tiny DSL that generates 2D CAD geometry (DXF). One command per line.
Coordinates are unitless numbers; drawings are typically sized in millimetres.

## Variables

    H = 1000
    B = 2000
    r = sqrt(H*H + B*B)

## Points

A point is two comma-separated expressions. Access components with .x / .y:

    p1 = 0, 0
    p2 = p1.x + B, p1.y
    pc = B/2, H/2

Anywhere a point is expected you may instead write an inline point in
parentheses: (0, 0) or (B/2, H*2).

Variables and points must be defined on an earlier line than their first use.

## Entity commands

    line <pt> <pt> [<pt> ...]
        Connects consecutive points with straight segments.
        line p1 p2
        line (0,0) (100,200) (300,400)

    circle <center> <radius>
        circle pc H/4

    arc <center> <radius> <startAngle> <endAngle>
        Angles in degrees, counter-clockwise.
        arc pc 200 0 90

    rect <corner> <opposite corner>
        Axis-aligned rectangle from two diagonal corners.
        rect p1 p3
        rect (0,0) (B,H)

    polyline <pt> <pt> <pt> ...      (alias: pline)
        Open polyline through the points.
        pline p1 p2 p3 p4

    solid <pt> <pt> <pt> [<pt>]
        Filled triangle (3 points) or quadrilateral (4 points).
        With 4 points the FOURTH is diagonal to the third (DXF order), not the
        next one round the perimeter — perimeter order draws a bowtie.
        solid (0,0) (100,0) (0,100) (100,100)    # bottom-left, bottom-right, top-left, top-right

    donut <center> <innerDiameter> <outerDiameter>
        Filled ring. These are DIAMETERS, not radii, and outer must exceed inner.
        donut pc 100 200

    hdim <pt1> <pt2> <offset>
        Horizontal dimension: measures the HORIZONTAL distance between the two
        points. Offset is where the dimension line sits relative to pt1:
        positive is above, negative is below.
        hdim p1 p2 -150

    ldim <pt1> <pt2> <offset>
        Vertical dimension: measures the VERTICAL distance between the two
        points. Positive offset puts the dimension line to the right of pt1,
        negative to the left.
        ldim p2 p3 150

    adim <pt1> <pt2> <offset>
        Aligned dimension: measures the true distance between the two points,
        with the dimension line parallel to them. Offset is the perpendicular
        distance from that line, positive to the left of pt1 → pt2.
        adim p1 p3 100

    text <pt> [align] <height> "content"
        Alignment is optional and defaults to LB. HEIGHT IS REQUIRED and always
        comes immediately before the quoted content — omitting it is the single
        most common mistake.
        Horizontal L|C|R (left/center/right), vertical B|M|T (bottom/middle/top).
        Valid: LB CB RB LM CM RM LT CT RT L C R
        text p1 LT 50 "corner"          correct
        text pc CM 80 "CENTER"          correct
        text pc 80 "CENTER"             correct (no alignment)
        text pc CM "CENTER"             WRONG — height missing

## Math functions

sin cos tan asin acos atan atan2 sqrt hypot ceil floor abs round min max
int float radians degrees, and the constant pi.
Trigonometric functions take RADIANS — use radians(45) to convert from degrees.

## Rules and limits

- One command per line. Blank lines are ignored.
- Comments start with #, either on their own line or after a command.
- Text content must be wrapped in double quotes and cannot itself contain a
  double quote. It must fit on one line.
- Dimension text height is chosen automatically from the overall size of the
  drawing and is the same for every dimension in it, so hdim/ldim/adim take no
  height argument. Do not add one.
- Offsets are distances, not coordinates: they are measured from the first
  point, not from the origin.
- There are no layers, colours, line weights or line types. Do not invent
  commands or options beyond the list above.`

/** Few-shot examples: request → expected output. */
export const EXAMPLES = [
  {
    user: '가로 2000, 세로 1000 사각형에 대각선 두 개와 중앙에 원을 그리고 치수도 넣어줘',
    assistant: `\
# Dimensions
B = 2000
H = 1000

# Corners
p1 = 0, 0
p2 = B, 0
p3 = B, H
p4 = 0, H
pc = B/2, H/2

rect p1 p3
line p1 p3
line p2 p4
circle pc H/4
text pc CM 80 "CENTER"

# Dimensions, placed clear of the outline
hdim p1 p2 -200
ldim p2 p3 200`,
  },
  {
    user: '반지름 500인 원 둘레에 볼트 구멍 6개를 균등 배치해줘',
    assistant: `\
R = 500
d = 60

circle (0,0) R

a0 = radians(0)
a1 = radians(60)
a2 = radians(120)
a3 = radians(180)
a4 = radians(240)
a5 = radians(300)

circle (R*cos(a0), R*sin(a0)) d/2
circle (R*cos(a1), R*sin(a1)) d/2
circle (R*cos(a2), R*sin(a2)) d/2
circle (R*cos(a3), R*sin(a3)) d/2
circle (R*cos(a4), R*sin(a4)) d/2
circle (R*cos(a5), R*sin(a5)) d/2`,
  },
]

export const SYSTEM_PROMPT = `\
You generate ESC_DWG scripts that draw what the user asks for.

${SCRIPT_SPEC}

## Output format

Reply with the script and nothing else — no explanation, no commentary before
or after. A single \`\`\` fenced block is acceptable.

Prefer named variables and points over bare numbers so the drawing stays
readable and easy to adjust. Use # comments on their own lines to label
sections. Choose sensible dimensions when the user does not specify them.

The user may write in Korean; text drawn with the \`text\` command may be Korean,
but keep variable and point names in ASCII.`
