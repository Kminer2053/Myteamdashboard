// YouTube Data API v3 테스트
require('dotenv').config();
const axios = require('axios');

// YouTube Data API v3 테스트 함수
async function testYouTubeAPI() {
    try {
        console.log('🔍 YouTube Data API v3 테스트 시작...');
        
        const apiKey = process.env.YOUTUBE_API_KEY; // 환경변수에서 가져오기
        const keyword = '인공지능';
        
        // 동영상 검색 API 테스트
        const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
        const searchParams = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: 10,
            order: 'relevance',
            key: apiKey
        };
        
        console.log('📺 동영상 검색 API 테스트...');
        const searchResponse = await axios.get(searchUrl, { 
            params: searchParams,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'http://localhost:4000'
            }
        });
        
        console.log('✅ 동영상 검색 API 테스트 성공!');
        console.log(`📊 검색 결과: ${searchResponse.data.pageInfo.totalResults}건`);
        console.log(`📺 표시된 동영상: ${searchResponse.data.items.length}건`);
        
        // 첫 번째 동영상 정보 출력
        if (searchResponse.data.items.length > 0) {
            const firstVideo = searchResponse.data.items[0];
            console.log('\n📺 첫 번째 동영상 정보:');
            console.log(`제목: ${firstVideo.snippet.title}`);
            console.log(`채널: ${firstVideo.snippet.channelTitle}`);
            console.log(`업로드일: ${firstVideo.snippet.publishedAt}`);
            console.log(`동영상 ID: ${firstVideo.id.videoId}`);
        }
        
        // 동영상 상세 정보 API 테스트 (조회수, 좋아요 등)
        if (searchResponse.data.items.length > 0) {
            const videoId = searchResponse.data.items[0].id.videoId;
            const detailsUrl = 'https://www.googleapis.com/youtube/v3/videos';
            const detailsParams = {
                part: 'statistics,snippet',
                id: videoId,
                key: apiKey
            };
            
            console.log('\n📊 동영상 상세 정보 API 테스트...');
            const detailsResponse = await axios.get(detailsUrl, { 
                params: detailsParams,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': 'http://localhost:4000'
                }
            });
            
            if (detailsResponse.data.items.length > 0) {
                const videoDetails = detailsResponse.data.items[0];
                console.log('✅ 동영상 상세 정보 API 테스트 성공!');
                console.log(`조회수: ${videoDetails.statistics.viewCount}`);
                console.log(`좋아요: ${videoDetails.statistics.likeCount}`);
                console.log(`댓글수: ${videoDetails.statistics.commentCount}`);
            }
        }
        
        return searchResponse.data;
        
    } catch (error) {
        console.error('❌ YouTube Data API v3 테스트 실패:', error.message);
        if (error.response) {
            console.error('응답 상태:', error.response.status);
            console.error('응답 데이터:', error.response.data);
        }
        return null;
    }
}

// 테스트 실행
if (require.main === module) {
    testYouTubeAPI();
}

module.exports = { testYouTubeAPI };
