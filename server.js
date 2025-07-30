// 환경 변수 설정
require('dotenv').config();

// db.js를 import
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const { mongoose, Keyword } = require('./db');
const Schedule = require('./models/Schedule');
const RiskKeyword = require('./models/RiskKeyword');
const PartnerCondition = require('./models/PartnerCondition');
const TechTopic = require('./models/TechTopic');
const Setting = require('./models/Setting');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');
const nodemailer = require('nodemailer');
const kakaoBotRouter = require('./kakao-bot');
const path = require('path');
const logRouter = require('./routes/log');
const { router: dbRouter, autoDeleteOldData } = require('./routes/db');
const { router: mailRouter, sendMonthlyStatMail } = require('./routes/mail');
const UserActionLog = require('./models/UserActionLog');

// AI API 설정
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const app = express();

// 미들웨어 설정
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
app.options('*', cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
app.use(express.json());

// 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/public', express.static(path.join(__dirname, 'public')));

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'e037eF7sxB3VuJHBpay5';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'qkPfGHxNkN';

// 카카오톡 봇 설정
const KAKAO_BOT_TOKEN = process.env.KAKAO_BOT_TOKEN;
const KAKAO_BOT_SECRET = process.env.KAKAO_BOT_SECRET;

// 이메일 발송을 위한 transporter 설정
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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

// === AI 기반 자동 뉴스 수집: 리스크이슈 ===
async function collectRiskNews() {
  const today = await getKoreaToday();
  try {
    const keywords = (await RiskKeyword.find()).map(k => k.value);
    if (keywords.length === 0) {
      console.log(`[AI 수집][리스크이슈] ${today} 키워드가 없습니다. 수집을 건너뜁니다.`);
      return;
    }
    
    let allNews = [];
    let analysisResults = [];
    console.log(`[AI 수집][리스크이슈] ${today} 수집 시작 (키워드 ${keywords.length}개)`);
    
    // Perplexity AI를 사용한 뉴스 수집 및 분석
    if (keywords.length > 0) {
      try {
        console.log(`[AI 수집][리스크이슈] 키워드 "${keywords[0]}" Perplexity AI 수집 및 분석 시작`);
        const aiResult = await collectNewsWithPerplexity(keywords[0], 'risk');
        
        if (aiResult && aiResult.news && aiResult.news.length > 0) {
          console.log(`[AI 수집][리스크이슈] 키워드 "${keywords[0]}" 결과 ${aiResult.news.length}건 수집`);
          allNews.push(...aiResult.news);
          
          if (aiResult.analysis) {
            analysisResults.push(aiResult.analysis);
          }
        } else {
          console.log(`[AI 수집][리스크이슈] 키워드 "${keywords[0]}" 결과 없음`);
        }
      } catch (e) {
        console.error(`[AI 수집][리스크이슈] Perplexity AI 실패:`, e.message);
        // 네이버 뉴스 API로 폴백
        try {
          console.log(`[AI 수집][리스크이슈] 네이버 뉴스 API로 폴백`);
          const fallbackNews = await collectNewsWithNaver(keywords[0]);
          if (fallbackNews && fallbackNews.length > 0) {
            allNews.push(...fallbackNews);
          }
        } catch (fallbackError) {
          console.error(`[AI 수집][리스크이슈] 네이버 뉴스 API 폴백 실패:`, fallbackError.message);
        }
      }
    }
    
    if (allNews.length > 0) {
      try {
        fs.writeFileSync(`riskNews_${today}.json`, JSON.stringify({
          news: allNews,
          analysis: analysisResults,
          collectedAt: new Date().toISOString()
        }, null, 2));
        console.log(`[AI 수집][리스크이슈] ${today} 수집 완료 (총 ${allNews.length}건)`);
      } catch (fileError) {
        console.error(`[AI 수집][리스크이슈] 파일 저장 실패:`, fileError.message);
      }
      
      // === DB 저장 (AI 분석 결과 포함) ===
      let insertedRisk = 0;
      let duplicateRisk = 0;
      for (const item of allNews) {
        try {
          const newsData = {
            ...item,
            aiGeneratedAt: new Date(),
            analysisModel: 'perplexity-ai'
          };
          
          const result = await RiskNews.updateOne(
            { link: item.link },
            { $setOnInsert: newsData },
            { upsert: true }
          );
          
          if (result.upsertedCount > 0) {
            insertedRisk++;
          } else {
            duplicateRisk++;
          }
        } catch (dbError) {
          console.error(`[AI 수집][리스크이슈] DB 저장 실패 (${item.title}):`, dbError.message);
        }
      }
      console.log(`[AI 수집][리스크이슈] ${today} DB 저장 완료 (신규: ${insertedRisk}건, 중복: ${duplicateRisk}건)`);
    }
  } catch (error) {
    console.error(`[AI 수집][리스크이슈] 전체 프로세스 실패:`, error.message);
  }
}

// === 자동 뉴스 수집: 제휴처탐색 ===
async function collectPartnerNews() {
  const today = await getKoreaToday();
  try {
    const conds = (await PartnerCondition.find()).map(c => c.value);
    if (conds.length === 0) {
      console.log(`[자동수집][제휴처탐색] ${today} 검색 조건이 없습니다. 수집을 건너뜁니다.`);
      return;
    }
    
    console.log(`[AI 수집][제휴처탐색] ${today} 수집 시작 (조건 ${conds.length}개)`);
    
    for (const kw of conds) {
      try {
        console.log(`[AI 수집][제휴처탐색] 조건 "${kw}" Perplexity AI 수집 시작`);
        console.log(`[AI 수집][partner] 조건 "${kw}" Perplexity AI 분석 시작`);
        
        // Perplexity AI로 뉴스 수집 및 분석
        const aiNewsData = await collectNewsWithPerplexity(kw, 'partner');
        
        if (aiNewsData && aiNewsData.length > 0) {
          console.log(`[AI 수집][partner] 조건 "${kw}" 결과 ${aiNewsData.length}건 수집 및 분석 완료`);
          
          // === DB 저장 ===
          let insertedPartner = 0;
          let duplicatePartner = 0;
          
          for (const item of aiNewsData) {
            try {
              const result = await PartnerNews.updateOne(
                { link: item.link },
                { $set: item },
                { upsert: true }
              );
              
              if (result.upsertedCount > 0) {
                insertedPartner++;
              } else {
                duplicatePartner++;
              }
            } catch (dbError) {
              console.error(`[AI 수집][partner] DB 저장 실패 (${item.title}):`, dbError.message);
            }
          }
          
          console.log(`[AI 수집][partner] 조건 "${kw}" DB 저장 완료 (신규: ${insertedPartner}건, 중복: ${duplicatePartner}건)`);
        } else {
          console.log(`[AI 수집][partner] 조건 "${kw}" 결과 없음`);
        }
        
      } catch (e) {
        console.error(`[AI 수집][partner] 조건 "${kw}" 뉴스 수집 실패:`, e.message);
        
        // AI 수집 실패 시 네이버 뉴스 API로 폴백
        try {
          console.log(`[AI 수집][partner] 조건 "${kw}" 네이버 뉴스 API 폴백 시도`);
          const res = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: kw, display: 100, sort: 'date' },
            headers: {
              'X-Naver-Client-Id': NAVER_CLIENT_ID,
              'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
          });
          
          if (res.data.items && res.data.items.length > 0) {
            console.log(`[AI 수집][partner] 조건 "${kw}" 폴백 결과 ${res.data.items.length}건 수집`);
            
            let insertedPartner = 0;
            let duplicatePartner = 0;
            
            for (const item of res.data.items) {
              try {
                const result = await PartnerNews.updateOne(
                  { link: item.link },
                  { $setOnInsert: { ...item, keyword: kw } },
                  { upsert: true }
                );
                
                if (result.upsertedCount > 0) {
                  insertedPartner++;
                } else {
                  duplicatePartner++;
                }
              } catch (dbError) {
                console.error(`[AI 수집][partner] 폴백 DB 저장 실패 (${item.title}):`, dbError.message);
              }
            }
            
            console.log(`[AI 수집][partner] 조건 "${kw}" 폴백 DB 저장 완료 (신규: ${insertedPartner}건, 중복: ${duplicatePartner}건)`);
          }
        } catch (fallbackError) {
          console.error(`[AI 수집][partner] 조건 "${kw}" 폴백 실패:`, fallbackError.message);
        }
      }
    }
    
    console.log(`[AI 수집][제휴처탐색] ${today} 수집 완료`);
    
  } catch (error) {
    console.error(`[AI 수집][제휴처탐색] 전체 프로세스 에러:`, error);
    throw error;
  }
}

