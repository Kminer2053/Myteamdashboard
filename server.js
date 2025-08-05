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
const RiskAnalysisReport = require('./models/RiskAnalysisReport');
const PartnerAnalysisReport = require('./models/PartnerAnalysisReport');
const TechAnalysisReport = require('./models/TechAnalysisReport');
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// === 공통 DB 저장 함수 ===
async function saveNewsToDB(newsItems, model, category, keywords) {
  let inserted = 0;
  let duplicate = 0;
  let skipped = 0;
  const today = await getKoreaToday();
  
  console.log(`[DB 저장][${category}] 금일 기준: ${today}, 총 ${newsItems.length}건 처리 시작`);
  
  for (const item of newsItems) {
    try {
      // 디버깅: 각 뉴스 아이템 정보 로그
      console.log(`[DEBUG][${category}] ===== 뉴스 아이템 정보 =====`);
      console.log(`제목: ${item.title}`);
      console.log(`링크: ${item.link}`);
      console.log(`언론사: ${item.source}`);
      console.log(`발행일: ${item.pubDate}`);
      console.log(`AI요약: ${item.aiSummary}`);
      console.log(`[DEBUG][${category}] ===== 아이템 끝 =====`);
      
      // 1. AI 요약이 있는 뉴스만 DB에 저장
      if (!item.aiSummary) {
        console.log(`[AI 수집][${category}] AI 요약이 없는 뉴스 건너뜀: ${item.title}`);
        skipped++;
        continue;
      }
      
      // 2. 발행일이 금일이 아닌 뉴스는 저장하지 않기
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      
      if (itemDateStr !== todayDateStr) {
        console.log(`[AI 수집][${category}] 금일이 아닌 뉴스 건너뜀: ${item.title} (${itemDateStr} vs ${todayDateStr})`);
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
    // analysisContent가 객체인 경우 문자열로 변환
    let analysisText = analysisContent;
    if (typeof analysisContent === 'object' && analysisContent !== null) {
      if (category === '리스크이슈') {
        // 리스크이슈의 경우 특별한 형식 처리 (서버 로그에서 확인된 실제 필드명 사용)
        const 뉴스요약 = analysisContent.뉴스요약 || analysisContent['뉴스요약'] || 'N/A';
        const 감성점수 = analysisContent.감성점수 || analysisContent['감성점수'] || 'N/A';
        const 주가정보 = analysisContent.더본코리아주가 || analysisContent['더본코리아 주가'] || analysisContent['더본코리아주가'] || 'N/A';
        
        analysisText = `뉴스요약: ${뉴스요약}\n감성점수: ${감성점수}\n주가정보: ${주가정보}`;
      } else {
        // 일반적인 객체를 JSON 문자열로 변환
        analysisText = JSON.stringify(analysisContent, null, 2);
      }
    } else if (typeof analysisContent === 'string') {
      analysisText = analysisContent;
    } else {
      analysisText = `${category} 수집 완료`;
    }
    
    const reportData = {
      date: new Date(today),
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
          console.log(`[DEBUG][risk] analysis가 없음:`, aiResult);
        }
        
        if (aiResult && aiResult.news && aiResult.news.length > 0) {
          // 실제 뉴스가 있는지 확인 (undefined 필드가 아닌 유효한 뉴스)
          const validNews = aiResult.news.filter(item => 
            item && item.title && item.link && item.aiSummary
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
      } else {
        console.log(`[AI 수집][리스크이슈] 금일 뉴스 없음 - 분석보고서 생성 건너뜀`);
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
          console.log(`[DEBUG][partner] analysis가 없음:`, aiNewsData);
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
          console.log(`[DEBUG][tech] analysis가 없음:`, aiNewsData);
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

    // 디버깅: 실제 전송되는 프롬프트 로그
    console.log(`[DEBUG][${category}] ===== 실제 전송되는 프롬프트 =====`);
    console.log(prompt);
    console.log(`[DEBUG][${category}] ===== 프롬프트 끝 =====`);

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
    
    // 디버깅: Perplexity AI 응답 로그
    console.log(`[DEBUG][${category}] ===== Perplexity AI 응답 =====`);
    console.log(aiResponse);
    console.log(`[DEBUG][${category}] ===== 응답 끝 =====`);
    
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
  
  // JSON 형식인지 확인
  const isJsonResponse = aiResponse.trim().startsWith('{') || aiResponse.trim().startsWith('[');
  
  if (isJsonResponse) {
    console.log(`[AI 수집][${category}] JSON 형식 감지됨, JSON 파싱 시도`);
    try {
      const result = JSON.parse(aiResponse);
      
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
      } else {
        return { news: [result], analysis: null };
      }
    } catch (parseError) {
      console.error(`[AI 수집][${category}] JSON 파싱 실패:`, parseError);
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
  
  // 추출 실패 시 기본 뉴스 객체 생성
  console.log(`[AI 수집][${category}] 기본 뉴스 객체 생성`);
  const fallbackNews = [{
    title: `AI 분석 결과: ${keywords.join(', ')}`,
    link: '#',
    source: 'AI 분석',
    pubDate: new Date().toISOString(),
    keyword: keywords.join(', '), // 키워드 필드 추가
    relatedKeywords: keywords, // 관련 키워드
    aiSummary: text.substring(0, 200) + '...',
    analysisModel: 'perplexity-ai' // AI 모델명
  }];
  
  return { news: fallbackNews, analysis: null };
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
  
  // 뉴스 항목이 없으면 전체 텍스트를 하나의 뉴스로 생성
  if (newsItems.length === 0 && text.length > 50) {
    console.log(`[텍스트 파싱] 뉴스 항목 없음, 전체 텍스트를 뉴스로 생성`);
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim() || '';
    const remainingText = lines.slice(1).join(' ').trim();
    
    newsItems.push({
      title: firstLine.length > 10 ? firstLine.substring(0, 100) : `AI 분석: ${keyword}`,
      link: '#',
      source: 'AI 분석',
      pubDate: new Date().toISOString(),
      aiSummary: remainingText.length > 0 ? remainingText.substring(0, 300) : text.substring(0, 300),
      relatedKeywords: [keyword],
      analysisModel: 'perplexity-ai'
    });
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

// 네이버뉴스 API 비활성화 - Perplexity AI만 사용
app.get('/api/naver-news', async (req, res) => {
  console.log('[API] 네이버뉴스 API 비활성화됨 - Perplexity AI만 사용');
  return res.status(403).json({ 
    error: '네이버뉴스 API가 비활성화되었습니다.',
    message: 'Perplexity AI만 사용하여 뉴스를 수집합니다.',
    note: '이전에 저장된 네이버뉴스 데이터는 여전히 DB에 남아있을 수 있습니다.'
  });
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
    
    // 전체 건수 조회
    const totalCount = await RiskNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    const news = await RiskNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate keyword source relatedKeywords analysisModel createdAt');
    
    // 오늘 날짜 기준으로 필터링
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.pubDate) return false;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr === todayDateStr;
    });
    
    const otherNews = news.filter(item => {
      if (!item.pubDate) return true;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr !== todayDateStr;
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
    
    // 전체 건수 조회
    const totalCount = await PartnerNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    const news = await PartnerNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate keyword source relatedKeywords analysisModel createdAt');
    
    // 오늘 날짜 기준으로 필터링
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.pubDate) return false;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr === todayDateStr;
    });
    
    const otherNews = news.filter(item => {
      if (!item.pubDate) return true;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr !== todayDateStr;
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
    
    // 전체 건수 조회
    const totalCount = await TechNews.countDocuments({
      createdAt: { $gte: cutoffDate }
    });
    
    const news = await TechNews.find({
      createdAt: { $gte: cutoffDate }
    })
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('title link aiSummary pubDate keyword source relatedKeywords analysisModel createdAt');
    
    // 오늘 날짜 기준으로 필터링
    const today = await getKoreaToday();
    const todayNews = news.filter(item => {
      if (!item.pubDate) return false;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr === todayDateStr;
    });
    
    const otherNews = news.filter(item => {
      if (!item.pubDate) return true;
      const itemDate = new Date(item.pubDate);
      const todayDate = new Date(today);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const todayDateStr = todayDate.toISOString().split('T')[0];
      return itemDateStr !== todayDateStr;
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