require('dotenv').config();
const axios = require('axios');

const keyword = 'IP라이선싱빌드업';
const startDate = new Date('2025-08-26');
const endDate = new Date('2025-09-25');
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

console.log(`🔍 YouTube API 디버깅: "${keyword}"`);
console.log(`📅 기간: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);
console.log('');

async function testYouTubeSearch() {
    try {
        const params = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: 10,
            publishedAfter: startDate.toISOString(),
            publishedBefore: endDate.toISOString(),
            key: youtubeApiKey
        };
        
        console.log('📤 요청 파라미터:');
        console.log(JSON.stringify(params, null, 2));
        console.log('');
        
        // 다양한 Referer 헤더로 시도
        const headers = [
            { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Referer': 'https://myteamdashboard.onrender.com' },
            { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Referer': 'http://localhost:10000' },
            { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Referer': 'https://www.google.com' }
        ];
        
        for (let i = 0; i < headers.length; i++) {
            console.log(`🔄 시도 ${i + 1}: Referer = ${headers[i].Referer || '없음'}`);
            
            try {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: params,
                    headers: headers[i]
                });
                
                console.log(`✅ 성공: ${response.data.items.length}개의 동영상 발견`);
                if (response.data.items.length > 0) {
                    console.log(`   첫 번째 동영상: ${response.data.items[0].snippet.title}`);
                }
                return; // 성공하면 종료
                
            } catch (error) {
                console.log(`   ❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.error?.message || error.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ 전체 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.error?.message || error.message}`);
    }
}

// Referer 없이 테스트
async function testYouTubeWithoutReferer() {
    console.log('🔍 Referer 없이 YouTube API 테스트');
    try {
        const params = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: 5,
            key: youtubeApiKey
        };
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: params
        });
        
        console.log(`✅ 성공: ${response.data.items.length}개의 동영상 발견`);
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.error?.message || error.message}`);
    }
}

testYouTubeSearch().then(() => {
    console.log('');
    testYouTubeWithoutReferer();
});


