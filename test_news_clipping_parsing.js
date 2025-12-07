require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const NewsClippingPdfGenerator = require('./services/newsClippingPdfGenerator');

// API 기본 URL
const API_BASE_URL = process.env.API_BASE_URL || 'https://myteamdashboard.onrender.com';

// 기본값 (main.js의 INITIAL_DEFAULTS와 동일)
const INITIAL_DEFAULTS = {
    date: new Date().toISOString().split('T')[0],
    header: "",
    basicSetting: `당신의 역할:
- 당신은 코레일유통 홍보문화처가 매일 받아보는 "주요 뉴스 브리핑"을 대신 제작하는 전문 뉴스클리핑 용역사의 책임 편집자입니다.
- 목표는 기존 외주업체가 만든 것과 동일한 수준의 "1페이지 요약 리스트"와 상세 뉴스 페이지를, 항상 같은 형식으로 안정적으로 생산하는 것입니다.

출력 언어:
- 모든 출력은 한국어로 작성합니다.`,
    categoryDefinition: `1) 카테고리 정의

- 코레일유통 : '코레일유통', '스토리웨이', '역사 상업시설' 등 코레일유통과 직접 연결된 기사
- 철도 : 코레일, SR, 국가철도공단, 도시철도, KTX, SRT, GTX 등 철도 인프라, 노선, 안전, 파업, 철도 정책 관련 기사
- 지역본부/계열사 : 코레일관광개발, 코레일네트웍스, 코레일테크 등 계열사 및 코레일 지역본부 관련 기사
- 공공기관 : 정부 부처(기재부, 국토부 등), 공공기관 정책·투자·규제 등 코레일유통에 간접적 영향을 줄 수 있는 기사
- 유통 : 편의점, 대형마트, 백화점, 리테일, F&B, 프랜차이즈, K-푸드/K-스낵 트렌드 등 일반 유통/소비 트렌드 기사`,
    categoryRule: `2) 분류규칙
- 기사 제목/내용에 '코레일유통' 또는 '스토리웨이' 등이 명시되면 '코레일유통'으로 분류합니다.
- 코레일, SR, 국가철도공단, 도시철도, KTX·SRT·GTX, 역세권 개발 이슈는 '철도'로 분류합니다.
- 코레일관광개발, 코레일네트웍스, 코레일테크 등 계열사 이름이 있으면 '지역본부/계열사'로 분류합니다.
- 정부 정책, 공공기관 투자·규제, 물가·노동·배송·공공자산 관련 제도 변화는 '공공기관'으로 분류합니다.
- 편의점/마트/프랜차이즈/리테일, K-푸드/K-스낵, 가격·소비 트렌드, 캐릭터 콜라보 등은 '유통'으로 분류합니다.
- 한 기사에 여러 요소가 있어도, 코레일유통/철도/계열사 직접 관련성이 가장 높은 카테고리를 우선합니다.`,
    selectionPrinciple: `기사선별 원칙:
- 기준_날짜 당일(필요 시 전일 저녁 포함) 기사 중심으로 선별합니다.
- 서로 내용이 거의 같은 기사는 가장 대표성이 높은 1건만 선택합니다.
- 다음뉴스, 네이트 등과 같이 뉴스중개사이트의 자료의 경우 원문기사의 언론사를 확인하여 출처로 표시합니다.
- 각 카테고리별로 1~6개 정도를 목표로 하되, 실제 기사 상황에 따라 유연하게 조정합니다.
- 코레일유통, 철도, 지역본부/계열사 관련 기사는 가능하면 빠뜨리지 않고 포함합니다.
- 공공기관·유통 카테고리는 코레일유통의 사업(철도역 상권, 편의점/도시락/광고 사업, ESG 등)에 의미 있는 이슈만 선별합니다.
- 같은 카테고리 안에서는 "회사/철도 직접 영향도가 큰 기사 → 정책/규제 → 일반 트렌드" 순으로 배치하려고 노력합니다.`,
    outputFormat: `출력형식:
- 아래 형식을 반드시 그대로 사용하고, 불필요한 설명이나 주석을 추가하지 않습니다.

* 1page 뉴스요약 페이지
1) 1행: "주요 뉴스 브리핑"
2) 2행: 헤더_문자열 (사용자가 준 값을 그대로 사용)
3) 빈 줄 1줄
4) 각 카테고리별로 다음 형식 반복 (기사 없는 카테고리는 전체 생략)

☐ 코레일유통
○기사 제목 1 (언론사)
○기사 제목 2 (언론사)

☐ 철도
○기사 제목 1 (언론사)
○기사 제목 2 (언론사)

☐ 지역본부/계열사
○기사 제목 1 (언론사)
...

☐ 공공기관
○기사 제목 1 (언론사)
...

☐ 유통
○기사 제목 1 (언론사)
...

- 카테고리 순서는 항상 다음을 기본으로 합니다.
1) 코레일유통
2) 철도
3) 지역본부/계열사
4) 공공기관
5) 유통
- 해당 카테고리에 선정된 기사가 하나도 없다면, 그 카테고리 제목과 내용 전체를 출력하지 않습니다.
- 각 카테고리 항목은 반드시 "☐"로 시작하고, 볼드체로 표시합니다.
- 각 기사 항목은 반드시 "○"로 시작하고, "제목 (언론사)" 형식을 유지합니다.
- 제목 안의 인용부호, 줄임표, 숫자 등은 기사 원문 제목을 최대한 보존하여 사용합니다.

* 각 뉴스 상세 페이지
1) 1행: "언론사명"
2) 2행: "기사제목"을 볼드체로 크게
3) 3행 이후 : "기사내용"
4) 기사내용 다음 : 빈행을 한줄넣고 그 다음행에 URL표기하고 링크를 걸어줍니다.
- 각 뉴스별 페이지가 끝나면 다음 페이지에서 새로 상세 페이지 출력

출력 시 유의사항:
- 중간 과정, 검색 키워드, 내부 설명, 주석표기, 판단 근거는 출력하지 않습니다.
- 오직 최종 브리핑 결과만 출력합니다.
- 사용자가 별도로 지시하지 않는 한, 각 뉴스 상세페이지의 기사내용은 원문의 내용을 충분히 전달할수 있도록 작성합니다.`,
    articleList: ""
};

