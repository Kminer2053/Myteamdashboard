require('dotenv').config();
const axios = require('axios');

async function testNaverNewsAPI() {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    const keyword = 'IP라이선싱빌드업';
    
    console.log(`🔍 네이버 뉴스 API 디버깅 테스트: "${keyword}"`);
    console.log('');
    
    if (!clientId || !clientSecret) {
        console.log('❌ 네이버 API 키가 설정되지 않았습니다.');
        return;
    }
    
    try {
        console.log('📰 네이버 뉴스 API 요청 중...');
        
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            },
            params: {
                'query': keyword,
                'display': 10,
                'start': 1,
                'sort': 'sim'
            }
        });
        
        console.log('✅ 네이버 뉴스 API 응답 성공!');
        console.log(`📊 검색 결과: ${response.data.total}건`);
        console.log(`📰 표시된 기사: ${response.data.items ? response.data.items.length : 0}건`);
        console.log('');
        
        if (response.data.items && response.data.items.length > 0) {
            console.log('📰 첫 번째 기사 정보:');
            const firstArticle = response.data.items[0];
            console.log(`제목: ${firstArticle.title}`);
            console.log(`링크: ${firstArticle.link}`);
            console.log(`날짜: ${firstArticle.pubDate}`);
            console.log(`설명: ${firstArticle.description}`);
            console.log('');
            
            // 모든 기사 제목 출력
            console.log('📰 모든 기사 제목:');
            response.data.items.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
            });
        } else {
            console.log('📭 검색된 기사가 없습니다.');
        }
        
        // 응답 데이터 전체 구조 확인
        console.log('');
        console.log('📊 응답 데이터 구조:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ 네이버 뉴스 API 테스트 실패:');
        console.log(`   상태 코드: ${error.response?.status || 'N/A'}`);
        console.log(`   에러 메시지: ${error.response?.data?.errorMessage || error.message}`);
        
        if (error.response?.data) {
            console.log(`   응답 데이터:`, JSON.stringify(error.response.data, null, 2));
        }
    }
}

// 테스트 실행
testNaverNewsAPI();


