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
const BotOutbox = require('./models/BotOutbox');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');
const RiskAnalysisReport = require('./models/RiskAnalysisReport');
const PartnerAnalysisReport = require('./models/PartnerAnalysisReport');
const TechAnalysisReport = require('./models/TechAnalysisReport');
const nodemailer = require('nodemailer');
const kakaoBotRouter = require('./kakao-bot');
const path = require('path');
const logRouter = require('./routes/log');
const { router: dbRouter, autoDeleteOldData } = require('./routes/db');
const { router: mailRouter, sendMonthlyStatMail } = require('./routes/mail');
const weightSettingsRouter = require('./routes/weightSettings');
const hotTopicAnalysisRouter = require('./routes/hotTopicAnalysis');
const UserActionLog = require('./models/UserActionLog');
const PDFGenerator = require('./services/pdfGenerator');
const NewsClippingPdfGenerator = require('./services/newsClippingPdfGenerator');
const botAuthMiddleware = require('./middleware/botAuth');

// PDF 생성기 인스턴스
const pdfGenerator = new PDFGenerator();
const newsClippingPdfGenerator = new NewsClippingPdfGenerator();

// AI API 설정
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const app = express();

// 미들웨어 설정
// CORS 설정: Vercel 도메인 및 모든 origin 허용
const allowedOrigins = [
    'https://myteamdashboard.onrender.com',
    /\.vercel\.app$/,  // 모든 Vercel 도메인 허용
    /\.netlify\.app$/,  // Netlify 도메인도 허용 (선택사항)
    'http://localhost:8002',  // 로컬 개발용
    'http://localhost:4000'   // 로컬 개발용
];

