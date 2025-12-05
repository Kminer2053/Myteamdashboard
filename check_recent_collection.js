require('dotenv').config();
const mongoose = require('mongoose');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

// MongoDB 연결
const MONGO_URI = 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 최근 뉴스 수집 현황 확인');
console.log('');

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
});

async function checkRecentCollection() {
    try {
        // 연결 대기
        await new Promise((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
            setTimeout(() => reject(new Error('연결 시간 초과')), 10000);
        });
        console.log('✅ MongoDB 연결 성공\n');
        
        // 최근 7일간 수집 현황 확인
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        console.log(`📅 확인 기간: ${sevenDaysAgo.toISOString().split('T')[0]} ~ ${today.toISOString().split('T')[0]}\n`);
        
        // 리스크 뉴스
        const riskNews = await RiskNews.find({
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ createdAt: -1 });
        
        console.log(`📰 리스크 뉴스 (최근 7일):`);
        console.log(`   총 ${riskNews.length}건`);
        
        if (riskNews.length > 0) {
            const dateGroups = {};
            riskNews.forEach(news => {
                let date;
                if (news.collectedDate) {
                    date = typeof news.collectedDate === 'string' ? news.collectedDate : news.collectedDate.toISOString().split('T')[0];
                } else if (news.createdAt) {
                    date = news.createdAt.toISOString().split('T')[0];
                } else {
                    date = news._id.getTimestamp().toISOString().split('T')[0];
                }
                dateGroups[date] = (dateGroups[date] || 0) + 1;
            });
            
            console.log('   날짜별 분포:');
            Object.keys(dateGroups).sort().reverse().forEach(date => {
                console.log(`      ${date}: ${dateGroups[date]}건`);
            });
            
            console.log('\n   최근 5건:');
            riskNews.slice(0, 5).forEach((news, index) => {
                let date;
                if (news.collectedDate) {
                    date = typeof news.collectedDate === 'string' ? news.collectedDate : news.collectedDate.toISOString().split('T')[0];
                } else if (news.createdAt) {
                    date = news.createdAt.toISOString().split('T')[0];
                } else {
                    date = news._id.getTimestamp().toISOString().split('T')[0];
                }
                console.log(`      ${index + 1}. [${date}] ${news.title.substring(0, 50)}...`);
                console.log(`         분석모델: ${news.analysisModel || 'N/A'}`);
            });
        } else {
            console.log('   ⚠️ 최근 7일간 수집된 뉴스가 없습니다.');
        }
        
        console.log('');
        
        // 제휴처 뉴스
        const partnerNews = await PartnerNews.find({
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ createdAt: -1 });
        
        console.log(`📰 제휴처 뉴스 (최근 7일):`);
        console.log(`   총 ${partnerNews.length}건`);
        
        if (partnerNews.length > 0) {
            const dateGroups = {};
            partnerNews.forEach(news => {
                let date;
                if (news.collectedDate) {
                    date = typeof news.collectedDate === 'string' ? news.collectedDate : news.collectedDate.toISOString().split('T')[0];
                } else if (news.createdAt) {
                    date = news.createdAt.toISOString().split('T')[0];
                } else {
                    date = news._id.getTimestamp().toISOString().split('T')[0];
                }
                dateGroups[date] = (dateGroups[date] || 0) + 1;
            });
            
            console.log('   날짜별 분포:');
            Object.keys(dateGroups).sort().reverse().forEach(date => {
                console.log(`      ${date}: ${dateGroups[date]}건`);
            });
        } else {
            console.log('   ⚠️ 최근 7일간 수집된 뉴스가 없습니다.');
        }
        
        console.log('');
        
        // 신기술 뉴스
        const techNews = await TechNews.find({
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ createdAt: -1 });
        
        console.log(`📰 신기술 뉴스 (최근 7일):`);
        console.log(`   총 ${techNews.length}건`);
        
        if (techNews.length > 0) {
            const dateGroups = {};
            techNews.forEach(news => {
                let date;
                if (news.collectedDate) {
                    date = typeof news.collectedDate === 'string' ? news.collectedDate : news.collectedDate.toISOString().split('T')[0];
                } else if (news.createdAt) {
                    date = news.createdAt.toISOString().split('T')[0];
                } else {
                    date = news._id.getTimestamp().toISOString().split('T')[0];
                }
                dateGroups[date] = (dateGroups[date] || 0) + 1;
            });
            
            console.log('   날짜별 분포:');
            Object.keys(dateGroups).sort().reverse().forEach(date => {
                console.log(`      ${date}: ${dateGroups[date]}건`);
            });
        } else {
            console.log('   ⚠️ 최근 7일간 수집된 뉴스가 없습니다.');
        }
        
        // 오늘 날짜 확인
        const todayStr = today.toISOString().split('T')[0];
        console.log(`\n📅 오늘 날짜: ${todayStr}`);
        
        const todayRisk = await RiskNews.find({
            collectedDate: todayStr
        });
        const todayPartner = await PartnerNews.find({
            collectedDate: todayStr
        });
        const todayTech = await TechNews.find({
            collectedDate: todayStr
        });
        
        console.log(`\n📊 오늘 수집된 뉴스:`);
        console.log(`   리스크: ${todayRisk.length}건`);
        console.log(`   제휴처: ${todayPartner.length}건`);
        console.log(`   신기술: ${todayTech.length}건`);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ 확인 완료');
    }
}

checkRecentCollection();
