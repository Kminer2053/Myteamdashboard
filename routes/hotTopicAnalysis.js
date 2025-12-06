const express = require('express');
const router = express.Router();
const axios = require('axios');
const PDFGenerator = require('../services/pdfGenerator');
const Setting = require('../models/Setting');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'e037eF7sxB3VuJHBpay5';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'qkPfGHxNkN';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const pdfGenerator = new PDFGenerator();

// 정보검색 API (언론보도 효과성 + 검색트렌드)
router.post('/search-info', async (req, res) => {
    try {
        const { keyword, startDate, endDate } = req.body;
        
        if (!keyword || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '키워드, 시작일, 종료일이 모두 필요합니다.'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 날짜 형식입니다.'
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: '시작일은 종료일보다 이전이어야 합니다.'
            });
        }

        // 최대 3개월 제한
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const maxDays = 90; // 3개월
        
        if (daysDiff > maxDays) {
            return res.status(400).json({
            success: false,
                message: `분석 기간은 최대 ${maxDays}일(3개월)까지만 가능합니다. 현재 기간: ${daysDiff}일`
            });
        }

        console.log(`🔍 정보검색 시작: ${keyword} (${startDate} ~ ${endDate})`);

        // 1. 언론보도 효과성 데이터 수집 (한번에 조회)
        let newsData = null;
        try {
            let allNewsItems = [];
            const maxPages = 10; // 최대 10페이지 (1000건)
            
            // 한번에 조회 (월별 분할 제거)
            for (let page = 1; page <= maxPages; page++) {
                const newsResponse = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                    headers: {
                        'X-Naver-Client-Id': NAVER_CLIENT_ID,
                        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
                    },
                    params: {
                        query: keyword,
                        display: 100,
                        sort: 'date',
                        start: (page - 1) * 100 + 1
                    }
                });

                const pageItems = newsResponse.data.items || [];
                if (pageItems.length === 0) break;
                
                allNewsItems = allNewsItems.concat(pageItems);
                
                // API 호출 간격 조절
                if (page < maxPages) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const filteredNews = allNewsItems
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    return pubDate >= start && pubDate <= end;
                })
                .map(item => {
                    // originallink가 있으면 우선 사용, 없으면 link 사용
                    const newsLink = item.originallink || item.link;
                    return {
                        title: item.title.replace(/<[^>]+>/g, ''),
                        link: newsLink,
                        description: item.description.replace(/<[^>]+>/g, ''),
                        pubDate: new Date(item.pubDate).toISOString().split('T')[0],
                        source: extractSourceFromLink(newsLink),
                        originallink: item.originallink
                    };
                });

            // 날짜별 집계 (전체 기간 포함, 뉴스 없는 날은 0으로 표시)
            const aggregated = {};
            
            // 전체 기간의 날짜 배열 생성
            const dates = [];
            let current = new Date(start);
            while (current <= end) {
                const dateKey = current.toISOString().split('T')[0];
                dates.push(dateKey);
                // 다음 날로 이동
                const nextDate = new Date(current);
                nextDate.setDate(nextDate.getDate() + 1);
                current = nextDate;
            }
            
            // 모든 날짜를 0으로 초기화
            dates.forEach(date => {
                aggregated[date] = 0;
            });
            
            // 뉴스가 있는 날짜만 카운트
            filteredNews.forEach(item => {
                const dateKey = item.pubDate; // YYYY-MM-DD 형식
                if (aggregated.hasOwnProperty(dateKey)) {
                    aggregated[dateKey]++;
                }
            });

            // 네이버뉴스 API 제한 확인 (950건 이상 시 경고)
            const apiLimitWarning = filteredNews.length >= 950;
            
            newsData = {
                news: filteredNews,
                aggregated: aggregated,
                totalCount: filteredNews.length,
                apiLimitWarning: apiLimitWarning
            };
        } catch (error) {
            console.error('언론보도 효과성 데이터 수집 오류:', error.message);
            newsData = {
                news: [],
                aggregated: {},
                totalCount: 0,
                error: error.message
            };
        }

        // 2. 네이버 검색트렌드 데이터 수집
        let naverTrend = null;
        try {
            const trendResponse = await axios.post('https://openapi.naver.com/v1/datalab/search', {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                timeUnit: 'date',
                keywordGroups: [{
                    groupName: keyword,
                    keywords: [keyword]
                }]
            }, {
                headers: {
                    'X-Naver-Client-Id': NAVER_CLIENT_ID,
                    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
                    'Content-Type': 'application/json'
                }
            });

            const trendData = trendResponse.data.results[0]?.data || [];
            naverTrend = {
                keyword: keyword,
                data: trendData.map(item => ({
                    date: item.period,
                    value: item.ratio || 0
                })),
                totalVolume: trendData.reduce((sum, item) => sum + (item.ratio || 0), 0),
                avgValue: Math.round(trendData.reduce((sum, item) => sum + (item.ratio || 0), 0) / Math.max(trendData.length, 1))
            };
        } catch (error) {
            console.error('네이버 검색트렌드 수집 오류:', error.message);
            naverTrend = {
                keyword: keyword,
                data: [],
                totalVolume: 0,
                avgValue: 0,
                error: error.message
            };
        }

        // 3. 구글 검색트렌드 데이터 수집 (제거됨)
        // 구글 트렌드는 공식 API가 유료이고, 비공식 라이브러리가 불안정하여 제거
        const googleTrend = null;

        res.json({
            success: true,
            data: {
                keyword: keyword,
                period: {
                    startDate: startDate,
                    endDate: endDate
                },
                newsData: newsData,
                naverTrend: naverTrend,
                googleTrend: googleTrend
            }
        });

    } catch (error) {
        console.error('정보검색 오류:', error);
        res.status(500).json({
            success: false,
            message: '정보검색 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 화제성 분석 보고서 생성 API
router.post('/generate-report', async (req, res) => {
    try {
        const { keyword, startDate, endDate, insights, newsData, naverTrend, googleTrend } = req.body;
        
        if (!keyword || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '키워드, 시작일, 종료일이 필요합니다.'
            });
        }

        if (!PERPLEXITY_API_KEY) {
            return res.status(500).json({
            success: false,
                message: 'Perplexity API 키가 설정되지 않았습니다.'
            });
        }

        console.log(`📊 화제성 분석 보고서 생성: ${keyword}`);

        // 프롬프트 구성 (구글 트렌드 제거)
        const prompt = buildAnalysisPrompt(keyword, startDate, endDate, insights, newsData, naverTrend, null);

        // 타임아웃 설정 조회 (기본값: 5분 = 300000ms)
        let timeout = 300000;
        try {
            const timeoutSetting = await Setting.findOne({ key: 'perplexityTimeout' });
            if (timeoutSetting && timeoutSetting.value) {
                timeout = parseInt(timeoutSetting.value);
                // 최소값 검증
                if (timeout < 60000) {
                    timeout = 60000; // 최소 1분
                }
            }
        } catch (err) {
            console.warn('타임아웃 설정 조회 실패, 기본값 사용:', err.message);
        }

        console.log(`⏱️ Perplexity AI 타임아웃: ${timeout}ms (${timeout / 1000}초)`);

        // Perplexity AI 호출
        let response;
        try {
            response = await axios.post(PERPLEXITY_API_URL, {
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 화제성 분석 전문가입니다. 주어진 데이터를 바탕으로 구조화된 마크다운 형식의 종합 분석 보고서를 작성해주세요.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: timeout
            });
        } catch (apiError) {
            // 401 인증 오류 처리
            if (apiError.response && apiError.response.status === 401) {
                console.error('🔐 Perplexity AI 인증 오류 (401): API 키가 유효하지 않거나 만료되었습니다.');
                return res.status(401).json({
                    success: false,
                    message: 'Perplexity AI 인증에 실패했습니다.',
                    error: '인증 오류',
                    details: 'API 키가 유효하지 않거나 만료되었습니다. 환경 변수 PERPLEXITY_API_KEY를 확인하고 올바른 API 키로 업데이트해주세요.'
                });
            }
            
            // 타임아웃 에러 구체적으로 처리
            if (apiError.code === 'ECONNABORTED' || apiError.message.includes('timeout')) {
                const timeoutSeconds = Math.floor(timeout / 1000);
                const timeoutMinutes = Math.floor(timeoutSeconds / 60);
                const timeoutDisplay = timeoutMinutes > 0 ? `${timeoutMinutes}분` : `${timeoutSeconds}초`;
                console.error('⏱️ Perplexity AI 타임아웃 오류:', apiError.message);
                return res.status(504).json({
                    success: false,
                    message: `AI 보고서 생성 시간이 초과되었습니다. (${timeoutDisplay})`,
                    error: '타임아웃',
                    details: `Perplexity AI 응답이 설정된 시간(${timeoutDisplay}) 내에 완료되지 않아 요청이 취소되었습니다. 관리자 페이지에서 타임아웃 시간을 늘리거나 잠시 후 다시 시도해주세요.`
                });
            }
            
            // 기타 API 에러
            console.error('❌ Perplexity AI API 오류:', apiError.message);
            throw apiError; // 상위 catch로 전달
        }

        let markdownReport = response.data.choices[0].message.content;
        const originalMarkdown = markdownReport; // 원본 마크다운 저장 (참고문헌 추가 전)
        
        // Perplexity AI가 생성한 참고문헌 섹션 제거 (우리가 새로 만들 예정)
        // "참고 문헌", "참고문헌", "Reference", "References" 등의 섹션 찾아서 제거
        const referenceSectionPatterns = [
            /\n\n##\s*📚\s*참고\s*문헌.*$/s,
            /\n\n##\s*참고\s*문헌.*$/s,
            /\n\n##\s*참고문헌.*$/s,
            /\n\n---\n\n##\s*📚\s*참고\s*문헌.*$/s,
            /\n\n---\n\n##\s*참고\s*문헌.*$/s,
            /\n\n###\s*참고\s*문헌.*$/s,
            /\n\n##\s*Reference.*$/s,
            /\n\n##\s*References.*$/s
        ];
        
        referenceSectionPatterns.forEach(pattern => {
            markdownReport = markdownReport.replace(pattern, '');
        });
        
        // Perplexity AI 응답에서 citations 추출 시도
        const citations = response.data.citations || [];
        
        // 마크다운에서 참조 번호 추출 ([1], [2] 등)
        const citationMatches = markdownReport.match(/\[(\d+)\]/g) || [];
        const citationNumbers = [...new Set(citationMatches.map(m => parseInt(m.replace(/[\[\]]/g, ''))))].sort((a, b) => a - b);
        
        // 수집된 뉴스 데이터의 링크를 참조 번호와 매핑
        const newsLinks = (newsData?.news || []).slice(0, 10).map((item, idx) => ({
            number: idx + 1,
            title: item.title,
            link: item.link || item.originallink || '#',
            source: item.source || '알 수 없음',
            pubDate: item.pubDate || ''
        }));
        
        // citations가 있으면 사용, 없으면 뉴스 데이터 링크 사용
        let references = [];
        if (citations && citations.length > 0) {
            references = citations.map((citation, idx) => ({
                number: idx + 1,
                url: citation.url || citation,
                title: citation.title || `출처 ${idx + 1}`
            }));
        } else if (citationNumbers.length > 0 && newsLinks.length > 0) {
            // 뉴스 데이터와 참조 번호 매핑
            references = citationNumbers.map(num => {
                const newsItem = newsLinks[num - 1]; // [1] = index 0
                if (newsItem) {
                    return {
                        number: num,
                        url: newsItem.link,
                        title: newsItem.title || `뉴스 ${num}`,
                        source: newsItem.source,
                        pubDate: newsItem.pubDate
                    };
                }
                return null;
            }).filter(ref => ref !== null);
        }
        
        // 참고문헌 섹션 추가 (참조 번호가 있을 때만)
        if (references.length > 0) {
            // 참조 번호는 그냥 텍스트로만 유지 (하이퍼링크 변환 안 함)
            
            markdownReport += '\n\n---\n\n## 📚 참고 문헌\n\n';
            references.forEach(ref => {
                // 형식: 번호. [url](url) - URL 자체를 표기하고 링크 적용
                if (ref.url && ref.url !== '#') {
                    markdownReport += `${ref.number}. [${ref.url}](${ref.url})\n`;
                } else {
                    const fallbackText = ref.title || `출처 ${ref.number}`;
                    markdownReport += `${ref.number}. ${fallbackText}\n`;
                }
            });
        }
        
        // Perplexity AI 응답 로그 (디버깅용)
        console.log('📝 Perplexity AI 원본 응답 (처음 1000자):');
        console.log(markdownReport.substring(0, 1000));
        console.log('\n📝 전체 응답 길이:', markdownReport.length, '자');
        console.log('📝 **볼드 패턴 확인:', (markdownReport.match(/\*\*[^*]+\*\*/g) || []).length, '개');
        console.log('📝 <strong> 태그 확인:', (markdownReport.match(/<strong>/gi) || []).length, '개');
        console.log(`📚 참조 번호 개수: ${citationNumbers.length}개`);
        console.log(`📚 참고문헌 개수: ${references.length}개`);
        
        // 참고문헌 데이터 확인 (디버깅용)
        if (references.length > 0) {
            console.log('📚 참고문헌 데이터 샘플 (첫 번째):');
            console.log(JSON.stringify(references[0], null, 2));
        }

        res.json({
            success: true,
            data: {
                keyword: keyword,
                report: markdownReport,
                originalMarkdown: originalMarkdown, // 원본 마크다운 (디버깅용)
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('화제성 분석 보고서 생성 오류:', error);
        
        // 이미 처리된 에러는 그대로 반환 (401, 504 등)
        if (error.response && error.response.status) {
            // 이미 상위에서 처리된 에러는 여기서 다시 처리하지 않음
            return;
        }
        
        // 에러 타입에 따른 메시지 구분
        let errorMessage = '보고서 생성 중 오류가 발생했습니다.';
        let errorDetails = error.message;
        let statusCode = 500;
        
        if (error.response) {
            // API 응답 에러
            if (error.response.status === 401) {
                errorMessage = 'Perplexity AI 인증에 실패했습니다.';
                errorDetails = 'API 키가 유효하지 않거나 만료되었습니다. 환경 변수를 확인해주세요.';
                statusCode = 401;
            } else {
                errorMessage = 'Perplexity AI 서버 오류가 발생했습니다.';
                errorDetails = `상태 코드: ${error.response.status}, 메시지: ${error.response.data?.message || error.message}`;
                statusCode = error.response.status || 500;
            }
        } else if (error.request) {
            // 요청은 보냈지만 응답이 없음
            errorMessage = 'Perplexity AI 서버에 연결할 수 없습니다.';
            errorDetails = '네트워크 연결을 확인해주세요.';
        }
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: errorDetails
        });
    }
});

// PDF 변환 API
router.post('/convert-pdf', async (req, res) => {
    try {
        const { markdown, filename } = req.body;
        
        if (!markdown) {
            return res.status(400).json({
                success: false,
                message: '마크다운 내용이 필요합니다.'
            });
        }

        console.log('📄 PDF 변환 시작...');
        
        const result = await pdfGenerator.convertToPDF(markdown, filename);
            
        if (result.success) {
            res.json({
                success: true,
                data: {
                    filePath: result.filePath,
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    url: result.url
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'PDF 변환 실패',
                error: result.error
            });
        }

    } catch (error) {
        console.error('PDF 변환 오류:', error);
        res.status(500).json({
            success: false,
            message: 'PDF 변환 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// PDF 다운로드 API
router.get('/download-pdf/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const path = require('path');
        const fs = require('fs');
        
        const reportsDir = path.join(__dirname, '../reports');
        const filePath = path.join(reportsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('PDF 다운로드 오류:', err);
                res.status(500).json({
                    success: false,
                    message: '파일 다운로드 중 오류가 발생했습니다.'
                });
            }
        });

    } catch (error) {
        console.error('PDF 다운로드 오류:', error);
        res.status(500).json({
            success: false,
            message: '파일 다운로드 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 프롬프트 구성 함수
function buildAnalysisPrompt(keyword, startDate, endDate, insights, newsData, naverTrend, googleTrend) {
    const newsCount = newsData?.totalCount || 0;
    const newsList = newsData?.news?.slice(0, 10).map((item, idx) => 
        `${idx + 1}. ${item.title} (${item.source}, ${item.pubDate})`
    ).join('\n') || '없음';

    const naverTrendData = naverTrend?.data?.map(item => 
        `${item.date}: ${item.value}`
    ).join('\n') || '데이터 없음';

    return `
# 화제성 분석 보고서 작성 요청

## 분석 대상
- **키워드**: ${keyword}
- **분석 기간**: ${startDate} ~ ${endDate}
- **착안사항**: ${insights || '없음'}

## 수집된 데이터

### 1. 언론보도 효과성
- **총 보도건수**: ${newsCount}건
- **주요 보도내역**:
${newsList}

### 2. 네이버 검색트렌드
- **평균 검색량**: ${naverTrend?.avgValue || 0}
- **시계열 데이터**:
${naverTrendData}

---

위 데이터를 바탕으로 다음 구조로 마크다운 형식의 화제성 분석 보고서를 작성해주세요:

# ${keyword} 화제성 분석 보고서

## 📊 분석 개요
- 분석 기간: ${startDate} ~ ${endDate}
- 총 보도건수: ${newsCount}건
- 네이버 평균 검색량: ${naverTrend?.avgValue || 0}

## 📰 언론보도 현황
[언론보도 효과성에 대한 분석]

## 📈 검색트렌드 분석
[네이버 검색트렌드 분석]

## 🔍 주요 발견사항
[데이터를 바탕으로 한 주요 발견사항]

## 💡 종합 분석
[착안사항을 반영한 종합 분석 및 인사이트]

## 📋 결론 및 제언
[결론 및 향후 제언]

---

**참고**: 마크다운 형식으로 작성하고, 표나 리스트를 적절히 활용해주세요.
`;
}

// 언론사 추출 함수 (네이버 뉴스 링크 처리 개선)
function extractSourceFromLink(link) {
    try {
        if (!link) return '알 수 없음';
        
        const url = new URL(link);
        const hostname = url.hostname;
        const pathname = url.pathname;
        
        // 네이버 뉴스 링크 처리 (n.news.naver.com/mnews/article/언론사ID/기사ID)
        if (hostname.includes('news.naver.com') || hostname.includes('n.news.naver.com')) {
            const articleMatch = pathname.match(/\/article\/([^\/]+)\//);
            if (articleMatch) {
                const mediaId = articleMatch[1];
                // 네이버 뉴스 언론사 ID 매핑 (주요 언론사)
                const naverMediaMap = {
                    '001': '연합뉴스',
                    '020': '동아일보',
                    '021': '조선일보',
                    '022': '중앙일보',
                    '023': '한겨레',
                    '025': '한국경제',
                    '028': '한국일보',
                    '030': '매일경제',
                    '031': '아시아경제',
                    '032': '이데일리',
                    '079': '노컷뉴스',
                    '081': '서울신문',
                    '082': '세계일보',
                    '087': '프레시안',
                    '088': '한국일보',
                    '092': '뉴스타파',
                    '094': '오마이뉴스',
                    '119': '조선비즈',
                    '215': '한국경제TV',
                    '277': '아시아투데이',
                    '293': '블로터',
                    '296': '전자신문',
                    '347': '디지털데일리',
                    '366': '아이뉴스24',
                    '421': '뉴스1',
                    '422': '연합뉴스TV',
                    '437': '이투데이',
                    '469': '뉴시스',
                    '586': '스포츠동아',
                    '629': '스포츠조선',
                    '656': '스포츠한국',
                    '658': '스포츠서울',
                    '660': '스포츠경향',
                    '662': '스포츠월드',
                    // 영문 ID 매핑
                    'idsn': '아이뉴스24',
                    'n': '네이버 뉴스',
                    'm-i': '머니투데이',
                    'biz': '비즈워치',
                    'edaily': '이데일리',
                    'munhwa': '문화일보',
                    'ikld': '아이클릭데일리',
                    'lawissue': '법률저널',
                    'mk': '매일경제',
                    'chosun': '조선일보',
                    'donga': '동아일보',
                    'joongang': '중앙일보',
                    'hani': '한겨레',
                    'khan': '경향신문',
                    'hankyung': '한국경제',
                    'fnnews': '파이낸셜뉴스',
                    'news1': '뉴스1',
                    'yonhap': '연합뉴스',
                    'newsis': '뉴시스',
                    'etnews': '전자신문',
                    'zdnet': 'ZDNet Korea',
                    'kbs': 'KBS',
                    'mbc': 'MBC',
                    'sbs': 'SBS',
                    'ytn': 'YTN',
                    'jtbc': 'JTBC'
                };
                
                if (naverMediaMap[mediaId]) {
                    return naverMediaMap[mediaId];
                }
                // 매핑되지 않은 경우 ID를 한글로 변환 시도
                return `언론사(${mediaId})`;
            }
        }
        
        // 주요 언론사 매핑
        const sourceMap = {
            'www.chosun.com': '조선일보',
            'www.donga.com': '동아일보',
            'www.joongang.co.kr': '중앙일보',
            'www.hani.co.kr': '한겨레',
            'www.khan.co.kr': '경향신문',
            'www.hankyung.com': '한국경제',
            'www.mk.co.kr': '매일경제',
            'www.etnews.com': '전자신문',
            'www.zdnet.co.kr': 'ZDNet Korea',
            'news.naver.com': '네이버 뉴스',
            'entertain.naver.com': '네이버 엔터테인먼트',
            'n.news.naver.com': '네이버 뉴스'
        };
        
        if (sourceMap[hostname]) {
            return sourceMap[hostname];
        }
        
        // 도메인에서 언론사명 추출 시도
        const domainParts = hostname.replace('www.', '').split('.');
        if (domainParts.length >= 2) {
            return domainParts[0];
        }
        
        return hostname.replace('www.', '');
    } catch (e) {
        return '알 수 없음';
    }
}

module.exports = router;
