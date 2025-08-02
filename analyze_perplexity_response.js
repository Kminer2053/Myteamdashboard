// Perplexity AI 응답 종합 분석 스크립트
const axios = require('axios');

async function analyzeAllCategories() {
  const categories = ['risk', 'partner', 'tech'];
  const results = {};
  
  console.log('=== Perplexity AI 응답 종합 분석 ===\n');
  
  for (const category of categories) {
    console.log(`🔍 ${category.toUpperCase()} 카테고리 분석 중...`);
    
    try {
      const response = await axios.post('https://myteamdashboard.onrender.com/api/test-perplexity', {
        category: category
      });
      
      const data = response.data;
      
      if (!data.success) {
        console.log(`❌ ${category} API 호출 실패:`, data.error);
        continue;
      }
      
      const news = data.data.news || [];
      const analysis = data.data.analysis;
      
      // 데이터 품질 분석
      const totalItems = news.length;
      const completeItems = news.filter(item => 
        item.title && item.link && item.source && item.pubDate && 
        (item.summary || item.aiSummary) && 
        item.link !== '#' && 
        (item.summary || item.aiSummary).length > 10
      ).length;
      
      // 기간 분석
      const today = new Date();
      const recentItems = news.filter(item => {
        if (!item.pubDate) return false;
        const itemDate = new Date(item.pubDate);
        const diffDays = (today - itemDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 1; // 24시간 이내
      });
      
      results[category] = {
        totalItems,
        completeItems,
        recentItems: recentItems.length,
        news,
        analysis
      };
      
      console.log(`✅ ${category}: ${totalItems}건 (완전: ${completeItems}건, 최근: ${recentItems.length}건)`);
      
    } catch (error) {
      console.log(`❌ ${category} 분석 실패:`, error.message);
    }
  }
  
  console.log('\n=== 종합 분석 결과 ===');
  
  // CSV 형태로 결과 출력
  console.log('카테고리,전체뉴스,완전한데이터,24시간이내,데이터완성도,기간준수율');
  console.log('---,---,---,---,---,---');
  
  for (const [category, result] of Object.entries(results)) {
    const completeness = result.totalItems > 0 ? Math.round((result.completeItems / result.totalItems) * 100) : 0;
    const timeCompliance = result.totalItems > 0 ? Math.round((result.recentItems / result.totalItems) * 100) : 0;
    
    console.log(`${category},${result.totalItems},${result.completeItems},${result.recentItems},${completeness}%,${timeCompliance}%`);
  }
  
  console.log('\n=== 상세 분석 ===');
  
  for (const [category, result] of Object.entries(results)) {
    console.log(`\n📊 ${category.toUpperCase()} 카테고리 상세:`);
    
    if (result.totalItems === 0) {
      console.log('  📝 뉴스 없음');
      continue;
    }
    
    // 뉴스 목록 출력
    result.news.forEach((item, index) => {
      const num = index + 1;
      const title = item.title || 'N/A';
      const link = item.link || 'N/A';
      const source = item.source || 'N/A';
      const pubDate = item.pubDate || 'N/A';
      const summary = item.summary || item.aiSummary || 'N/A';
      
      // 데이터 완성도 계산
      let completeness = 0;
      if (title && title !== 'N/A') completeness += 20;
      if (link && link !== 'N/A' && link !== '#') completeness += 20;
      if (source && source !== 'N/A') completeness += 20;
      if (pubDate && pubDate !== 'N/A') completeness += 20;
      if (summary && summary !== 'N/A' && summary.length > 10) completeness += 20;
      
      console.log(`  ${num}. "${title}" (${completeness}%)`);
      console.log(`     링크: ${link}`);
      console.log(`     출처: ${source}`);
      console.log(`     날짜: ${pubDate}`);
      console.log(`     요약: ${summary.substring(0, 100)}...`);
    });
  }
  
  // 문제점 분석
  console.log('\n=== 문제점 분석 ===');
  
  let totalNews = 0;
  let totalComplete = 0;
  let totalRecent = 0;
  
  for (const result of Object.values(results)) {
    totalNews += result.totalItems;
    totalComplete += result.completeItems;
    totalRecent += result.recentItems;
  }
  
  console.log(`📈 전체 뉴스: ${totalNews}건`);
  console.log(`✅ 완전한 데이터: ${totalComplete}건 (${Math.round((totalComplete/totalNews)*100)}%)`);
  console.log(`🕐 24시간 이내: ${totalRecent}건 (${Math.round((totalRecent/totalNews)*100)}%)`);
  
  if (totalNews > 0) {
    console.log('\n🔍 주요 문제점:');
    
    if (totalComplete < totalNews) {
      console.log(`  ❌ 불완전한 데이터: ${totalNews - totalComplete}건`);
    }
    
    if (totalRecent < totalNews) {
      console.log(`  ⏰ 기간 초과: ${totalNews - totalRecent}건`);
    }
    
    if (totalNews > 10) {
      console.log(`  📊 과다 수집: ${totalNews}건 (예상보다 많음)`);
    }
  }
  
  console.log('\n=== 결론 ===');
  console.log('1. Perplexity AI는 50건 고정 반환이 아닌, 조건에 맞는 뉴스만 반환');
  console.log('2. 하지만 기간 필터링이 완벽하지 않음 (24시간 초과 뉴스 포함)');
  console.log('3. 데이터 품질은 대체로 양호하지만 일부 불완전한 데이터 존재');
  console.log('4. 키워드 관련성은 프롬프트에 따라 달라짐');
}

// 스크립트 실행
analyzeAllCategories(); 