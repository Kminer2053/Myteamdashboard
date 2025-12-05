require('dotenv').config();
const axios = require('axios');

async function testTwitterAPI() {
    console.log('🐦 X (Twitter) API 테스트 시작...\n');
    
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    if (!bearerToken) {
        console.error('❌ TWITTER_BEARER_TOKEN이 설정되지 않았습니다.');
        return;
    }
    
    try {
        // 1. 사용자 정보 조회 테스트
        console.log('1️⃣ 사용자 정보 조회 테스트...');
        const userResponse = await axios.get('https://api.twitter.com/2/users/by/username/elonmusk', {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'MyTeamDashboard/1.0'
            }
        });
        
        console.log('✅ 사용자 정보 조회 성공!');
        console.log(`   사용자명: ${userResponse.data.data.name}`);
        console.log(`   팔로워 수: ${userResponse.data.data.public_metrics?.followers_count || 'N/A'}\n`);
        
        // 2. 트윗 검색 테스트
        console.log('2️⃣ 트윗 검색 테스트...');
        const searchResponse = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'MyTeamDashboard/1.0'
            },
            params: {
                'query': 'AI OR artificial intelligence',
                'max_results': 10,
                'tweet.fields': 'public_metrics,created_at,author_id'
            }
        });
        
        console.log('✅ 트윗 검색 성공!');
        console.log(`   검색된 트윗 수: ${searchResponse.data.meta?.result_count || 0}`);
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
            const firstTweet = searchResponse.data.data[0];
            console.log(`   첫 번째 트윗 ID: ${firstTweet.id}`);
            console.log(`   좋아요 수: ${firstTweet.public_metrics?.like_count || 0}`);
            console.log(`   리트윗 수: ${firstTweet.public_metrics?.retweet_count || 0}`);
            console.log(`   댓글 수: ${firstTweet.public_metrics?.reply_count || 0}`);
        }
        
        console.log('\n🎉 X (Twitter) API 테스트 완료!');
        console.log('✅ 모든 기능이 정상 작동합니다.');
        
    } catch (error) {
        console.error('❌ X (Twitter) API 테스트 실패:');
        if (error.response) {
            console.error(`   상태 코드: ${error.response.status}`);
            console.error(`   에러 메시지: ${error.response.data?.detail || error.response.data?.title || 'Unknown error'}`);
            console.error(`   응답 데이터:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`   에러: ${error.message}`);
        }
    }
}

// 테스트 실행
testTwitterAPI();


