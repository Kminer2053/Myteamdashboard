require('dotenv').config();
const axios = require('axios');

const keyword = 'IP라이선싱빌드업';
const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

console.log(`🔍 네이버 뉴스 884건 상세 분석: "${keyword}"`);
console.log('');

async function analyzeNewsData() {
    try {
        // 전체 데이터 수집 (여러 페이지)
        let allArticles = [];
        let totalCount = 0;
        let page = 1;
        const maxPages = 10; // 최대 10페이지 (1000건)
        
        while (page <= maxPages) {
            const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                headers: {
                    'X-Naver-Client-Id': naverClientId,
                    'X-Naver-Client-Secret': naverClientSecret
                },
                params: {
                    'query': keyword,
                    'display': 100,
                    'start': (page - 1) * 100 + 1,
                    'sort': 'sim'
                }
            });
            
            if (page === 1) {
                totalCount = response.data.total;
                console.log(`📊 총 검색 결과: ${totalCount}건`);
            }
            
            const articles = response.data.items || [];
            allArticles = allArticles.concat(articles);
            
            console.log(`📄 페이지 ${page}: ${articles.length}건 수집 (누적: ${allArticles.length}건)`);
            
            if (articles.length < 100) break; // 마지막 페이지
            page++;
        }
        
        console.log(`\n📋 총 수집된 기사: ${allArticles.length}건`);
        
        // 날짜별 분석
        const dateAnalysis = {};
        allArticles.forEach(article => {
            const date = new Date(article.pubDate).toISOString().split('T')[0];
            if (!dateAnalysis[date]) {
                dateAnalysis[date] = 0;
            }
            dateAnalysis[date]++;
        });
        
        console.log('\n📅 날짜별 기사 수:');
        Object.keys(dateAnalysis).sort().forEach(date => {
            console.log(`   ${date}: ${dateAnalysis[date]}건`);
        });
        
        // 언론사별 분석
        const mediaAnalysis = {};
        allArticles.forEach(article => {
            // 링크에서 언론사 추출 (간단한 방법)
            const link = article.link;
            let media = 'Unknown';
            if (link.includes('mk.co.kr')) media = '매일경제';
            else if (link.includes('kpenews.com')) media = '한국정경신문';
            else if (link.includes('meconomynews.com')) media = '시장경제신문';
            else if (link.includes('fnnews.com')) media = '파이낸셜뉴스';
            else if (link.includes('the-pr.co.kr')) media = '더프라이즈';
            else if (link.includes('straightnews.co.kr')) media = '스트레이트뉴스';
            else if (link.includes('startuptoday.co.kr')) media = '스타트업투데이';
            else if (link.includes('thefairnews.co.kr')) media = '더페어뉴스';
            else if (link.includes('munhwa.com')) media = '문화일보';
            else if (link.includes('naver.com')) media = '네이버뉴스';
            
            if (!mediaAnalysis[media]) {
                mediaAnalysis[media] = 0;
            }
            mediaAnalysis[media]++;
        });
        
        console.log('\n📰 언론사별 기사 수:');
        Object.keys(mediaAnalysis).sort((a, b) => mediaAnalysis[b] - mediaAnalysis[a]).forEach(media => {
            console.log(`   ${media}: ${mediaAnalysis[media]}건`);
        });
        
        // 키워드 포함 빈도 분석
        const keywordAnalysis = {};
        const keywords = ['IP', '라이선싱', '빌드업', '코레일', '슈야', '테마카페', '캐릭터'];
        
        keywords.forEach(keyword => {
            keywordAnalysis[keyword] = 0;
            allArticles.forEach(article => {
                const title = article.title.toLowerCase();
                const description = article.description.toLowerCase();
                if (title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())) {
                    keywordAnalysis[keyword]++;
                }
            });
        });
        
        console.log('\n🔍 키워드 포함 빈도:');
        Object.keys(keywordAnalysis).forEach(keyword => {
            console.log(`   "${keyword}": ${keywordAnalysis[keyword]}건`);
        });
        
        // 샘플 기사 상세 정보
        console.log('\n📰 샘플 기사 상세 정보 (첫 3건):');
        allArticles.slice(0, 3).forEach((article, index) => {
            console.log(`\n${index + 1}. ${article.title.replace(/<[^>]*>/g, '')}`);
            console.log(`   설명: ${article.description.replace(/<[^>]*>/g, '')}`);
            console.log(`   날짜: ${article.pubDate}`);
            console.log(`   링크: ${article.link}`);
            console.log(`   원본링크: ${article.originallink}`);
        });
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.errorMessage || error.message}`);
    }
}

analyzeNewsData();