// === 자동 뉴스 수집: 신기술동향 ===
async function collectTechNews() {
  const today = await getKoreaToday();
  try {
    const topics = (await TechTopic.find()).map(t => t.value);
    if (topics.length === 0) {
      console.log(`[자동수집][신기술동향] ${today} 주제가 없습니다. 수집을 건너뜁니다.`);
      return;
    }
    
    console.log(`[AI 수집][신기술동향] ${today} 수집 시작 (주제 ${topics.length}개)`);
    
    for (const kw of topics) {
      try {
        console.log(`[AI 수집][신기술동향] 주제 "${kw}" Perplexity AI 수집 시작`);
        console.log(`[AI 수집][tech] 주제 "${kw}" Perplexity AI 분석 시작`);
        
        // Perplexity AI로 뉴스 수집 및 분석
        const aiNewsData = await collectNewsWithPerplexity(kw, 'tech');
        
        if (aiNewsData && aiNewsData.length > 0) {
          console.log(`[AI 수집][tech] 주제 "${kw}" 결과 ${aiNewsData.length}건 수집 및 분석 완료`);
          
          // === DB 저장 ===
          let insertedTech = 0;
          let duplicateTech = 0;
          
          for (const item of aiNewsData) {
            try {
              const result = await TechNews.updateOne(
                { link: item.link },
                { $set: item },
                { upsert: true }
              );
              
              if (result.upsertedCount > 0) {
                insertedTech++;
              } else {
                duplicateTech++;
              }
            } catch (dbError) {
              console.error(`[AI 수집][tech] DB 저장 실패 (${item.title}):`, dbError.message);
            }
          }
          
          console.log(`[AI 수집][tech] 주제 "${kw}" DB 저장 완료 (신규: ${insertedTech}건, 중복: ${duplicateTech}건)`);
        } else {
          console.log(`[AI 수집][tech] 주제 "${kw}" 결과 없음`);
        }
        
      } catch (e) {
        console.error(`[AI 수집][tech] 주제 "${kw}" 뉴스 수집 실패:`, e.message);
        
        // AI 수집 실패 시 네이버 뉴스 API로 폴백
        try {
          console.log(`[AI 수집][tech] 주제 "${kw}" 네이버 뉴스 API 폴백 시도`);
          const res = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: kw, display: 100, sort: 'date' },
            headers: {
              'X-Naver-Client-Id': NAVER_CLIENT_ID,
              'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
          });
          
          if (res.data.items && res.data.items.length > 0) {
            console.log(`[AI 수집][tech] 주제 "${kw}" 폴백 결과 ${res.data.items.length}건 수집`);
            
            let insertedTech = 0;
            let duplicateTech = 0;
            
            for (const item of res.data.items) {
              try {
                const result = await TechNews.updateOne(
                  { link: item.link },
                  { $setOnInsert: { ...item, keyword: kw } },
                  { upsert: true }
                );
                
                if (result.upsertedCount > 0) {
                  insertedTech++;
                } else {
                  duplicateTech++;
                }
              } catch (dbError) {
                console.error(`[AI 수집][tech] 폴백 DB 저장 실패 (${item.title}):`, dbError.message);
              }
            }
            
            console.log(`[AI 수집][tech] 주제 "${kw}" 폴백 DB 저장 완료 (신규: ${insertedTech}건, 중복: ${duplicateTech}건)`);
          }
        } catch (fallbackError) {
          console.error(`[AI 수집][tech] 주제 "${kw}" 폴백 실패:`, fallbackError.message);
        }
      }
    }
    
    console.log(`[AI 수집][신기술동향] ${today} 수집 완료`);
    
  } catch (error) {
    console.error(`[AI 수집][신기술동향] 전체 프로세스 에러:`, error);
    throw error;
  }
}

