const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결 (실제 배포된 서버 사용)
const MONGODB_URI = 'mongodb+srv://teamdashboard:teamdashboard123@cluster0.mongodb.net/team_dashboard?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

// 모델 import
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');
const RiskAnalysisReport = require('./models/RiskAnalysisReport');
const PartnerAnalysisReport = require('./models/PartnerAnalysisReport');
const TechAnalysisReport = require('./models/TechAnalysisReport');

async function deleteAllNewsData() {
    try {
        console.log('🗑️ 모든 뉴스 데이터 삭제 시작...');
        console.log('MongoDB URI:', MONGODB_URI);
        
        // 뉴스 데이터 삭제
        const riskNewsResult = await RiskNews.deleteMany({});
        const partnerNewsResult = await PartnerNews.deleteMany({});
        const techNewsResult = await TechNews.deleteMany({});
        
        console.log(`✅ 리스크 뉴스 삭제: ${riskNewsResult.deletedCount}건`);
        console.log(`✅ 제휴처 뉴스 삭제: ${partnerNewsResult.deletedCount}건`);
        console.log(`✅ 신기술 뉴스 삭제: ${techNewsResult.deletedCount}건`);
        
        // AI 분석 보고서 삭제
        const riskAnalysisResult = await RiskAnalysisReport.deleteMany({});
        const partnerAnalysisResult = await PartnerAnalysisReport.deleteMany({});
        const techAnalysisResult = await TechAnalysisReport.deleteMany({});
        
        console.log(`✅ 리스크 분석 보고서 삭제: ${riskAnalysisResult.deletedCount}건`);
        console.log(`✅ 제휴처 분석 보고서 삭제: ${partnerAnalysisResult.deletedCount}건`);
        console.log(`✅ 신기술 분석 보고서 삭제: ${techAnalysisResult.deletedCount}건`);
        
        console.log('🎉 모든 데이터 삭제 완료!');
        
    } catch (error) {
        console.error('❌ 데이터 삭제 중 오류 발생:', error);
    } finally {
        mongoose.connection.close();
    }
}

deleteAllNewsData(); 