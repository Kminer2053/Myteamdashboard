// 네이버 데이터랩 API 테스트
require('dotenv').config();
const axios = require('axios');

// 네이버 데이터랩 검색 트렌드 API 테스트
async function testNaverDatalabAPI() {
    try {
        console.log('🔍 네이버 데이터랩 API 테스트 시작...');
        
        const clientId = 'e037eF7sxB3VuJHBpay5'; // 기존 Client ID
        const clientSecret = process.env.NAVER_CLIENT_SECRET; // 환경변수에서 가져오기
        
        if (!clientSecret) {
            console.error('❌ NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.');
            console.log('💡 .env 파일에 NAVER_CLIENT_SECRET을 추가해주세요.');
            return;
        }
        
        // 검색 트렌드 API 테스트
        const trendUrl = 'https://openapi.naver.com/v1/datalab/search';
        const trendData = {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            timeUnit: 'date',
            keywordGroups: [
                {
                    groupName: '인공지능',
                    keywords: ['인공지능', 'AI', '머신러닝']
                }
            ]
        };
        
        console.log('📈 검색 트렌드 API 테스트...');
        const trendResponse = await axios.post(trendUrl, trendData, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ 검색 트렌드 API 테스트 성공!');
        console.log(`📊 데이터 기간: ${trendResponse.data.startDate} ~ ${trendResponse.data.endDate}`);
        console.log(`📈 데이터 포인트: ${trendResponse.data.results[0].data.length}개`);
        
        // 쇼핑인사이트 API 테스트 (올바른 형식으로 수정)
        const shoppingUrl = 'https://openapi.naver.com/v1/datalab/shopping/categories';
        const shoppingData = {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            timeUnit: 'date',
            category: [{
                name: '디지털/가전',
                param: ['50000000']
            }],
            keywordGroups: [
                {
                    groupName: '스마트폰',
                    keywords: ['아이폰', '갤럭시', '스마트폰']
                }
            ]
        };
        
        console.log('\n🛒 쇼핑인사이트 API 테스트...');
        const shoppingResponse = await axios.post(shoppingUrl, shoppingData, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ 쇼핑인사이트 API 테스트 성공!');
        console.log(`📊 데이터 기간: ${shoppingResponse.data.startDate} ~ ${shoppingResponse.data.endDate}`);
        console.log(`🛒 데이터 포인트: ${shoppingResponse.data.results[0].data.length}개`);
        
        return {
            trend: trendResponse.data,
            shopping: shoppingResponse.data
        };
        
    } catch (error) {
        console.error('❌ 네이버 데이터랩 API 테스트 실패:', error.message);
        if (error.response) {
            console.error('응답 상태:', error.response.status);
            console.error('응답 데이터:', error.response.data);
        }
        return null;
    }
}

// 테스트 실행
if (require.main === module) {
    testNaverDatalabAPI();
}

module.exports = { testNaverDatalabAPI };