// === 동적 cron 스케줄 등록 함수 ===
async function scheduleNewsJob(isInit = false) {
  if (newsCronJob) {
    console.log(`[자동수집][크론] 기존 작업 중지 후 재설정 중...`);
    newsCronJob.stop();
  }
  
  const setting = await Setting.findOne({ key: 'newsUpdateTime' });
  const time = (setting && setting.value) ? setting.value : '08:00';
  const [h, m] = time.split(':').map(Number);
  const cronExp = `${m} ${h} * * *`;
  console.log(`[자동수집][크론] ${cronExp} (매일 ${time})에 자동 뉴스 수집 예약됨`);
  
  // 서버 시작 시에만 테스트 수집 실행
  if (isInit) {
    console.log(`[자동수집][크론] 서버 시작 시 테스트 수집 시도...`);
    try {
      await collectRiskNews();
      await collectPartnerNews();
      await collectTechNews();
      console.log(`[자동수집][크론] 서버 시작 시 테스트 수집 완료`);
    } catch (error) {
      console.error(`[자동수집][크론] 초기 테스트 수집 에러:`, error);
    }
  }
  
  newsCronJob = cron.schedule(cronExp, async () => {
    console.log(`[자동수집][크론] ${new Date().toLocaleString()} 자동 뉴스 수집 시작`);
    try {
      await collectRiskNews();
      await collectPartnerNews();
      await collectTechNews();
      await autoDeleteOldData(); // DB 자동 삭제 호출
      console.log(`[자동수집][크론] ${new Date().toLocaleString()} 자동 뉴스 수집 완료`);
    } catch (error) {
      console.error(`[자동수집][크론] 수집 중 에러 발생:`, error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Seoul" // 한국 시간대 명시
  });
  
  // 크론 작업이 올바르게 등록되었는지 확인
  console.log(`[자동수집][크론] 작업 상태: ${newsCronJob ? '활성화됨' : '비활성화됨'}`);
  
  // 5분마다 상태 확인을 위한 테스트 크론 작업
  cron.schedule('*/5 * * * *', () => {
    console.log(`[자동수집][크론] ${new Date().toLocaleString()} 크론 작업 상태 확인 - 정상 작동 중`);
  }, {
    scheduled: true,
    timezone: "Asia/Seoul"
  });
}

// === AI 기반 뉴스 수집 함수들 ===

// Perplexity AI를 활용한 뉴스 수집 및 분석
async function collectNewsWithPerplexity(keyword, category = 'risk') {
  try {
    console.log(`[AI 수집][${category}] 키워드 "${keyword}" Perplexity AI 분석 시작`);
    
    // 카테고리별 프롬프트 설정
    let categoryContext = '';
    switch (category) {
      case 'risk':
        categoryContext = '리스크 이슈 및 위험 요소에 중점을 두고 분석해주세요.';
        break;
      case 'partner':
        categoryContext = '제휴처 및 파트너사 관련 비즈니스 뉴스에 중점을 두고 분석해주세요.';
        break;
      case 'tech':
        categoryContext = '신기술 동향 및 혁신 기술에 중점을 두고 분석해주세요.';
        break;
      default:
        categoryContext = '일반적인 뉴스 분석을 진행해주세요.';
    }
    
    const prompt = `
    다음 키워드에 대한 최신 뉴스를 검색하고 종합 분석해주세요: "${keyword}"
    
    분석 컨텍스트: ${categoryContext}
    
    요구사항:
    1. 최근 24시간 내의 뉴스만 수집
    2. 각 뉴스에 대해 다음 정보를 JSON 형식으로 제공:
       {
         "title": "뉴스 제목",
         "link": "뉴스 링크",
         "source": "언론사명",
         "pubDate": "발행일",
         "aiSummary": "AI 생성 요약 (2-3문장)",
         "importanceScore": 1-10 점수,
         "sentiment": {"type": "positive/negative/neutral", "score": 0.0-1.0},
         "relatedKeywords": ["관련 키워드1", "관련 키워드2"],
         "trendAnalysis": "개별 뉴스 트렌드 분석",
         "futureOutlook": "개별 뉴스 향후 전망"
       }
    3. 최대 5개 뉴스만 제공
    4. 중요도 순으로 정렬
    5. 전체 뉴스에 대한 종합 분석 포함:
       {
         "trendAnalysis": "전체적인 트렌드 분석 (2-3문장)",
         "mainIssues": "주요 이슈 요약",
         "futureOutlook": "향후 전망 예측",
         "keyKeywords": ["핵심 키워드1", "핵심 키워드2"]
       }
    
    최종 응답 형식:
    {
      "news": [뉴스 배열],
      "analysis": {
        "trendAnalysis": "트렌드 분석",
        "mainIssues": "주요 이슈",
        "futureOutlook": "향후 전망",
        "keyKeywords": ["키워드1", "키워드2"]
      }
    }
    `;

    // Rate Limit 방지를 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await axios.post(PERPLEXITY_API_URL, {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: '당신은 뉴스 분석 전문가입니다. 요청된 JSON 형식에 맞춰 정확하고 구조화된 정보를 제공해주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log(`[AI 수집][${category}] Perplexity AI 응답 수신`);
    
    // JSON 파싱 시도
    try {
      const result = JSON.parse(aiResponse);
      
      // 뉴스 데이터 정규화 및 검증
      let newsData = [];
      if (result.news && Array.isArray(result.news)) {
        newsData = result.news.map(item => {
          // sentiment 객체 정규화
          let normalizedSentiment = { type: 'neutral', score: 0.5 };
          if (item.sentiment) {
            if (typeof item.sentiment === 'string') {
              normalizedSentiment = { type: item.sentiment, score: 0.5 };
            } else if (typeof item.sentiment === 'object') {
              normalizedSentiment = {
                type: item.sentiment.type || 'neutral',
                score: item.sentiment.score || 0.5
              };
            }
          }
          
          return {
            ...item,
            sentiment: normalizedSentiment,
            aiSummary: item.aiSummary || item.summary || 'AI 요약이 없습니다.',
            importanceScore: item.importanceScore || 5,
            relatedKeywords: item.relatedKeywords || [],
            aiGeneratedAt: new Date(),
            analysisModel: 'perplexity-ai'
          };
        });
      }
      
      // 응답 형식에 따라 처리
      if (newsData.length > 0) {
        return { news: newsData, analysis: result.analysis || null };
      } else if (Array.isArray(result)) {
        return { news: result, analysis: null };
      } else {
        return { news: [result], analysis: null };
      }
    } catch (parseError) {
      console.error(`[AI 수집][${category}] JSON 파싱 실패:`, parseError);
      console.error(`[AI 수집][${category}] 원본 응답:`, aiResponse);
      // 텍스트에서 뉴스 정보 추출 시도
      const extractedNews = extractNewsFromText(aiResponse, keyword);
      return { news: extractedNews, analysis: null };
    }
    
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`[AI 수집][${category}] Rate Limit 도달, 30초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      return await collectNewsWithPerplexity(keyword, category);
    }
    console.error(`[AI 수집][${category}] Perplexity AI API 호출 실패:`, error.message);
    if (error.response) {
      console.error(`[AI 수집][${category}] 응답 데이터:`, error.response.data);
    }
    throw error;
  }
}

// 텍스트에서 뉴스 정보 추출 (JSON 파싱 실패 시 대안)
function extractNewsFromText(text, keyword) {
  const newsItems = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('title') || line.includes('제목')) {
      const title = line.split(':')[1]?.trim() || line;
      const link = lines[i + 1]?.includes('http') ? lines[i + 1].trim() : '';
      
      newsItems.push({
        title: title.replace(/"/g, ''),
        link: link,
        keyword: keyword,
        pubDate: new Date().toISOString(),
        source: 'AI 수집',
        aiSummary: 'AI가 수집한 뉴스입니다.',
        importanceScore: 5,
        sentiment: { type: 'neutral', score: 0.5 },
        relatedKeywords: [keyword],
        aiGeneratedAt: new Date(),
        analysisModel: 'perplexity-ai'
      });
    }
  }
  
  return newsItems;
}

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

// 한국시간 기준 포맷 함수
function formatKST(date) {
    if (!date) return '-';
    const d = new Date(date instanceof Date ? date.getTime() : date);
    // UTC → KST 변환
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}년 ${mm}월 ${dd}일 ${hh}:${min}`;
}

// 이메일 발송 함수 (HTML 스타일)
async function sendScheduleEmail(action, schedule, prevSchedule = null) {
    try {
        const setting = await Setting.findOne({ key: 'emails' });
        if (!setting || !setting.value) return;
        const emails = JSON.parse(setting.value);
        if (emails.length === 0) return;

        let subject = '';
        let html = '';
        const nowStr = formatKST(new Date());
        if (action === 'create') {
            subject = '[미래성장처] 일정이 등록되었습니다';
            html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #1976d2; margin-bottom: 20px;">[업무일정 등록 알림]</h2>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>제목:</strong> ${schedule.title}</p>
                        <p style="margin: 5px 0;"><strong>일시:</strong> ${formatKST(schedule.start)}</p>
                        <p style="margin: 5px 0;"><strong>내용:</strong> ${schedule.content || '내용 없음'}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">등록일시: ${nowStr}</p>
                    <p style="color: #aaa; font-size: 12px;">이 메일은 자동으로 발송되었습니다.</p>
                    <div style="margin-top:20px;"><a href='https://myteamdashboard.vercel.app/index.html' style='color:#1976d2;'>대시보드 바로가기</a></div>
                </div>
            `;
        } else if (action === 'update') {
            subject = '[미래성장처] 일정이 변경되었습니다';
            html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #1976d2; margin-bottom: 20px;">[업무일정 변경 알림]</h2>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>제목:</strong> ${schedule.title}</p>
                        <p style="margin: 5px 0;"><strong>변경 전 일시:</strong> ${prevSchedule ? formatKST(prevSchedule.start) : '-'}</p>
                        <p style="margin: 5px 0;"><strong>변경 후 일시:</strong> ${formatKST(schedule.start)}</p>
                        <p style="margin: 5px 0;"><strong>변경 전 내용:</strong> ${prevSchedule ? (prevSchedule.content || '내용 없음') : '-'}</p>
                        <p style="margin: 5px 0;"><strong>변경 후 내용:</strong> ${schedule.content || '내용 없음'}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">변경일시: ${nowStr}</p>
                    <p style="color: #aaa; font-size: 12px;">이 메일은 자동으로 발송되었습니다.</p>
                    <div style="margin-top:20px;"><a href='https://myteamdashboard.vercel.app/index.html' style='color:#1976d2;'>대시보드 바로가기</a></div>
                </div>
            `;
        } else if (action === 'delete') {
            subject = '[미래성장처] 일정이 취소되었습니다';
            html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #d32f2f; margin-bottom: 20px;">[업무일정 취소 알림]</h2>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>제목:</strong> ${schedule.title}</p>
                        <p style="margin: 5px 0;"><strong>일시:</strong> ${formatKST(schedule.start)}</p>
                        <p style="margin: 5px 0;"><strong>내용:</strong> ${schedule.content || '내용 없음'}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">취소일시: ${nowStr}</p>
                    <p style="color: #aaa; font-size: 12px;">이 메일은 자동으로 발송되었습니다.</p>
                    <div style="margin-top:20px;"><a href='https://myteamdashboard.vercel.app/index.html' style='color:#1976d2;'>대시보드 바로가기</a></div>
                </div>
            `;
        }
        for (const recipient of emails) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: recipient.email,
                    subject: subject,
                    html: html
                });
                process.stdout.write(`[이메일 발송 성공] to: ${recipient.email}, subject: ${subject}\n`);
            } catch (err) {
                process.stdout.write(`[이메일 발송 실패] to: ${recipient.email}, error: ${err && err.message}\n`);
            }
        }
    } catch (error) {
        process.stdout.write(`[이메일 발송 실패] error: ${error && error.message}\n`);
    }
}

// 일정 등록
app.post('/api/schedules', async (req, res) => {
    try {
        // start 필드가 YYYY-MM-DDTHH:mm 형식의 한국시간 문자열로 들어온다고 가정
        let scheduleData = { ...req.body };
        if (scheduleData.start) {
            // 프론트에서 받은 한국시간 문자열을 Date 객체로 변환
            const kstDate = new Date(scheduleData.start);
            // KST → UTC 변환 (KST는 UTC+9)
            const utcDate = new Date(kstDate.getTime() - 9 * 60 * 60 * 1000);
            scheduleData.start = utcDate;
        }
        const schedule = await Schedule.create(scheduleData);
        await sendScheduleEmail('create', schedule);
        res.json(schedule);
    } catch (err) {
        res.status(500).json({ error: '일정 등록 실패' });
    }
});

// 일정 수정
app.put('/api/schedules/:id', async (req, res) => {
    try {
        const prevSchedule = await Schedule.findById(req.params.id);
        let updateData = { ...req.body };
        if (updateData.start) {
            const kstDate = new Date(updateData.start);
            const utcDate = new Date(kstDate.getTime() - 9 * 60 * 60 * 1000);
            updateData.start = utcDate;
        }
        const schedule = await Schedule.findByIdAndUpdate(req.params.id, updateData, { new: true });
        await sendScheduleEmail('update', schedule, prevSchedule);
        res.json(schedule);
    } catch (err) {
        res.status(500).json({ error: '일정 수정 실패' });
    }
});

// 일정 삭제
app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        await Schedule.findByIdAndDelete(req.params.id);
        await sendScheduleEmail('delete', schedule);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '일정 삭제 실패' });
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
    // 시간 변경 시 스케줄도 즉시 갱신 (테스트 수집은 실행하지 않음)
    await scheduleNewsJob(false);
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

// === 수동 뉴스 수집 테스트 API ===
app.post('/api/test-collect', async (req, res) => {
  try {
    console.log('[수동 테스트] 뉴스 수집 시작...');
    
    // 각 카테고리별 수집 실행
    await collectRiskNews();
    await collectPartnerNews();
    await collectTechNews();
    
    console.log('[수동 테스트] 뉴스 수집 완료');
    
    res.json({ 
      success: true, 
      message: '수동 뉴스 수집이 완료되었습니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[수동 테스트] 오류:', error);
    res.status(500).json({ error: '수동 뉴스 수집 실패' });
  }
});

// === 강제 스키마 재설정 API ===
app.post('/api/force-reset-schemas', async (req, res) => {
  try {
    console.log('[강제 스키마 재설정] 시작...');
    
    // MongoDB 연결 재설정
    await mongoose.disconnect();
    console.log('[강제 스키마 재설정] MongoDB 연결 해제 완료');
    
    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // MongoDB 재연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('[강제 스키마 재설정] MongoDB 재연결 완료');
    
    // 모든 뉴스 컬렉션 강제 삭제
    const collections = ['risknews', 'partnernews', 'technews'];
    for (const collectionName of collections) {
      try {
        await mongoose.connection.collection(collectionName).drop();
        console.log(`[강제 스키마 재설정] ${collectionName} 컬렉션 삭제 완료`);
      } catch (error) {
        console.log(`[강제 스키마 재설정] ${collectionName} 컬렉션이 없거나 이미 삭제됨`);
      }
    }
    
    console.log('[강제 스키마 재설정] 완료 - 모든 컬렉션이 새로운 스키마로 재생성됨');
    
    res.json({ 
      success: true, 
      message: '강제 스키마 재설정이 완료되었습니다. 다음 수집에서 새로운 스키마가 적용됩니다.'
    });
  } catch (error) {
    console.error('[강제 스키마 재설정] 오류:', error);
    res.status(500).json({ error: '강제 스키마 재설정 실패' });
  }
});

// === 스키마 업데이트 API (안전한 방법) ===
app.post('/api/update-schemas', async (req, res) => {
  try {
    console.log('[스키마 업데이트] 시작...');
    
    // 기존 데이터 백업
    const existingPartnerNews = await PartnerNews.find({});
    const existingTechNews = await TechNews.find({});
    const existingRiskNews = await RiskNews.find({});
    
    console.log(`[스키마 업데이트] 백업 완료 - PartnerNews: ${existingPartnerNews.length}건, TechNews: ${existingTechNews.length}건, RiskNews: ${existingRiskNews.length}건`);
    
    // 컬렉션 삭제 후 재생성 (스키마 강제 업데이트)
    await mongoose.connection.collection('partnernews').drop();
    await mongoose.connection.collection('technews').drop();
    await mongoose.connection.collection('risknews').drop();
    
    console.log('[스키마 업데이트] 컬렉션 삭제 완료');
    
    // 새로운 스키마로 데이터 재생성
    if (existingPartnerNews.length > 0) {
      const updatedPartnerNews = existingPartnerNews.map(item => ({
        ...item.toObject(),
        aiSummary: item.aiSummary || '기존 데이터',
        importanceScore: item.importanceScore || 5,
        sentiment: item.sentiment || { type: 'neutral', score: 0.5 },
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
        aiGeneratedAt: item.aiGeneratedAt || new Date(),
        analysisModel: item.analysisModel || 'legacy'
      }));
      
      await PartnerNews.insertMany(updatedPartnerNews);
      console.log(`[스키마 업데이트] PartnerNews ${updatedPartnerNews.length}건 재생성 완료`);
    }
    
    if (existingTechNews.length > 0) {
      const updatedTechNews = existingTechNews.map(item => ({
        ...item.toObject(),
        aiSummary: item.aiSummary || '기존 데이터',
        importanceScore: item.importanceScore || 5,
        sentiment: item.sentiment || { type: 'neutral', score: 0.5 },
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
        aiGeneratedAt: item.aiGeneratedAt || new Date(),
        analysisModel: item.analysisModel || 'legacy'
      }));
      
      await TechNews.insertMany(updatedTechNews);
      console.log(`[스키마 업데이트] TechNews ${updatedTechNews.length}건 재생성 완료`);
    }
    
    if (existingRiskNews.length > 0) {
      const updatedRiskNews = existingRiskNews.map(item => ({
        ...item.toObject(),
        aiSummary: item.aiSummary || '기존 데이터',
        importanceScore: item.importanceScore || 5,
        sentiment: item.sentiment || { type: 'neutral', score: 0.5 },
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
        aiGeneratedAt: item.aiGeneratedAt || new Date(),
        analysisModel: item.analysisModel || 'legacy'
      }));
      
      await RiskNews.insertMany(updatedRiskNews);
      console.log(`[스키마 업데이트] RiskNews ${updatedRiskNews.length}건 재생성 완료`);
    }
    
    res.json({ 
      success: true, 
      message: '스키마가 안전하게 업데이트되었습니다.',
      stats: {
        partnerNews: existingPartnerNews.length,
        techNews: existingTechNews.length,
        riskNews: existingRiskNews.length
      }
    });
  } catch (error) {
    console.error('[스키마 업데이트] 오류:', error);
    res.status(500).json({ error: '스키마 업데이트 실패' });
  }
});

// === AI 분석 결과 조회 API ===
app.get('/api/ai-analysis/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 5, days = 7 } = req.query;
    
    let model;
    switch (category) {
      case 'risk':
        model = RiskNews;
        break;
      case 'partner':
        model = PartnerNews;
        break;
      case 'tech':
        model = TechNews;
        break;
      default:
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const news = await model.find({
      aiGeneratedAt: { $gte: cutoffDate }
    })
    .sort({ aiGeneratedAt: -1 })
    .limit(parseInt(limit))
    .select('title link source importanceScore sentiment aiSummary relatedKeywords aiGeneratedAt');
    
    // AI 분석 통계
    const stats = {
      total: news.length,
      bySentiment: {
        positive: news.filter(n => n.sentiment?.type === 'positive').length,
        negative: news.filter(n => n.sentiment?.type === 'negative').length,
        neutral: news.filter(n => n.sentiment?.type === 'neutral').length
      },
      avgImportance: news.reduce((sum, n) => sum + (n.importanceScore || 5), 0) / news.length,
      topKeywords: news.reduce((acc, n) => {
        if (n.relatedKeywords) {
          n.relatedKeywords.forEach(kw => {
            acc[kw] = (acc[kw] || 0) + 1;
          });
        }
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      data: {
        news,
        stats,
        category
      }
    });
    
  } catch (error) {
    console.error('AI 분석 결과 조회 실패:', error);
    res.status(500).json({ error: 'AI 분석 결과 조회 중 오류가 발생했습니다.' });
  }
});

// === AI 분석 요약 API ===
app.get('/api/ai-summary/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { days = 7 } = req.query;
    
    let model;
    switch (category) {
      case 'risk':
        model = RiskNews;
        break;
      case 'partner':
        model = PartnerNews;
        break;
      case 'tech':
        model = TechNews;
        break;
      default:
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const recentNews = await model.find({
      aiGeneratedAt: { $gte: cutoffDate }
    })
    .sort({ aiGeneratedAt: -1 })
    .limit(10)
    .select('title aiSummary importanceScore sentiment relatedKeywords');
    
    if (recentNews.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: '최근 AI 분석된 뉴스가 없습니다.',
          trends: [],
          keywords: []
        }
      });
    }
    
    // Perplexity AI를 사용한 요약 생성
    try {
      const summary = await generateSummaryWithPerplexity(recentNews.slice(0, 5), category);
      res.json({
        success: true,
        data: summary || {
          summary: 'AI 분석 요약을 생성할 수 없습니다.',
          trends: [],
          keywords: []
        }
      });
    } catch (analysisError) {
      console.error('AI 요약 생성 실패:', analysisError);
      res.json({
        success: true,
        data: {
          summary: 'AI 요약 생성 중 오류가 발생했습니다.',
          trends: [],
          keywords: []
        }
      });
    }
    
  } catch (error) {
    console.error('AI 요약 조회 실패:', error);
    res.status(500).json({ error: 'AI 요약 조회 중 오류가 발생했습니다.' });
  }
});

// Perplexity AI를 사용한 요약 생성
async function generateSummaryWithPerplexity(newsData, category = 'risk') {
  try {
    console.log(`[AI 요약][${category}] Perplexity AI 요약 생성 시작 (${newsData.length}건)`);
    
    const prompt = `
    다음 뉴스 데이터를 분석하고 요약해주세요:
    
    뉴스 목록:
    ${JSON.stringify(newsData.slice(0, 5), null, 2)}
    
    분석 요구사항:
    1. 전체적인 트렌드 분석 (2-3문장)
    2. 주요 이슈 요약
    3. 향후 전망 예측
    4. 주목해야 할 키워드 추출
    
    JSON 형식으로 응답:
    {
      "trendAnalysis": "트렌드 분석",
      "mainIssues": "주요 이슈",
      "futureOutlook": "향후 전망",
      "keyKeywords": ["키워드1", "키워드2"]
    }
    `;

    // Rate Limit 방지를 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await axios.post(PERPLEXITY_API_URL, {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: '당신은 뉴스 분석 전문가입니다. 객관적이고 정확한 분석을 제공해주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const analysisResult = response.data.choices[0].message.content;
    console.log(`[AI 요약][${category}] Perplexity AI 요약 완료`);
    
    try {
      return JSON.parse(analysisResult);
    } catch (parseError) {
      console.error(`[AI 요약][${category}] JSON 파싱 실패:`, parseError);
      return { trendAnalysis: analysisResult };
    }
    
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`[AI 요약][${category}] Rate Limit 도달, 30초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      return await generateSummaryWithPerplexity(newsData, category);
    }
    console.error(`[AI 요약][${category}] Perplexity AI API 호출 실패:`, error.message);
    if (error.response) {
      console.error(`[AI 요약][${category}] 응답 데이터:`, error.response.data);
    }
    return null;
  }
}

// ===== 이메일 리스트 API =====
app.get('/api/emails', async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'emails' });
    let emails = [];
    if (setting && setting.value) {
      emails = JSON.parse(setting.value);
    }
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: '이메일 리스트 조회 실패' });
  }
});

