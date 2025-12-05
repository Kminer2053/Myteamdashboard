require('dotenv').config();
const mongoose = require('mongoose');
const DBUsageSetting = require('./models/DBUsageSetting');

// MongoDB 연결
const MONGO_URI = 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 자동 삭제 설정 확인');
console.log('');

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
});

async function checkAutoDeleteSetting() {
    try {
        // 연결 대기
        await new Promise((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
            setTimeout(() => reject(new Error('연결 시간 초과')), 10000);
        });
        console.log('✅ MongoDB 연결 성공\n');
        
        // DB 사용량 설정 조회
        const setting = await DBUsageSetting.findOne().sort({ updatedAt: -1 });
        
        if (!setting) {
            console.log('⚠️ 자동 삭제 설정이 없습니다.');
            console.log('   → 자동 삭제 기능이 비활성화되어 있습니다.\n');
        } else {
            console.log('📊 자동 삭제 설정:');
            console.log(`   제한 용량 (limitMB): ${setting.limitMB}MB`);
            console.log(`   삭제 용량 (deleteMB): ${setting.deleteMB}MB`);
            console.log(`   설정 일시: ${setting.updatedAt || setting.createdAt}\n`);
            
            // 현재 DB 사용량 확인
            const db = mongoose.connection.db;
            const stats = await db.stats();
            const usedMB = (stats.dataSize + stats.indexSize) / (1024 * 1024);
            
            console.log('📊 현재 DB 사용량:');
            console.log(`   사용 중: ${usedMB.toFixed(2)}MB`);
            console.log(`   제한 용량: ${setting.limitMB}MB`);
            console.log(`   상태: ${usedMB >= setting.limitMB ? '⚠️ 제한 초과 (자동 삭제 활성화됨)' : '✅ 정상 범위'}\n`);
            
            // 삭제 이력 확인 (DBUsageSetting 컬렉션의 모든 설정 기록)
            const allSettings = await DBUsageSetting.find().sort({ updatedAt: -1 });
            console.log(`📋 설정 변경 이력: ${allSettings.length}건`);
            if (allSettings.length > 1) {
                console.log('   최근 5개 설정:');
                allSettings.slice(0, 5).forEach((s, index) => {
                    console.log(`   ${index + 1}. ${s.updatedAt || s.createdAt} - limitMB: ${s.limitMB}, deleteMB: ${s.deleteMB}`);
                });
            }
        }
        
        // 실제 삭제가 발생했는지 확인하기 위해 뉴스 데이터 날짜 범위 확인
        const RiskNews = require('./models/RiskNews');
        const PartnerNews = require('./models/PartnerNews');
        const TechNews = require('./models/TechNews');
        
        const riskNewsCount = await RiskNews.countDocuments({});
        const partnerNewsCount = await PartnerNews.countDocuments({});
        const techNewsCount = await TechNews.countDocuments({});
        
        if (riskNewsCount > 0) {
            const oldestRisk = await RiskNews.find().sort({ _id: 1 }).limit(1);
            const newestRisk = await RiskNews.find().sort({ _id: -1 }).limit(1);
            
            console.log('\n📰 리스크 뉴스 데이터 범위:');
            if (oldestRisk[0] && newestRisk[0]) {
                const oldestDate = oldestRisk[0].createdAt || oldestRisk[0]._id.getTimestamp();
                const newestDate = newestRisk[0].createdAt || newestRisk[0]._id.getTimestamp();
                console.log(`   최초 데이터: ${oldestDate.toISOString().split('T')[0]}`);
                console.log(`   최신 데이터: ${newestDate.toISOString().split('T')[0]}`);
                console.log(`   기간: 약 ${Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24))}일`);
            }
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ 확인 완료');
    }
}

checkAutoDeleteSetting();
