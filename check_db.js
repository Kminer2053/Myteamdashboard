const mongoose = require('mongoose');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

async function checkDBStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myteamdashboard');
    console.log('MongoDB 연결됨');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('=== 오늘 저장된 실제 DB 데이터 ===');
    console.log('날짜 기준:', today.toISOString());
    
    const riskCount = await RiskNews.countDocuments({ createdAt: { $gte: today } });
    const partnerCount = await PartnerNews.countDocuments({ createdAt: { $gte: today } });
    const techCount = await TechNews.countDocuments({ createdAt: { $gte: today } });
    
    console.log('리스크이슈:', riskCount, '건');
    console.log('제휴처탐색:', partnerCount, '건');
    console.log('신기술동향:', techCount, '건');
    
    console.log('\n=== 상세 데이터 확인 ===');
    
    const riskNews = await RiskNews.find({ createdAt: { $gte: today } }).select('title link createdAt');
    const partnerNews = await PartnerNews.find({ createdAt: { $gte: today } }).select('title link createdAt');
    const techNews = await TechNews.find({ createdAt: { $gte: today } }).select('title link createdAt');
    
    console.log('\n리스크이슈 상세:');
    riskNews.forEach((item, i) => console.log(`${i+1}. ${item.title} (${item.createdAt})`));
    
    console.log('\n제휴처탐색 상세:');
    partnerNews.forEach((item, i) => console.log(`${i+1}. ${item.title} (${item.createdAt})`));
    
    console.log('\n신기술동향 상세:');
    techNews.forEach((item, i) => console.log(`${i+1}. ${item.title} (${item.createdAt})`));
    
    await mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
    
  } catch (error) {
    console.error('오류:', error);
  }
}

checkDBStatus(); 