// 날짜로부터 헤더 문자열 자동 생성
function generateHeaderFromDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    
    return `[ '${year}.${month}.${day}. (${weekday}) / 홍보문화처(☎6163)]`;
}

// 프롬프트 생성 (main.js의 buildPrompt와 동일)
function buildPrompt(defaults) {
    const date = defaults.date;
    const header = defaults.header || generateHeaderFromDate(date);
    const basicSetting = defaults.basicSetting;
    const categoryDefinition = defaults.categoryDefinition;
    const categoryRule = defaults.categoryRule;
    const selectionPrinciple = defaults.selectionPrinciple;
    const outputFormat = defaults.outputFormat;
    const articleList = defaults.articleList.trim();

    let prompt = '';

    // 기본설정
    if (basicSetting) {
        prompt += basicSetting + '\n\n';
    }

    // 입력 정보
    prompt += `입력:\n`;
    prompt += `- 사용자는 다음 정보를 제공합니다.\n`;
    prompt += `1) 헤더_문자열 : ${header}\n`;
    prompt += `2) 기준_날짜 : ${date}\n`;
    if (articleList) {
        prompt += `3) 기사_목록 : 외부 시스템(크롤러, Perplexity 등)이 미리 수집한 기사 리스트\n${articleList}\n`;
    } else {
        prompt += `3) 기사_목록 : 제공되지 않음 (웹 검색 도구를 활용해 직접 뉴스를 수집해주세요)\n`;
    }
    prompt += '\n';

    // 카테고리 정의
    if (categoryDefinition) {
        prompt += `카테고리 정의:\n${categoryDefinition}\n\n`;
    }

    // 분류규칙
    if (categoryRule) {
        prompt += `카테고리 분류 규칙:\n${categoryRule}\n\n`;
    }

    // 기사선별 원칙
    if (selectionPrinciple) {
        prompt += `${selectionPrinciple}\n\n`;
    }

    // 출력형식
    if (outputFormat) {
        prompt += `${outputFormat}\n\n`;
    }

    prompt += `위 정보를 바탕으로 뉴스 브리핑을 생성해주세요.`;
    
    return prompt;
}