app.use(cors({ 
    origin: function (origin, callback) {
        // origin이 없으면 (같은 도메인 요청) 허용
        if (!origin) return callback(null, true);
        
        // 허용된 origin 목록 확인
        const isAllowed = allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
                return origin === allowed;
            } else if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return false;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            // 모든 origin 허용 (개발 중)
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));
app.options('*', cors({ 
    origin: true,  // 모든 origin 허용
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));

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

// === 공통 DB 저장 함수 ===
async function saveNewsToDB(newsItems, model, category, keywords) {
  let inserted = 0;
  let duplicate = 0;
  let skipped = 0;
  const today = await getKoreaToday();
  
  console.log(`[DB 저장][${category}] 금일 기준: ${today}, 총 ${newsItems.length}건 처리 시작`);
  
  for (const item of newsItems) {
    try {

      
      // 1. AI 요약이 있는 뉴스만 DB에 저장
      if (!item.aiSummary) {
        console.log(`[AI 수집][${category}] AI 요약이 없는 뉴스 건너뜀: ${item.title}`);
        skipped++;
        continue;
      }
      
      // 2. 발행일이 오늘 또는 어제인 뉴스만 저장 (최근 24시간)
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      const yesterdayDateStr = yesterdayDate.toISOString().split('T')[0];
      
      if (itemDateStr !== todayDateStr && itemDateStr !== yesterdayDateStr) {
        console.log(`[AI 수집][${category}] 최근 24시간이 아닌 뉴스 건너뜀: ${item.title} (${itemDateStr} vs ${todayDateStr}/${yesterdayDateStr})`);
        skipped++;
        continue;
      }
      
      // 3. 중복 체크: (링크와 발행일이 동일) OR (제목과 발행일이 동일)한 기존 데이터 확인
      const existingNews = await model.findOne({
        $or: [
          { link: item.link, pubDate: item.pubDate },
          { title: item.title, pubDate: item.pubDate }
        ]
      });
      
      if (existingNews) {
        console.log(`[AI 수집][${category}] 중복 뉴스 건너뜀: ${item.title}`);
        duplicate++;
        continue;
      }
      
      const newsData = {
        ...item,
        collectedDate: today, // 수집일자 추가
        keyword: keywords.join(', '),
        source: item.source || 'AI 분석',
        relatedKeywords: item.relatedKeywords || keywords,
        analysisModel: 'perplexity-ai'
      };
      
      const result = await model.updateOne(
        { link: item.link },
        { $setOnInsert: newsData },
        { upsert: true }
      );
      
      if (result.upsertedCount > 0) {
        inserted++;
      } else {
        duplicate++;
      }
    } catch (dbError) {
      console.error(`[AI 수집][${category}] DB 저장 실패 (${item.title}):`, dbError.message);
    }
  }
  
  console.log(`[DB 저장][${category}] 완료 - 신규: ${inserted}건, 중복: ${duplicate}건, 제외: ${skipped}건`);
  return { inserted, duplicate, skipped };
}

// === 서버 내부 통계 기록 함수 ===
async function logServerAction(action, meta = {}) {
  try {
    // 퍼플렉시티 관련 액션인지 확인
    const isPerplexityAction = action.startsWith('퍼플렉시티');
    const type = isPerplexityAction ? 'perplexity' : 'news';
    
    const log = new UserActionLog({ 
      type, 
      action, 
      userId: 'system', 
      userAgent: 'news-collector', 
      meta 
    });
    await log.save();
  } catch (e) {
    console.error('서버 통계 기록 실패:', e.message);
  }
}

// === 공통 분석보고서 생성 함수 ===
async function createAnalysisReport(today, category, analysisContent, reportModel, savedNewsCount = 0) {
  try {
    // analysisContent가 객체인 경우 JSON으로 저장 (프론트엔드에서 구조화된 렌더링을 위해)
    let analysisText = analysisContent;
    if (typeof analysisContent === 'object' && analysisContent !== null) {
      // 객체를 JSON 문자열로 저장 (프론트엔드에서 파싱하여 구조화된 렌더링)
      analysisText = JSON.stringify(analysisContent, null, 2);
    } else if (typeof analysisContent === 'string') {
      analysisText = analysisContent;
    } else {
      analysisText = `${category} 수집 완료`;
    }
    
    const reportData = {
      date: new Date(today),
      collectedDate: today, // 수집일자 추가
      analysis: analysisText,
      totalNewsCount: savedNewsCount  // 실제 저장된 뉴스 건수 사용
    };
    
    await reportModel.findOneAndUpdate(
      { date: new Date(today) },
      reportData,
      { upsert: true, new: true }
    );
    console.log(`[AI 수집][${category}] ${today} AI 분석 보고서 생성 완료`);
  } catch (reportError) {
    console.error(`[AI 수집][${category}] AI 분석 보고서 생성 실패:`, reportError.message);
  }
}

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
    console.log(`[AI 수집][리스크이슈] ${today} 수집 시작 (키워드 ${keywords.length}개)`);
    
    let aiResult = null;
    // Perplexity AI를 사용한 뉴스 수집 및 분석
    if (keywords.length > 0) {
      try {
        console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" Perplexity AI 수집 및 분석 시작`);
        aiResult = await collectNewsWithPerplexity(keywords, 'risk');
        
        // AI분석보고서는 DB 저장 후 조건부로 생성 (여기서는 임시로 생성하지 않음)
        if (aiResult && aiResult.analysis) {
          console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" AI분석보고서 준비됨`);
        } else {
          console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" AI분석보고서 없음`);
        }
        
        if (aiResult && aiResult.news && aiResult.news.length > 0) {
                // 실제 뉴스가 있는지 확인 (undefined 필드가 아닌 유효한 뉴스)
      const validNews = aiResult.news.filter(item => 
        item && item.title && item.title.length > 5 && item.aiSummary && item.aiSummary.length > 10
      );
          
          if (validNews.length > 0) {
            console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" 결과 ${validNews.length}건 수집`);
            allNews.push(...validNews);
          } else {
            console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" 유효한 뉴스 없음`);
          }
        } else {
          console.log(`[AI 수집][리스크이슈] 키워드 "${keywords.join(', ')}" 뉴스 없음`);
        }
      } catch (e) {
        console.error(`[AI 수집][리스크이슈] Perplexity AI 실패:`, e.message);
        console.log(`[AI 수집][리스크이슈] 수집된 뉴스가 없습니다.`);
      }
    }
    
    if (allNews.length > 0) {
      try {
        fs.writeFileSync(`riskNews_${today}.json`, JSON.stringify({
          news: allNews,
          analysis: aiResult ? aiResult.analysis : null,
          collectedAt: new Date().toISOString()
        }, null, 2));
        console.log(`[AI 수집][리스크이슈] ${today} 수집 완료 (총 ${allNews.length}건)`);
      } catch (fileError) {
        console.error(`[AI 수집][리스크이슈] 파일 저장 실패:`, fileError.message);
      }
      
      // === DB 저장 (AI 분석 결과 포함) ===
      const { inserted: insertedRisk, duplicate: duplicateRisk, skipped: skippedRisk } = await saveNewsToDB(allNews, RiskNews, '리스크이슈', keywords);
      console.log(`[AI 수집][리스크이슈] ${today} DB 저장 완료 (신규: ${insertedRisk}건, 중복: ${duplicateRisk}건, 제외: ${skippedRisk}건)`);
      
      // 통계 기록 (퍼플렉시티만)
      await logServerAction('퍼플렉시티리스크뉴스수집', { count: insertedRisk, keywords: keywords.join(', ') });
      
      // 금일 뉴스가 1건이라도 있을 때만 분석보고서 저장
      if (aiResult && aiResult.analysis && insertedRisk > 0) {
        console.log(`[AI 수집][리스크이슈] 금일 뉴스 ${insertedRisk}건 저장됨 - 분석보고서 생성`);
        await createAnalysisReport(today, '리스크이슈', aiResult.analysis, RiskAnalysisReport, insertedRisk);
        
        // AI 분석보고서 생성 통계 기록 (퍼플렉시티만)
        await logServerAction('퍼플렉시티AI분석보고서생성', { category: '리스크이슈', count: insertedRisk });
      } else if (insertedRisk === 0) {
        console.log(`[AI 수집][리스크이슈] 금일 뉴스 없음 - 분석보고서 생성 건너뜀`);
      } else {
        console.log(`[AI 수집][리스크이슈] 분석보고서 없음 - 생성 건너뜀`);
      }
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
    
    if (conds.length > 0) {
      try {
        console.log(`[AI 수집][제휴처탐색] 조건 "${conds.join(', ')}" Perplexity AI 수집 시작`);
        console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" Perplexity AI 분석 시작`);
        
        // Perplexity AI로 뉴스 수집 및 분석
        const aiNewsData = await collectNewsWithPerplexity(conds, 'partner');
        
        // AI분석보고서는 금일 뉴스가 있을 때만 생성 (여기서는 임시로 생성하지 않음)
        if (aiNewsData && aiNewsData.analysis) {
          console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" AI분석보고서 준비됨`);
        } else {
          console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" AI분석보고서 없음`);
        }
        
        if (aiNewsData && aiNewsData.news && aiNewsData.news.length > 0) {
          // 실제 뉴스가 있는지 확인 (undefined 필드가 아닌 유효한 뉴스)
          const validNews = aiNewsData.news.filter(item => 
            item && item.title && item.link && item.aiSummary
          );
          
          if (validNews.length > 0) {
            console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" 결과 ${validNews.length}건 수집 및 분석 완료`);
          
            // === DB 저장 ===
            const { inserted: insertedPartner, duplicate: duplicatePartner, skipped: skippedPartner } = await saveNewsToDB(validNews, PartnerNews, '제휴처탐색', conds);
            console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" DB 저장 완료 (신규: ${insertedPartner}건, 중복: ${duplicatePartner}건, 제외: ${skippedPartner}건)`);
            
            // 통계 기록 (퍼플렉시티만)
            await logServerAction('퍼플렉시티제휴처뉴스수집', { count: insertedPartner, conditions: conds.join(', ') });
            
            // 금일 뉴스가 1건이라도 있을 때만 분석보고서 저장
            if (aiNewsData.analysis && insertedPartner > 0) {
              console.log(`[AI 수집][제휴처탐색] 금일 뉴스 ${insertedPartner}건 저장됨 - 분석보고서 생성`);
              await createAnalysisReport(today, '제휴처탐색', aiNewsData.analysis, PartnerAnalysisReport, insertedPartner);
              
              // AI 분석보고서 생성 통계 기록 (퍼플렉시티만)
              await logServerAction('퍼플렉시티AI분석보고서생성', { category: '제휴처탐색', count: insertedPartner });
            } else {
              console.log(`[AI 수집][제휴처탐색] 금일 뉴스 없음 - 분석보고서 생성 건너뜀`);
            }
          } else {
            console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" 유효한 뉴스 없음`);
          }
        } else {
          console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" 뉴스 없음`);
        }
        
              } catch (e) {
          console.error(`[AI 수집][partner] 조건 "${conds.join(', ')}" 뉴스 수집 실패:`, e.message);
          console.log(`[AI 수집][partner] 조건 "${conds.join(', ')}" 수집된 뉴스가 없습니다.`);
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
    
    if (topics.length > 0) {
      try {
        console.log(`[AI 수집][신기술동향] 주제 "${topics.join(', ')}" Perplexity AI 수집 시작`);
        console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" Perplexity AI 분석 시작`);
        
        // Perplexity AI로 뉴스 수집 및 분석
        const aiNewsData = await collectNewsWithPerplexity(topics, 'tech');
        
        // AI분석보고서는 금일 뉴스가 있을 때만 생성 (여기서는 임시로 생성하지 않음)
        if (aiNewsData && aiNewsData.analysis) {
          console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" AI분석보고서 준비됨`);
        } else {
          console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" AI분석보고서 없음`);
        }
        
        if (aiNewsData && aiNewsData.news && aiNewsData.news.length > 0) {
          // 실제 뉴스가 있는지 확인 (undefined 필드가 아닌 유효한 뉴스)
          const validNews = aiNewsData.news.filter(item => 
            item && item.title && item.link && item.aiSummary
          );
          
          if (validNews.length > 0) {
            console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" 결과 ${validNews.length}건 수집 및 분석 완료`);
          
            // === DB 저장 ===
            const { inserted: insertedTech, duplicate: duplicateTech, skipped: skippedTech } = await saveNewsToDB(validNews, TechNews, '신기술동향', topics);
            console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" DB 저장 완료 (신규: ${insertedTech}건, 중복: ${duplicateTech}건, 제외: ${skippedTech}건)`);
            
            // 통계 기록 (퍼플렉시티만)
            await logServerAction('퍼플렉시티기술뉴스수집', { count: insertedTech, topics: topics.join(', ') });
            
            // 금일 뉴스가 1건이라도 있을 때만 분석보고서 저장
            if (aiNewsData.analysis && insertedTech > 0) {
              console.log(`[AI 수집][신기술동향] 금일 뉴스 ${insertedTech}건 저장됨 - 분석보고서 생성`);
              await createAnalysisReport(today, '신기술동향', aiNewsData.analysis, TechAnalysisReport, insertedTech);
              
              // AI 분석보고서 생성 통계 기록 (퍼플렉시티만)
              await logServerAction('퍼플렉시티AI분석보고서생성', { category: '신기술동향', count: insertedTech });
            } else {
              console.log(`[AI 수집][신기술동향] 금일 뉴스 없음 - 분석보고서 생성 건너뜀`);
            }
          } else {
            console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" 유효한 뉴스 없음`);
          }
        } else {
          console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" 뉴스 없음`);
        }
        
              } catch (e) {
          console.error(`[AI 수집][tech] 주제 "${topics.join(', ')}" 뉴스 수집 실패:`, e.message);
          console.log(`[AI 수집][tech] 주제 "${topics.join(', ')}" 수집된 뉴스가 없습니다.`);
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
  
  // 서버 시작 시에만 테스트 수집 실행 (중복 방지)
  if (isInit) {
    console.log(`[자동수집][크론] 서버 시작 시 테스트 수집 시도...`);
    try {
      // 이미 오늘 수집된 데이터가 있는지 확인
      const today = await getKoreaToday();
      const existingRiskNews = await RiskNews.findOne({ 
        createdAt: { 
          $gte: new Date(today + 'T00:00:00.000Z'),
          $lt: new Date(today + 'T23:59:59.999Z')
        }
      });
      
      if (!existingRiskNews) {
        await collectRiskNews();
        await collectPartnerNews();
        await collectTechNews();
        console.log(`[자동수집][크론] 서버 시작 시 테스트 수집 완료`);
      } else {
        console.log(`[자동수집][크론] 오늘 이미 수집된 데이터가 있어 테스트 수집을 건너뜁니다.`);
      }
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
async function collectNewsWithPerplexity(keywords, category = 'risk') {
  try {
    console.log(`[AI 수집][${category}] 키워드 "${keywords.join(', ')}" Perplexity AI 분석 시작`);
    
    // DB에서 카테고리별 커스텀 프롬프트 불러오기
    let customPrompt = '';
    try {
      const promptSetting = await Setting.findOne({ key: `prompt_${category}` });
      if (promptSetting && promptSetting.value) {
        customPrompt = promptSetting.value;
        console.log(`[AI 수집][${category}] 커스텀 프롬프트 사용: ${customPrompt.substring(0, 50)}...`);
      }
    } catch (e) {
      console.log(`[AI 수집][${category}] 프롬프트 불러오기 실패`);
    }
    
    // 카테고리별 기본 컨텍스트 설정 (커스텀 프롬프트가 없을 때 사용)
    let defaultCategoryContext = '';
    switch (category) {
      case 'risk':
        defaultCategoryContext = '리스크 이슈 및 위험 요소에 중점을 두고 분석해주세요.';
        break;
      case 'partner':
        defaultCategoryContext = '제휴처 및 파트너사 관련 비즈니스 뉴스에 중점을 두고 분석해주세요.';
        break;
      case 'tech':
        defaultCategoryContext = '신기술 동향 및 혁신 기술에 중점을 두고 분석해주세요.';
        break;
      default:
        defaultCategoryContext = '일반적인 뉴스 분석을 진행해주세요.';
    }
    
    // 커스텀 프롬프트가 있으면 사용, 없으면 기본 컨텍스트 사용
    const categoryContext = customPrompt || defaultCategoryContext;
    
    // 항상 기본 프롬프트 구조 사용
    const prompt = `
당신은 뉴스 분석 전문가입니다. 다음 키워드들에 대한 최신 뉴스를 검색하고 분석해주세요: ${keywords.join(', ')}

카테고리: ${category}

요구사항:
1. **반드시 최근 24시간 내의 뉴스만 수집** (오늘 날짜 기준)
2. **신뢰할 수 있는 언론사나 뉴스 사이트의 기사만 수집** (YouTube, Instagram, 블로그 등은 제외)
3. 각 뉴스에 대해 다음 정보를 제공:
   - 제목: 뉴스 제목
   - 링크: 실제 뉴스 URL
   - 언론사: 출처 언론사명
   - 발행일: 뉴스 발행일 (YYYY-MM-DD 형식)
   - aiSummary: 뉴스 내용 요약
4. 뉴스가 없을 경우 "금일은 뉴스가 없습니다" 표시
5. 마지막에 전체 뉴스에 대한 종합 분석 보고서를 추가

분석 보고서 작성 시 다음 내용을 참고하여 작성해주세요:
${categoryContext}

응답 형식:
- 가능하면 JSON 형태로 응답하되, JSON이 어려우면 텍스트 형태로도 가능합니다
- JSON 응답 시 주석을 포함하지 마세요
- 텍스트 응답 시 표 형태나 구조화된 형태로 정리해주세요

예시 JSON 형식:
{
  "news": [
    {
      "title": "뉴스 제목",
      "link": "https://example.com/news/123",
      "source": "언론사명",
      "pubDate": "2025-08-02",
      "aiSummary": "뉴스 요약"
    }
  ],
  "analysis": "전체 분석 보고서"
}
`;



    // Rate Limit 방지를 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 카테고리별 토큰 제한 가져오기
    let setting = await Setting.findOne({ key: 'tokenLimits' });
    let tokenLimits = {
      risk: 3000,
      partner: 3000,
      tech: 3000
    };
    if (setting && setting.value) {
      tokenLimits = JSON.parse(setting.value);
    }
    const maxTokens = tokenLimits[category] === null ? null : (tokenLimits[category] || 3000);
    
    const response = await axios.post(PERPLEXITY_API_URL, {
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens === null ? null : maxTokens,
      temperature: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const aiResponse = response.data.choices[0].message.content;
    const finishReason = response.data.choices[0].finish_reason;
    const usage = response.data.usage;
    
    console.log(`[AI 수집][${category}] Perplexity AI 응답 수신`);
    console.log(`[AI 수집][${category}] Finish reason: ${finishReason}`);
    console.log(`[AI 수집][${category}] Token usage: ${usage?.total_tokens || 'N/A'}/${usage?.completion_tokens || 'N/A'}`);
    

    
    // 토큰 잘림 감지 및 재시도 로직
    if (finishReason === 'length') {
      console.warn(`[AI 수집][${category}] ⚠️ 응답이 max_tokens(${3000})로 잘렸습니다!`);
      console.warn(`[AI 수집][${category}] 실제 사용된 토큰: ${usage?.completion_tokens || 'N/A'}`);
      
      // 토큰 제한을 2배로 늘려서 재시도 (무제한인 경우 8000으로 설정)
      const retryMaxTokens = maxTokens === null ? 8000 : maxTokens * 2;
      console.log(`[AI 수집][${category}] 토큰 제한을 ${retryMaxTokens}로 늘려서 재시도합니다...`);
      
      try {
        const retryResponse = await axios.post(PERPLEXITY_API_URL, {
          model: 'sonar-pro',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: retryMaxTokens === null ? null : retryMaxTokens,
          temperature: 0.5
        }, {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        });

        const retryAiResponse = retryResponse.data.choices[0].message.content;
        const retryFinishReason = retryResponse.data.choices[0].finish_reason;
        const retryUsage = retryResponse.data.usage;
        
        console.log(`[AI 수집][${category}] 재시도 완료 - Finish reason: ${retryFinishReason}`);
        console.log(`[AI 수집][${category}] 재시도 토큰 사용량: ${retryUsage?.completion_tokens || 'N/A'}`);
        
        if (retryFinishReason === 'stop') {
          console.log(`[AI 수집][${category}] ✅ 재시도 성공! 정상적으로 완료되었습니다.`);
          // 재시도 성공 시 원래 토큰 제한으로 복원
          return await processAiResponse(retryAiResponse, keywords, category, maxTokens);
        } else {
          console.error(`[AI 수집][${category}] ❌ 재시도도 실패했습니다.`);
          throw new Error('토큰 제한 초과로 재시도 실패');
        }
        
      } catch (retryError) {
        console.error(`[AI 수집][${category}] 재시도 중 오류:`, retryError.message);
        throw retryError;
      }
    }
    
    // AI 응답 처리 함수 호출
    return await processAiResponse(aiResponse, keywords, category, maxTokens);
    
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`[AI 수집][${category}] Rate Limit 도달, 30초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      return await collectNewsWithPerplexity(keywords, category);
    }
    console.error(`[AI 수집][${category}] Perplexity AI API 호출 실패:`, error.message);
    if (error.response) {
      console.error(`[AI 수집][${category}] 응답 데이터:`, error.response.data);
    }
    throw error;
  }
}

// AI 응답 처리 함수
async function processAiResponse(aiResponse, keywords, category, maxTokens) {
  console.log(`[AI 수집][${category}] 응답 형식 감지 중...`);
  
  // 마크다운 코드 블록 제거 (```json ... ``` 형식)
  let cleanedResponse = aiResponse.trim();
  if (cleanedResponse.startsWith('```json')) {
    console.log(`[AI 수집][${category}] 마크다운 코드 블록 감지, 제거 중...`);
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedResponse.startsWith('```')) {
    console.log(`[AI 수집][${category}] 마크다운 코드 블록 감지, 제거 중...`);
    cleanedResponse = cleanedResponse.replace(/^```[a-z]*\s*/, '').replace(/\s*```$/, '');
  }
  
  // JSON 형식인지 확인
  const isJsonResponse = cleanedResponse.trim().startsWith('{') || cleanedResponse.trim().startsWith('[');
  
  if (isJsonResponse) {
    console.log(`[AI 수집][${category}] JSON 형식 감지됨, JSON 파싱 시도`);
    try {
      const result = JSON.parse(cleanedResponse);
      
      // 뉴스 데이터 정규화 및 검증
      let newsData = [];
      if (result.news && Array.isArray(result.news)) {
        newsData = result.news.map(item => {
          return {
            ...item,
            keyword: keywords.join(', '), // 키워드 필드 추가
            source: item.source || 'AI 분석', // 언론사/출처
            relatedKeywords: item.relatedKeywords || keywords, // 관련 키워드
            aiSummary: item.aiSummary || item.summary || 'AI 요약이 없습니다.',
            analysisModel: 'perplexity-ai' // AI 모델명
          };
        });
      }
      
      // 응답 형식에 따라 처리
      if (newsData.length > 0) {
        return { news: newsData, analysis: result.analysis || null };
      } else if (Array.isArray(result)) {
        return { news: result, analysis: null };
      } else if (result.news && Array.isArray(result.news) && result.news.length === 0) {
        // 뉴스가 비어있고 분석 보고서만 있는 경우
        console.log(`[AI 수집][${category}] 뉴스 없음, 분석 보고서만 존재`);
        return { news: [], analysis: result.analysis || result };
      } else {
        return { news: [result], analysis: null };
      }
    } catch (parseError) {
      console.error(`[AI 수집][${category}] JSON 파싱 실패:`, parseError);
      console.log(`[AI 수집][${category}] JSON 응답 일부:`, cleanedResponse.substring(0, 200) + '...');
      console.log(`[AI 수집][${category}] 텍스트 파싱으로 전환`);
      return parseTextResponse(aiResponse, keywords, category);
    }
  } else {
    console.log(`[AI 수집][${category}] 텍스트 형식 감지됨, 텍스트 파싱 시도`);
    return parseTextResponse(aiResponse, keywords, category);
  }
}

// 텍스트 응답 파싱 함수
function parseTextResponse(text, keywords, category) {
  console.log(`[AI 수집][${category}] 텍스트 파싱 시작`);
  
  // 텍스트에서 뉴스 정보 추출 시도
  const extractedResult = extractNewsFromText(text, keywords[0]);
  if (extractedResult && extractedResult.news && extractedResult.news.length > 0) {
    console.log(`[AI 수집][${category}] 텍스트에서 ${extractedResult.news.length}건 추출 성공`);
    return extractedResult;
  }
  
  // 추출 실패 시 뉴스가 없다고 판단
  console.log(`[AI 수집][${category}] 뉴스 추출 실패 - 뉴스 없음으로 처리`);
  
  // 분석 보고서만 반환
  return { news: [], analysis: text };
}

// 텍스트에서 뉴스 정보 추출 (JSON 파싱 실패 시 대안)
function extractNewsFromText(text, keyword) {
  const newsItems = [];
  let newsAnalysis = '';
  
  console.log(`[텍스트 파싱] 키워드: ${keyword}, 텍스트 길이: ${text.length}`);
  
  // 텍스트를 섹션으로 분할
  const sections = text.split('---');
  
  // 뉴스 섹션 찾기 (표 형태)
  for (const section of sections) {
    if (section.includes('| 제목 |') || section.includes('| 제목|') || section.includes('제목 |')) {
      console.log(`[텍스트 파싱] 표 형태 뉴스 섹션 발견`);
      // 표 형태의 뉴스 데이터 파싱
      const lines = section.split('\n');
      let inTable = false;
      
      for (const line of lines) {
        if (line.includes('| 제목 |') || line.includes('| 제목|') || line.includes('제목 |')) {
          inTable = true;
          continue;
        }
        
        if (inTable && line.trim() && line.includes('|')) {
          const columns = line.split('|').map(col => col.trim()).filter(col => col);
          
          if (columns.length >= 5) {
            const [title, link, source, pubDate, summary] = columns;
            
            // 링크에서 실제 URL 추출
            let actualLink = '#';
            if (link.includes('[') && link.includes(']')) {
              const linkMatch = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                actualLink = linkMatch[2];
              }
            } else if (link.startsWith('http')) {
              actualLink = link;
            }
            
            // 제목 정리
            let cleanTitle = title.replace(/^[-*•]\s*/, '').replace(/^[0-9]+\.\s*/, '');
            if (cleanTitle.length > 100) {
              cleanTitle = cleanTitle.substring(0, 100) + '...';
            }
            
            // 요약 정리
            let cleanSummary = summary;
            if (cleanSummary.length > 300) {
              cleanSummary = cleanSummary.substring(0, 300) + '...';
            }
            
            // 관련 키워드 추출
            const relatedKeywords = [keyword];
            if (cleanTitle.includes('백종원')) relatedKeywords.push('백종원');
            if (cleanTitle.includes('더본코리아')) relatedKeywords.push('더본코리아');
            
            newsItems.push({
              title: cleanTitle,
              link: actualLink,
              source: source || 'AI 분석',
              pubDate: pubDate || new Date().toISOString(),
              keyword: keyword, // 키워드 필드 추가
              relatedKeywords: relatedKeywords, // 관련 키워드
              aiSummary: cleanSummary,
              analysisModel: 'perplexity-ai' // AI 모델명
            });
          }
        }
        
        // 표 끝 확인
        if (inTable && line.trim() === '') {
          inTable = false;
        }
      }
    }
    
    // 분석 보고서 섹션 찾기 (다양한 패턴 지원)
    if (section.includes('리스크 분석') || section.includes('전체 뉴스 분석') || 
        section.includes('분석 보고서') || section.includes('뉴스 분석') ||
        section.includes('종합 분석') || section.includes('요약 분석')) {
      newsAnalysis = section.trim();
      console.log(`[텍스트 파싱] 분석 보고서 섹션 발견`);
    }
  }
  
  // 뉴스 항목이 없으면 뉴스가 없다고 판단
  if (newsItems.length === 0) {
    console.log(`[텍스트 파싱] 뉴스 항목 없음 - 뉴스 없음으로 처리`);
  }
  
  console.log(`[텍스트 파싱] 결과: 뉴스 ${newsItems.length}건, 분석보고서: ${newsAnalysis ? '있음' : '없음'}`);
  return { news: newsItems, analysis: newsAnalysis };
}

// 네이버뉴스 최신 뉴스 API 비활성화 - Perplexity AI만 사용
app.get('/api/naver-news-latest', (req, res) => {
  console.log('[API] 네이버뉴스 최신 뉴스 API 비활성화됨 - Perplexity AI만 사용');
  return res.status(403).json({ 
    error: '네이버뉴스 최신 뉴스 API가 비활성화되었습니다.',
    message: 'Perplexity AI만 사용하여 뉴스를 수집합니다.',
    note: '이전에 저장된 네이버뉴스 데이터는 여전히 DB에 남아있을 수 있습니다.'
  });
});

// 언론보도 효과성 측정용 네이버 뉴스 API
app.get('/api/media-effectiveness', async (req, res) => {
  try {
    const { keyword, startDate, endDate, aggregation = '일', limit = 100 } = req.query;
    
    if (!keyword || !startDate || !endDate) {
      return res.status(400).json({ 
        error: '필수 파라미터가 누락되었습니다.',
        message: '키워드, 시작일, 종료일을 모두 입력해주세요.'
      });
    }

    console.log(`[언론보도 효과성] 검색: ${keyword}, 기간: ${startDate}~${endDate}, 집계: ${aggregation}`);

    // 네이버 뉴스 검색 API 호출 (여러 페이지에서 데이터 수집)
    const searchUrl = 'https://openapi.naver.com/v1/search/news.json';
    let allNewsItems = [];
    const maxPages = Math.ceil(limit / 100); // 최대 페이지 수
    
    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({
        query: keyword,
        display: 100, // 한 번에 100개씩
        sort: 'date', // 최신순
        start: (page - 1) * 100 + 1
      });

      try {
        const response = await axios.get(`${searchUrl}?${params}`, {
          headers: {
            'X-Naver-Client-Id': NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
          }
        });

        const pageItems = response.data.items || [];
        if (pageItems.length === 0) break; // 더 이상 데이터가 없으면 중단
        
        allNewsItems = allNewsItems.concat(pageItems);
        
        // API 호출 간격 조절 (Rate Limit 방지)
        if (page < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`[언론보도 효과성] 페이지 ${page} 호출 실패:`, error.message);
        break;
      }
    }
    
    console.log(`[언론보도 효과성] 총 ${allNewsItems.length}건의 뉴스 수집 완료`);
    
    // 날짜 필터링 및 데이터 정제
    const filteredNews = allNewsItems
      .filter(item => {
        const pubDate = new Date(item.pubDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return pubDate >= start && pubDate <= end;
      })
      .map(item => ({
        title: item.title.replace(/<[^>]+>/g, ''), // HTML 태그 제거
        link: item.link,
        description: item.description.replace(/<[^>]+>/g, ''), // HTML 태그 제거
        pubDate: new Date(item.pubDate).toISOString().split('T')[0], // YYYY-MM-DD 형식
        source: extractSourceFromLink(item.link),
        originallink: item.originallink
      }));

    // 집계 데이터 생성
    const aggregatedData = aggregateNewsByDate(filteredNews, aggregation, startDate, endDate);

    res.json({
      success: true,
      data: {
        news: filteredNews,
        aggregated: aggregatedData,
        totalCount: filteredNews.length,
        keyword,
        period: { startDate, endDate },
        aggregation
      }
    });

  } catch (error) {
    console.error('[언론보도 효과성] API 호출 실패:', error);
    res.status(500).json({ 
      error: '뉴스 검색 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 언론사 추출 함수
function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    const hostname = url.hostname;
    
    // 주요 언론사 매핑 (확장)
    const sourceMap = {
      // 종합일간지
      'www.chosun.com': '조선일보',
      'www.donga.com': '동아일보',
      'www.joongang.co.kr': '중앙일보',
      'www.hani.co.kr': '한겨레',
      'www.khan.co.kr': '경향신문',
      'www.seoul.co.kr': '서울신문',
      'www.kookje.co.kr': '국제신문',
      'www.busan.com': '부산일보',
      'www.kwnews.co.kr': '강원일보',
      'www.jejuilbo.com': '제주일보',
      
      // 경제지
      'www.hankyung.com': '한국경제',
      'www.mk.co.kr': '매일경제',
      'www.edaily.co.kr': '이데일리',
      'www.fnnews.com': '파이낸셜뉴스',
      'www.news1.kr': '뉴스1',
      'www.yonhapnews.co.kr': '연합뉴스',
      'www.newsis.com': '뉴시스',
      
      // IT/기술 전문지
      'www.etnews.com': '전자신문',
      'www.zdnet.co.kr': 'ZDNet Korea',
      'www.itworld.co.kr': 'ITWorld',
      'www.ciokorea.com': 'CIO Korea',
      'www.boannews.com': '보안뉴스',
      'www.techm.kr': '테크M',
      'www.techholic.co.kr': '테크홀릭',
      
      // 방송사
      'www.kbs.co.kr': 'KBS',
      'www.mbc.co.kr': 'MBC',
      'www.sbs.co.kr': 'SBC',
      'www.ytn.co.kr': 'YTN',
      'www.jtbc.co.kr': 'JTBC',
      'www.channela.co.kr': '채널A',
      'www.tvn.co.kr': 'tvN',
      
      // 온라인 언론
      'www.huffingtonpost.kr': '허핑턴포스트',
      'www.ohmynews.com': '오마이뉴스',
      'www.pressian.com': '프레시안',
      'www.mediatoday.co.kr': '미디어오늘',
      'www.newstapa.org': '뉴스타파',
      'www.vop.co.kr': '민중의소리',
      
      // 전문 언론
      'www.lecturernews.com': '강사신문',
      'www.worktoday.co.kr': '워크투데이',
      'www.jobkorea.co.kr': '잡코리아',
      'www.saramin.co.kr': '사람인',
      'www.incruit.com': '인크루트',
      
      // 지역 언론
      'www.gnnews.co.kr': '경남신문',
      'www.gyeongnam.co.kr': '경남도민일보',
      'www.gnmaeil.com': '경남매일',
      'www.gyeongbuk.co.kr': '경북일보',
      'www.kbmaeil.com': '경북매일',
      'www.gwangju.co.kr': '광주일보',
      'www.jeonmae.co.kr': '전매일보',
      'www.daejonilbo.com': '대전일보',
      'www.ulsanpress.net': '울산매일',
      'www.incheonilbo.com': '인천일보',
      
      // 기타 주요 언론
      'www.heraldcorp.com': '헤럴드경제',
      'www.asiae.co.kr': '아시아경제',
      'www.sedaily.com': '서울경제',
      'www.bizwatch.co.kr': '비즈워치',
      'www.biztribune.co.kr': '비즈트리뷴',
      'www.techcrunch.co.kr': '테크크런치',
      'www.venturebeat.com': '벤처비트',
      'www.wired.co.kr': '와이어드',
      'www.theverge.com': '더버지',
      'www.engadget.com': '엔가젯',
      
      // 네이버 관련
      'm.entertain.naver.com': '네이버 엔터테인먼트',
      'm.news.naver.com': '네이버 뉴스',
      'news.naver.com': '네이버 뉴스',
      'entertain.naver.com': '네이버 엔터테인먼트',
      
      // 카카오 관련
      'news.kakao.com': '카카오 뉴스',
      'm.news.kakao.com': '카카오 뉴스',
      
      // 구글 관련
      'news.google.com': '구글 뉴스',
      'm.news.google.com': '구글 뉴스'
    };
    
    // 정확한 매칭 시도
    if (sourceMap[hostname]) {
      return sourceMap[hostname];
    }
    
    // 부분 매칭 시도 (도메인 일부로 매칭)
    for (const [domain, name] of Object.entries(sourceMap)) {
      if (hostname.includes(domain.replace('www.', ''))) {
        return name;
      }
    }
    
    // 도메인에서 언론사명 추출 시도
    const domainParts = hostname.replace('www.', '').split('.');
    if (domainParts.length >= 2) {
      const mainDomain = domainParts[0];
      
      // 일반적인 언론사 도메인 패턴 매칭
      const commonPatterns = {
        'chosun': '조선일보',
        'donga': '동아일보',
        'joongang': '중앙일보',
        'hani': '한겨레',
        'khan': '경향신문',
        'hankyung': '한국경제',
        'mk': '매일경제',
        'etnews': '전자신문',
        'zdnet': 'ZDNet Korea',
        'itworld': 'ITWorld',
        'ciokorea': 'CIO Korea',
        'boannews': '보안뉴스',
        'techm': '테크M',
        'techholic': '테크홀릭',
        'kbs': 'KBS',
        'mbc': 'MBC',
        'sbs': 'SBC',
        'ytn': 'YTN',
        'jtbc': 'JTBC',
        'channela': '채널A',
        'tvn': 'tvN',
        'huffingtonpost': '허핑턴포스트',
        'ohmynews': '오마이뉴스',
        'pressian': '프레시안',
        'mediatoday': '미디어오늘',
        'newstapa': '뉴스타파',
        'vop': '민중의소리',
        'lecturernews': '강사신문',
        'worktoday': '워크투데이',
        'jobkorea': '잡코리아',
        'saramin': '사람인',
        'incruit': '인크루트',
        'gnnews': '경남신문',
        'gyeongnam': '경남도민일보',
        'gnmaeil': '경남매일',
        'gyeongbuk': '경북일보',
        'kbmaeil': '경북매일',
        'gwangju': '광주일보',
        'jeonmae': '전매일보',
        'daejonilbo': '대전일보',
        'ulsanpress': '울산매일',
        'incheonilbo': '인천일보',
        'heraldcorp': '헤럴드경제',
        'asiae': '아시아경제',
        'sedaily': '서울경제',
        'bizwatch': '비즈워치',
        'biztribune': '비즈트리뷴',
        'techcrunch': '테크크런치',
        'venturebeat': '벤처비트',
        'wired': '와이어드',
        'theverge': '더버지',
        'engadget': '엔가젯'
      };
      
      if (commonPatterns[mainDomain]) {
        return commonPatterns[mainDomain];
      }
    }
    
    // 매칭되지 않는 경우 도메인에서 www 제거하여 반환
    return hostname.replace('www.', '');
  } catch (e) {
    return '알 수 없음';
  }
}

// 날짜별 집계 함수
function aggregateNewsByDate(news, aggregation, startDate, endDate) {
  const aggregated = {};
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 날짜 범위 생성
  const dates = [];
  let current = new Date(start);
  
  while (current <= end) {
    if (aggregation === '일') {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    } else if (aggregation === '월') {
      const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      if (!dates.includes(yearMonth)) {
        dates.push(yearMonth);
      }
      current.setMonth(current.getMonth() + 1);
    } else if (aggregation === '연') {
      const year = current.getFullYear().toString();
      if (!dates.includes(year)) {
        dates.push(year);
      }
      current.setFullYear(current.getFullYear() + 1);
    }
  }
  
  // 초기화
  dates.forEach(date => {
    aggregated[date] = 0;
  });
  
  // 뉴스 카운트
  news.forEach(item => {
    let key;
    if (aggregation === '일') {
      key = item.pubDate;
    } else if (aggregation === '월') {
      key = item.pubDate.substring(0, 7);
    } else if (aggregation === '연') {
      key = item.pubDate.substring(0, 4);
    }
    
    if (aggregated.hasOwnProperty(key)) {
      aggregated[key]++;
    }
  });
  
  return aggregated;
}

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

// 카카오톡 알림 큐 적재 함수
async function enqueueScheduleKakao(action, schedule, prevSchedule = null) {
  try {
    // 1. kakao_rooms 설정 조회
    const roomsSetting = await Setting.findOne({ key: 'kakao_rooms' });
    if (!roomsSetting) {
      console.log('kakao_rooms 설정 없음, 카톡 알림 스킵');
      return;
    }
    
    const rooms = JSON.parse(roomsSetting.value);
    
    // 2. enabled=true AND scheduleNotify=true 방만 필터링
    const targetRooms = rooms.filter(room => 
      room.enabled === true && room.scheduleNotify === true
    );
    
    if (targetRooms.length === 0) {
      console.log('알림 활성화된 방 없음, 카톡 알림 스킵');
      return;
    }
    
    // 3. 메시지 템플릿 생성
    const message = generateScheduleMessage(action, schedule, prevSchedule);
    
    // 4. 각 방에 메시지 적재
    const timestamp = Date.now();
    const outboxDocs = targetRooms.map(room => ({
      targetRoom: room.roomName,
      message,
      type: `schedule_${action}`,
      status: 'pending',
      priority: 0,
      scheduleId: schedule._id,
      dedupeKey: `schedule:${action}:${schedule._id}:${timestamp}`,
      attempts: 0
    }));
    
    // 5. 중복 체크 후 삽입
    for (const doc of outboxDocs) {
      try {
        await BotOutbox.create(doc);
        console.log(`카톡 메시지 적재: ${doc.targetRoom} - ${action}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`중복 메시지 스킵: ${doc.dedupeKey}`);
        } else {
          console.error('BotOutbox 저장 실패:', error);
        }
      }
    }
  } catch (error) {
    console.error('enqueueScheduleKakao 실패:', error);
    // 에러 발생 시에도 스케줄 저장은 성공하도록 함 (non-blocking)
  }
}

// 스케줄 메시지 템플릿 생성 함수
function generateScheduleMessage(action, schedule, prevSchedule) {
  const dashboardUrl = 'https://myteamdashboard.vercel.app/index.html';
  
  switch (action) {
    case 'create':
      return `[일정 등록]
제목: ${schedule.title}
일시: ${formatKST(schedule.start)}
내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    case 'update':
      return `[일정 변경]
제목: ${schedule.title}

변경 전 일시: ${formatKST(prevSchedule.start)}
변경 후 일시: ${formatKST(schedule.start)}

변경 전 내용: ${prevSchedule.content || '내용 없음'}
변경 후 내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    case 'delete':
      return `[일정 취소]
제목: ${schedule.title}
일시: ${formatKST(schedule.start)}
내용: ${schedule.content || '내용 없음'}

대시보드: ${dashboardUrl}`;

    default:
      return `[일정 알림]\n제목: ${schedule.title}`;
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
        await enqueueScheduleKakao('create', schedule);
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
        await enqueueScheduleKakao('update', schedule, prevSchedule);
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
        await enqueueScheduleKakao('delete', schedule);
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

// === 카테고리별 AI 프롬프트 설정 API ===
// 조회
app.get('/api/prompt/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ['risk', 'partner', 'tech'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    const setting = await Setting.findOne({ key: `prompt_${category}` });
    res.json({ value: setting ? setting.value : '' });
  } catch (err) {
    res.status(500).json({ error: '프롬프트 조회 실패', message: err.message });
  }
});

// 저장
app.post('/api/prompt/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { value } = req.body;
    const validCategories = ['risk', 'partner', 'tech'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    if (!value) return res.status(400).json({ error: '프롬프트 값이 필요합니다.' });
    const setting = await Setting.findOneAndUpdate(
      { key: `prompt_${category}` },
      { value },
      { upsert: true, new: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: '프롬프트 저장 실패', message: err.message });
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
  try {
    const { limit = 50, days = 7, offset = 0 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    // 전체 건수 조회 (최근 N일)
    const totalCount = await RiskNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    // 전체 누적 건수 조회 (날짜 제한 없음)
    const totalCountAll = await RiskNews.countDocuments({});
    
    const news = await RiskNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate collectedDate keyword source relatedKeywords analysisModel createdAt');
    
    // 수집일자 기준으로 필터링 (오늘 수집된 뉴스)
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.collectedDate) return false;
      return item.collectedDate === today;
    });
    
    const otherNews = news.filter(item => {
      if (!item.collectedDate) return true;
      return item.collectedDate !== today;
    });

    // 오늘 날짜의 분석보고서 조회
    const analysisReport = await RiskAnalysisReport.findOne({
      date: { $gte: new Date(today + 'T00:00:00.000Z') }
    }).sort({ date: -1 });
    
    res.json({
      success: true,
      data: news,
      todayNews: todayNews,
      otherNews: otherNews,
      count: news.length,
      totalCount: totalCount,
      totalCountAll: totalCountAll, // 전체 누적 건수 추가
      hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      offset: parseInt(offset),
      limit: parseInt(limit),
      analysisReport: analysisReport
    });
  } catch (error) {
    console.error('리스크 뉴스 조회 실패:', error);
    res.status(500).json({ error: '리스크 뉴스 조회 중 오류가 발생했습니다.' });
  }
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
  try {
    const { limit = 50, days = 7, offset = 0 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    // 전체 건수 조회 (최근 N일)
    const totalCount = await PartnerNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    // 전체 누적 건수 조회 (날짜 제한 없음)
    const totalCountAll = await PartnerNews.countDocuments({});
    
    const news = await PartnerNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate collectedDate keyword source relatedKeywords analysisModel createdAt');
    
    // 수집일자 기준으로 필터링 (오늘 수집된 뉴스)
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.collectedDate) return false;
      return item.collectedDate === today;
    });
    
    const otherNews = news.filter(item => {
      if (!item.collectedDate) return true;
      return item.collectedDate !== today;
    });
    
    // 최신 AI분석보고서 조회
    const analysisReport = await PartnerAnalysisReport.findOne({
      date: { $gte: new Date(today + 'T00:00:00.000Z') }
    }).sort({ date: -1 });
    
    res.json({
      success: true,
      data: news,
      todayNews: todayNews,
      otherNews: otherNews,
      count: news.length,
      totalCount: totalCount,
      totalCountAll: totalCountAll, // 전체 누적 건수 추가
      hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      offset: parseInt(offset),
      limit: parseInt(limit),
      analysisReport: analysisReport || null
    });
  } catch (error) {
    console.error('제휴처 뉴스 조회 실패:', error);
    res.status(500).json({ error: '제휴처 뉴스 조회 중 오류가 발생했습니다.' });
  }
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
  try {
    const { limit = 50, days = 7, offset = 0 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    // 전체 건수 조회 (최근 N일)
    const totalCount = await TechNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    // 전체 누적 건수 조회 (날짜 제한 없음)
    const totalCountAll = await TechNews.countDocuments({});
    
    const news = await TechNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate collectedDate keyword source relatedKeywords analysisModel createdAt');
    
    // 수집일자 기준으로 필터링 (오늘 수집된 뉴스)
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.collectedDate) return false;
      return item.collectedDate === today;
    });
    
    const otherNews = news.filter(item => {
      if (!item.collectedDate) return true;
      return item.collectedDate !== today;
    });
    
    // 최신 AI분석보고서 조회
    const analysisReport = await TechAnalysisReport.findOne({
      date: { $gte: new Date(today + 'T00:00:00.000Z') }
    }).sort({ date: -1 });
    
    res.json({
      success: true,
      data: news,
      todayNews: todayNews,
      otherNews: otherNews,
      count: news.length,
      totalCount: totalCount,
      totalCountAll: totalCountAll, // 전체 누적 건수 추가
      hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      offset: parseInt(offset),
      limit: parseInt(limit),
      analysisReport: analysisReport || null
    });
  } catch (error) {
    console.error('신기술 뉴스 조회 실패:', error);
    res.status(500).json({ error: '신기술 뉴스 조회 중 오류가 발생했습니다.' });
  }
});

// === 테스트 데이터 추가 API ===
app.post('/api/add-test-data', async (req, res) => {
  try {
    console.log('[테스트 데이터] 추가 시작...');
    
    // 제휴처뉴스 테스트 데이터
    const partnerTestData = new PartnerNews({
      title: '[테스트] AI 기술 기업 간 협력 확대',
      link: 'https://example.com/partner-test-news',
      aiSummary: 'AI 기술 기업들이 전략적 파트너십을 통해 기술 혁신을 가속화하고 있다. 이는 시장 경쟁력 강화와 새로운 비즈니스 모델 창출로 이어질 것으로 예상된다.',
      pubDate: new Date().toISOString(),
      collectedDate: new Date().toISOString().split('T')[0], // 수집일자 추가
      keyword: 'AI',
      source: '테스트뉴스',
      relatedKeywords: ['AI 협력', '기술혁신', '파트너십'],
      analysisModel: 'perplexity-ai'
    });
    
    // 신기술동향 테스트 데이터
    const techTestData = new TechNews({
      title: '[테스트] 인공지능 업무 활용 사례 증가',
      link: 'https://example.com/tech-test-news',
      aiSummary: '기업들이 AI 기술을 업무 프로세스에 도입하여 업무 효율성을 크게 향상시키고 있다. 특히 문서 처리, 고객 서비스, 데이터 분석 분야에서 AI 활용이 두드러진다.',
      pubDate: new Date().toISOString(),
      collectedDate: new Date().toISOString().split('T')[0], // 수집일자 추가
      keyword: '인공지능',
      source: '테스트뉴스',
      relatedKeywords: ['AI 업무', '생산성 향상', '자동화'],
      analysisModel: 'perplexity-ai'
    });
    
    await partnerTestData.save();
    await techTestData.save();
    
    console.log('[테스트 데이터] 추가 완료');
    
    res.json({ 
      success: true, 
      message: '테스트 데이터가 추가되었습니다.',
      partnerNews: 1,
      techNews: 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[테스트 데이터] 오류:', error);
    res.status(500).json({ error: '테스트 데이터 추가 실패' });
  }
});

// === 카테고리별 Perplexity AI 뉴스 수집 API ===
app.post('/api/collect-news/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ['risk', 'partner', 'tech'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    
    console.log(`[수동 수집][${category}] 뉴스 수집 시작...`);
    
    let result;
    switch (category) {
      case 'risk':
        result = await collectRiskNews();
        break;
      case 'partner':
        result = await collectPartnerNews();
        break;
      case 'tech':
        result = await collectTechNews();
        break;
    }
    
    console.log(`[수동 수집][${category}] 뉴스 수집 완료`);
    
    res.json({ 
      success: true, 
      message: `${category} 카테고리 뉴스 수집이 완료되었습니다.`,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[수동 수집][${req.params.category}] 오류:`, error);
    res.status(500).json({ error: '뉴스 수집 실패' });
  }
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
    
    // 분석 보고서 컬렉션도 삭제
    const reportCollections = ['riskanalysisreports', 'partneranalysisreports', 'techanalysisreports'];
    for (const collectionName of reportCollections) {
      try {
        await mongoose.connection.collection(collectionName).drop();
        console.log(`[강제 스키마 재설정] ${collectionName} 컬렉션 삭제 완료`);
      } catch (error) {
        console.log(`[강제 스키마 재설정] ${collectionName} 컬렉션이 없거나 이미 삭제됨`);
      }
    }
    
    // 스키마 모델 캐시 삭제
    delete mongoose.models.RiskNews;
    delete mongoose.models.PartnerNews;
    delete mongoose.models.TechNews;
    delete mongoose.models.RiskAnalysisReport;
    delete mongoose.models.PartnerAnalysisReport;
    delete mongoose.models.TechAnalysisReport;
    
    console.log('[강제 스키마 재설정] 스키마 모델 캐시 삭제 완료');
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

// === 뉴스 및 AI 분석 데이터만 삭제 API ===
app.post('/api/clear-news-analysis-data', async (req, res) => {
  try {
    console.log('[뉴스 및 AI 분석 데이터 삭제] 시작...');
    
    // 뉴스 데이터 삭제
    await RiskNews.deleteMany({});
    await PartnerNews.deleteMany({});
    await TechNews.deleteMany({});
    console.log('[뉴스 및 AI 분석 데이터 삭제] 뉴스 데이터 삭제 완료');
    
    // 분석 보고서 데이터 삭제
    await RiskAnalysisReport.deleteMany({});
    await PartnerAnalysisReport.deleteMany({});
    await TechAnalysisReport.deleteMany({});
    console.log('[뉴스 및 AI 분석 데이터 삭제] 분석 보고서 데이터 삭제 완료');
    
    console.log('[뉴스 및 AI 분석 데이터 삭제] 완료');
    
    res.json({ 
      success: true, 
      message: '뉴스 및 AI 분석 데이터가 완전히 삭제되었습니다. 키워드/조건/주제 데이터는 유지됩니다.'
    });
  } catch (error) {
    console.error('[뉴스 및 AI 분석 데이터 삭제] 오류:', error);
    res.status(500).json({ error: '데이터 삭제 실패' });
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
        aiSummary: item.aiSummary || item.description || '기존 데이터',
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
        analysisModel: item.analysisModel || 'legacy'
      }));
      
      await PartnerNews.insertMany(updatedPartnerNews);
      console.log(`[스키마 업데이트] PartnerNews ${updatedPartnerNews.length}건 재생성 완료`);
    }
    
    if (existingTechNews.length > 0) {
      const updatedTechNews = existingTechNews.map(item => ({
        ...item.toObject(),
        aiSummary: item.aiSummary || item.description || '기존 데이터',
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
        analysisModel: item.analysisModel || 'legacy'
      }));
      
      await TechNews.insertMany(updatedTechNews);
      console.log(`[스키마 업데이트] TechNews ${updatedTechNews.length}건 재생성 완료`);
    }
    
    if (existingRiskNews.length > 0) {
      const updatedRiskNews = existingRiskNews.map(item => ({
        ...item.toObject(),
        aiSummary: item.aiSummary || item.description || '기존 데이터',
        source: item.source || '기존 수집',
        relatedKeywords: item.relatedKeywords || [],
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
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select('title link source aiSummary relatedKeywords analysisModel');
    
    // AI 분석 통계
    const stats = {
      total: news.length,
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

// === DB 데이터 상태 확인 API ===
app.get('/api/db-status', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 각 카테고리별 데이터 현황
    const [riskNews, partnerNews, techNews] = await Promise.all([
      RiskNews.find({ createdAt: { $gte: today, $lt: tomorrow } }).sort({ createdAt: -1 }),
      PartnerNews.find({ createdAt: { $gte: today, $lt: tomorrow } }).sort({ createdAt: -1 }),
      TechNews.find({ createdAt: { $gte: today, $lt: tomorrow } }).sort({ createdAt: -1 })
    ]);
    
    // 전체 데이터 수도 확인
    const [totalRisk, totalPartner, totalTech] = await Promise.all([
      RiskNews.countDocuments(),
      PartnerNews.countDocuments(),
      TechNews.countDocuments()
    ]);
    
    res.json({
      success: true,
      data: {
        today: {
          risk: riskNews.length,
          partner: partnerNews.length,
          tech: techNews.length
        },
        total: {
          risk: totalRisk,
          partner: totalPartner,
          tech: totalTech
        },
        latestData: {
          risk: riskNews.slice(0, 3),
          partner: partnerNews.slice(0, 3),
          tech: techNews.slice(0, 3)
        }
      }
    });
  } catch (error) {
    console.error('DB 상태 확인 실패:', error);
    res.status(500).json({ error: 'DB 상태 확인 중 오류가 발생했습니다.' });
  }
});

// === 리스크이슈 분석 보고서 API ===
app.get('/api/risk-analysis/:date?', async (req, res) => {
  try {
    const { date } = req.params;
    let query = {};
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDate };
    }
    
    const reports = await RiskAnalysisReport.find(query)
      .sort({ date: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('리스크이슈 분석 보고서 조회 실패:', error);
    res.status(500).json({ error: '리스크이슈 분석 보고서 조회 중 오류가 발생했습니다.' });
  }
});

// === 리스크이슈 분석 보고서 삭제 API ===
app.delete('/api/risk-analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await RiskAnalysisReport.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: '분석 보고서를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      message: '분석 보고서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('리스크이슈 분석 보고서 삭제 실패:', error);
    res.status(500).json({ error: '리스크이슈 분석 보고서 삭제 중 오류가 발생했습니다.' });
  }
});

// === 제휴처탐색 분석 보고서 API ===
app.get('/api/partner-analysis/:date?', async (req, res) => {
  try {
    const { date } = req.params;
    let query = {};
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDate };
    }
    
    const reports = await PartnerAnalysisReport.find(query)
      .sort({ date: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('제휴처탐색 분석 보고서 조회 실패:', error);
    res.status(500).json({ error: '제휴처탐색 분석 보고서 조회 중 오류가 발생했습니다.' });
  }
});

// === 제휴처탐색 분석 보고서 삭제 API ===
app.delete('/api/partner-analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await PartnerAnalysisReport.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: '분석 보고서를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      message: '분석 보고서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('제휴처탐색 분석 보고서 삭제 실패:', error);
    res.status(500).json({ error: '제휴처탐색 분석 보고서 삭제 중 오류가 발생했습니다.' });
  }
});

// === 신기술동향 분석 보고서 API ===
app.get('/api/tech-analysis/:date?', async (req, res) => {
  try {
    const { date } = req.params;
    let query = {};
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDate };
    }
    
    const reports = await TechAnalysisReport.find(query)
      .sort({ date: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('신기술동향 분석 보고서 조회 실패:', error);
    res.status(500).json({ error: '신기술동향 분석 보고서 조회 중 오류가 발생했습니다.' });
  }
});

// === 신기술동향 분석 보고서 삭제 API ===
app.delete('/api/tech-analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await TechAnalysisReport.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: '분석 보고서를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      message: '분석 보고서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('신기술동향 분석 보고서 삭제 실패:', error);
    res.status(500).json({ error: '신기술동향 분석 보고서 삭제 중 오류가 발생했습니다.' });
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
    
    // 뉴스 수집 시 이미 분석이 포함되어 있으므로 별도 요약 불필요
    res.json({
      success: true,
      data: {
        summary: '뉴스 수집 시 이미 분석이 포함되어 있습니다.',
        trends: [],
        keywords: []
      }
    });
    
  } catch (error) {
    console.error('AI 요약 조회 실패:', error);
    res.status(500).json({ error: 'AI 요약 조회 중 오류가 발생했습니다.' });
  }
});



// ===== 토큰 제한 설정 API =====
app.get('/api/token-limits', async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'tokenLimits' });
    let tokenLimits = {
      risk: 3000,
      partner: 3000,
      tech: 3000
    };
    if (setting && setting.value) {
      tokenLimits = JSON.parse(setting.value);
    }
    res.json(tokenLimits);
  } catch (err) {
    res.status(500).json({ error: '토큰 제한 설정 조회 실패' });
  }
});

app.post('/api/token-limits', async (req, res) => {
  try {
    const { risk, partner, tech } = req.body;
    if (!risk || !partner || !tech) {
      return res.status(400).json({ error: '모든 카테고리의 토큰 제한을 입력하세요.' });
    }
    
    const tokenLimits = { risk, partner, tech };
    let setting = await Setting.findOne({ key: 'tokenLimits' });
    
    if (setting) {
      setting.value = JSON.stringify(tokenLimits);
      await setting.save();
    } else {
      await Setting.create({ key: 'tokenLimits', value: JSON.stringify(tokenLimits) });
    }
    
    res.json({ success: true, data: tokenLimits });
  } catch (err) {
    res.status(500).json({ error: '토큰 제한 설정 저장 실패' });
  }
});

// ===== Perplexity 타임아웃 설정 API =====
app.get('/api/perplexity-timeout', async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'perplexityTimeout' });
    const defaultTimeout = 300000; // 5분 (기본값)
    const timeout = setting && setting.value ? parseInt(setting.value) : defaultTimeout;
    res.json({ timeout });
  } catch (err) {
    console.error('타임아웃 설정 조회 실패:', err);
    res.status(500).json({ error: '타임아웃 설정 조회 실패' });
  }
});

app.post('/api/perplexity-timeout', async (req, res) => {
  try {
    const { timeout } = req.body;
    if (!timeout || timeout < 60000) {
      return res.status(400).json({ error: '타임아웃은 최소 60000ms (1분) 이상이어야 합니다.' });
    }
    
    let setting = await Setting.findOne({ key: 'perplexityTimeout' });
    
    if (setting) {
      setting.value = timeout.toString();
      await setting.save();
    } else {
      await Setting.create({ key: 'perplexityTimeout', value: timeout.toString() });
    }
    
    res.json({ success: true, timeout: parseInt(timeout) });
  } catch (err) {
    console.error('타임아웃 설정 저장 실패:', err);
    res.status(500).json({ error: '타임아웃 설정 저장 실패' });
  }
});

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

// 디버그: 빌드된 파일 버전 확인
app.get('/debug/version', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const appJsPath = path.join(__dirname, 'dist', 'app.js');
    try {
        const content = fs.readFileSync(appJsPath, 'utf8');
        const hasVersion = content.includes('함수 버전: 2025-12-02-v2');
        const hasOldError = content.includes('공휴일 데이터를 가져오는데 실패했습니다');
        const fileSize = fs.statSync(appJsPath).size;
        const fileDate = fs.statSync(appJsPath).mtime;
        res.json({
            success: true,
            hasVersion: hasVersion,
            hasOldError: hasOldError,
            fileSize: fileSize,
            fileDate: fileDate,
            filePath: appJsPath
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            filePath: appJsPath
        });
    }
});

// ========================================
// 어드민 래퍼 API (카카오봇 관리용)
// ========================================

// 어드민 세션 토큰 관리 (메모리 기반, 서버 재시작 시 초기화)
const adminSessions = new Map();
const crypto = require('crypto');

// 세션 생성 함수
function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24시간 후 만료
  adminSessions.set(token, { expiresAt });
  return token;
}

// 세션 검증 미들웨어
function adminAuthMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  
  if (!token) {
    return res.status(401).json({ error: '관리자 인증 토큰이 없습니다' });
  }
  
  const session = adminSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: '유효하지 않은 세션입니다' });
  }
  
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return res.status(401).json({ error: '세션이 만료되었습니다' });
  }
  
  next();
}

