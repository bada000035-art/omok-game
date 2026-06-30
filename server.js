require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* =========================================================================
   오목 멀티플레이어 방 관리
   ========================================================================= */
const rooms = {};

function generateCode() {
  let code;
  do { code = Math.random().toString(36).substring(2, 6).toUpperCase(); }
  while (rooms[code]);
  return code;
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const code = generateCode();
    rooms[code] = { sockets: [socket], chars: [null, null] };
    socket.roomCode = code;
    socket.playerIdx = 0;
    socket.join(code);
    socket.emit('room-created', { code });
  });

  socket.on('join-room', ({ code }) => {
    const room = rooms[code];
    if (!room || room.sockets.length >= 2) {
      return socket.emit('join-error', { msg: '존재하지 않거나 이미 가득 찬 방입니다.' });
    }
    room.sockets.push(socket);
    socket.roomCode = code;
    socket.playerIdx = 1;
    socket.join(code);
    socket.emit('room-joined', { code });
    room.sockets[0].emit('opponent-joined');
  });

  socket.on('select-char', ({ charKey }) => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room) return;
    room.chars[socket.playerIdx] = charKey;
    socket.to(code).emit('opponent-char', { charKey });
    if (room.chars[0] && room.chars[1]) {
      io.to(code).emit('both-ready', { chars: room.chars });
    }
  });

  socket.on('game-sync', (state) => {
    socket.to(socket.roomCode).emit('game-sync', state);
  });

  socket.on('mp-restart', () => {
    socket.to(socket.roomCode).emit('mp-restart');
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      socket.to(code).emit('opponent-disconnected');
      delete rooms[code];
    }
  });
});

const WORDS = [
  // 동물
  '독수리', '두더지', '해파리', '판다', '전갈', '플라밍고', '악어', '문어', '하이에나', '나무늘보',
  // 음식
  '바나나', '마늘', '두리안', '삼겹살', '도넛', '마카롱', '된장찌개', '타코', '파인애플', '고구마',
  // 사물
  '소파', '우산', '수도꼭지', '전자레인지', '볼펜', '샹들리에', '지우개', '탁자', '냉장고', '화분',
  // 추상 개념
  '철학', '양자역학', '엔트로피', '무기력', '영원', '역설', '허무', '카오스', '직관', '숙명',
  // 장소
  '지하철역', '사막', '도서관', '폐공장', '블랙홀', '이케아', '무인도', '빙하', '지하벙커', '옥상',
  // 탈것 및 무기
  '탱크', '잠수함', '자전거', '킥보드', '투석기', '드론', '범선', '로켓', '포크레인', '인력거',
  // 감정/상태
  '분노', '졸음', '긴장', '황홀', '혼란', '무기력', '열정', '공포', '설렘', '권태',
  // 자연현상
  '번개', '눈사태', '쓰나미', '가뭄', '안개', '무지개', '토네이도', '일식', '홍수', '지진',
  // 직업/존재
  '회계사', '마법사', '소방관', '철학자', '닌자', '우주인', '노숙자', '요리사', '무당', '기사',
  // 기타
  '버블티', '클립', '알람시계', '픽셀', '문고리', '태엽', '형광등', '수건', '고무장갑', '단추',
  // 추가
  '포스트잇', '계산기', '솜사탕', '에스컬레이터', '신호등', '고양이캔', '수염', '주전자', '도마뱀', '낙지',
];

// GET /api/random-word
app.get('/api/random-word', (req, res) => {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  res.json({ word });
});

// GET /api/search-image?word=바나나
app.get('/api/search-image', async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: 'word is required' });

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_CX,
        q: word,
        searchType: 'image',
        num: 3,
      },
    });

    const items = response.data.items || [];
    if (items.length === 0) {
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    const [first, ...rest] = items;
    res.json({
      imageUrl: first.link,
      fallbackUrls: rest.map(i => i.link),
    });
  } catch (err) {
    console.error('Google Search error:', err.response?.data || err.message);
    res.status(500).json({ error: '이미지 검색 실패', detail: err.message });
  }
});

// POST /api/analyze  { imageUrl: string }
app.post('/api/analyze', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

  let imageBase64, mediaType;
  try {
    const imgRes = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    imageBase64 = Buffer.from(imgRes.data).toString('base64');
    const ct = imgRes.headers['content-type'] || 'image/jpeg';
    mediaType = ct.split(';')[0].trim();
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(mediaType)) mediaType = 'image/jpeg';
  } catch (err) {
    console.error('Image fetch error:', err.message);
    return res.status(502).json({ error: '이미지 다운로드 실패', detail: err.message });
  }

  const prompt = `이 이미지의 전투력을 측정하라. 모든 수치가 왜 그렇게 산출되었는지 반드시 구체적 근거를 들어 설명하라. 모든 항목을 한국어로 작성하고, 아래 JSON 구조만 반환하라. 분석은 진지하게, 결론은 황당하게.

반환할 JSON 구조:
{
  "total_power": (숫자, 1~999999),
  "dimensions": [
    { "name": "물리적 파괴력", "score": (1~100), "comment": "한 문장, 위트있게" },
    { "name": "정신적 압박감", "score": (1~100), "comment": "한 문장, 위트있게" },
    { "name": "생존 본능",    "score": (1~100), "comment": "한 문장, 위트있게" },
    { "name": "포스 방출량",  "score": (1~100), "comment": "한 문장, 위트있게" },
    { "name": "야망 지수",    "score": (1~100), "comment": "한 문장, 위트있게" }
  ],
  "analysis": "각 수치가 왜 그렇게 나왔는지 항목별로 구체적 근거를 들어 3~4문장으로 서술. 진지한 말투지만 내용은 황당하게.",
  "rank": "E / D / C / B / A / S / SS / SSS / 신의 영역 중 하나",
  "verdict": "2~3문장의 드라마틱한 최종 판정. 이 존재의 전투 잠재력에 대한 공식 선고."
}

JSON만 반환하고 마크다운 코드펜스는 쓰지 말 것.`;

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 1500, temperature: 1.0 },
        systemInstruction: {
          parts: [{ text: 'You are a combat power analyzer. Your tone is grave and official. Your conclusions are objectively absurd. Respond only in valid JSON with no markdown formatting.' }],
        },
      },
      { timeout: 60000 }
    );

    let raw = geminiRes.data.candidates[0].content.parts[0].text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI 분석 실패', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 가동 중: http://localhost:${PORT}`);
});
