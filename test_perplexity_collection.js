require('dotenv').config();
const axios = require('axios');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

console.log('🔍 Perplexity API 뉴스 수집 테스트');
console.log('');

if (!PERPLEXITY_API_KEY) {
    console.log('❌ PERPLEXITY_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
}

console.log(`✅ API 키 확인: ${PERPLEXITY_API_KEY.substring(0, 10)}...`);
console.log('');

async function testPerplexityCollection() {
    try {
        const keywords = ['백종원', '더본코리아']; // 리스크 키워드 예시
        
        const prompt = `
당신은 뉴스 분석 전문가입니다. 다음 키워드들에 대한 최신 뉴스를 검색하고 분석해주세요: ${keywords.join(', ')}

카테고리: risk

요구사항:
1. **반드시 최근 24시간 내의 뉴스만 수집** (오늘 날짜 기준)
2. **신뢰할 수 있는 언론사나 뉴스 사이트의 기사만 수집** (YouTube, Instagram, 블로그 등은 제외)
3. 각 뉴스에 대해 다음 정보를 제공:
   - 제목: 뉴스 제목
   - 링크: 실제 뉴스 URL
   - 언론사: 출처 언론사명
   - 발행일: 뉴스 발행일 (YYYY-MM-DD 형식)
   - aiSummary: 뉴스 내용 요약
4. 뉴스가 없을 경우 "금일은 뉴스가 없습니다" 표시
5. 마지막에 전체 뉴스에 대한 종합 분석 보고서를 추가

응답 형식:
- 가능하면 JSON 형태로 응답하되, JSON이 어려우면 텍스트 형태로도 가능합니다
- JSON 응답 시 주석을 포함하지 마세요

예시 JSON 형식:
{
  "news": [
    {
      "title": "뉴스 제목",
      "link": "https://example.com/news/123",
      "source": "언론사명",
      "pubDate": "2025-12-02",
      "aiSummary": "뉴스 요약"
    }
  ],
  "analysis": "전체 분석 보고서"
}
`;

        console.log('📤 Perplexity API 호출 중...');
        console.log(`   키워드: ${keywords.join(', ')}`);
        console.log(`   모델: sonar-pro`);
        console.log('');

        const response = await axios.post(PERPLEXITY_API_URL, {
            model: 'sonar-pro',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 3000,
            temperature: 0.5
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const aiResponse = response.data.choices[0].message.content;
        const finishReason = response.data.choices[0].finish_reason;
        const usage = response.data.usage;

        console.log('✅ Perplexity API 응답 수신');
        console.log(`   Finish reason: ${finishReason}`);
        console.log(`   Token usage: ${usage?.total_tokens || 'N/A'}/${usage?.completion_tokens || 'N/A'}`);
        console.log('');

        // 응답 내용 확인
        console.log('📄 응답 내용 (처음 500자):');
        console.log(aiResponse.substring(0, 500));
        console.log('...');
        console.log('');

        // JSON 형식인지 확인
        const isJsonResponse = aiResponse.trim().startsWith('{') || aiResponse.trim().startsWith('[');
        
        if (isJsonResponse) {
            console.log('✅ JSON 형식 응답 감지');
            try {
                const result = JSON.parse(aiResponse);
                if (result.news && Array.isArray(result.news)) {
                    console.log(`\n📰 수집된 뉴스: ${result.news.length}건`);
                    result.news.forEach((news, index) => {
                        console.log(`   ${index + 1}. ${news.title}`);
                        console.log(`      링크: ${news.link}`);
                        console.log(`      발행일: ${news.pubDate}`);
                    });
                } else {
                    console.log('⚠️ 뉴스 배열이 없습니다.');
                }
                
                if (result.analysis) {
                    console.log(`\n📊 분석 보고서: ${result.analysis.substring(0, 100)}...`);
                }
            } catch (parseError) {
                console.log('❌ JSON 파싱 실패:', parseError.message);
            }
        } else {
            console.log('⚠️ 텍스트 형식 응답 (JSON 아님)');
            // 텍스트에서 뉴스 개수 추정
            const newsMatches = aiResponse.match(/뉴스|기사|article/gi);
            console.log(`   "뉴스" 키워드 발견: ${newsMatches ? newsMatches.length : 0}회`);
        }

        if (finishReason === 'length') {
            console.log('\n⚠️ 응답이 max_tokens로 잘렸습니다!');
        }

    } catch (error) {
        console.error('❌ Perplexity API 호출 실패:');
        console.error(`   에러 메시지: ${error.message}`);
        
        if (error.response) {
            console.error(`   상태 코드: ${error.response.status}`);
            console.error(`   응답 데이터:`, JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.error('\n   ⚠️ API 키가 유효하지 않습니다.');
            } else if (error.response.status === 429) {
                console.error('\n   ⚠️ Rate Limit에 도달했습니다.');
            }
        } else if (error.request) {
            console.error('   네트워크 오류: 요청이 전송되었지만 응답을 받지 못했습니다.');
        }
    }
}

testPerplexityCollection();