// 1. POST /api/admin/auth - 어드민 인증
app.post('/api/admin/auth', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: '비밀번호가 필요합니다' });
    }
    
    // 환경변수 또는 기본값으로 비밀번호 확인
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== adminPassword) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
    }
    
    // 세션 토큰 생성
    const token = createAdminSession();
    
    console.log('어드민 인증 성공');
    res.json({ success: true, token });
  } catch (error) {
    console.error('어드민 인증 오류:', error);
    res.status(500).json({ error: '인증 처리 실패' });
  }
});

// 2. GET /api/admin/bot/config - 봇 설정 조회
app.get('/api/admin/bot/config', adminAuthMiddleware, async (req, res) => {
  try {
    const roomsSetting = await Setting.findOne({ key: 'kakao_rooms' });
    const adminsSetting = await Setting.findOne({ key: 'kakao_admins' });
    
    const rooms = roomsSetting ? JSON.parse(roomsSetting.value) : [];
    const admins = adminsSetting ? JSON.parse(adminsSetting.value) : [];
    
    console.log('봇 설정 조회 (어드민)');
    res.json({
      rooms,
      admins,
      pollIntervalSec: 15
    });
  } catch (error) {
    console.error('봇 설정 조회 오류:', error);
    res.status(500).json({ error: '설정 조회 실패' });
  }
});

