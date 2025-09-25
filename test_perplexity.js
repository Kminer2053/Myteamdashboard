// Perplexity AI API 테스트
require('dotenv').config();
const axios = require('axios');

// Perplexity AI API 테스트 함수
async function testPerplexityAPI() {
    try {
        console.log('🔍 Perplexity AI API 테스트 시작...');
        
        const apiKey = process.env.PERPLEXITY_API_KEY; // 환경변수에서 가져오기
        
        if (!apiKey) {
            console.error('❌ PERPLEXITY_API_KEY 환경변수가 설정되지 않았습니다.');
            console.log('💡 .env 파일에 PERPLEXITY_API_KEY를 추가해주세요.');
            return;
        }
        
        const url = 'https://api.perplexity.ai/chat/completions';
        const data = {
            model: 'sonar-pro',
            messages: [
                {
                    role: 'user',
                    content: '인공지능 관련 뉴스가 최근에 많이 나오고 있는데, 이에 대한 간단한 분석을 해주세요.'
                }
            ],
            max_tokens: 500,
            temperature: 0.5
        };
        
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Perplexity AI API 테스트 성공!');
        console.log(`🤖 모델: ${response.data.model}`);
        console.log(`📝 토큰 사용량: ${response.data.usage.total_tokens}`);
        
        // AI 응답 출력
        if (response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content;
            console.log('\n🧠 AI 분석 결과:');
            console.log(aiResponse);
        }
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Perplexity AI API 테스트 실패:', error.message);
        if (error.response) {
            console.error('응답 상태:', error.response.status);
            console.error('응답 데이터:', error.response.data);
        }
        return null;
    }
}

// 테스트 실행
if (require.main === module) {
    testPerplexityAPI();
}

module.exports = { testPerplexityAPI };
