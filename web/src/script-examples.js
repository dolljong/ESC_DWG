/**
 * Ready-made scripts offered by the "예제" dropdown above the script editor.
 *
 * The first entry is what the editor starts with, so it stays the simplest one.
 * Every script here must parse cleanly — script-parser.js is the authority, and
 * the examples double as a smoke test of it. When the grammar changes, re-run
 * these through parseScript() before trusting them.
 *
 * Keep each script short enough to read in one screen; the point is to show a
 * command in context, not to build a real drawing.
 */

/** @type {{name: string, script: string}[]} */
export const SCRIPT_EXAMPLES = [
  {
    name: '1. 기본 도형',
    script: `# Variables
H = 1000
B = 2000

# Points: name = x_expr, y_expr
p1 = 0, 0
p2 = p1.x+B, p1.y
p3 = p2.x, p2.y+H
p4 = p1.x, p1.y+H
pc = B/2, H/2

# Entities (use point names or (expr,expr))
rect p1 p3
line p1 p3
line p2 p4
circle pc H/4

# text <pt> [align] height "content"
# align: L,C,R + B,M,T (ex: LB, CT, R)
text p1 LT 50 "p1(LB)"
text p3 RB 50 "p3(RT)"
text pc CM 80 "CENTER"
`,
  },

  {
    name: '2. 텍스트 정렬 9종',
    script: `# 정렬 코드는 좌우(L C R) + 상하(B M T) 조합입니다.
# 점(도넛)이 기준 위치이고, 글자가 그 주위 어디에 놓이는지 보세요.
S = 300      # 격자 간격
H = 60       # 문자 높이
d = 16       # 기준점 표시 크기

x1 = 0
x2 = S
x3 = 2*S
y1 = 0
y2 = S
y3 = 2*S

# 기준점 표시
donut (x1,y3) 0 d
donut (x2,y3) 0 d
donut (x3,y3) 0 d
donut (x1,y2) 0 d
donut (x2,y2) 0 d
donut (x3,y2) 0 d
donut (x1,y1) 0 d
donut (x2,y1) 0 d
donut (x3,y1) 0 d

# 윗줄: T (기준점이 글자 위)
text (x1,y3) LT H "LT"
text (x2,y3) CT H "CT"
text (x3,y3) RT H "RT"

# 가운뎃줄: M (기준점이 글자 중간)
text (x1,y2) LM H "LM"
text (x2,y2) CM H "CM"
text (x3,y2) RM H "RM"

# 아랫줄: B (기준점이 글자 아래)
text (x1,y1) LB H "LB"
text (x2,y1) CB H "CB"
text (x3,y1) RB H "RB"

text (x2, y3+2*S) CB 80 "TEXT ALIGNMENT"
`,
  },

  {
    name: '3. 치수선 (hdim/ldim/adim)',
    script: `# 치수선 3종. 문자·화살표 크기는 재는 거리에 맞춰 자동으로 정해집니다.
# 오프셋은 좌표가 아니라 "첫 번째 점에서 잰 거리"입니다.
B = 1200
H = 800

p1 = 0, 0
p2 = B, 0
p3 = B, H
p4 = 0, H

pline p1 p2 p3 p4 p1
line p1 p3

# 수평 거리 — 오프셋 음수는 아래쪽
hdim p1 p2 -200

# 수직 거리 — 오프셋 양수는 오른쪽
ldim p2 p3 250

# 실제(경사) 거리 — 치수선이 두 점 방향에 나란함
adim p1 p3 150

text (B/2, H+150) CB 70 "DIMENSIONS"
`,
  },

  {
    name: '4. 원 · 호 · 도넛 · 솔리드',
    script: `# 곡선과 채워진 도형들
R = 200

circle (0,0) R

# arc <중심> <반지름> <시작각> <끝각> — 도(degree), 반시계 방향
arc (600,0) R 0 180
arc (600,0) R 225 315

# donut <중심> <내측직경> <외측직경> — 반지름이 아니라 직경
donut (1200,0) 200 2*R

# solid — 3점이면 삼각형, 4점이면 사각형
# 4점일 때 네 번째 점은 세 번째 점의 "대각"입니다 (DXF 규칙).
# 아래는 좌하 → 우하 → 좌상 → 우상 순서입니다.
solid (1600,-R) (2000,-R) (1800,R)
solid (2200,-R) (2600,-R) (2200,R) (2600,R)

# 열린 폴리라인
pline (0,500) (400,800) (800,500) (1200,800) (1600,500)

text (0,-350) CT 70 "circle"
text (600,-350) CT 70 "arc"
text (1200,-350) CT 70 "donut"
text (1800,-350) CT 70 "solid 3"
text (2400,-350) CT 70 "solid 4"
`,
  },

  {
    name: '5. RC 보 단면',
    script: `# 철근콘크리트 보 단면 400 x 700
b = 400        # 폭
h = 700        # 높이
c = 40         # 피복두께
D = 25         # 주철근 직경

p1 = 0, 0
p2 = b, 0
p3 = b, h

# 콘크리트 외형과 스터럽
rect p1 p3
rect (c,c) (b-c, h-c)

# 주철근 중심 높이
yb = c + D/2         # 하부
yt = h - c - D/2     # 상부

# 하부 3-D25
donut (c+D, yb) 0 D
donut (b/2, yb) 0 D
donut (b-c-D, yb) 0 D

# 상부 2-D25
donut (c+D, yt) 0 D
donut (b-c-D, yt) 0 D

# 치수
hdim p1 p2 -120
ldim p2 p3 150

text (b/2, h+120) CB 45 "RC BEAM 400x700"
text (b+320, yt) LM 35 "상부 2-D25"
text (b+320, yb) LM 35 "하부 3-D25"
`,
  },

  {
    name: '6. 옹벽 단면 (역T형)',
    script: `# 역T형 캔틸레버 옹벽 단면
H = 5000       # 전체 높이
tf = 600       # 저판 두께
tw1 = 300      # 벽체 상단 두께
tw2 = 550      # 벽체 하단 두께
toe = 1000     # 앞굽 폭
heel = 1950    # 뒷굽 폭
B = toe+tw2+heel   # 저판 전체 폭

# 벽체 전면 경사 2% — 상단이 배면쪽으로 기욺
hw = H-tf          # 벽체 높이
dx = 0.02*hw       # 전면 상단이 배면쪽으로 물러나는 거리

# 외곽선을 시계 반대 방향으로 한 바퀴.
# 앞굽·뒷굽 상면(a3→a4, a7→a8)이 여기 포함되어 있으므로
# 저판 상면을 가로지르는 선을 따로 그리지 않습니다.
a1 = 0, 0
a2 = B, 0
a3 = B, tf
a4 = toe+tw2, tf      # 배면 하단
a5 = toe+dx+tw1, H    # 배면 상단
a6 = toe+dx, H        # 전면 상단 (2% 만큼 배면쪽)
a7 = toe, tf          # 전면 하단
a8 = 0, tf

pline a1 a2 a3 a4 a5 a6 a7 a8 a1

# 벽체 하단 두께를 저판 아래까지 내려 치수 보조점으로 사용
b1 = toe, 0
b2 = toe+tw2, 0

# 수평 1단 — 앞굽폭 · 벽체하단두께 · 뒷굽폭
hdim a1 b1 -800
hdim b1 b2 -800
hdim b2 a2 -800

# 수평 2단 — 저판 전체 폭
hdim a1 a2 -1600

# 상부 치수 보조점 — 앞굽끝·전면하단·배면하단·뒷굽끝의 x 를
# 벽체 상단 높이(H)로 올려서, 인출선이 오프셋만큼만 짧게 나오게 합니다.
t1 = 0, H
t2 = toe, H
t3 = toe+tw2, H
t4 = B, H

# 수평 상단 — 앞굽끝 · 전면경사 · 상단폭 · 배면경사 · 뒷굽끝
od = 500       # 상부 치수선 오프셋 (원점이 모두 y=H 라 값 하나로 통일)
hdim t1 t2 od
hdim t2 a6 od
hdim a6 a5 od
hdim a5 t3 od
hdim t3 t4 od

# 수직 — 저판 두께 · 벽체 높이 (한 줄로 연결)
ldim a2 a3 1000
ldim a3 (B, H) 1000

text (B/2, H+od+600) CB 220 "RETAINING WALL H=5.0m"
text (toe/2, tf/2) CM 150 "앞굽"
text (B-800, tf/2) CM 150 "뒷굽"
`,
  },

  {
    name: '7. 박스 암거 단면',
    script: `# 1련 박스 암거 (박스 컬버트) 단면
Bi = 3000      # 내공 폭
Hi = 2500      # 내공 높이
t = 350        # 벽체 · 상하판 두께
h = 300        # 헌치 크기

B = Bi+2*t     # 전체 폭
H = Hi+2*t     # 전체 높이

# 외측 윤곽
rect (0,0) (B, H)

# 내공 윤곽 — 네 모서리를 헌치로 잘라낸 팔각형 한 바퀴
pline (t+h, t) (Bi+t-h, t) (Bi+t, t+h) (Bi+t, Hi+t-h) (Bi+t-h, Hi+t) (t+h, Hi+t) (t, Hi+t-h) (t, t+h) (t+h, t)

# 중심선
line (B/2, -400) (B/2, H+400)

# 수평 1단 — 벽체두께 · 내공폭 · 벽체두께
hdim (0,0) (t,0) -800
hdim (t,0) (Bi+t,0) -800
hdim (Bi+t,0) (B,0) -800

# 수평 2단 — 전체 폭
hdim (0,0) (B,0) -1600

# 수직 1단 — 하부슬래브 · 내공높이 · 상부슬래브
ldim (B,0) (B,t) 800
ldim (B,t) (B,Hi+t) 800
ldim (B,Hi+t) (B,H) 800

# 수직 2단 — 전체 높이
ldim (B,0) (B,H) 1600

text (B/2, H+700) CB 200 "BOX CULVERT 3.0 x 2.5"
text (t+400, Hi+t-400) LT 180 "내공"
text (0, -2500) LT 180 "헌치 300x300"
`,
  },

  {
    name: '8. 원형 볼트 배치 (삼각함수)',
    script: `# 플랜지 볼트 구멍을 삼각함수로 배치합니다.
# 반복문이 없으므로 구멍 하나에 한 줄씩 씁니다.
OD = 600       # 플랜지 외경
BCD = 460      # 볼트 중심원 지름
hd = 26        # 볼트 구멍 지름
R = BCD/2

pc = 0, 0
circle pc OD/2
circle pc R

# 각도는 라디안이므로 radians()로 도를 변환합니다.
circle (R*cos(radians(0)), R*sin(radians(0))) hd/2
circle (R*cos(radians(60)), R*sin(radians(60))) hd/2
circle (R*cos(radians(120)), R*sin(radians(120))) hd/2
circle (R*cos(radians(180)), R*sin(radians(180))) hd/2
circle (R*cos(radians(240)), R*sin(radians(240))) hd/2
circle (R*cos(radians(300)), R*sin(radians(300))) hd/2

# 중심 표시
line (-40,0) (40,0)
line (0,-40) (0,40)

hdim (-OD/2,0) (OD/2,0) -OD/2-120
text (0, OD/2+90) CB 45 "FLANGE 6-M24 (B.C.D 460)"
`,
  },
];
