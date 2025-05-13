// db.js를 import
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const { Keyword } = require('./db');
const Schedule = require('./models/Schedule');
const RiskKeyword = require('./models/RiskKeyword');
const PartnerCondition = require('./models/PartnerCondition');
const TechTopic = require('./models/TechTopic');
const Setting = require('./models/Setting');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

const app = express();
app.use(cors());
app.use(express.json());

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'e037eF7sxB3VuJHBpay5';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'qkPfGHxNkN';

// === API 문서화 ===
/**
 * @api {get} /api/naver-news 네이버 뉴스 검색 API
 * @apiName GetNaverNews
 * @apiGroup News
 * @apiVersion 1.0.0
 * 
 * @apiParam {String} query 검색어 (필수, URL 인코딩 필요)
 * @apiParam {Number} [display=100] 한 번에 표시할 검색 결과 개수 (최대 100)
 * @apiParam {String} [sort=date] 정렬 방식 (date: 최신순, sim: 정확도순)
 * @apiParam {Number} [max=100] 최대 검색 결과 개수
 * 
 * @apiSuccess {Object[]} items 검색 결과 목록
 * @apiSuccess {String} items.title 뉴스 제목
 * @apiSuccess {String} items.link 뉴스 링크
 * @apiSuccess {String} items.description 뉴스 설명
 * @apiSuccess {String} items.pubDate 발행일
 * 
 * @apiError (400) {String} error 필수 파라미터 누락
 * @apiError (500) {String} error 서버 에러
 * 
 * @apiExample {curl} 예시:
 *     curl -X GET "http://localhost:4000/api/naver-news?query=%ED%85%8C%EC%8A%A4%ED%8A%B8&max=5"
 */

// === 스케줄러용 키워드 목록 (예시, 추후 동적 관리 가능) ===
const KEYWORDS = ['백종원', '지역개발사업'];
const NEWS_FILE = 'news-data.json';

let newsCronJob = null;

// === 자동 뉴스 수집: 리스크이슈 ===
async function collectRiskNews() {
  const today = new Date().toISOString().slice(0, 10);
  const keywords = (await RiskKeyword.find()).map(k => k.value);
  let allNews = [];
  for (const kw of keywords) {
    try {
      const res = await axios.get('https://openapi.naver.com/v1/search/news.json', {
        params: { query: kw, display: 100, sort: 'date' },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });
      if (res.data.items) {
        res.data.items.forEach(item => {
          if (!allNews.some(n => n.link === item.link)) {
            allNews.push({ ...item, keyword: kw });
          }
        });
      }
    } catch (e) {
      console.error(`[자동수집][리스크이슈] 키워드 ${kw} 뉴스 수집 실패:`, e.message);
    }
  }
  fs.writeFileSync(`riskNews_${today}.json`, JSON.stringify(allNews, null, 2));
}

// === 자동 뉴스 수집: 제휴처탐색 ===
async function collectPartnerNews() {
  const today = new Date().toISOString().slice(0, 10);
  const conds = (await PartnerCondition.find()).map(c => c.value);
  let allNews = [];
  for (const kw of conds) {
    try {
      const res = await axios.get('https://openapi.naver.com/v1/search/news.json', {
        params: { query: kw, display: 100, sort: 'date' },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });
      if (res.data.items) {
        res.data.items.forEach(item => {
          if (!allNews.some(n => n.link === item.link)) {
            allNews.push({ ...item, keyword: kw });
          }
        });
      }
    } catch (e) {
      console.error(`[자동수집][제휴처탐색] 조건 ${kw} 뉴스 수집 실패:`, e.message);
    }
  }
  fs.writeFileSync(`partnerNews_${today}.json`, JSON.stringify(allNews, null, 2));
}

// === 자동 뉴스 수집: 신기술동향 ===
async function collectTechNews() {
  const today = new Date().toISOString().slice(0, 10);
  const topics = (await TechTopic.find()).map(t => t.value);
  let allNews = [];
  for (const kw of topics) {
    try {
      const res = await axios.get('https://openapi.naver.com/v1/search/news.json', {
        params: { query: kw, display: 100, sort: 'date' },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });
      if (res.data.items) {
        res.data.items.forEach(item => {
          if (!allNews.some(n => n.link === item.link)) {
            allNews.push({ ...item, keyword: kw });
          }
        });
      }
    } catch (e) {
      console.error(`[자동수집][신기술동향] 주제 ${kw} 뉴스 수집 실패:`, e.message);
    }
  }
  fs.writeFileSync(`techNews_${today}.json`, JSON.stringify(allNews, null, 2));
}

// === 동적 cron 스케줄 등록 함수 ===
async function scheduleNewsJob() {
  if (newsCronJob) newsCronJob.stop();
  const setting = await Setting.findOne({ key: 'newsUpdateTime' });
  const time = (setting && setting.value) ? setting.value : '07:00';
  const [h, m] = time.split(':').map(Number);
  const cronExp = `${m} ${h} * * *`;
  newsCronJob = cron.schedule(cronExp, async () => {
    await collectRiskNews();
    await collectPartnerNews();
    await collectTechNews();
  });
}

