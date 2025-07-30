const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on('error', console.error.bind(console, '[MongoDB] 연결 에러:'));
db.once('open', async () => {
  console.log('[MongoDB] 연결됨');
  
  // 스키마 캐시 문제 해결을 위한 컬렉션 재생성
  try {
    console.log('[스키마 캐시 해결] 컬렉션 재생성 시작...');
    
    // PartnerNews 컬렉션 재생성
    const PartnerNews = require('./models/PartnerNews');
    const TechNews = require('./models/TechNews');
    const RiskNews = require('./models/RiskNews');
    
    const partnerNewsCount = await PartnerNews.countDocuments();
    if (partnerNewsCount > 0) {
      console.log(`[스키마 캐시 해결] PartnerNews ${partnerNewsCount}건 발견, 스키마 업데이트 시도...`);
      await mongoose.connection.collection('partnernews').drop();
      console.log('[스키마 캐시 해결] PartnerNews 컬렉션 삭제 완료');
    }
    
    // TechNews 컬렉션 재생성
    const techNewsCount = await TechNews.countDocuments();
    if (techNewsCount > 0) {
      console.log(`[스키마 캐시 해결] TechNews ${techNewsCount}건 발견, 스키마 업데이트 시도...`);
      await mongoose.connection.collection('technews').drop();
      console.log('[스키마 캐시 해결] TechNews 컬렉션 삭제 완료');
    }
    
    // RiskNews 컬렉션도 재생성 (sentiment 객체 문제 해결)
    const riskNewsCount = await RiskNews.countDocuments();
    if (riskNewsCount > 0) {
      console.log(`[스키마 캐시 해결] RiskNews ${riskNewsCount}건 발견, 스키마 업데이트 시도...`);
      await mongoose.connection.collection('risknews').drop();
      console.log('[스키마 캐시 해결] RiskNews 컬렉션 삭제 완료');
    }
    
    console.log('[스키마 캐시 해결] 완료 - 다음 수집에서 새로운 스키마 적용됨');
  } catch (error) {
    console.error('[스키마 캐시 해결] 오류:', error);
  }
});

// 모델 정의
const Keyword = mongoose.model('Keyword', { value: String });

module.exports = { mongoose, Keyword }; 