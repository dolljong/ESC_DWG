/**
 * Ready-made scripts offered by the "예제" dropdown above the script editor.
 *
 * The first entry is what the editor starts with, so it stays the simplest one.
 * Every script here must parse cleanly — script-parser.js is the authority, and
 * the examples double as a smoke test of it. When the grammar changes, re-run
 * these through parseScript() before trusting them.
 *
 * House style, which llm/script-spec.js also teaches the model: name every
 * point in a block near the top, label it with a trailing `#` comment, then draw
 * using only those names. Editing a drawing afterwards — moving a corner, adding
 * a dimension off an existing vertex — then means touching one line, and the LLM
 * has a vocabulary to talk about the geometry with.
 *
 * Keep each script short enough to read in one screen; the point is to show a
 * command in context, not to build a real drawing.
 */

/** @type {{name: string, script: string}[]} */
export const SCRIPT_EXAMPLES = [
  {
    name: '1. 기본 도형',
    script: `# 값을 변수로, 위치를 점으로 먼저 정의하고 이름으로 그립니다.

# ── 치수 ─────────────────────────────
H = 1000       # 높이
B = 2000       # 폭

# ── 점 (이름 = x수식, y수식) ─────────
p1 = 0, 0            # 좌하
p2 = p1.x+B, p1.y    # 우하
p3 = p2.x, p2.y+H    # 우상
p4 = p1.x, p1.y+H    # 좌상
pc = B/2, H/2        # 중심

# ── 도형 (좌표 대신 점 이름을 씁니다) ─
rect p1 p3
line p1 p3
line p2 p4
circle pc H/4

# text <점> [정렬] <높이> "내용"
# 정렬: L,C,R + B,M,T (예: LB, CT, R)
text p1 LT 50 "p1"
text p3 RB 50 "p3"
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

# ── 점 — 이름을 정렬 코드와 똑같이 지었습니다 ──
pLT = 0,   2*S       # 왼쪽 위
pCT = S,   2*S       # 가운데 위
pRT = 2*S, 2*S       # 오른쪽 위
pLM = 0,   S         # 왼쪽 중간
pCM = S,   S         # 가운데 중간
pRM = 2*S, S         # 오른쪽 중간
pLB = 0,   0         # 왼쪽 아래
pCB = S,   0         # 가운데 아래
pRB = 2*S, 0         # 오른쪽 아래
pTitle = pCT.x, pCT.y+2*S    # 제목

# 기준점 표시
donut pLT 0 d
donut pCT 0 d
donut pRT 0 d
donut pLM 0 d
donut pCM 0 d
donut pRM 0 d
donut pLB 0 d
donut pCB 0 d
donut pRB 0 d

# 윗줄: T (기준점이 글자 위)
text pLT LT H "LT"
text pCT CT H "CT"
text pRT RT H "RT"

# 가운뎃줄: M (기준점이 글자 중간)
text pLM LM H "LM"
text pCM CM H "CM"
text pRM RM H "RM"

# 아랫줄: B (기준점이 글자 아래)
text pLB LB H "LB"
text pCB CB H "CB"
text pRB RB H "RB"

text pTitle CB 80 "TEXT ALIGNMENT"
`,
  },

  {
    name: '3. 치수선 (hdim/ldim/adim)',
    script: `# 치수선 3종. 문자·화살표 크기는 재는 거리에 맞춰 자동으로 정해집니다.
# 오프셋은 좌표가 아니라 "첫 번째 점에서 잰 거리"입니다.
B = 1200
H = 800

# ── 점 ───────────────────────────────
p1 = 0, 0            # 좌하
p2 = B, 0            # 우하
p3 = B, H            # 우상
p4 = 0, H            # 좌상
pTitle = B/2, H+150  # 제목

pline p1 p2 p3 p4 p1
line p1 p3

# 수평 거리 — 오프셋 음수는 아래쪽
hdim p1 p2 -200

# 수직 거리 — 오프셋 양수는 오른쪽
ldim p2 p3 250

# 실제(경사) 거리 — 치수선이 두 점 방향에 나란함
adim p1 p3 150

text pTitle CB 70 "DIMENSIONS"
`,
  },

  {
    name: '4. 원 · 호 · 도넛 · 솔리드',
    script: `# 곡선과 채워진 도형들. 그릴 자리를 점으로 먼저 잡아 둡니다.
R = 200        # 공통 반지름
yn = -350      # 이름표 y 좌표

# ── 중심점 ───────────────────────────
c1 = 0, 0            # 원
c2 = 600, 0          # 호
c3 = 1200, 0         # 도넛

# ── 삼각형 solid 꼭짓점 ──────────────
t1 = 1600, -R        # 좌하
t2 = 2000, -R        # 우하
t3 = 1800, R         # 꼭대기

# ── 사각형 solid 꼭짓점 ──────────────
q1 = 2200, -R        # 좌하
q2 = 2600, -R        # 우하
q3 = 2200, R         # 좌상
q4 = 2600, R         # 우상

# ── 폴리라인 지그재그 ────────────────
w1 = 0, 500
w2 = 400, 800
w3 = 800, 500
w4 = 1200, 800
w5 = 1600, 500

# ── 이름표 위치 ──────────────────────
n1 = c1.x, yn
n2 = c2.x, yn
n3 = c3.x, yn
n4 = t3.x, yn
n5 = 2400, yn

circle c1 R

# arc <중심> <반지름> <시작각> <끝각> — 도(degree), 반시계 방향
arc c2 R 0 180
arc c2 R 225 315

# donut <중심> <내측직경> <외측직경> — 반지름이 아니라 직경
donut c3 200 2*R

# solid — 3점이면 삼각형, 4점이면 사각형
# 4점일 때 네 번째 점은 세 번째 점의 "대각"입니다 (DXF 규칙).
solid t1 t2 t3
solid q1 q2 q3 q4

# 열린 폴리라인
pline w1 w2 w3 w4 w5

text n1 CT 70 "circle"
text n2 CT 70 "arc"
text n3 CT 70 "donut"
text n4 CT 70 "solid 3"
text n5 CT 70 "solid 4"
`,
  },

  {
    name: '5. RC 보 단면',
    script: `# 철근콘크리트 보 단면 400 x 700
b = 400        # 폭
h = 700        # 높이
c = 40         # 피복두께
D = 25         # 주철근 직경

# 주철근 중심 높이
yb = c + D/2         # 하부
yt = h - c - D/2     # 상부

# ── 콘크리트 외형 ────────────────────
p1 = 0, 0            # 좌하
p2 = b, 0            # 우하
p3 = b, h            # 우상
p4 = 0, h            # 좌상

# ── 스터럽 (피복 안쪽) ───────────────
s1 = c, c            # 좌하
s2 = b-c, h-c        # 우상

# ── 하부 주철근 3-D25 ────────────────
r1 = c+D, yb         # 좌
r2 = b/2, yb         # 중
r3 = b-c-D, yb       # 우

# ── 상부 주철근 2-D25 ────────────────
r4 = c+D, yt         # 좌
r5 = b-c-D, yt       # 우

# ── 이름표 위치 ──────────────────────
pTitle = b/2, h+120
pTop = b+320, yt
pBot = b+320, yb

rect p1 p3
rect s1 s2

donut r1 0 D
donut r2 0 D
donut r3 0 D
donut r4 0 D
donut r5 0 D

# 치수
hdim p1 p2 -120
ldim p2 p3 150

text pTitle CB 45 "RC BEAM 400x700"
text pTop LM 35 "상부 2-D25"
text pBot LM 35 "하부 3-D25"
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

# ── 외곽선 점 — 시계 반대 방향으로 한 바퀴 ──
# 앞굽·뒷굽 상면(a3→a4, a7→a8)이 여기 포함되어 있으므로
# 저판 상면을 가로지르는 선을 따로 그리지 않습니다.
a1 = 0, 0             # 저판 좌하
a2 = B, 0             # 저판 우하
a3 = B, tf            # 뒷굽 끝 상면
a4 = toe+tw2, tf      # 배면 하단
a5 = toe+dx+tw1, H    # 배면 상단
a6 = toe+dx, H        # 전면 상단 (2% 만큼 배면쪽)
a7 = toe, tf          # 전면 하단
a8 = 0, tf            # 앞굽 끝 상면

pline a1 a2 a3 a4 a5 a6 a7 a8 a1

# ── 치수 보조점 ──────────────────────
# 벽체 하단 두께를 저판 아래까지 내림
b1 = toe, 0           # 전면 하단의 x
b2 = toe+tw2, 0       # 배면 하단의 x

# 앞굽끝·전면하단·배면하단·뒷굽끝의 x 를 벽체 상단 높이(H)로
# 올려서, 인출선이 오프셋만큼만 짧게 나오게 합니다.
t1 = 0, H             # 앞굽 끝
t2 = toe, H           # 전면 하단
t3 = toe+tw2, H       # 배면 하단
t4 = B, H             # 뒷굽 끝

# ── 이름표 위치 ──────────────────────
od = 500              # 상부 치수선 오프셋 (원점이 모두 y=H 라 값 하나로 통일)
pTitle = B/2, H+od+600
pToe = toe/2, tf/2
pHeel = B-800, tf/2

# 수평 1단 — 앞굽폭 · 벽체하단두께 · 뒷굽폭
hdim a1 b1 -800
hdim b1 b2 -800
hdim b2 a2 -800

# 수평 2단 — 저판 전체 폭
hdim a1 a2 -1600

# 수평 상단 — 앞굽끝 · 전면경사 · 상단폭 · 배면경사 · 뒷굽끝
hdim t1 t2 od
hdim t2 a6 od
hdim a6 a5 od
hdim a5 t3 od
hdim t3 t4 od

# 수직 — 저판 두께 · 벽체 높이 (한 줄로 연결)
ldim a2 a3 1000
ldim a3 t4 1000

text pTitle CB 220 "RETAINING WALL H=5.0m"
text pToe CM 150 "앞굽"
text pHeel CM 150 "뒷굽"
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

# ── 외측 윤곽 ────────────────────────
o1 = 0, 0            # 좌하
o2 = B, 0            # 우하
o3 = B, H            # 우상
o4 = 0, H            # 좌상

# ── 내공 윤곽 — 네 모서리를 헌치로 자른 팔각형 (반시계) ──
i1 = t+h, t          # 바닥 좌
i2 = Bi+t-h, t       # 바닥 우
i3 = Bi+t, t+h       # 우벽 하
i4 = Bi+t, Hi+t-h    # 우벽 상
i5 = Bi+t-h, Hi+t    # 천장 우
i6 = t+h, Hi+t       # 천장 좌
i7 = t, Hi+t-h       # 좌벽 상
i8 = t, t+h          # 좌벽 하

# ── 중심선 ───────────────────────────
cl1 = B/2, -400      # 아래 끝
cl2 = B/2, H+400     # 위 끝

# ── 치수 보조점 ──────────────────────
d1 = t, 0            # 좌측 벽체 안쪽면
d2 = Bi+t, 0         # 우측 벽체 안쪽면
e1 = B, t            # 하부슬래브 상면
e2 = B, Hi+t         # 상부슬래브 하면

# ── 이름표 위치 ──────────────────────
pTitle = B/2, H+700
pIn = t+400, Hi+t-400
pNote = 0, -2500

rect o1 o3
pline i1 i2 i3 i4 i5 i6 i7 i8 i1
line cl1 cl2

# 수평 1단 — 벽체두께 · 내공폭 · 벽체두께
hdim o1 d1 -800
hdim d1 d2 -800
hdim d2 o2 -800

# 수평 2단 — 전체 폭
hdim o1 o2 -1600

# 수직 1단 — 하부슬래브 · 내공높이 · 상부슬래브
ldim o2 e1 800
ldim e1 e2 800
ldim e2 o3 800

# 수직 2단 — 전체 높이
ldim o2 o3 1600

text pTitle CB 200 "BOX CULVERT 3.0 x 2.5"
text pIn LT 180 "내공"
text pNote LT 180 "헌치 300x300"
`,
  },

  {
    name: '8. 원형 볼트 배치 (삼각함수)',
    script: `# 플랜지 볼트 구멍을 삼각함수로 배치합니다.
# 반복문이 없으므로 구멍 하나에 한 줄씩 점을 정의합니다.
OD = 600       # 플랜지 외경
BCD = 460      # 볼트 중심원 지름
hd = 26        # 볼트 구멍 지름
R = BCD/2

# ── 점 — 각도는 라디안이므로 radians()로 도를 변환합니다 ──
pc = 0, 0                                    # 플랜지 중심
h1 = R*cos(radians(0)),   R*sin(radians(0))    # 0도
h2 = R*cos(radians(60)),  R*sin(radians(60))   # 60도
h3 = R*cos(radians(120)), R*sin(radians(120))  # 120도
h4 = R*cos(radians(180)), R*sin(radians(180))  # 180도
h5 = R*cos(radians(240)), R*sin(radians(240))  # 240도
h6 = R*cos(radians(300)), R*sin(radians(300))  # 300도

# 중심 표시 십자
m1 = -40, 0
m2 = 40, 0
m3 = 0, -40
m4 = 0, 40

# 치수 · 이름표
w1 = -OD/2, 0        # 외경 좌
w2 = OD/2, 0         # 외경 우
pTitle = 0, OD/2+90

circle pc OD/2
circle pc R

circle h1 hd/2
circle h2 hd/2
circle h3 hd/2
circle h4 hd/2
circle h5 hd/2
circle h6 hd/2

line m1 m2
line m3 m4

hdim w1 w2 -OD/2-120
text pTitle CB 45 "FLANGE 6-M24 (B.C.D 460)"
`,
  },
];
