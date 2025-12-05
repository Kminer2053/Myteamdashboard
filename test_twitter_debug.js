require('dotenv').config();
const axios = require('axios');

const keyword = 'IP라이선싱빌드업';
const startDate = new Date('2025-08-26');
const endDate = new Date('2025-09-25');
const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

console.log(`🔍 Twitter API 디버깅: "${keyword}"`);
console.log(`📅 기간: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);
console.log('');

async function testTwitterSearch() {
    try {
        // Twitter API v2 Recent Search 파라미터 확인
        const params = {
            query: keyword,
            max_results: 10,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            'tweet.fields': 'public_metrics,created_at'
        };
        
        console.log('📤 요청 파라미터:');
        console.log(JSON.stringify(params, null, 2));
        console.log('');
        
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${twitterBearerToken}`,
                'Content-Type': 'application/json'
            },
            params: params
        });
        
        console.log('📥 응답 데이터:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
        
        const tweetCount = response.data.meta?.result_count || 0;
        console.log(`✅ 성공: ${tweetCount}개의 트윗 발견`);
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.detail || error.message}`);
        
        if (error.response?.data) {
            console.log('📥 에러 응답:');
            console.log(JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.response?.status === 429) {
            console.log('   ⚠️ Twitter API 무료 티어는 15분당 1회 요청 제한이 있습니다.');
        }
    }
}

// 더 간단한 키워드로 테스트
async function testSimpleTwitterSearch() {
    console.log('🔍 간단한 키워드로 Twitter 테스트: "아이폰"');
    try {
        const params = {
            query: '아이폰',
            max_results: 5,
            'tweet.fields': 'public_metrics,created_at'
        };
        
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${twitterBearerToken}`,
                'Content-Type': 'application/json'
            },
            params: params
        });
        
        const tweetCount = response.data.meta?.result_count || 0;
        console.log(`✅ "아이폰" 키워드: ${tweetCount}개의 트윗 발견`);
        
    } catch (error) {
        console.log(`❌ "아이폰" 키워드 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.detail || error.message}`);
    }
}

testTwitterSearch().then(() => {
    console.log('');
    testSimpleTwitterSearch();
});