// 3. POST /api/admin/bot/config - 봇 설정 저장
app.post('/api/admin/bot/config', adminAuthMiddleware, async (req, res) => {
  try {
    const { rooms, admins } = req.body;
    
    // 유효성 검증
    if (!Array.isArray(rooms) || !Array.isArray(admins)) {
      return res.status(400).json({ error: '잘못된 요청 형식' });
    }
    
    // Setting 저장
    await Setting.findOneAndUpdate(
      { key: 'kakao_rooms' },
      { value: JSON.stringify(rooms) },
      { upsert: true }
    );
    
    await Setting.findOneAndUpdate(
      { key: 'kakao_admins' },
      { value: JSON.stringify(admins) },
      { upsert: true }
    );
    
    console.log('봇 설정 저장 완료 (어드민)');
    res.json({ success: true, message: '설정이 저장되었습니다' });
  } catch (error) {
    console.error('봇 설정 저장 오류:', error);
    res.status(500).json({ error: '설정 저장 실패' });
  }
});

// 4. GET /api/admin/bot/outbox/stats - Outbox 통계 조회
app.get('/api/admin/bot/outbox/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 상태별 카운트
    const [pending, sent, failed] = await Promise.all([
      BotOutbox.countDocuments({ status: 'pending' }),
      BotOutbox.countDocuments({ status: 'sent' }),
      BotOutbox.countDocuments({ status: 'failed' })
    ]);
    
    // 최근 로그
    const recentLogs = await BotOutbox.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('targetRoom message status sentAt type attempts lastError createdAt')
      .lean();
    
    res.json({
      pending,
      sent,
      failed,
      recentLogs: recentLogs.map(log => ({
        id: log._id.toString(),
        targetRoom: log.targetRoom,
        message: log.message.substring(0, 100) + (log.message.length > 100 ? '...' : ''),
        status: log.status,
        sentAt: log.sentAt,
        type: log.type,
        attempts: log.attempts,
        lastError: log.lastError,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    console.error('봇 통계 조회 오류:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// ========================================
// Bot API 엔드포인트
// ========================================

// 1. GET /api/bot/config - 봇 설정 조회
app.get('/api/bot/config', botAuthMiddleware, async (req, res) => {
  try {
    const roomsSetting = await Setting.findOne({ key: 'kakao_rooms' });
    const adminsSetting = await Setting.findOne({ key: 'kakao_admins' });
    
    const rooms = roomsSetting ? JSON.parse(roomsSetting.value) : [];
    const admins = adminsSetting ? JSON.parse(adminsSetting.value) : [];
    
    res.json({
      admins,
      rooms,
      pollIntervalSec: 15
    });
  } catch (error) {
    console.error('Bot config 조회 오류:', error);
    res.status(500).json({ error: '설정 조회 실패' });
  }
});

// 2. POST /api/bot/config - 봇 설정 변경
app.post('/api/bot/config', botAuthMiddleware, async (req, res) => {
  try {
    const { admins, rooms } = req.body;
    
    // 유효성 검증
    if (!Array.isArray(admins) || !Array.isArray(rooms)) {
      return res.status(400).json({ error: '잘못된 요청 형식' });
    }
    
    // Setting 저장
    await Setting.findOneAndUpdate(
      { key: 'kakao_rooms' },
      { value: JSON.stringify(rooms) },
      { upsert: true }
    );
    
    await Setting.findOneAndUpdate(
      { key: 'kakao_admins' },
      { value: JSON.stringify(admins) },
      { upsert: true }
    );
    
    console.log('Bot config 저장 완료');
    res.json({ success: true, message: '설정이 저장되었습니다' });
  } catch (error) {
    console.error('Bot config 저장 오류:', error);
    res.status(500).json({ error: '설정 저장 실패' });
  }
});

// 3. POST /api/bot/outbox/pull - 메시지 가져오기 (폴링)
app.post('/api/bot/outbox/pull', botAuthMiddleware, async (req, res) => {
  try {
    const { deviceId, limit = 20 } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId 필수' });
    }
    
    const now = new Date();
    const lockExpireTime = new Date(now.getTime() - 5 * 60 * 1000); // 5분 전
    
    // 조회 조건:
    // 1. status='pending'
    // 2. attempts < 5
    // 3. 잠금 없음 또는 잠금 만료
    const items = await BotOutbox.find({
      status: 'pending',
      attempts: { $lt: 5 },
      $or: [
        { lockedAt: null },
        { lockedAt: { $lt: lockExpireTime } }
      ]
    })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .lean();
    
    // 지수 백오프 필터링
    const readyItems = items.filter(item => {
      if (item.attempts === 0) return true;
      const waitMs = Math.pow(2, item.attempts - 1) * 60 * 1000;
      const nextRetryTime = new Date(item.updatedAt.getTime() + waitMs);
      return now >= nextRetryTime;
    });
    
    // 잠금 설정
    const ids = readyItems.map(item => item._id);
    if (ids.length > 0) {
      await BotOutbox.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            lockedAt: now,
            lockedByDeviceId: deviceId
          }
        }
      );
    }
    
    // 응답 포맷
    const response = {
      items: readyItems.map(item => ({
        id: item._id.toString(),
        targetRoom: item.targetRoom,
        message: item.message,
        type: item.type,
        priority: item.priority
      }))
    };
    
    if (response.items.length > 0) {
      console.log(`Bot pull: ${response.items.length}개 메시지 전달 (device: ${deviceId})`);
    }
    
    res.json(response);
  } catch (error) {
    console.error('Bot pull 오류:', error);
    res.status(500).json({ error: '메시지 조회 실패' });
  }
});

// 4. POST /api/bot/outbox/ack - 전송 결과 보고
app.post('/api/bot/outbox/ack', botAuthMiddleware, async (req, res) => {
  try {
    const { deviceId, results } = req.body;
    
    if (!deviceId || !Array.isArray(results)) {
      return res.status(400).json({ error: '잘못된 요청' });
    }
    
    let updated = 0;
    
    for (const result of results) {
      const { id, status, error } = result;
      
      if (status === 'sent') {
        // 전송 성공
        await BotOutbox.updateOne(
          { _id: id },
          {
            $set: {
              status: 'sent',
              sentAt: new Date(),
              lockedAt: null,
              lockedByDeviceId: null
            }
          }
        );
        updated++;
        console.log(`Bot ack: 전송 성공 (id: ${id})`);
      } else if (status === 'failed') {
        // 전송 실패
        const item = await BotOutbox.findById(id);
        if (item) {
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= 5 ? 'failed' : 'pending';
          
          await BotOutbox.updateOne(
            { _id: id },
            {
              $set: {
                status: newStatus,
                attempts: newAttempts,
                lastError: error || '알 수 없는 오류',
                lockedAt: null,
                lockedByDeviceId: null
              }
            }
          );
          updated++;
          console.log(`Bot ack: 전송 실패 (id: ${id}, attempts: ${newAttempts}, status: ${newStatus})`);
        }
      }
    }
    
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Bot ack 오류:', error);
    res.status(500).json({ error: '결과 처리 실패' });
  }
});

// 5. GET /api/bot/outbox/stats - 통계 조회
app.get('/api/bot/outbox/stats', botAuthMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 상태별 카운트
    const [pending, sent, failed] = await Promise.all([
      BotOutbox.countDocuments({ status: 'pending' }),
      BotOutbox.countDocuments({ status: 'sent' }),
      BotOutbox.countDocuments({ status: 'failed' })
    ]);
    
    // 최근 로그
    const recentLogs = await BotOutbox.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('targetRoom message status sentAt type attempts lastError createdAt')
      .lean();
    
    res.json({
      pending,
      sent,
      failed,
      recentLogs: recentLogs.map(log => ({
        id: log._id.toString(),
        targetRoom: log.targetRoom,
        message: log.message.substring(0, 100) + (log.message.length > 100 ? '...' : ''),
        status: log.status,
        sentAt: log.sentAt,
        type: log.type,
        attempts: log.attempts,
        lastError: log.lastError,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    console.error('Bot stats 조회 오류:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

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
    } else {
      console.log(`[서버] 크론 작업이 이미 등록되어 있어 초기화를 건너뜁니다.`);
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
app.use('/api/weight-settings', weightSettingsRouter);
app.use('/api/hot-topic-analysis', hotTopicAnalysisRouter);

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

// === 오래된 PDF 파일 자동 삭제 크론 (매일 새벽 3시) ===
cron.schedule('0 3 * * *', async () => {
  try {
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      return;
    }

    const files = fs.readdirSync(reportsDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
    let deletedCount = 0;

    files.forEach(file => {
      if (file.endsWith('.pdf')) {
        const filePath = path.join(reportsDir, file);
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[PDF 자동삭제] 오래된 파일 삭제: ${file}`);
          }
        } catch (error) {
          console.error(`[PDF 자동삭제] 파일 삭제 실패: ${file}`, error.message);
        }
      }
    });

    if (deletedCount > 0) {
      console.log(`[PDF 자동삭제] 완료: ${deletedCount}개 파일 삭제됨`);
    }
  } catch (error) {
    console.error('[PDF 자동삭제] 크론 작업 오류:', error.message);
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

// === DB 진단 API ===
app.get('/api/db-diagnosis', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 각 테이블의 데이터 현황
    const [riskCount, partnerCount, techCount] = await Promise.all([
      RiskNews.countDocuments(),
      PartnerNews.countDocuments(),
      TechNews.countDocuments()
    ]);
    
    // 오늘 수집된 데이터
    const [todayRisk, todayPartner, todayTech] = await Promise.all([
      RiskNews.countDocuments({ aiGeneratedAt: { $gte: today, $lt: tomorrow } }),
      PartnerNews.countDocuments({ aiGeneratedAt: { $gte: today, $lt: tomorrow } }),
      TechNews.countDocuments({ aiGeneratedAt: { $gte: today, $lt: tomorrow } })
    ]);
    
    // 최근 데이터 샘플
    const [recentRisk, recentPartner, recentTech] = await Promise.all([
      RiskNews.findOne().sort({ createdAt: -1 }),
      PartnerNews.findOne().sort({ createdAt: -1 }),
      TechNews.findOne().sort({ createdAt: -1 })
    ]);
    
    // AI 분석 보고서 현황
    const [reportCount, todayReport] = await Promise.all([
      RiskAnalysisReport.countDocuments() + PartnerAnalysisReport.countDocuments() + TechAnalysisReport.countDocuments(),
      RiskAnalysisReport.countDocuments({ date: { $gte: today, $lt: tomorrow } }) + 
      PartnerAnalysisReport.countDocuments({ date: { $gte: today, $lt: tomorrow } }) + 
      TechAnalysisReport.countDocuments({ date: { $gte: today, $lt: tomorrow } })
    ]);
    
    res.json({
      success: true,
      data: {
        tables: {
          risk: { total: riskCount, today: todayRisk, latest: recentRisk },
          partner: { total: partnerCount, today: todayPartner, latest: recentPartner },
          tech: { total: techCount, today: todayTech, latest: recentTech }
        },
        reports: {
          total: reportCount,
          today: todayReport
        },
        issues: []
      }
    });
  } catch (error) {
    console.error('DB 진단 실패:', error);
    res.status(500).json({ error: 'DB 진단 중 오류가 발생했습니다.' });
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

// === AI API 테스트 엔드포인트 ===
app.post('/api/test-perplexity', async (req, res) => {
  try {
    const { category, customPrompt } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: '카테고리가 필요합니다.' });
    }
    
    // 실제 DB에서 키워드 가져오기
    let keywords = [];
    switch (category) {
      case 'risk':
        const riskKeywords = await RiskKeyword.find();
        keywords = riskKeywords.map(k => k.value);
        break;
      case 'partner':
        const partnerConditions = await PartnerCondition.find();
        keywords = partnerConditions.map(c => c.value);
        break;
      case 'tech':
        const techTopics = await TechTopic.find();
        keywords = techTopics.map(t => t.value);
        break;
      default:
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    
    if (keywords.length === 0) {
      return res.status(400).json({ error: `${category} 카테고리에 키워드가 없습니다.` });
    }
    
    console.log(`[API 테스트] 카테고리: ${category}, 실제 DB 키워드: ${keywords.join(', ')}`);
    
    // 실제 DB에서 커스텀 프롬프트 가져오기
    let dbCustomPrompt = '';
    try {
      const promptSetting = await Setting.findOne({ key: `prompt_${category}` });
      if (promptSetting && promptSetting.value) {
        dbCustomPrompt = promptSetting.value;
        console.log(`[API 테스트] DB 커스텀 프롬프트 사용: ${dbCustomPrompt.substring(0, 50)}...`);
      }
    } catch (e) {
      console.log(`[API 테스트] DB 프롬프트 불러오기 실패`);
    }
    
    // 카테고리별 기본 컨텍스트 설정 (커스텀 프롬프트가 없을 때 사용)
    let defaultCategoryContext = '';
    switch (category) {
      case 'risk':
        defaultCategoryContext = '리스크 이슈 및 위험 요소에 중점을 두고 분석해주세요.';
        break;
      case 'partner':
        defaultCategoryContext = '제휴처 및 파트너사 관련 비즈니스 뉴스에 중점을 두고 분석해주세요.';
        break;
      case 'tech':
        defaultCategoryContext = '신기술 동향 및 혁신 기술에 중점을 두고 분석해주세요.';
        break;
      default:
        defaultCategoryContext = '일반적인 뉴스 분석을 진행해주세요.';
    }
    
    // 커스텀 프롬프트가 있으면 사용, 없으면 기본 컨텍스트 사용
    const categoryContext = customPrompt || dbCustomPrompt || defaultCategoryContext;
    
    // 항상 기본 프롬프트 구조 사용
    const prompt = `
당신은 뉴스 분석 전문가입니다. 다음 키워드들에 대한 최신 뉴스를 검색하고 분석해주세요: ${keywords.join(', ')}

카테고리: ${category}

요구사항:
1. 키워드와 관련된 최근 24시간 내의 뉴스만 수집
2. 각 뉴스에 대해 다음 정보를 제공:
   - 제목: 뉴스 제목
   - 링크: 실제 뉴스 URL
   - 언론사: 출처 언론사명
   - 발행일: 뉴스 발행일
   - 요약: 뉴스 내용 요약
3. 뉴스가 없을 경우 "금일은 뉴스가 없습니다" 표시
4. 마지막에 전체 뉴스에 대한 종합 분석 보고서를 추가

분석 보고서 작성 시 다음 내용을 참고하여 작성해주세요:
${categoryContext}

응답 형식:
- 가능하면 JSON 형태로 응답하되, JSON이 어려우면 텍스트 형태로도 가능합니다
- JSON 응답 시 주석을 포함하지 마세요
- 텍스트 응답 시 표 형태나 구조화된 형태로 정리해주세요

예시 JSON 형식:
{
  "news": [
    {
      "title": "뉴스 제목",
      "link": "https://example.com/news/123",
      "source": "언론사명",
      "pubDate": "2025-07-31",
      "summary": "뉴스 요약"
    }
  ],
  "analysis": "전체 분석 보고서"
}
`;

    // Rate Limit 방지를 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 카테고리별 토큰 제한 가져오기
    let setting = await Setting.findOne({ key: 'tokenLimits' });
    let tokenLimits = {
      risk: 3000,
      partner: 3000,
      tech: 3000
    };
    if (setting && setting.value) {
      tokenLimits = JSON.parse(setting.value);
    }
    const maxTokens = tokenLimits[category] === null ? null : (tokenLimits[category] || 3000);
    
    const response = await axios.post(PERPLEXITY_API_URL, {
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens === null ? null : maxTokens,
      temperature: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const aiResponse = response.data.choices[0].message.content;
    const finishReason = response.data.choices[0].finish_reason;
    const usage = response.data.usage;
    
    console.log(`[API 테스트] Perplexity AI 응답 수신`);
    console.log(`[API 테스트] Finish reason: ${finishReason}`);
    console.log(`[API 테스트] Token usage: ${usage?.total_tokens || 'N/A'}/${usage?.completion_tokens || 'N/A'}`);
    
    // 토큰 잘림 감지 및 재시도 로직
    if (finishReason === 'length') {
      console.warn(`[API 테스트] ⚠️ 응답이 max_tokens(${maxTokens})로 잘렸습니다!`);
      console.warn(`[API 테스트] 실제 사용된 토큰: ${usage?.completion_tokens || 'N/A'}`);
      
      // 토큰 제한을 2배로 늘려서 재시도 (무제한인 경우 8000으로 설정)
      const retryMaxTokens = maxTokens === null ? 8000 : maxTokens * 2;
      console.log(`[API 테스트] 토큰 제한을 ${retryMaxTokens}로 늘려서 재시도합니다...`);
      
      try {
        const retryResponse = await axios.post(PERPLEXITY_API_URL, {
          model: 'sonar-pro',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: retryMaxTokens,
          temperature: 0.5
        }, {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        });

        const retryAiResponse = retryResponse.data.choices[0].message.content;
        const retryFinishReason = retryResponse.data.choices[0].finish_reason;
        const retryUsage = retryResponse.data.usage;
        
        console.log(`[API 테스트] 재시도 완료 - Finish reason: ${retryFinishReason}`);
        console.log(`[API 테스트] 재시도 Token usage: ${retryUsage?.total_tokens || 'N/A'}/${retryUsage?.completion_tokens || 'N/A'}`);
        
        if (retryFinishReason === 'length') {
          console.warn(`[API 테스트] ⚠️ 재시도에서도 토큰 제한에 걸렸습니다!`);
        }
        
        // 재시도 응답으로 처리
        const aiResponse = retryAiResponse;
        const finishReason = retryFinishReason;
        const usage = retryUsage;
        
      } catch (retryError) {
        console.error(`[API 테스트] 재시도 중 오류 발생:`, retryError.message);
        // 재시도 실패 시 원래 응답 사용
      }
    }
    
    // JSON 파싱 시도
    try {
      const result = JSON.parse(aiResponse);
      console.log(`[API 테스트] JSON 파싱 성공`);
      
      res.json({
        success: true,
        data: result,
        rawResponse: aiResponse
      });
      
    } catch (parseError) {
      console.error(`[API 테스트] JSON 파싱 실패:`, parseError);
      console.error(`[API 테스트] 원본 응답:`, aiResponse);
      
      res.json({
        success: false,
        error: 'JSON 파싱 실패',
        rawResponse: aiResponse,
        parseError: parseError.message
      });
    }
    
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`[API 테스트] Rate Limit 도달`);
      res.status(429).json({ error: 'Rate Limit 도달' });
    } else {
      console.error(`[API 테스트] API 호출 실패:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }
});

// 데이터 삭제 API (개발용)
app.delete('/api/clear-all-news', async (req, res) => {
    try {
        console.log('🗑️ 모든 뉴스 데이터 삭제 시작...');
        
        // 뉴스 데이터 삭제
        const riskNewsResult = await RiskNews.deleteMany({});
        const partnerNewsResult = await PartnerNews.deleteMany({});
        const techNewsResult = await TechNews.deleteMany({});
        
        // AI 분석 보고서 삭제
        const riskAnalysisResult = await RiskAnalysisReport.deleteMany({});
        const partnerAnalysisResult = await PartnerAnalysisReport.deleteMany({});
        const techAnalysisResult = await TechAnalysisReport.deleteMany({});
        
        const result = {
            success: true,
            message: '모든 뉴스 데이터 삭제 완료',
            deleted: {
                riskNews: riskNewsResult.deletedCount,
                partnerNews: partnerNewsResult.deletedCount,
                techNews: techNewsResult.deletedCount,
                riskAnalysis: riskAnalysisResult.deletedCount,
                partnerAnalysis: partnerAnalysisResult.deletedCount,
                techAnalysis: techAnalysisResult.deletedCount
            }
        };
        
        console.log('✅ 삭제 결과:', result);
        res.json(result);
        
    } catch (error) {
        console.error('❌ 데이터 삭제 중 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// === 뉴스 클리핑용 기사 수집 API ===
app.post('/api/news-clipping/collect-articles', cors(), async (req, res) => {
    try {
        const { date, customKeywords } = req.body; // 기준일자 (YYYY-MM-DD 형식)
        
        if (!date) {
            return res.status(400).json({ error: '기준일자가 필요합니다.' });
        }

        console.log(`[뉴스 클리핑] 기사 수집 시작: ${date}`);

        // 카테고리별 키워드 정의
        const defaultCategoryKeywords = {
            '코레일유통': ['코레일유통', '스토리웨이', '역사 상업시설', '코레일 역세권', '코레일 상업시설'],
            '철도': ['코레일', 'KTX', 'SRT', 'GTX', '도시철도', '철도 노선', '철도 안전', '역세권 개발', '철도 정책', '국가철도공단', 'SR', '철도 파업', '철도 사고'],
            '지역본부/계열사': ['코레일관광개발', '코레일네트웍스', '코레일테크', '코레일 지역본부'],
            '공공기관': ['기재부', '국토부', 'SOC 투자', '역세권 규제', '공공자산', '물가 정책', '배송 정책', '노동 정책'],
            '유통': ['편의점', '도시락', '간편식', '역세권 상권', 'K-푸드', 'K-스낵', '캐릭터 콜라보', '유통 트렌드', '소비 트렌드', 'F&B', '프랜차이즈']
        };
        const normalizeKeywords = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
            return String(val).split(/[\n,]/).map(v => v.trim()).filter(Boolean);
        };
        const categoryKeywords = {
            '코레일유통': normalizeKeywords(customKeywords?.korail).length ? normalizeKeywords(customKeywords?.korail) : defaultCategoryKeywords['코레일유통'],
            '철도': normalizeKeywords(customKeywords?.rail).length ? normalizeKeywords(customKeywords?.rail) : defaultCategoryKeywords['철도'],
            '지역본부/계열사': normalizeKeywords(customKeywords?.subsidiary).length ? normalizeKeywords(customKeywords?.subsidiary) : defaultCategoryKeywords['지역본부/계열사'],
            '공공기관': normalizeKeywords(customKeywords?.gov).length ? normalizeKeywords(customKeywords?.gov) : defaultCategoryKeywords['공공기관'],
            '유통': normalizeKeywords(customKeywords?.retail).length ? normalizeKeywords(customKeywords?.retail) : defaultCategoryKeywords['유통']
        };

        // 날짜 범위 계산 (전일 18시 ~ 당일 23:59) - 한국시간 기준
        // date는 YYYY-MM-DD 형식이므로 한국시간 기준으로 파싱
        const targetDate = new Date(date + 'T00:00:00+09:00'); // 한국시간(UTC+9) 기준
        const prevDay = new Date(targetDate);
        prevDay.setDate(prevDay.getDate() - 1);
        prevDay.setHours(18, 0, 0, 0);
        const endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);

        const allArticles = [];

        // 카테고리별로 순차 처리
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            console.log(`[뉴스 클리핑] ${category} 카테고리 처리 중...`);
            
            const categoryArticles = []; // 카테고리별 기사 임시 저장
            const categoryArticleMap = new Map(); // 카테고리별 중복 제거용 (제목+URL+날짜)
            
            for (const keyword of keywords) {
                try {
                    // 네이버 뉴스 API 호출
                    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                        headers: {
                            'X-Naver-Client-Id': NAVER_CLIENT_ID,
                            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
                        },
                        params: {
                            query: keyword,
                            display: 100,
                            sort: 'date', // 최신순
                            start: 1
                        }
                    });

                    const items = response.data.items || [];
                    
                    // 날짜 필터링
                    for (const item of items) {
                        const pubDate = new Date(item.pubDate);
                        
                        // 날짜 범위 체크 (전일 18시 ~ 당일 23:59) - 한국시간 기준
                        if (pubDate < prevDay || pubDate > endDate) {
                            continue;
                        }

                        // HTML 태그 제거
                        const title = item.title.replace(/<[^>]*>/g, '').trim();
                        const description = item.description ? item.description.replace(/<[^>]*>/g, '').trim() : '';
                        
                        // 중복 체크 (제목+URL+날짜)
                        const dateKey = pubDate.toISOString().split('T')[0];
                        const articleUrl = item.originallink || item.link;
                        const uniqueKey = `${title}|${articleUrl}|${dateKey}`;
                        
                        if (!categoryArticleMap.has(uniqueKey)) {
                            categoryArticleMap.set(uniqueKey, true);
                            
                            // 언론사명 추출 (URL에서 도메인 추출)
                            let publisher = '알 수 없음';
                            try {
                                if (articleUrl) {
                                    const urlObj = new URL(articleUrl);
                                    let hostname = urlObj.hostname.replace('www.', '').replace('m.', '');
                                    // 도메인에서 언론사명 추출 (예: news.naver.com -> naver, mk.co.kr -> mk)
                                    const domainParts = hostname.split('.');
                                    if (domainParts.length > 1) {
                                        // .co.kr, .com 등 제거하고 첫 번째 부분 사용
                                        publisher = domainParts[0];
                                        // 한글 도메인인 경우 전체 사용
                                        if (/[가-힣]/.test(hostname)) {
                                            publisher = hostname.split('.')[0];
                                        }
                                    } else {
                                        publisher = hostname;
                                    }
                                }
                            } catch (e) {
                                // URL 파싱 실패 시 기본값 사용
                                publisher = '알 수 없음';
                            }
                            
                            categoryArticles.push({
                                category: category,
                                title: title,
                                publisher: publisher,
                                url: articleUrl,
                                description: description,
                                pubDate: pubDate.toISOString(),
                                keyword: keyword
                            });
                        }
                    }

                    // API 호출 간격 조절 (Rate Limit 방지)
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                } catch (error) {
                    console.error(`[뉴스 클리핑] 키워드 "${keyword}" 검색 실패:`, error.message);
                    // 개별 키워드 실패해도 계속 진행
                }
            }
            
            // 카테고리별로 발행일 기준 정렬 (최신순)
            categoryArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            
            // 카테고리별 최대 100건까지만 사용
            const limitedCategoryArticles = categoryArticles.slice(0, 100);
            
            // 전체 리스트에 추가
            allArticles.push(...limitedCategoryArticles);
            
            console.log(`[뉴스 클리핑] ${category}: 총 ${categoryArticles.length}건 수집 → 최근보도 기준 100건 제한 → ${limitedCategoryArticles.length}건 사용`);
        }

        // 카테고리별로 그룹화
        const articlesByCategory = {};
        for (const article of allArticles) {
            if (!articlesByCategory[article.category]) {
                articlesByCategory[article.category] = [];
            }
            articlesByCategory[article.category].push(article);
        }

        console.log(`[뉴스 클리핑] 기사 수집 완료: 총 ${allArticles.length}건`);
        console.log(`[뉴스 클리핑] 카테고리별:`, Object.entries(articlesByCategory).map(([cat, arts]) => `${cat}: ${arts.length}건`).join(', '));

        // 이용통계 기록
        await logServerAction('뉴스클리핑기사수집', { 
            date: date, 
            totalArticles: allArticles.length,
            categories: Object.keys(articlesByCategory).join(', ')
        });

        res.json({
            success: true,
            date: date,
            totalArticles: allArticles.length,
            articlesByCategory: articlesByCategory,
            articles: allArticles
        });

    } catch (error) {
        console.error('[뉴스 클리핑] 기사 수집 오류:', error);
        res.status(500).json({ 
            error: '기사 수집 중 오류가 발생했습니다.',
            message: error.message 
        });
    }
});

// === 뉴스 클리핑용 Perplexity API 프록시 ===
// OPTIONS 요청 처리 (CORS preflight)
app.options('/api/perplexity-chat', cors());

app.post('/api/perplexity-chat', cors(), async (req, res) => {
    try {
        const { messages, model = 'sonar-pro', max_tokens = 8000, temperature = 0.5 } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        if (!PERPLEXITY_API_KEY) {
            return res.status(500).json({ error: 'Perplexity API 키가 설정되지 않았습니다.' });
        }

        console.log('[뉴스 클리핑] Perplexity API 호출 시작');
        
        // 프롬프트 길이 확인 (디버깅용)
        const promptLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
        console.log(`[뉴스 클리핑] 프롬프트 총 길이: ${promptLength}자 (약 ${Math.ceil(promptLength / 4)} 토큰 추정)`);

        const response = await axios.post(PERPLEXITY_API_URL, {
            model: model,
            messages: messages,
            max_tokens: max_tokens,
            temperature: temperature
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2분 타임아웃
        });

        const aiResponse = response.data.choices[0].message.content;
        const finishReason = response.data.choices[0].finish_reason;
        const usage = response.data.usage;

        console.log('[뉴스 클리핑] Perplexity API 응답 수신');
        console.log(`[뉴스 클리핑] Finish reason: ${finishReason}`);
        console.log(`[뉴스 클리핑] Token usage: ${usage?.total_tokens || 'N/A'}`);

        // 이용통계 기록 (성공 시)
        try {
            await UserActionLog.create({
                type: 'news-clipping',
                action: '뉴스클리핑자료생성',
                userId: req.ip || 'unknown',
                userAgent: req.get('user-agent') || 'unknown',
                meta: {
                    model: model,
                    finishReason: finishReason,
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0,
                    maxTokens: max_tokens
                }
            });
        } catch (logError) {
            console.error('[뉴스 클리핑] 통계 기록 실패:', logError.message);
            // 통계 기록 실패해도 API 호출은 성공으로 처리
        }

        // 토큰 잘림 감지 및 재시도
        if (finishReason === 'length') {
            console.warn('[뉴스 클리핑] ⚠️ 응답이 max_tokens로 잘렸습니다!');
            
            const retryMaxTokens = max_tokens * 2;
            console.log(`[뉴스 클리핑] 토큰 제한을 ${retryMaxTokens}로 늘려서 재시도합니다...`);
            
            try {
                const retryResponse = await axios.post(PERPLEXITY_API_URL, {
                    model: model,
                    messages: messages,
                    max_tokens: retryMaxTokens,
                    temperature: temperature
                }, {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000
                });

                const retryAiResponse = retryResponse.data.choices[0].message.content;
                const retryFinishReason = retryResponse.data.choices[0].finish_reason;

                if (retryFinishReason === 'stop') {
                    console.log('[뉴스 클리핑] ✅ 재시도 성공!');
                    
                    // 재시도 성공 시 통계 기록 업데이트 (재시도 정보 포함)
                    try {
                        await UserActionLog.create({
                            type: 'news-clipping',
                            action: '뉴스클리핑자료생성',
                            userId: req.ip || 'unknown',
                            userAgent: req.get('user-agent') || 'unknown',
                            meta: {
                                model: model,
                                finishReason: retryFinishReason,
                                promptTokens: retryResponse.data.usage?.prompt_tokens || 0,
                                completionTokens: retryResponse.data.usage?.completion_tokens || 0,
                                totalTokens: retryResponse.data.usage?.total_tokens || 0,
                                maxTokens: retryMaxTokens,
                                retried: true,
                                originalMaxTokens: max_tokens
                            }
                        });
                    } catch (logError) {
                        console.error('[뉴스 클리핑] 재시도 통계 기록 실패:', logError.message);
                    }
                    
                    return res.json({
                        choices: [{
                            message: {
                                content: retryAiResponse
                            },
                            finish_reason: retryFinishReason
                        }],
                        usage: retryResponse.data.usage
                    });
                }
            } catch (retryError) {
                console.error('[뉴스 클리핑] 재시도 중 오류:', retryError.message);
            }
        }

        res.json({
            choices: [{
                message: {
                    content: aiResponse
                },
                finish_reason: finishReason
            }],
            usage: usage
        });

    } catch (error) {
        console.error('[뉴스 클리핑] Perplexity API 호출 실패:', error.message);
        
        // 400 에러의 상세 정보 로깅
        if (error.response && error.response.status === 400) {
            console.error('[뉴스 클리핑] 400 에러 상세:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                message: error.message
            });
        }
        
        if (error.response && error.response.status === 429) {
            res.status(429).json({ error: 'Rate Limit 도달. 잠시 후 다시 시도해주세요.' });
        } else if (error.response) {
            res.status(error.response.status).json({ 
                error: 'API 호출 실패', 
                message: error.response.data?.message || error.message 
            });
        } else {
            res.status(500).json({ error: '서버 오류', message: error.message });
        }
    }
});

// === 뉴스 클리핑용 PDF 생성 API ===
// OPTIONS 요청 처리 (CORS preflight)
app.options('/api/news-clipping/generate-pdf', cors());
app.options('/api/news-clipping/download-pdf/:filename', cors());

app.post('/api/news-clipping/generate-pdf', cors(), async (req, res) => {
    try {
        const { content, filename } = req.body;

        if (!content) {
            return res.status(400).json({ 
                success: false, 
                error: '콘텐츠가 필요합니다.' 
            });
        }

        console.log('[뉴스 클리핑] PDF 생성 시작');

        // 파일명 생성 (기본값: 뉴스클리핑_날짜)
        const defaultFilename = filename || `뉴스클리핑_${new Date().toISOString().split('T')[0]}`;
        
        // PDF 생성 (뉴스 클리핑 전용 생성기 사용)
        const result = await newsClippingPdfGenerator.convertToPDF(content, defaultFilename);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'PDF 생성 실패'
            });
        }

        console.log('[뉴스 클리핑] PDF 생성 완료:', result.fileName);

        // 이용통계 기록
        try {
            await UserActionLog.create({
                type: 'news-clipping',
                action: '뉴스클리핑PDF생성',
                userId: req.ip || 'unknown',
                userAgent: req.get('user-agent') || 'unknown',
                meta: {
                    filename: result.fileName,
                    fileSize: result.fileSize,
                    date: defaultFilename
                }
            });
        } catch (logError) {
            console.error('[뉴스 클리핑] 통계 기록 실패:', logError.message);
        }

        // 대시보드와 동일한 형식으로 fileName만 반환
        res.json({
            success: true,
            data: {
                fileName: result.fileName,
                fileSize: result.fileSize
            }
        });

    } catch (error) {
        console.error('[뉴스 클리핑] PDF 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: 'PDF 생성 중 오류가 발생했습니다.',
            message: error.message
        });
    }
});

// PDF 다운로드 API (대시보드와 동일한 방식)
app.get('/api/news-clipping/download-pdf/:filename', cors(), async (req, res) => {
    try {
        const { filename } = req.params;
        const path = require('path');
        const fs = require('fs');
        
        const reportsDir = path.join(__dirname, 'reports');
        const filePath = path.join(reportsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('[뉴스 클리핑] PDF 다운로드 오류:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: '파일 다운로드 중 오류가 발생했습니다.'
                    });
                }
            }
        });

    } catch (error) {
        console.error('[뉴스 클리핑] PDF 다운로드 오류:', error);
        res.status(500).json({
            success: false,
            message: 'PDF 다운로드 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});