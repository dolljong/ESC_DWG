# ESC_DWG - 웹과 데스크탑에서 DXF 도면을 열어보자

CAD 도면 파일인 DXF를 별도의 CAD 프로그램 없이 바로 확인하고 싶었던 적이 있으신가요? **ESC_DWG**는 DXF 파일을 웹 브라우저와 데스크탑 환경 모두에서 볼 수 있는 오픈소스 뷰어 프로젝트입니다.

## 왜 만들었나

설계 현장에서 DXF 파일을 확인하려면 AutoCAD나 전용 뷰어를 설치해야 합니다. 하지만 단순히 도면을 "보기만" 하고 싶을 때는 무겁고 번거롭습니다. ESC_DWG는 이런 불편함을 해결하기 위해 두 가지 방식의 뷰어를 제공합니다.

## 두 가지 뷰어

### 1. 웹 뷰어 - 브라우저만 있으면 OK

웹 뷰어는 **dxf-viewer** 라이브러리와 **Three.js(WebGL)** 기반으로 동작합니다. 설치 없이 웹 브라우저에서 바로 DXF 파일을 열어볼 수 있습니다.

- WebGL 기반 고속 렌더링
- 한국어 텍스트 지원 (맑은 고딕 폰트 내장)
- 마우스 휠 줌, 드래그 패닝
- 레이어별 표시/숨기기

웹서버에 배포하면 팀원 누구나 링크 하나로 도면을 확인할 수 있습니다.

**개발 및 실행:**

```bash
cd web
npm install
npx vite
```

**빌드 후 웹서버에 배포:**

```bash
npx vite build
# dist/ 폴더를 웹서버에 업로드
```

### 2. 데스크탑 뷰어 - Python으로 바로 실행

데스크탑 뷰어는 **Python + Tkinter + matplotlib** 조합으로, Python만 설치되어 있으면 바로 실행할 수 있습니다.

- DXF 파일 열기 및 렌더링
- 마우스 드래그 패닝, 휠 줌
- 영역 선택 줌
- 스크립트 편집기로 도형 직접 생성

**실행:**

```bash
pip install ezdxf matplotlib
python desktop/ESC_DWG.py
```

## 스크립트로 도면 만들기

데스크탑 뷰어의 가장 큰 특징은 **스크립트 편집기**입니다. 왼쪽 패널에서 간단한 명령어로 도형을 프로그래밍 방식으로 생성할 수 있습니다.

```
# 변수 정의
H = 1000
B = 2000

# 점 정의
p1 = 0, 0
p2 = p1.x+B, p1.y
p3 = p2.x, p2.y+H
p4 = p1.x, p1.y+H
pc = B/2, H/2

# 도형 그리기
rect p1 p3
line p1 p3
line p2 p4
circle pc H/4
text pc CM 80 "CENTER"
```

변수, 점, 수학 함수를 조합해서 복잡한 도형도 만들 수 있습니다. 지원 도형: line, circle, arc, rect, polyline, solid, donut, text, 치수선(hdim, ldim, adim) 등.

## 프로젝트 구조

```
ESC_DWG/
├── web/          JS 웹 뷰어 (dxf-viewer + Three.js)
├── desktop/      Python 데스크탑 뷰어 (Tkinter + ezdxf + matplotlib)
└── samples/      테스트용 DXF 파일
```

웹 버전과 데스크탑 버전을 하나의 저장소에서 관리하며, `samples/` 폴더의 DXF 파일을 양쪽에서 공유합니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| 웹 뷰어 | JavaScript, dxf-viewer, Three.js, Vite |
| 데스크탑 뷰어 | Python, Tkinter, ezdxf, matplotlib |
| 빌드 | Vite (웹), pip (데스크탑) |

## 시작하기

GitHub에서 클론한 후 바로 사용할 수 있습니다.

```bash
git clone https://github.com/dolljong/ESC_DWG.git
cd ESC_DWG

# 웹 뷰어
cd web && npm install && npx vite

# 또는 데스크탑 뷰어
pip install ezdxf matplotlib
python desktop/ESC_DWG.py
```

CAD 프로그램 없이 DXF 도면을 빠르게 확인하고 싶다면, ESC_DWG를 한번 사용해 보세요.

**GitHub:** [https://github.com/dolljong/ESC_DWG](https://github.com/dolljong/ESC_DWG)
