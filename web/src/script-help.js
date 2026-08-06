/**
 * Korean script reference shown by the 도움말 button.
 *
 * This is the user-facing twin of ../src/llm/script-spec.js: same grammar, but
 * written for a person rather than a model, and in the language the rest of the
 * UI speaks. It follows the desktop build's manual (desktop/ESC_DWG.py,
 * show_usage) so both versions document the same language.
 *
 * When the grammar in ./script-parser.js changes, update BOTH this file and
 * llm/script-spec.js — otherwise the help and the model drift apart from what
 * the parser actually accepts.
 *
 * Static authored markup; nothing here is built from user input.
 */

/** @type {{title: string, body: string}[]} */
const SECTIONS = [
  {
    title: '기본 규칙',
    body: `
<ul>
  <li>한 줄에 명령 하나. 빈 줄은 무시됩니다.</li>
  <li><code>#</code> 뒤는 주석입니다. 줄 전체 또는 명령 뒤에 붙일 수 있습니다.</li>
  <li>변수와 점은 <b>사용하기 전 줄</b>에 먼저 정의해야 합니다.</li>
  <li>좌표는 단위 없는 숫자이며, 보통 밀리미터 기준으로 씁니다.</li>
</ul>`,
  },
  {
    title: '변수',
    body: `
<p>수식에서 쓸 숫자 값을 지정합니다.</p>
<pre>H = 1000
B = 2000
r = sqrt(H*H + B*B)</pre>`,
  },
  {
    title: '점 (Point)',
    body: `
<p>쉼표로 구분된 두 수식이 점이 됩니다. <code>.x</code> / <code>.y</code> 로 좌표에 접근합니다.</p>
<pre>p1 = 0, 0
p2 = p1.x + B, p1.y
pc = B/2, H/2</pre>
<p>점이 필요한 자리에는 괄호를 쓴 즉석 점도 넣을 수 있습니다 — <code>(0, 0)</code>, <code>(B/2, H*2)</code>.</p>`,
  },
  {
    title: '권장 작성 순서 — 점 먼저',
    body: `
<p>예제들이 모두 이 방식으로 쓰여 있습니다.
   <b>치수 변수 → 점 정의(주석으로 이름표) → 도형 명령</b> 순으로 쓰고,
   도형 명령에는 좌표 대신 <b>점 이름만</b> 넣습니다.</p>
<pre># ── 점 ──────────────────
p1 = 0, 0            <span class="ok"># 좌하</span>
p2 = B, 0            <span class="ok"># 우하</span>
p3 = B, H            <span class="ok"># 우상</span>
p4 = 0, H            <span class="ok"># 좌상</span>
pTitle = B/2, H+150  <span class="ok"># 제목 위치</span>

rect p1 p3           <span class="ok"># 이름으로 그리기</span>
rect (0,0) (B,H)     <span class="bad"># 좌표 직접 — 나중에 지칭할 수 없음</span></pre>
<p class="note">이렇게 해 두면 꼭짓점을 옮길 때 점 정의 한 줄만 고치면 되고,
   치수선·문자를 덧붙일 때도 이미 있는 점을 그대로 쓸 수 있습니다.
   AI에게 <i>"p3 를 오른쪽으로 200 옮겨줘"</i>, <i>"a5 에서 t3 까지 치수 넣어줘"</i>
   처럼 <b>점 이름으로 지시</b>할 수도 있습니다.</p>
<p class="note">문자 위치·치수 보조점에도 이름을 붙이세요(<code>pTitle</code>, <code>pNote</code>,
   <code>d1</code> …). 이름은 ASCII로 짓고, 명령어(<code>line rect text</code> …)나
   함수 이름과 겹치지 않게 합니다.</p>
<p class="note"><b>[점 이름]</b> 버튼을 켜면 정의된 점 위치에 <span class="bad">붉은 점</span>과
   이름이 도면 위에 표시됩니다. 편집하는 대로 바로 갱신되고, 확대·축소해도 크기가 그대로이며,
   저장하는 DXF 파일에는 들어가지 않습니다.</p>`,
  },
  {
    title: '도형 명령어',
    body: `
<dl>
  <dt><code>line &lt;점1&gt; &lt;점2&gt; [&lt;점3&gt; ...]</code></dt>
  <dd>연속된 점 사이를 직선으로 잇습니다.
    <pre>line p1 p2
line (0,0) (100,200) (300,400)</pre></dd>

  <dt><code>circle &lt;중심점&gt; &lt;반지름&gt;</code></dt>
  <dd><pre>circle pc H/4</pre></dd>

  <dt><code>arc &lt;중심점&gt; &lt;반지름&gt; &lt;시작각&gt; &lt;끝각&gt;</code></dt>
  <dd>각도는 도(degree), 반시계 방향입니다.
    <pre>arc pc 200 0 90</pre></dd>

  <dt><code>rect &lt;점1&gt; &lt;점2&gt;</code></dt>
  <dd>두 대각 꼭짓점으로 축에 나란한 사각형을 그립니다.
    <pre>rect p1 p3
rect (0,0) (B,H)</pre></dd>

  <dt><code>polyline &lt;점&gt; &lt;점&gt; ...</code> <span class="alias">(별칭: pline)</span></dt>
  <dd>여러 점을 잇는 열린 폴리라인입니다.
    <pre>pline p1 p2 p3 p4</pre></dd>

  <dt><code>solid &lt;점1&gt; &lt;점2&gt; &lt;점3&gt; [&lt;점4&gt;]</code></dt>
  <dd>채워진 삼각형(3점) 또는 사각형(4점)입니다.
    <p class="note">4점일 때 <b>네 번째 점은 세 번째 점의 대각</b>입니다(DXF 규칙).
      둘레를 따라 순서대로 넣으면 나비 모양이 됩니다.</p>
    <pre>solid p1 p2 p3
solid (0,0) (100,0) (0,100) (100,100)   <span class="ok"># 좌하 우하 좌상 우상</span>
solid (0,0) (100,0) (100,100) (0,100)   <span class="bad"># 둘레 순서 — 나비 모양</span></pre></dd>

  <dt><code>donut &lt;중심점&gt; &lt;내측직경&gt; &lt;외측직경&gt;</code></dt>
  <dd>채워진 링입니다. 반지름이 아니라 <b>직경</b>이며, 외측이 내측보다 커야 합니다.
    <pre>donut pc 100 200</pre></dd>

  <dt><code>text &lt;점&gt; [정렬] &lt;높이&gt; "내용"</code></dt>
  <dd>정렬은 생략 가능하며 기본값은 <code>LB</code>입니다.
    <b>높이는 반드시 있어야 하고</b> 항상 따옴표 내용 바로 앞에 옵니다 — 가장 흔한 실수입니다.
    <p class="note">좌우 <code>L</code>(왼쪽) <code>C</code>(가운데) <code>R</code>(오른쪽) ·
       상하 <code>B</code>(아래) <code>M</code>(중간) <code>T</code>(위)<br>
       조합: LB CB RB LM CM RM LT CT RT</p>
    <pre>text p1 LT 50 "왼쪽 위"
text pc CM 80 "중앙"
text pc 80 "중앙"        <span class="ok"># 정렬 생략 — 가능</span>
text pc CM "중앙"        <span class="bad"># 높이 누락 — 오류</span></pre></dd>
</dl>`,
  },
  {
    title: '치수선',
    body: `
<p>문자 높이와 화살표 크기는 <b>도면 전체 크기에 맞춰 자동으로</b> 정해집니다. 높이 인자는 없습니다.</p>
<p class="note">한 도면 안의 치수선은 재는 거리와 무관하게 <b>모두 같은 크기</b>입니다 —
   300짜리 치수와 5000짜리 치수의 글자 크기가 같습니다.</p>
<p class="note"><b>[치수 설정]</b> 버튼에서 색·화살표 모양(화살표/사선 틱/없음)·보조선 옵셋·연장 길이·
   문자 크기와 도면 배율(DIMSCALE)을 바꿀 수 있습니다. 크기 값은 배율을 곱하기 전 값이고,
   배율을 <b>자동</b>으로 두면 도면 크기에 맞춰 정해집니다. 설정은 브라우저에 저장되며
   화면과 저장하는 DXF에 똑같이 적용됩니다.</p>
<p class="note">오프셋은 좌표가 아니라 <b>거리</b>입니다. 원점이 아니라 <b>첫 번째 점</b>에서 잽니다.</p>
<dl>
  <dt><code>hdim &lt;점1&gt; &lt;점2&gt; &lt;오프셋&gt;</code></dt>
  <dd>두 점의 <b>수평</b> 거리를 재는 치수선. 오프셋 양수=위, 음수=아래.
    <pre>hdim p1 p2 -150</pre></dd>

  <dt><code>ldim &lt;점1&gt; &lt;점2&gt; &lt;오프셋&gt;</code></dt>
  <dd>두 점의 <b>수직</b> 거리를 재는 치수선. 오프셋 양수=오른쪽, 음수=왼쪽.
    <pre>ldim p2 p3 150</pre></dd>

  <dt><code>adim &lt;점1&gt; &lt;점2&gt; &lt;오프셋&gt;</code></dt>
  <dd>두 점의 <b>실제</b> 거리를 재며 치수선이 두 점 방향에 나란합니다.
    오프셋은 그 선까지의 수직 거리이고, 점1→점2 방향의 왼쪽이 양수입니다.
    <pre>adim p1 p3 100</pre></dd>
</dl>`,
  },
  {
    title: '수학 함수',
    body: `
<p><code>sin cos tan asin acos atan atan2 sqrt hypot ceil floor abs round min max
int float radians degrees</code> 와 상수 <code>pi</code>.</p>
<p class="note">삼각함수는 <b>라디안</b>을 받습니다. 도 단위는 <code>radians(45)</code>로 변환하세요.</p>`,
  },
  {
    title: '제한 사항',
    body: `
<ul>
  <li>텍스트 내용은 큰따옴표로 감싸며, 내용 안에 큰따옴표를 넣을 수 없고 한 줄이어야 합니다.</li>
  <li>레이어, 색상, 선 굵기, 선 종류는 지원하지 않습니다.</li>
</ul>`,
  },
  {
    title: '전체 예제',
    body: `
<pre># 치수
B = 2000
H = 1000

# 점
p1 = 0, 0            <span class="ok"># 좌하</span>
p2 = B, 0            <span class="ok"># 우하</span>
p3 = B, H            <span class="ok"># 우상</span>
p4 = 0, H            <span class="ok"># 좌상</span>
pc = B/2, H/2        <span class="ok"># 중심</span>

rect p1 p3
line p1 p3
line p2 p4
circle pc H/4
text pc CM 80 "CENTER"

# 치수선은 도형 바깥으로 빼서 배치
hdim p1 p2 -200
ldim p2 p3 200</pre>`,
  },
];

/** Help content as an HTML string, ready to assign to innerHTML. */
export const SCRIPT_HELP_HTML = SECTIONS.map(
  (s) => `<section><h4>${s.title}</h4>${s.body}</section>`,
).join('\n');
