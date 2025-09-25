// 네이버 뉴스 API 테스트
require('dotenv').config();
const axios = require('axios');

// 네이버 뉴스 API 테스트 함수
async function testNaverNewsAPI() {
    try {
        console.log('🔍 네이버 뉴스 API 테스트 시작...');
        
        // 테스트용 키워드
        const keyword = '인공지능';
        const clientId = 'e037eF7sxB3VuJHBpay5'; // 기존 Client ID
        const clientSecret = process.env.NAVER_CLIENT_SECRET; // 환경변수에서 가져오기
        
        if (!clientSecret) {
            console.error('❌ NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.');
            console.log('💡 .env 파일에 NAVER_CLIENT_SECRET을 추가해주세요.');
            return;
        }
        
        const url = 'https://openapi.naver.com/v1/search/news.json';
        const params = {
            query: keyword,
            display: 10,
            start: 1,
            sort: 'sim'
        };
        
        const response = await axios.get(url, {
            params: params,
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            }
        });
        
        console.log('✅ 네이버 뉴스 API 테스트 성공!');
        console.log(`📊 검색 결과: ${response.data.total}건`);
        console.log(`📰 표시된 기사: ${response.data.items.length}건`);
        
        // 첫 번째 기사 정보 출력
        if (response.data.items.length > 0) {
            const firstNews = response.data.items[0];
            console.log('\n📰 첫 번째 기사 정보:');
            console.log(`제목: ${firstNews.title.replace(/<[^>]*>/g, '')}`);
            console.log(`링크: ${firstNews.link}`);
            console.log(`날짜: ${firstNews.pubDate}`);
        }
        
        return response.data;
        
    } catch (error) {
        console.error('❌ 네이버 뉴스 API 테스트 실패:', error.message);
        if (error.response) {
            console.error('응답 상태:', error.response.status);
            console.error('응답 데이터:', error.response.data);
        }
        return null;
    }
}

// 테스트 실행
if (require.main === module) {
    testNaverNewsAPI();
}

module.exports = { testNaverNewsAPI };
