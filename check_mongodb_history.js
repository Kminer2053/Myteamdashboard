require('dotenv').config();
const mongoose = require('mongoose');
const UserActionLog = require('./models/UserActionLog');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

// MongoDB 연결
const MONGO_URI = 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 MongoDB 삭제 이력 확인');
console.log('');

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
});

async function checkMongoDBHistory() {
    try {
        // 연결 대기
        await new Promise((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
            setTimeout(() => reject(new Error('연결 시간 초과')), 10000);
        });
        console.log('✅ MongoDB 연결 성공\n');
        
        // 1. UserActionLog 확인 (관리자 작업 로그)
        console.log('📋 1. 사용자 작업 로그 확인:');
        const userLogs = await UserActionLog.find({
            $or: [
                { action: { $regex: /delete|삭제/i } },
                { action: { $regex: /auto.*delete|자동.*삭제/i } }
            ]
        }).sort({ createdAt: -1 }).limit(20);
        
        if (userLogs.length > 0) {
            console.log(`   발견된 삭제 관련 로그: ${userLogs.length}건\n`);
            userLogs.forEach((log, index) => {
                const dateStr = log.createdAt ? log.createdAt.toISOString().split('T')[0] : 
                               log._id ? log._id.getTimestamp().toISOString().split('T')[0] : '날짜 없음';
                console.log(`   ${index + 1}. [${dateStr}] ${log.action || '작업 없음'}`);
                if (log.details) console.log(`      상세: ${JSON.stringify(log.details)}`);
            });
        } else {
            console.log('   삭제 관련 로그가 없습니다.\n');
        }
        
        // 2. 각 컬렉션의 데이터 통계 분석
        console.log('\n📊 2. 데이터 통계 분석:');
        
        const collections = [
            { name: '리스크 뉴스', model: RiskNews },
            { name: '제휴처 뉴스', model: PartnerNews },
            { name: '신기술 뉴스', model: TechNews }
        ];
        
        for (const collection of collections) {
            const count = await collection.model.countDocuments({});
            
            // 최초 데이터와 최신 데이터 확인
            const oldest = await collection.model.find().sort({ _id: 1 }).limit(1);
            const newest = await collection.model.find().sort({ _id: -1 }).limit(1);
            
            if (oldest.length > 0 && newest.length > 0) {
                const oldestDate = oldest[0].createdAt || oldest[0]._id.getTimestamp();
                const newestDate = newest[0].createdAt || newest[0]._id.getTimestamp();
                const daysDiff = Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
                
                console.log(`\n   ${collection.name}:`);
                console.log(`      총 데이터: ${count}건`);
                console.log(`      최초 데이터: ${oldestDate.toISOString().split('T')[0]}`);
                console.log(`      최신 데이터: ${newestDate.toISOString().split('T')[0]}`);
                console.log(`      기간: ${daysDiff}일`);
                
                // 날짜별 분포 확인
                const dateGroups = await collection.model.aggregate([
                    {
                        $group: {
                            _id: { 
                                $dateToString: { 
                                    format: "%Y-%m", 
                                    date: { $ifNull: ["$createdAt", "$_id"] }
                                } 
                            },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                
                console.log(`      월별 분포:`);
                dateGroups.forEach(group => {
                    console.log(`         ${group._id}: ${group.count}건`);
                });
            }
        }
        
        // 3. _id 기반으로 데이터 간격 확인 (삭제 추정)
        console.log('\n🔍 3. 데이터 간격 분석 (삭제 추정):');
        
        for (const collection of collections) {
            // _id를 기준으로 연속성 확인
            const allDocs = await collection.model.find({})
                .sort({ _id: 1 })
                .select('_id createdAt')
                .limit(1000);
            
            if (allDocs.length > 1) {
                let gaps = [];
                for (let i = 1; i < allDocs.length; i++) {
                    const prevId = allDocs[i-1]._id.getTimestamp();
                    const currId = allDocs[i]._id.getTimestamp();
                    const daysDiff = Math.floor((currId - prevId) / (1000 * 60 * 60 * 24));
                    
                    // 7일 이상 간격이 있으면 의심
                    if (daysDiff > 7) {
                        gaps.push({
                            from: prevId.toISOString().split('T')[0],
                            to: currId.toISOString().split('T')[0],
                            days: daysDiff
                        });
                    }
                }
                
                if (gaps.length > 0) {
                    console.log(`\n   ${collection.name} - 의심스러운 간격:`);
                    gaps.slice(0, 5).forEach(gap => {
                        console.log(`      ${gap.from} ~ ${gap.to}: ${gap.days}일 간격`);
                    });
                } else {
                    console.log(`\n   ${collection.name}: 연속적인 데이터 (큰 간격 없음)`);
                }
            }
        }
        
        // 4. MongoDB 서버 통계 확인
        console.log('\n📈 4. MongoDB 서버 통계:');
        const db = mongoose.connection.db;
        const stats = await db.stats();
        
        console.log(`   데이터 크기: ${(stats.dataSize / (1024 * 1024)).toFixed(2)}MB`);
        console.log(`   인덱스 크기: ${(stats.indexSize / (1024 * 1024)).toFixed(2)}MB`);
        console.log(`   총 크기: ${((stats.dataSize + stats.indexSize) / (1024 * 1024)).toFixed(2)}MB`);
        console.log(`   컬렉션 수: ${stats.collections}`);
        console.log(`   문서 수: ${stats.objects}`);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ 확인 완료');
    }
}

checkMongoDBHistory();
