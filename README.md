# ESC_DWG

DXF 파일 뷰어 프로젝트. 웹 버전(JS)과 데스크탑 버전(Python) 두 가지를 제공합니다.

## 프로젝트 구조

```
web/          JS 웹 뷰어 (dxf-viewer + Three.js)
desktop/      Python 데스크탑 뷰어 (Tkinter + ezdxf + matplotlib)
samples/      테스트용 DXF 파일
```

## 웹 뷰어 (web/)

브라우저에서 DXF 파일을 렌더링하는 WebGL 기반 뷰어입니다.

### 개발

```bash
cd web
npm install
npx vite
```

### 빌드 및 배포

```bash
npx vite build
```

`dist/` 폴더의 내용물을 웹서버에 업로드합니다.

## 데스크탑 뷰어 (desktop/)

- `ESC_DWG.py` - Tkinter GUI 기반 DXF 뷰어
- `dxfviewer.py` - matplotlib 기반 DXF 뷰어

### 실행

```bash
pip install ezdxf matplotlib
python desktop/ESC_DWG.py
```