app.post('/api/emails', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: '이름과 이메일을 입력하세요.' });
    let setting = await Setting.findOne({ key: 'emails' });
    let emails = [];
    if (setting && setting.value) {
      emails = JSON.parse(setting.value);
    }
    if (emails.some(e => e.email === email)) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    }
    emails.push({ name, email });
    if (setting) {
      setting.value = JSON.stringify(emails);
      await setting.save();
    } else {
      await Setting.create({ key: 'emails', value: JSON.stringify(emails) });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '이메일 추가 실패' });
  }
});

app.delete('/api/emails/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    let setting = await Setting.findOne({ key: 'emails' });
    let emails = [];
    if (setting && setting.value) {
      emails = JSON.parse(setting.value);
    }
    const newEmails = emails.filter(e => e.email !== email);
    if (setting) {
      setting.value = JSON.stringify(newEmails);
      await setting.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '이메일 삭제 실패' });
  }
});

app.use('/kakao', kakaoBotRouter);
console.log('카카오 라우터 등록됨');

app.get('/', (req, res) => {
  res.send('API 서버가 정상적으로 실행 중입니다.');
});

// calendar_images 폴더 static 서빙
app.use('/calendar_images', express.static(path.join(__dirname, 'calendar_images')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`[서버] http://localhost:${PORT} 에서 실행 중`);
  
  try {
    // MongoDB 연결 상태 확인
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) resolve();
        else mongoose.connection.once('connected', resolve);
      });
    }
    
    // 뉴스 키워드 데이터 확인
    const riskKeywords = await RiskKeyword.countDocuments();
    const partnerConditions = await PartnerCondition.countDocuments();
    const techTopics = await TechTopic.countDocuments();
    
    console.log(`[서버] 데이터 현황:`);
    console.log(`[서버] - 리스크이슈 키워드: ${riskKeywords}개`);
    console.log(`[서버] - 제휴처탐색 조건: ${partnerConditions}개`);
    console.log(`[서버] - 신기술동향 주제: ${techTopics}개`);
    
    // 크론 작업 초기화 - 한 번만 실행
    if (!newsCronJob) {  // 크론 작업이 없을 때만 초기화
      await scheduleNewsJob(true);
    }
  } catch (error) {
    console.error(`[서버] 초기화 중 오류 발생:`, error);
  }
});

