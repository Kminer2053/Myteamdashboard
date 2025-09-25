require('dotenv').config();
const axios = require('axios');

async function testTwitterSimpleSearch() {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    console.log(`🐦 Twitter API 간단 테스트`);
    console.log('');
    
    if (!bearerToken || bearerToken === 'your_api_key_here') {
        console.log('❌ Twitter Bearer Token이 설정되지 않았습니다.');
        return;
    }
    
    try {
        console.log('🔍 간단한 트윗 검색 중...');
        
        // 더 간단한 쿼리로 테스트 (날짜 범위 없이)
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'MyTeamDashboard/1.0'
            },
            params: {
                'query': '슈야 -is:retweet',
                'max_results': 10,
                'tweet.fields': 'public_metrics,created_at,author_id,text'
            }
        });
        
        const tweets = response.data.data || [];
        const meta = response.data.meta || {};
        
        console.log('✅ 트윗 검색 성공!');
        console.log(`📊 검색 결과: ${tweets.length}개 트윗`);
        console.log(`📈 총 결과 수: ${meta.result_count || 'N/A'}`);
        console.log('');
        
        if (tweets.length > 0) {
            // 통계 계산
            const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.like_count || 0), 0);
            const totalRetweets = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.retweet_count || 0), 0);
            const totalReplies = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.reply_count || 0), 0);
            
            console.log('📊 트윗 통계:');
            console.log(`   - 총 좋아요: ${totalLikes.toLocaleString()}개`);
            console.log(`   - 총 리트윗: ${totalRetweets.toLocaleString()}개`);
            console.log(`   - 총 댓글: ${totalReplies.toLocaleString()}개`);
            console.log(`   - 평균 참여도: ${Math.round((totalLikes + totalRetweets + totalReplies) / tweets.length)}`);
            console.log('');
            
            // 상위 트윗 2개 표시
            const topTweets = tweets
                .sort((a, b) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0))
                .slice(0, 2);
            
            console.log('🔥 상위 트윗 2개:');
            topTweets.forEach((tweet, index) => {
                console.log(`   ${index + 1}. 좋아요: ${tweet.public_metrics?.like_count || 0}개`);
                console.log(`      리트윗: ${tweet.public_metrics?.retweet_count || 0}개`);
                console.log(`      댓글: ${tweet.public_metrics?.reply_count || 0}개`);
                console.log(`      날짜: ${new Date(tweet.created_at).toLocaleString()}`);
                console.log(`      내용: ${tweet.text.substring(0, 80)}${tweet.text.length > 80 ? '...' : ''}`);
                console.log('');
            });
        } else {
            console.log('📭 해당 키워드로 검색된 트윗이 없습니다.');
        }
        
    } catch (error) {
        console.log('❌ Twitter API 테스트 실패:');
        console.log(`   상태 코드: ${error.response?.status || 'N/A'}`);
        console.log(`   에러 메시지: ${error.response?.data?.title || error.message}`);
        
        if (error.response?.data) {
            console.log(`   응답 데이터:`, JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.response?.status === 429) {
            console.log('');
            console.log('💡 현재 상황:');
            console.log('   - Twitter API 사용량 제한에 걸렸습니다.');
            console.log('   - 이는 무료 플랜의 제한사항입니다.');
            console.log('   - 화제성 분석에서는 Twitter 데이터 없이 다른 소스로 분석을 진행합니다.');
        }
    }
}

// 테스트 실행
testTwitterSimpleSearch();
