require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const keyword = 'IP라이선싱빌드업';
const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

console.log(`📊 네이버 뉴스 884건 CSV 생성: "${keyword}"`);
console.log('');

async function generateNewsCSV() {
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
        
        // CSV 헤더 생성
        const csvHeader = [
            '순번',
            '제목',
            '설명',
            '발행일',
            '링크',
            '원본링크',
            '언론사',
            'IP포함',
            '라이선싱포함',
            '빌드업포함',
            '코레일포함',
            '슈야포함',
            '테마카페포함',
            '캐릭터포함'
        ].join(',');
        
        // CSV 데이터 생성
        const csvRows = [csvHeader];
        
        allArticles.forEach((article, index) => {
            const cleanTitle = article.title.replace(/<[^>]*>/g, '').replace(/,/g, ';');
            const cleanDescription = article.description.replace(/<[^>]*>/g, '').replace(/,/g, ';');
            const pubDate = new Date(article.pubDate).toISOString().split('T')[0];
            
            // 언론사 추출
            let media = 'Unknown';
            if (article.link.includes('mk.co.kr')) media = '매일경제';
            else if (article.link.includes('kpenews.com')) media = '한국정경신문';
            else if (article.link.includes('meconomynews.com')) media = '시장경제신문';
            else if (article.link.includes('fnnews.com')) media = '파이낸셜뉴스';
            else if (article.link.includes('the-pr.co.kr')) media = '더프라이즈';
            else if (article.link.includes('straightnews.co.kr')) media = '스트레이트뉴스';
            else if (article.link.includes('startuptoday.co.kr')) media = '스타트업투데이';
            else if (article.link.includes('thefairnews.co.kr')) media = '더페어뉴스';
            else if (article.link.includes('munhwa.com')) media = '문화일보';
            else if (article.link.includes('naver.com')) media = '네이버뉴스';
            
            // 키워드 포함 여부 체크
            const titleLower = article.title.toLowerCase();
            const descLower = article.description.toLowerCase();
            
            const ipIncluded = (titleLower.includes('ip') || descLower.includes('ip')) ? 'Y' : 'N';
            const licensingIncluded = (titleLower.includes('라이선싱') || descLower.includes('라이선싱')) ? 'Y' : 'N';
            const buildUpIncluded = (titleLower.includes('빌드업') || descLower.includes('빌드업')) ? 'Y' : 'N';
            const korailIncluded = (titleLower.includes('코레일') || descLower.includes('코레일')) ? 'Y' : 'N';
            const shuyaIncluded = (titleLower.includes('슈야') || descLower.includes('슈야')) ? 'Y' : 'N';
            const themeCafeIncluded = (titleLower.includes('테마카페') || descLower.includes('테마카페')) ? 'Y' : 'N';
            const characterIncluded = (titleLower.includes('캐릭터') || descLower.includes('캐릭터')) ? 'Y' : 'N';
            
            const row = [
                index + 1,
                `"${cleanTitle}"`,
                `"${cleanDescription}"`,
                pubDate,
                `"${article.link}"`,
                `"${article.originallink}"`,
                media,
                ipIncluded,
                licensingIncluded,
                buildUpIncluded,
                korailIncluded,
                shuyaIncluded,
                themeCafeIncluded,
                characterIncluded
            ].join(',');
            
            csvRows.push(row);
        });
        
        // CSV 파일 저장
        const csvContent = csvRows.join('\n');
        const filename = `IP라이선싱빌드업_뉴스_${allArticles.length}건_${new Date().toISOString().split('T')[0]}.csv`;
        
        fs.writeFileSync(filename, csvContent, 'utf8');
        
        console.log(`\n✅ CSV 파일 생성 완료: ${filename}`);
        console.log(`📊 총 ${allArticles.length}건의 기사 데이터가 포함되었습니다.`);
        
        // 통계 정보 출력
        const stats = {
            total: allArticles.length,
            ipIncluded: allArticles.filter(a => a.title.toLowerCase().includes('ip') || a.description.toLowerCase().includes('ip')).length,
            licensingIncluded: allArticles.filter(a => a.title.toLowerCase().includes('라이선싱') || a.description.toLowerCase().includes('라이선싱')).length,
            buildUpIncluded: allArticles.filter(a => a.title.toLowerCase().includes('빌드업') || a.description.toLowerCase().includes('빌드업')).length,
            korailIncluded: allArticles.filter(a => a.title.toLowerCase().includes('코레일') || a.description.toLowerCase().includes('코레일')).length,
            shuyaIncluded: allArticles.filter(a => a.title.toLowerCase().includes('슈야') || a.description.toLowerCase().includes('슈야')).length,
            themeCafeIncluded: allArticles.filter(a => a.title.toLowerCase().includes('테마카페') || a.description.toLowerCase().includes('테마카페')).length,
            characterIncluded: allArticles.filter(a => a.title.toLowerCase().includes('캐릭터') || a.description.toLowerCase().includes('캐릭터')).length
        };
        
        console.log('\n📈 키워드 포함 통계:');
        console.log(`   IP: ${stats.ipIncluded}건 (${(stats.ipIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   라이선싱: ${stats.licensingIncluded}건 (${(stats.licensingIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   빌드업: ${stats.buildUpIncluded}건 (${(stats.buildUpIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   코레일: ${stats.korailIncluded}건 (${(stats.korailIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   슈야: ${stats.shuyaIncluded}건 (${(stats.shuyaIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   테마카페: ${stats.themeCafeIncluded}건 (${(stats.themeCafeIncluded/stats.total*100).toFixed(1)}%)`);
        console.log(`   캐릭터: ${stats.characterIncluded}건 (${(stats.characterIncluded/stats.total*100).toFixed(1)}%)`);
        
    } catch (error) {
        console.log(`❌ 실패: ${error.response?.status || 'N/A'} - ${error.response?.data?.errorMessage || error.message}`);
    }
}

generateNewsCSV();