// 공인된 KST 기준 오늘 날짜를 가져오는 비동기 함수
async function getKoreaToday() {
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Seoul');
        const data = await res.json();
        // data.datetime 예시: "2025-06-06T03:49:00.123456+09:00"
        return data.datetime.slice(0, 10); // "YYYY-MM-DD"
    } catch (e) {
        // 네트워크 오류 등 발생 시 fallback: 기존 방식
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const year = kst.getUTCFullYear();
        const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kst.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// pubDate에서 YYYY-MM-DD 추출 함수 (kakao-bot.js와 동일하게)
function extractDate(pubDate) {
    if (!pubDate) return '';
    // 예: 2025. 5. 19. 오전 9:02:00
    const match = pubDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (match) {
        const [, y, m, d] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // ISO 포맷(UTC)일 경우 9시간 더해서 KST로 변환
    const d = new Date(pubDate);
    if (isNaN(d)) return '';
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

// 공인된 KST 기준 오늘 날짜 반환 API
app.get('/api/korea-today', async (req, res) => {
    try {
        const today = await getKoreaToday();
        res.json({ today });
    } catch (e) {
        res.status(500).json({ error: '오늘 날짜 조회 실패', message: e.message });
    }
});

app.use('/api', logRouter);
app.use('/api', dbRouter);
app.use('/api', mailRouter);

// === 월말 통계 메일 발송 크론 ===
cron.schedule('50 23 28-31 * *', async () => {
  const now = new Date();
  // 말일만 실행
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrow.getDate() === 1) {
    await sendMonthlyStatMail();
    console.log('[크론] 월말 통계 메일 발송 완료');
  }
});

// === 대시보드 방문자수 기록 API ===
app.post('/api/visit', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    await UserActionLog.create({
      type: 'dashboard',
      action: 'visit',
      userAgent,
      timestamp: new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '방문 기록 실패', message: err.message });
  }
});

