require('dotenv').config();
const axios = require('axios');

async function testTwitterSearchLimits() {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    console.log(`🐦 Twitter API 검색 제한 테스트`);
    console.log('');
    
    if (!bearerToken || bearerToken === 'your_api_key_here') {
        console.log('❌ Twitter Bearer Token이 설정되지 않았습니다.');
        return;
    }
    
    try {
        console.log('🔍 Twitter API 사용량 정보 확인 중...');
        
        // 1. 먼저 API 사용량 정보를 확인해보자
        const usageResponse = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'MyTeamDashboard/1.0'
            },
            params: {
                'query': 'test',
                'max_results': 10,
                'tweet.fields': 'public_metrics,created_at'
            }
        });
        
        console.log('✅ API 요청 성공!');
        console.log('📊 응답 헤더 정보:');
        console.log(`   - x-rate-limit-limit: ${usageResponse.headers['x-rate-limit-limit'] || 'N/A'}`);
        console.log(`   - x-rate-limit-remaining: ${usageResponse.headers['x-rate-limit-remaining'] || 'N/A'}`);
        console.log(`   - x-rate-limit-reset: ${usageResponse.headers['x-rate-limit-reset'] || 'N/A'}`);
        console.log('');
        
        if (usageResponse.headers['x-rate-limit-reset']) {
            const resetTime = new Date(parseInt(usageResponse.headers['x-rate-limit-reset']) * 1000);
            console.log(`⏰ 제한 초기화 시간: ${resetTime.toLocaleString()}`);
        }
        
        // 2. 실제 키워드 검색 테스트
        console.log('🔍 "슈야 테마카페" 키워드 검색 테스트...');
        
        const searchResponse = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'MyTeamDashboard/1.0'
            },
            params: {
                'query': '슈야 테마카페 -is:retweet',
                'max_results': 10,
                'tweet.fields': 'public_metrics,created_at,text'
            }
        });
        
        const tweets = searchResponse.data.data || [];
        console.log(`✅ 검색 성공! ${tweets.length}개 트윗 발견`);
        
        if (tweets.length > 0) {
            console.log('📊 검색 결과 통계:');
            const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.like_count || 0), 0);
            const totalRetweets = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.retweet_count || 0), 0);
            const totalReplies = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.reply_count || 0), 0);
            
            console.log(`   - 총 좋아요: ${totalLikes}개`);
            console.log(`   - 총 리트윗: ${totalRetweets}개`);
            console.log(`   - 총 댓글: ${totalReplies}개`);
            console.log(`   - 평균 참여도: ${Math.round((totalLikes + totalRetweets + totalReplies) / tweets.length)}`);
            
            // 최신 트윗 1개 표시
            const latestTweet = tweets[0];
            console.log('');
            console.log('🔥 최신 트윗:');
            console.log(`   날짜: ${new Date(latestTweet.created_at).toLocaleString()}`);
            console.log(`   좋아요: ${latestTweet.public_metrics?.like_count || 0}개`);
            console.log(`   내용: ${latestTweet.text.substring(0, 100)}${latestTweet.text.length > 100 ? '...' : ''}`);
        }
        
    } catch (error) {
        console.log('❌ Twitter API 테스트 실패:');
        console.log(`   상태 코드: ${error.response?.status || 'N/A'}`);
        console.log(`   에러 메시지: ${error.response?.data?.title || error.message}`);
        
        if (error.response?.headers) {
            console.log('📊 응답 헤더 정보:');
            console.log(`   - x-rate-limit-limit: ${error.response.headers['x-rate-limit-limit'] || 'N/A'}`);
            console.log(`   - x-rate-limit-remaining: ${error.response.headers['x-rate-limit-remaining'] || 'N/A'}`);
            console.log(`   - x-rate-limit-reset: ${error.response.headers['x-rate-limit-reset'] || 'N/A'}`);
        }
        
        if (error.response?.data) {
            console.log(`   응답 데이터:`, JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.response?.status === 429) {
            console.log('');
            console.log('💡 429 오류 분석:');
            console.log('   - Twitter API v2 Recent Search는 별도의 사용량 제한이 있습니다.');
            console.log('   - 무료 플랜에서는 월 10,000개 요청 제한이 있을 수 있습니다.');
            console.log('   - 또는 15분당 300개 요청 제한일 수 있습니다.');
        }
    }
}

// 테스트 실행
testTwitterSearchLimits();


