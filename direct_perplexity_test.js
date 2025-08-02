// Perplexity AI 직접 테스트 스크립트 (모든 카테고리)
const axios = require('axios');

async function testAllCategories() {
  const categories = [
    { name: 'risk', keywords: ['백종원', '더본코리아'], customPrompt: '' },
    { name: 'partner', keywords: ['로코노미', '로컬브랜드'], customPrompt: '간략하게 뉴스를 요약하고 최근 트렌드와 시사점을 언급' },
    { name: 'tech', keywords: ['인공지능', 'AI'], customPrompt: '' }
  ];
  
  for (const category of categories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${category.name.toUpperCase()} 카테고리 테스트`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      console.log(`🔍 설정된 키워드: ${category.keywords.join(', ')}`);
      console.log(`📝 커스텀 프롬프트: ${category.customPrompt || '기본 프롬프트'}`);
      console.log('\n');
      
      // 실제 프롬프트 구성 (서버와 동일한 방식)
      const prompt = `
당신은 뉴스 분석 전문가입니다. 다음 키워드들에 대한 최신 뉴스를 검색하고 분석해주세요: ${category.keywords.join(', ')}

카테고리: ${category.name}

요구사항:
1. 키워드와 관련된 최근 24시간 내의 뉴스만 수집
2. 각 뉴스에 대해 다음 정보를 제공:
   - 제목: 뉴스 제목
   - 링크: 실제 뉴스 URL
   - 언론사: 출처 언론사명
   - 발행일: 뉴스 발행일
   - aiSummary: 뉴스 내용 요약
3. 뉴스가 없을 경우 "금일은 뉴스가 없습니다" 표시
4. 마지막에 전체 뉴스에 대한 종합 분석 보고서를 추가

분석 보고서 작성 시 다음 내용을 참고하여 작성해주세요:
${category.customPrompt || '일반적인 뉴스 분석을 진행해주세요.'}

응답 형식:
- 가능하면 JSON 형태로 응답하되, JSON이 어려우면 텍스트 형태로도 가능합니다
- JSON 응답 시 주석을 포함하지 마세요
- 텍스트 응답 시 표 형태나 구조화된 형태로 정리해주세요

예시 JSON 형식:
{
  "news": [
    {
      "title": "뉴스 제목",
      "link": "https://example.com/news/123",
      "source": "언론사명",
      "pubDate": "2025-07-31",
      "aiSummary": "뉴스 요약"
    }
  ],
  "analysis": "전체 분석 보고서"
}
`;

      console.log('📤 전송할 프롬프트:');
      console.log('-'.repeat(50));
      console.log(prompt);
      console.log('-'.repeat(50));
      console.log('\n');
      
      // Perplexity AI API 직접 호출
      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
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
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      const aiResponse = response.data.choices[0].message.content;
      const finishReason = response.data.choices[0].finish_reason;
      const usage = response.data.usage;
      
      console.log('📥 Perplexity AI 응답:');
      console.log('-'.repeat(50));
      console.log(aiResponse);
      console.log('-'.repeat(50));
      console.log('\n');
      
      console.log('📊 응답 메타데이터:');
      console.log(`- Finish reason: ${finishReason}`);
      console.log(`- Total tokens: ${usage?.total_tokens || 'N/A'}`);
      console.log(`- Completion tokens: ${usage?.completion_tokens || 'N/A'}`);
      console.log('\n');
      
      // JSON 파싱 시도
      try {
        const parsedResponse = JSON.parse(aiResponse);
        console.log('✅ JSON 파싱 성공');
        
        const news = parsedResponse.news || [];
        console.log(`📈 뉴스 개수: ${news.length}건\n`);
        
        if (news.length > 0) {
          console.log('=== 뉴스 데이터 (표 형태) ===');
          console.log('번호|제목|링크|언론사|발행일|요약');
          console.log('---|---|---|---|---|---');
          
          news.forEach((item, index) => {
            const num = index + 1;
            const title = item.title || 'N/A';
            const link = item.link || 'N/A';
            const source = item.source || 'N/A';
            const pubDate = item.pubDate || 'N/A';
            const summary = item.aiSummary || item.summary || 'N/A';
            
            console.log(`${num}|${title}|${link}|${source}|${pubDate}|${summary}`);
          });
          
          console.log('\n=== 분석 보고서 ===');
          console.log(parsedResponse.analysis || '분석 보고서 없음');
        } else {
          console.log('📝 뉴스가 없습니다.');
        }
        
      } catch (parseError) {
        console.log('❌ JSON 파싱 실패 - 텍스트 응답으로 처리');
        console.log('원본 응답:', aiResponse);
      }
      
    } catch (error) {
      console.error(`❌ ${category.name} API 호출 실패:`, error.message);
      if (error.response) {
        console.error('응답 데이터:', error.response.data);
      }
    }
    
    // 카테고리 간 간격
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 테스트 완료');
  console.log(`${'='.repeat(60)}`);
}

// 스크립트 실행
testAllCategories(); 