// === 대시보드 방문자수 통계 API ===
app.get('/api/stats/visit', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, month, total] = await Promise.all([
      UserActionLog.countDocuments({ type: 'dashboard', action: 'visit', timestamp: { $gte: startOfDay } }),
      UserActionLog.countDocuments({ type: 'dashboard', action: 'visit', timestamp: { $gte: startOfMonth } }),
      UserActionLog.countDocuments({ type: 'dashboard', action: 'visit' }),
    ]);
    res.json({ today, month, total });
  } catch (err) {
    res.status(500).json({ error: '방문자수 통계 조회 실패', message: err.message });
  }
});

// === Rate Limit 상태 확인 API ===
app.get('/api/rate-limit-status', async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      perplexity: {
        status: 'unknown',
        lastError: null,
        retryCount: 0
      },
      recommendations: []
    };
    
    // Perplexity Rate Limit 테스트
    try {
      const testResponse = await axios.post(PERPLEXITY_API_URL, {
        model: 'sonar-pro',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      }, {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      status.perplexity.status = 'available';
    } catch (error) {
      status.perplexity.status = error.response?.status === 429 ? 'rate_limited' : 'error';
      status.perplexity.lastError = error.message;
    }
    
    // 권장사항 추가
    if (status.perplexity.status === 'rate_limited') {
      status.recommendations.push('Perplexity Rate Limit 도달. 30초 후 재시도하세요.');
    }
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Rate Limit 상태 확인 실패:', error);
    res.status(500).json({ error: 'Rate Limit 상태 확인 중 오류가 발생했습니다.' });
  }
});