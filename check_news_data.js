require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB 연결 (db.js와 동일한 설정 사용)
// 환경변수가 없으면 기본값 사용 (하드코딩)
const MONGO_URI = 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 MongoDB 뉴스 데이터 상태 확인');
console.log(`📡 연결 URI: ${MONGO_URI.replace(/\/\/.*@/, '//***:***@')}`);
console.log('');

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
});

// 모델 import
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

async function checkNewsData() {
    try {
        // 연결 대기
        await new Promise((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
            setTimeout(() => reject(new Error('연결 시간 초과')), 10000);
        });
        console.log('✅ MongoDB 연결 성공\n');
        
        // 각 뉴스 컬렉션의 데이터 수 확인
        const riskNewsCount = await RiskNews.countDocuments({});
        const partnerNewsCount = await PartnerNews.countDocuments({});
        const techNewsCount = await TechNews.countDocuments({});
        
        console.log('📊 뉴스 데이터 현황:');
        console.log(`   리스크 뉴스: ${riskNewsCount}건`);
        console.log(`   제휴처 뉴스: ${partnerNewsCount}건`);
        console.log(`   신기술 뉴스: ${techNewsCount}건`);
        console.log(`   총계: ${riskNewsCount + partnerNewsCount + techNewsCount}건\n`);
        
        // 최근 데이터 확인
        if (riskNewsCount > 0) {
            const recentRiskNews = await RiskNews.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title createdAt keyword date');
            console.log('📰 최근 리스크 뉴스 (최대 5건):');
            recentRiskNews.forEach((news, index) => {
                const dateStr = news.date ? new Date(news.date).toISOString().split('T')[0] : 
                               news.createdAt ? new Date(news.createdAt).toISOString().split('T')[0] : '날짜 없음';
                console.log(`   ${index + 1}. [${dateStr}] ${news.keyword || '키워드 없음'} - ${(news.title || '').substring(0, 50)}...`);
            });
            console.log('');
        }
        
        if (partnerNewsCount > 0) {
            const recentPartnerNews = await PartnerNews.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title createdAt keyword date');
            console.log('📰 최근 제휴처 뉴스 (최대 5건):');
            recentPartnerNews.forEach((news, index) => {
                const dateStr = news.date ? new Date(news.date).toISOString().split('T')[0] : 
                               news.createdAt ? new Date(news.createdAt).toISOString().split('T')[0] : '날짜 없음';
                console.log(`   ${index + 1}. [${dateStr}] ${news.keyword || '키워드 없음'} - ${(news.title || '').substring(0, 50)}...`);
            });
            console.log('');
        }
        
        if (techNewsCount > 0) {
            const recentTechNews = await TechNews.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title createdAt topic date');
            console.log('📰 최근 신기술 뉴스 (최대 5건):');
            recentTechNews.forEach((news, index) => {
                const dateStr = news.date ? new Date(news.date).toISOString().split('T')[0] : 
                               news.createdAt ? new Date(news.createdAt).toISOString().split('T')[0] : '날짜 없음';
                console.log(`   ${index + 1}. [${dateStr}] ${news.topic || '주제 없음'} - ${(news.title || '').substring(0, 50)}...`);
            });
            console.log('');
        }
        
        // 날짜별 분포 확인
        if (riskNewsCount > 0) {
            const dateGroups = await RiskNews.aggregate([
                {
                    $group: {
                        _id: { 
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: { $ifNull: ["$date", "$createdAt"] }
                            } 
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: -1 } },
                { $limit: 10 }
            ]);
            
            console.log('📅 최근 10일간 리스크 뉴스 수집 현황:');
            dateGroups.forEach(group => {
                console.log(`   ${group._id}: ${group.count}건`);
            });
            console.log('');
        }
        
        // 컬렉션 목록 확인
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📋 데이터베이스 컬렉션 목록:');
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        if (error.name === 'MongoServerSelectionError') {
            console.error('   MongoDB 서버에 연결할 수 없습니다. 네트워크나 인증 정보를 확인하세요.');
        }
    } finally {
        mongoose.connection.close();
        console.log('\n✅ 확인 완료');
    }
}

checkNewsData();
