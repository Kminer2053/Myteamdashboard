// 모든 API 통합 테스트
require('dotenv').config();

const { testNaverNewsAPI } = require('./test_naver_news');
const { testNaverDatalabAPI } = require('./test_naver_datalab');
const { testYouTubeAPI } = require('./test_youtube');
const { testPerplexityAPI } = require('./test_perplexity');

async function testAllAPIs() {
    console.log('🚀 모든 API 테스트 시작...\n');
    
    const results = {
        naverNews: false,
        naverDatalab: false,
        youtube: false,
        perplexity: false
    };
    
    // 1. 네이버 뉴스 API 테스트
    console.log('='.repeat(50));
    console.log('1️⃣ 네이버 뉴스 API 테스트');
    console.log('='.repeat(50));
    const naverNewsResult = await testNaverNewsAPI();
    results.naverNews = naverNewsResult !== null;
    
    // 2. 네이버 데이터랩 API 테스트
    console.log('\n' + '='.repeat(50));
    console.log('2️⃣ 네이버 데이터랩 API 테스트');
    console.log('='.repeat(50));
    const naverDatalabResult = await testNaverDatalabAPI();
    results.naverDatalab = naverDatalabResult !== null;
    
    // 3. YouTube Data API v3 테스트
    console.log('\n' + '='.repeat(50));
    console.log('3️⃣ YouTube Data API v3 테스트');
    console.log('='.repeat(50));
    const youtubeResult = await testYouTubeAPI();
    results.youtube = youtubeResult !== null;
    
    // 4. Perplexity AI API 테스트
    console.log('\n' + '='.repeat(50));
    console.log('4️⃣ Perplexity AI API 테스트');
    console.log('='.repeat(50));
    const perplexityResult = await testPerplexityAPI();
    results.perplexity = perplexityResult !== null;
    
    // 결과 요약
    console.log('\n' + '='.repeat(50));
    console.log('📊 API 테스트 결과 요약');
    console.log('='.repeat(50));
    
    const apiNames = {
        naverNews: '네이버 뉴스 API',
        naverDatalab: '네이버 데이터랩 API',
        youtube: 'YouTube Data API v3',
        perplexity: 'Perplexity AI API'
    };
    
    let successCount = 0;
    for (const [key, value] of Object.entries(results)) {
        const status = value ? '✅ 성공' : '❌ 실패';
        console.log(`${apiNames[key]}: ${status}`);
        if (value) successCount++;
    }
    
    console.log(`\n🎯 전체 결과: ${successCount}/4 API 테스트 성공`);
    
    if (successCount === 4) {
        console.log('🎉 모든 API가 정상적으로 작동합니다!');
        console.log('다음 단계: 데이터베이스 모델 설정으로 진행할 수 있습니다.');
    } else {
        console.log('⚠️ 일부 API 테스트가 실패했습니다.');
        console.log('환경변수 설정을 확인해주세요.');
    }
    
    return results;
}

// 테스트 실행
if (require.main === module) {
    testAllAPIs().catch(console.error);
}

module.exports = { testAllAPIs };