// 서버 시작 시 스케줄 등록
scheduleNewsJob();

// 최신 뉴스 파일 반환
app.get('/api/naver-news-latest', (req, res) => {
  if (fs.existsSync(NEWS_FILE)) {
    const data = fs.readFileSync(NEWS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } else {
    res.json({ date: null, news: [] });
  }
});

// 기존 프록시 엔드포인트(직접 조회)
app.get('/api/naver-news', async (req, res) => {
  const { query, display = 100, sort = 'date', max = 100 } = req.query;
  
  // 필수 파라미터 검증
  if (!query) {
    return res.status(400).json({ 
      error: 'query 파라미터가 필요합니다.',
      message: '검색어를 입력해주세요.',
      example: 'http://localhost:4000/api/naver-news?query=테스트&max=5'
    });
  }

  // 파라미터 유효성 검증
  const displayNum = Math.min(Math.max(Number(display), 1), 100);
  const maxNum = Math.min(Number(max), 1000); // 네이버 API 최대 1000개 제한
  
  try {
    let allItems = [];
    let start = 1;
    let callCount = 0;
    
    if (maxNum <= 100) {
      // 100개 이하 요청 시 한 번만 호출
      const params = { query, display: maxNum, start, sort };
      const result = await axios.get('https://openapi.naver.com/v1/search/news.json', {
        params,
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });
      allItems = result.data.items || [];
    } else {
      // 100개 초과 요청 시 기존 방식대로 루프
      while (allItems.length < maxNum && start <= 1000) {
        callCount++;
        const params = { query, display: displayNum, start, sort };
        try {
          const result = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params,
            headers: {
              'X-Naver-Client-Id': NAVER_CLIENT_ID,
              'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
          });
          const items = result.data.items || [];
          if (items.length > 0) {
            items.forEach(item => {
              if (!allItems.some(n => n.link === item.link)) {
                allItems.push(item);
              }
            });
            if (items.length < displayNum) break;
            start += displayNum;
          } else {
            break;
          }
        } catch (apiError) {
          console.error('[프록시] 네이버 API 호출 실패:', apiError.message);
          return res.status(500).json({
            error: '네이버 API 호출 실패',
            message: apiError.message,
            details: apiError.response?.data || '알 수 없는 오류'
          });
        }
      }
    }
    
    res.json({ items: allItems.slice(0, maxNum) });
    
  } catch (err) {
    console.error('[프록시] 에러:', err.message);
    res.status(500).json({ 
      error: '서버 에러',
      message: err.message
    });
  }
});

// 키워드 전체 조회
app.get('/api/keywords', async (req, res) => {
  try {
    const keywords = await Keyword.find();
    res.json(keywords);
  } catch (err) {
    console.error('[키워드 조회] 에러:', err.message);
    res.status(500).json({ 
      error: '키워드 조회 실패',
      message: err.message
    });
  }
});

// 키워드 추가
app.post('/api/keywords', async (req, res) => {
  const { value } = req.body;
  
  if (!value) {
    return res.status(400).json({ 
      error: '키워드 값이 필요합니다.',
      message: '키워드를 입력해주세요.'
    });
  }
  
  try {
    const keyword = new Keyword({ value });
    await keyword.save();
    res.json(keyword);
  } catch (err) {
    console.error('[키워드 추가] 에러:', err.message);
    res.status(500).json({ 
      error: '키워드 추가 실패',
      message: err.message
    });
  }
});

// === 스케줄(업무일정표) CRUD API ===
// 전체 일정 조회
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find().sort({ start: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: '일정 조회 실패', message: err.message });
  }
});

// 일정 추가
app.post('/api/schedules', async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    await schedule.save();
    res.json(schedule);
  } catch (err) {
    res.status(400).json({ error: '일정 추가 실패', message: err.message });
  }
});

// 일정 수정
app.put('/api/schedules/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) return res.status(404).json({ error: '일정 없음' });
    res.json(schedule);
  } catch (err) {
    res.status(400).json({ error: '일정 수정 실패', message: err.message });
  }
});

// 일정 삭제
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ error: '일정 없음' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '일정 삭제 실패', message: err.message });
  }
});

// === 리스크 이슈 키워드 CRUD API ===
// 전체 키워드 조회
app.get('/api/risk-keywords', async (req, res) => {
  try {
    const keywords = await RiskKeyword.find().sort({ createdAt: 1 });
    res.json(keywords);
  } catch (err) {
    res.status(500).json({ error: '키워드 조회 실패', message: err.message });
  }
});

// 키워드 추가
app.post('/api/risk-keywords', async (req, res) => {
  try {
    const keyword = new RiskKeyword(req.body);
    await keyword.save();
    res.json(keyword);
  } catch (err) {
    res.status(400).json({ error: '키워드 추가 실패', message: err.message });
  }
});

