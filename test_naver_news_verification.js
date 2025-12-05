require('dotenv').config();
const axios = require('axios');

const keyword = 'IP라이선싱빌드업';
const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

console.log(`🔍 네이버 뉴스 API 정확한 검증: "${keyword}"`);
console.log('');

async function testNaverNews() {
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret
            },
            params: {
                'query': keyword,
                'display': 100,  // 최대 100개까지
                'start': 1,
                'sort': 'sim'
            }
        });
        
        console.log('📊 네이버 뉴스 API 응답:');
        console.log(`   총 검색 결과: ${response.data.total}건`);
        console.log(`   현재 페이지 표시: ${response.data.display}건`);
        console.log(`   시작 위치: ${response.data.start}`);
        console.log(`   마지막 빌드 날짜: ${response.data.lastBuildDate}`);
        console.log('');
        
        if (response.data.items && response.data.items.length > 0) {
            console.log('📰 첫 5개 기사 제목:');
            response.data.items.slice(0, 5).forEach((article, index) => {
                const cleanTitle = article.title.replace(/<[^>]*>/g, '');
                console.log(`   ${index + 1}. ${cleanTitle}`);
                console.log(`      날짜: ${article.pubDate}`);
                console.log(`      링크: ${article.link}`);
                console.log('');
            });
        }
        
        // 전체 응답 데이터 구조 확인
        console.log('📋 응답 데이터 구조:');
        console.log(JSON.stringify({
            total: response.data.total,
            display: response.data.display,
            start: response.data.start,
            lastBuildDate: response.data.lastBuildDate,
            itemsCount: response.data.items ? response.data.items.length : 0
        }, null, 2));
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.errorMessage || error.message}`);
    }
}

// 다른 키워드로도 비교 테스트
async function testOtherKeywords() {
    const testKeywords = ['IP', '라이선싱', '빌드업', '아이폰'];
    
    for (const testKeyword of testKeywords) {
        try {
            const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                headers: {
                    'X-Naver-Client-Id': naverClientId,
                    'X-Naver-Client-Secret': naverClientSecret
                },
                params: {
                    'query': testKeyword,
                    'display': 10,
                    'start': 1,
                    'sort': 'sim'
                }
            });
            
            console.log(`📊 "${testKeyword}" 키워드: ${response.data.total}건`);
            
        } catch (error) {
            console.log(`❌ "${testKeyword}" 실패: ${error.response?.status || 'N/A'}`);
        }
    }
}

testNaverNews().then(() => {
    console.log('');
    console.log('🔍 다른 키워드 비교 테스트:');
    testOtherKeywords();
});