// Perplexity API 호출
async function callPerplexityAPI(prompt) {
    try {
        console.log('📡 Perplexity API 호출 중...');
        const response = await axios.post(`${API_BASE_URL}/api/perplexity-chat`, {
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'sonar-pro',
            max_tokens: 8000,
            temperature: 0.5
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
            throw new Error('서버 응답 형식이 올바르지 않습니다.');
        }
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ Perplexity API 호출 오류:', error.message);
        if (error.response) {
            console.error('응답 상태:', error.response.status);
            console.error('응답 데이터:', error.response.data);
        }
        throw error;
    }
}

// 미리보기 변환 테스트 (main.js의 displayResult와 동일)
function testPreviewParsing(result) {
    console.log('\n=== 미리보기 파싱 테스트 ===');
    
    const lines = result.split('\n');
    let html = '';
    let inSummaryPage = true;
    let publisherNumber = 0; // 언론사명 넘버링용
    const issues = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 상세 페이지 구분 (--- 구분선 또는 "* 각 뉴스 상세 페이지" 마커)
        if (line === '---' || line.startsWith('* 각 뉴스 상세 페이지')) {
            inSummaryPage = false;
            publisherNumber = 0; // 상세 페이지 진입 시 넘버링 초기화
            html += '<hr class="detail-separator">';
            console.log(`✅ 상세 페이지 시작: ${i}번째 줄`);
            continue;
        }
        
        // 상세 페이지 자동 감지: 언론사명 패턴이 나오면 상세 페이지로 전환
        const isPublisherName = line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
            !line.includes('브리핑') && line.length < 20 && !line.startsWith('☐') && !line.startsWith('○') && 
            !line.startsWith('**') && line !== '---' && !line.match(/^\(URL/);
        
        if (inSummaryPage && isPublisherName && i > 5) { // 요약 페이지에서 언론사명이 나오면 상세 페이지로 전환
            inSummaryPage = false;
            publisherNumber = 0;
            html += '<hr class="detail-separator">';
            console.log(`✅ 상세 페이지 자동 감지: ${i}번째 줄 - ${line}`);
        }
        
        if (inSummaryPage) {
            // "주요 뉴스 브리핑" 제목
            if (line === '주요 뉴스 브리핑') {
                html += '<h1 class="main-title">주요 뉴스 브리핑</h1>';
                console.log(`✅ 주요 뉴스 브리핑 제목 발견: ${i}번째 줄`);
                continue;
            }
            
            // 헤더 문자열 (날짜 정보) - [ ] 형식 또는 일반 날짜 형식
            if (line.match(/^\[.*\]$/) || line.match(/^\d{2}\.\d{2}\.\d{2}\./)) {
                html += `<div class="header-info">${line}</div>`;
                console.log(`✅ 헤더 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // 카테고리 제목 (☐로 시작하거나 ☐ **...** 형식) - 전체 볼드 처리
            const categoryMatch1 = line.match(/^☐\s*\*\*(.+?)\*\*/);
            const categoryMatch2 = line.match(/^\*\*☐\s*(.+?)\*\*/);
            if (categoryMatch1) {
                // 형식: ☐ **카테고리명** (전체 볼드)
                html += `<h2 class="category-title"><strong>☐ ${categoryMatch1[1]}</strong></h2>`;
                console.log(`✅ ☐ 카테고리 제목 발견: ${i}번째 줄 - ☐ ${categoryMatch1[1]}`);
                continue;
            } else if (categoryMatch2) {
                // 형식: **☐ 카테고리명** (전체 볼드) - ☐ 포함하여 출력
                html += `<h2 class="category-title"><strong>☐ ${categoryMatch2[1]}</strong></h2>`;
                console.log(`✅ ☐ 카테고리 제목 발견: ${i}번째 줄 - ☐ ${categoryMatch2[1]}`);
                continue;
            } else if (line.startsWith('☐ ')) {
                // 일반 형식: ☐ 카테고리명 (마크다운 제거 후 전체 볼드)
                const cleanCategory = line.replace(/\*\*(.*?)\*\*/g, '$1');
                html += `<h2 class="category-title"><strong>${cleanCategory}</strong></h2>`;
                console.log(`✅ ☐ 카테고리 제목 발견: ${i}번째 줄 - ${cleanCategory}`);
                continue;
            }
            
            // 기사 항목 (○로 시작) - 주석 표기 제거
            if (line.startsWith('○')) {
                // [1], [2] 같은 주석 표기 제거
                const cleanedLine = line.replace(/\[\d+\]/g, '');
                html += `<div class="article-item">${cleanedLine}</div>`;
                console.log(`✅ ○ 기사 항목 발견: ${i}번째 줄 - ${cleanedLine.substring(0, 50)}...`);
                continue;
            }
            
            // 빈 줄
            if (!line) {
                html += '<br>';
                continue;
            }
        } else {
            // 상세 페이지 처리
            // 언론사명 (짧은 한글 텍스트) - 넘버링 추가
            if (line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
                !line.includes('브리핑') && line.length < 20 && !line.startsWith('☐') && !line.startsWith('○') && 
                !line.startsWith('**') && line !== '---' && !line.match(/^\(URL/)) {
                publisherNumber++;
                html += `<h3 class="publisher-name">${publisherNumber}. ${line}</h3>`;
                console.log(`✅ 언론사명 발견: ${i}번째 줄 - ${publisherNumber}. ${line}`);
                continue;
            }
            
            // 기사 제목 (**...** 형식) - 주석 표기 제거
            const titleMatch = line.match(/\*\*(.+?)\*\*/);
            if (titleMatch) {
                // 제목에서 주석 표기 제거
                const cleanedTitle = titleMatch[1].replace(/\[\d+\]/g, '');
                html += `<h4 class="article-title">${cleanedTitle}</h4>`;
                console.log(`✅ 기사 제목 발견: ${i}번째 줄 - ${cleanedTitle.substring(0, 50)}...`);
                continue;
            }
            
            // URL 처리 (실제 URL만 링크, 생략 메시지는 그대로)
            if (line.match(/^https?:\/\//)) {
                html += `<div class="article-url"><a href="${line}" target="_blank" rel="noopener noreferrer">${line}</a></div>`;
                console.log(`✅ URL 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // URL 생략 메시지
            if (line.match(/^\(URL 생략/)) {
                html += `<div class="article-url-omitted">${line}</div>`;
                console.log(`✅ URL 생략 메시지 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // 기사 내용 - 주석 표기 제거
            if (line && line !== '---') {
                // [1], [2] 같은 주석 표기 제거
                let processedLine = line.replace(/\[\d+\]/g, '');
                // 마크다운 볼드체 처리
                processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                html += `<p class="article-content">${processedLine}</p>`;
            }
        }
    }
    
    if (issues.length > 0) {
        console.log('\n⚠️ 발견된 문제점:');
        issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    return { html, issues };
}

// PDF 파싱 로직 테스트 (newsClippingPdfGenerator.js의 로직 시뮬레이션)
function testPdfParsing(result) {
    console.log('\n=== PDF 파싱 테스트 ===');
    
    const lines = result.split('\n');
    let inSummaryPage = true;
    let currentArticleUrl = null;
    const issues = [];
    const parsedStructure = {
        summaryPage: {
            title: null,
            header: null,
            categories: []
        },
        detailPages: []
    };
    
    let currentCategory = null;
    let currentArticle = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        // 상세 페이지 구분 (--- 구분선 또는 "* 각 뉴스 상세 페이지" 마커)
        if (line === '---' || line.startsWith('* 각 뉴스 상세 페이지')) {
            inSummaryPage = false;
            console.log(`✅ 상세 페이지 시작: ${i}번째 줄`);
            continue;
        }
        
        if (inSummaryPage) {
            // "주요 뉴스 브리핑" 제목
            if (line === '주요 뉴스 브리핑' || line.trim() === '주요 뉴스 브리핑') {
                parsedStructure.summaryPage.title = '주요 뉴스 브리핑';
                console.log(`✅ 요약 페이지 제목 발견: ${i}번째 줄`);
                continue;
            }
            
            // 헤더 문자열 ([ ] 형식 또는 일반 날짜 형식)
            if (line.match(/^\[.*\]$/) || line.match(/^\d{2}\.\d{2}\.\d{2}\./)) {
                parsedStructure.summaryPage.header = line;
                console.log(`✅ 헤더 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // 카테고리 제목 (☐로 시작하거나 ☐ **...** 형식)
            const categoryMatch1 = line.match(/^☐\s*\*\*(.+?)\*\*/);
            const categoryMatch2 = line.match(/^\*\*☐\s*(.+?)\*\*/);
            if (categoryMatch1) {
                // 형식: ☐ **카테고리명**
                currentCategory = {
                    name: categoryMatch1[1],
                    articles: []
                };
                parsedStructure.summaryPage.categories.push(currentCategory);
                console.log(`✅ 카테고리 발견: ${i}번째 줄 - ${currentCategory.name}`);
                continue;
            } else if (categoryMatch2) {
                // 형식: **☐ 카테고리명**
                currentCategory = {
                    name: categoryMatch2[1],
                    articles: []
                };
                parsedStructure.summaryPage.categories.push(currentCategory);
                console.log(`✅ 카테고리 발견: ${i}번째 줄 - ${currentCategory.name}`);
                continue;
            } else if (line.startsWith('☐ ')) {
                // 일반 형식: ☐ 카테고리명 (마크다운 제거)
                const cleanCategory = line.substring(2).trim().replace(/\*\*(.*?)\*\*/g, '$1');
                currentCategory = {
                    name: cleanCategory,
                    articles: []
                };
                parsedStructure.summaryPage.categories.push(currentCategory);
                console.log(`✅ 카테고리 발견: ${i}번째 줄 - ${currentCategory.name}`);
                continue;
            }
            
            // 기사 항목 (○로 시작)
            if (line.startsWith('○')) {
                if (!currentCategory) {
                    issues.push(`⚠️ ${i}번째 줄: 카테고리 없이 기사 항목 발견 - ${line}`);
                } else {
                    currentCategory.articles.push(line);
                }
                continue;
            }
            
            // 언론사명 감지 (요약 페이지에서 상세 페이지로 전환)
            if (line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
                !line.includes('브리핑') && line.length < 20 && !line.startsWith('☐') && !line.startsWith('○') &&
                !line.startsWith('**') && line !== '---') {
                inSummaryPage = false;
                console.log(`✅ 상세 페이지 시작 (언론사명으로 감지): ${i}번째 줄 - ${line}`);
                
                currentArticle = {
                    publisher: line,
                    title: null,
                    content: [],
                    url: null
                };
                parsedStructure.detailPages.push(currentArticle);
                currentArticleUrl = null;
                console.log(`✅ 언론사명 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
        } else {
            // 상세 페이지 처리
            // 언론사명 감지 (짧은 한글 텍스트)
            // 요약 페이지에서 상세 페이지로 전환도 여기서 처리
            if (line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
                !line.includes('브리핑') && line.length < 20 && !line.startsWith('☐') && !line.startsWith('○') &&
                !line.startsWith('**') && line !== '---') {
                
                // 요약 페이지에서 상세 페이지로 전환
                if (inSummaryPage) {
                    inSummaryPage = false;
                    console.log(`✅ 상세 페이지 시작 (언론사명으로 감지): ${i}번째 줄 - ${line}`);
                }
                
                if (currentArticle && currentArticleUrl) {
                    currentArticle.url = currentArticleUrl;
                }
                
                currentArticle = {
                    publisher: line,
                    title: null,
                    content: [],
                    url: null
                };
                parsedStructure.detailPages.push(currentArticle);
                currentArticleUrl = null;
                console.log(`✅ 언론사명 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // URL 추출
            if (line.match(/^https?:\/\//)) {
                currentArticleUrl = line;
                console.log(`✅ URL 발견: ${i}번째 줄 - ${line}`);
                continue;
            }
            
            // 기사 제목 (**...** 형식 또는 일반 긴 텍스트)
            const titleMatch = line.match(/\*\*(.+?)\*\*/);
            if (currentArticle && !currentArticle.title && titleMatch) {
                currentArticle.title = titleMatch[1];
                console.log(`✅ 기사 제목 발견: ${i}번째 줄 - ${titleMatch[1].substring(0, 50)}...`);
                continue;
            } else if (currentArticle && !currentArticle.title && !currentArticleUrl && line.length > 5 && !line.match(/^https?:\/\//) && line !== '---') {
                currentArticle.title = line;
                console.log(`✅ 기사 제목 발견: ${i}번째 줄 - ${line.substring(0, 50)}...`);
                continue;
            }
            
            // 기사 내용
            if (currentArticle && line.length > 0) {
                currentArticle.content.push(line);
            }
        }
    }
    
    // 마지막 기사 URL 추가
    if (currentArticle && currentArticleUrl) {
        currentArticle.url = currentArticleUrl;
    }
    
    // 결과 요약
    console.log(`\n📊 파싱 결과 요약:`);
    console.log(`   - 요약 페이지 카테고리: ${parsedStructure.summaryPage.categories.length}개`);
    parsedStructure.summaryPage.categories.forEach(cat => {
        console.log(`     • ${cat.name}: ${cat.articles.length}개 기사`);
    });
    console.log(`   - 상세 페이지 기사: ${parsedStructure.detailPages.length}개`);
    parsedStructure.detailPages.forEach((article, idx) => {
        console.log(`     • ${idx + 1}. ${article.publisher} - ${article.title ? article.title.substring(0, 30) : '제목 없음'}...`);
        if (!article.url) {
            issues.push(`⚠️ ${article.publisher} 기사에 URL이 없습니다.`);
        }
    });
    
    if (issues.length > 0) {
        console.log('\n⚠️ 발견된 문제점:');
        issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    return { parsedStructure, issues };
}

// 메인 테스트 함수
async function runTest() {
    try {
        console.log('🧪 뉴스 클리핑 파싱 테스트 시작\n');
        console.log(`📅 테스트 날짜: ${INITIAL_DEFAULTS.date}`);
        console.log(`🌐 API URL: ${API_BASE_URL}\n`);
        
        // 헤더 자동 생성
        const defaults = {
            ...INITIAL_DEFAULTS,
            header: generateHeaderFromDate(INITIAL_DEFAULTS.date)
        };
        
        // 프롬프트 생성
        const prompt = buildPrompt(defaults);
        console.log('📝 생성된 프롬프트 길이:', prompt.length, '자');
        console.log('프롬프트 미리보기 (처음 500자):\n', prompt.substring(0, 500), '...\n');
        
        // Perplexity API 호출
        const result = await callPerplexityAPI(prompt);
        
        console.log('✅ API 응답 수신 완료');
        console.log('응답 길이:', result.length, '자\n');
        
        // 결과를 파일로 저장
        const outputDir = path.join(__dirname, 'test_output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rawOutputPath = path.join(outputDir, `news-clipping-raw-${timestamp}.txt`);
        fs.writeFileSync(rawOutputPath, result, 'utf8');
        console.log(`💾 원본 결과 저장: ${rawOutputPath}`);
        
        // 미리보기 파싱 테스트
        const previewResult = testPreviewParsing(result);
        const previewOutputPath = path.join(outputDir, `news-clipping-preview-${timestamp}.html`);
        fs.writeFileSync(previewOutputPath, `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>뉴스 클리핑 미리보기 테스트</title>
    <style>
        body { 
            font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; 
            padding: 20px; 
            background-color: #f5f5f5;
        }
        .preview-content {
            background: white;
            padding: 20px;
            border-radius: 5px;
            line-height: 1.8;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1.main-title {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
        }
        .header-info {
            text-align: right;
            margin-bottom: 15px;
            font-size: 1.1em;
        }
        h2.category-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #1976d2;
        }
        .article-item {
            margin-left: 20px;
            margin-bottom: 5px;
        }
        .detail-separator {
            margin: 40px 0;
            border: 0;
            border-top: 1px dashed #ccc;
        }
        .publisher-name {
            font-size: 1.1em;
            font-weight: bold;
            margin-top: 30px;
            margin-bottom: 10px;
            color: #333;
        }
        .article-title {
            font-size: 1.3em;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1976d2;
        }
        .article-content {
            margin-bottom: 10px;
            line-height: 1.6;
            color: #333;
        }
        .article-url {
            font-size: 0.9em;
            margin-top: 10px;
            margin-bottom: 20px;
        }
        .article-url a {
            color: #1976d2;
            text-decoration: underline;
            word-break: break-all;
        }
        .article-url a:hover {
            color: #1565c0;
        }
        .article-url-omitted {
            font-size: 0.85em;
            color: #666;
            font-style: italic;
            margin-top: 10px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>미리보기 파싱 결과</h1>
    <div class="preview-content">${previewResult.html}</div>
    <hr>
    <h2>발견된 문제점</h2>
    <ul>
        ${previewResult.issues.length > 0 ? previewResult.issues.map(issue => `<li>${issue}</li>`).join('') : '<li>없음</li>'}
    </ul>
</body>
</html>
        `, 'utf8');
        console.log(`💾 미리보기 HTML 저장: ${previewOutputPath}`);
        
        // PDF 파싱 테스트
        const pdfResult = testPdfParsing(result);
        const pdfTestOutputPath = path.join(outputDir, `news-clipping-pdf-test-${timestamp}.json`);
        fs.writeFileSync(pdfTestOutputPath, JSON.stringify({
            parsedStructure: pdfResult.parsedStructure,
            issues: pdfResult.issues,
            lineCount: result.split('\n').length
        }, null, 2), 'utf8');
        console.log(`💾 PDF 파싱 테스트 결과 저장: ${pdfTestOutputPath}`);
        
        // 실제 PDF 생성
        console.log('\n📄 PDF 생성 중...');
        const pdfGenerator = new NewsClippingPdfGenerator();
        const date = defaults.date;
        const filename = `뉴스클리핑_${date}`;
        const pdfGenerationResult = await pdfGenerator.convertToPDF(result, filename);
        
        let pdfOutputPath = null;
        if (pdfGenerationResult.success) {
            console.log(`✅ PDF 생성 완료: ${pdfGenerationResult.fileName}`);
            console.log(`   파일 크기: ${(pdfGenerationResult.fileSize / 1024).toFixed(2)} KB`);
            console.log(`   파일 경로: ${pdfGenerationResult.filePath}`);
            
            // PDF 파일을 test_output으로 복사
            pdfOutputPath = path.join(outputDir, `news-clipping-${timestamp}.pdf`);
            fs.copyFileSync(pdfGenerationResult.filePath, pdfOutputPath);
            console.log(`💾 PDF 파일 복사: ${pdfOutputPath}`);
        } else {
            console.error(`❌ PDF 생성 실패: ${pdfGenerationResult.error}`);
        }
        
        console.log('\n✅ 테스트 완료!');
        console.log('\n📋 생성된 파일:');
        console.log(`   1. 원본 데이터: ${rawOutputPath}`);
        console.log(`   2. 미리보기 HTML: ${previewOutputPath}`);
        console.log(`   3. PDF 파일: ${pdfGenerationResult.success ? pdfOutputPath : '생성 실패'}`);
        console.log(`   4. 파싱 테스트 결과: ${pdfTestOutputPath}`);
        console.log('\n💡 확인 방법:');
        console.log(`   - 원본 데이터: 텍스트 에디터로 열기`);
        console.log(`     ${rawOutputPath}`);
        console.log(`   - 미리보기 HTML: 브라우저로 열기`);
        console.log(`     ${previewOutputPath}`);
        console.log(`   - PDF 파일: PDF 뷰어로 열기`);
        if (pdfOutputPath) {
            console.log(`     ${pdfOutputPath}`);
        }
        
        // macOS에서 자동으로 파일 열기
        const { exec } = require('child_process');
        const platform = process.platform;
        
        if (platform === 'darwin') {
            // macOS
            setTimeout(() => {
                exec(`open "${previewOutputPath}"`, (error) => {
                    if (error) console.error('HTML 파일 열기 실패:', error.message);
                });
                if (pdfOutputPath) {
                    setTimeout(() => {
                        exec(`open "${pdfOutputPath}"`, (error) => {
                            if (error) console.error('PDF 파일 열기 실패:', error.message);
                        });
                    }, 500);
                }
            }, 1000);
            console.log('\n🚀 브라우저에서 미리보기 HTML과 PDF가 자동으로 열립니다...');
        } else if (platform === 'win32') {
            // Windows
            exec(`start "" "${previewOutputPath}"`, (error) => {
                if (error) console.error('HTML 파일 열기 실패:', error.message);
            });
            if (pdfOutputPath) {
                setTimeout(() => {
                    exec(`start "" "${pdfOutputPath}"`, (error) => {
                        if (error) console.error('PDF 파일 열기 실패:', error.message);
                    });
                }, 500);
            }
            console.log('\n🚀 브라우저에서 미리보기 HTML과 PDF가 자동으로 열립니다...');
        } else {
            // Linux
            console.log('\n💡 Linux에서는 다음 명령어로 파일을 열 수 있습니다:');
            console.log(`   xdg-open "${previewOutputPath}"`);
            if (pdfOutputPath) {
                console.log(`   xdg-open "${pdfOutputPath}"`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ 테스트 실패:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 실행
runTest();