// 키워드 삭제
app.delete('/api/risk-keywords/:id', async (req, res) => {
  try {
    const keyword = await RiskKeyword.findByIdAndDelete(req.params.id);
    if (!keyword) return res.status(404).json({ error: '키워드 없음' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '키워드 삭제 실패', message: err.message });
  }
});

// === 제휴처 조건 CRUD API ===
// 전체 조건 조회
app.get('/api/partner-conditions', async (req, res) => {
  try {
    const conditions = await PartnerCondition.find().sort({ createdAt: 1 });
    res.json(conditions);
  } catch (err) {
    res.status(500).json({ error: '조건 조회 실패', message: err.message });
  }
});

// 조건 추가
app.post('/api/partner-conditions', async (req, res) => {
  try {
    const condition = new PartnerCondition(req.body);
    await condition.save();
    res.json(condition);
  } catch (err) {
    res.status(400).json({ error: '조건 추가 실패', message: err.message });
  }
});

// 조건 삭제
app.delete('/api/partner-conditions/:id', async (req, res) => {
  try {
    const condition = await PartnerCondition.findByIdAndDelete(req.params.id);
    if (!condition) return res.status(404).json({ error: '조건 없음' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '조건 삭제 실패', message: err.message });
  }
});

// === 신기술 주제 CRUD API ===
// 전체 주제 조회
app.get('/api/tech-topics', async (req, res) => {
  try {
    const topics = await TechTopic.find().sort({ createdAt: 1 });
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: '주제 조회 실패', message: err.message });
  }
});

// 주제 추가
app.post('/api/tech-topics', async (req, res) => {
  try {
    const topic = new TechTopic(req.body);
    await topic.save();
    res.json(topic);
  } catch (err) {
    res.status(400).json({ error: '주제 추가 실패', message: err.message });
  }
});

// 주제 삭제
app.delete('/api/tech-topics/:id', async (req, res) => {
  try {
    const topic = await TechTopic.findByIdAndDelete(req.params.id);
    if (!topic) return res.status(404).json({ error: '주제 없음' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '주제 삭제 실패', message: err.message });
  }
});

// === 뉴스 갱신 시간 설정 API ===
// 조회
app.get('/api/settings/news-update-time', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'newsUpdateTime' });
    res.json({ value: setting ? setting.value : '07:00' });
  } catch (err) {
    res.status(500).json({ error: '설정 조회 실패', message: err.message });
  }
});

// 저장
app.post('/api/settings/news-update-time', async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: '값이 필요합니다.' });
    const setting = await Setting.findOneAndUpdate(
      { key: 'newsUpdateTime' },
      { value },
      { upsert: true, new: true }
    );
    // 시간 변경 시 스케줄도 즉시 갱신
    await scheduleNewsJob();
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: '설정 저장 실패', message: err.message });
  }
});

// === 리스크이슈 뉴스 저장/조회 API ===
app.post('/api/risk-news', async (req, res) => {
  try {
    const newsArr = req.body.items || [];
    let inserted = 0;
    for (const item of newsArr) {
      try {
        await RiskNews.updateOne(
          { link: item.link },
          { $setOnInsert: item },
          { upsert: true }
        );
        inserted++;
      } catch (e) { /* 중복 등 무시 */ }
    }
    res.json({ inserted });
  } catch (err) {
    res.status(500).json({ error: '저장 실패', message: err.message });
  }
});
app.get('/api/risk-news', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const news = await RiskNews.find({}).sort({ pubDate: -1 });
  res.json(news);
});
// === 제휴처탐색 뉴스 저장/조회 API ===
app.post('/api/partner-news', async (req, res) => {
  try {
    const newsArr = req.body.items || [];
    let inserted = 0;
    for (const item of newsArr) {
      try {
        await PartnerNews.updateOne(
          { link: item.link },
          { $setOnInsert: item },
          { upsert: true }
        );
        inserted++;
      } catch (e) { /* 중복 등 무시 */ }
    }
    res.json({ inserted });
  } catch (err) {
    res.status(500).json({ error: '저장 실패', message: err.message });
  }
});
app.get('/api/partner-news', async (req, res) => {
  const news = await PartnerNews.find({}).sort({ pubDate: -1 });
  res.json(news);
});
// === 신기술동향 뉴스 저장/조회 API ===
app.post('/api/tech-news', async (req, res) => {
  try {
    const newsArr = req.body.items || [];
    let inserted = 0;
    for (const item of newsArr) {
      try {
        await TechNews.updateOne(
          { link: item.link },
          { $setOnInsert: item },
          { upsert: true }
        );
        inserted++;
      } catch (e) { /* 중복 등 무시 */ }
    }
    res.json({ inserted });
  } catch (err) {
    res.status(500).json({ error: '저장 실패', message: err.message });
  }
});
app.get('/api/tech-news', async (req, res) => {
  const news = await TechNews.find({}).sort({ pubDate: -1 });
  res.json(news);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`[서버] http://localhost:${PORT} 에서 실행 중`);
});