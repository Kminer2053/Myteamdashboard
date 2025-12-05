require('dotenv').config();
const axios = require('axios');

const keyword = 'IP라이선싱빌드업';
const startDate = new Date('2025-08-26');
const endDate = new Date('2025-09-25');

const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

console.log(`🔍 네이버 데이터랩 트렌드 API 디버깅: "${keyword}"`);
console.log(`📅 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);
console.log('');

async function testNaverTrend() {
    try {
        const requestBody = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            timeUnit: 'date',
            keywordGroups: [{
                groupName: keyword,
                keywords: [keyword]
            }]
        };
        
        console.log('📤 요청 데이터:');
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('');
        
        const response = await axios.post('https://openapi.naver.com/v1/datalab/search', requestBody, {
            headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📥 응답 데이터:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
        
        const trendData = response.data.results[0]?.data || [];
        console.log(`✅ 성공: ${trendData.length}일간의 트렌드 데이터`);
        
        if (trendData.length > 0) {
            const totalRatio = trendData.reduce((sum, item) => sum + item.ratio, 0);
            console.log(`   총 검색량: ${totalRatio}, 평균: ${Math.round(totalRatio / trendData.length)}`);
        } else {
            console.log('   ⚠️ 트렌드 데이터가 없습니다. 키워드가 너무 구체적이거나 검색량이 부족할 수 있습니다.');
        }
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.errorMessage || error.message}`);
        if (error.response?.data) {
            console.log('📥 에러 응답:');
            console.log(JSON.stringify(error.response.data, null, 2));
        }
    }
}

// 더 간단한 키워드로도 테스트
async function testSimpleKeyword() {
    console.log('🔍 간단한 키워드로 테스트: "아이폰"');
    try {
        const requestBody = {
            startDate: '2025-09-01',
            endDate: '2025-09-25',
            timeUnit: 'date',
            keywordGroups: [{
                groupName: '아이폰',
                keywords: ['아이폰']
            }]
        };
        
        const response = await axios.post('https://openapi.naver.com/v1/datalab/search', requestBody, {
            headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret,
                'Content-Type': 'application/json'
            }
        });
        
        const trendData = response.data.results[0]?.data || [];
        console.log(`✅ "아이폰" 키워드: ${trendData.length}일간의 트렌드 데이터`);
        
    } catch (error) {
        console.log(`❌ "아이폰" 키워드 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.errorMessage || error.message}`);
    }
}

testNaverTrend().then(() => {
    console.log('');
    testSimpleKeyword();
});


