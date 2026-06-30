# 전투력 측정기 — COMBAT POWER ANALYSIS SYSTEM v2.7

무작위 단어를 뽑아 구글 이미지를 검색하고, Claude AI가 그 이미지의 전투력을 진지하게 분석해주는 앱.

---

## 사전 준비물

- Node.js 18+
- Anthropic API 키
- Google Custom Search API 키 + 검색엔진 ID (CX)

---

## Google Custom Search 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트를 선택하고 **Custom Search API**를 활성화합니다.
2. [Programmable Search Engine](https://programmablesearchengine.google.com)에 접속해 새 검색엔진을 생성합니다.
   - "검색할 사이트"는 비워두고 **전체 웹 검색** 옵션을 켭니다.
3. 생성된 검색엔진 설정 → **이미지 검색 활성화** 토글을 켭니다.
4. 개요 페이지에서 **검색엔진 ID (CX)** 를 복사합니다.

---

## 설치 및 실행

```bash
# 의존성 설치
npm install express axios dotenv

# .env 파일 작성
# ANTHROPIC_API_KEY, GOOGLE_API_KEY, GOOGLE_CX 값을 채워넣으세요

# 서버 실행
node server.js
```

브라우저에서 http://localhost:3000 접속 후 **▶ 스캔 개시** 버튼을 누르세요.

---

## 파일 구조

```
project/
├── server.js     # Express 백엔드 (API 3개)
├── index.html    # 프론트엔드 단일 파일
├── .env          # API 키 설정 (git에 올리지 마세요)
└── README.md
```
