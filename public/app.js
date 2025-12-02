// API 기본 URL 설정 (전역)
const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

// pubDate에서 YYYY-MM-DD 추출 함수 (전역) - 한국시간 기준
function extractDate(pubDate) {
    if (!pubDate) return '';
    
    // 이미 YYYY-MM-DD 형식인 경우
    if (/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) {
        return pubDate;
    }
    
    // 한국어 형식: 2025. 5. 19. 오전 9:02:00
    const match = pubDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (match) {
        const [, y, m, d] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // ISO 포맷(UTC)일 경우 한국시간으로 변환
    const d = new Date(pubDate);
    if (isNaN(d)) return '';
    
    // UTC를 한국시간(KST)으로 변환 (UTC+9)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

// 서버에서 공인된 KST 기준 오늘 날짜를 받아오는 비동기 함수
async function getKoreaToday() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/korea-today`);
        const data = await res.json();
        return data.today;
    } catch (e) {
        // 네트워크 오류 등 발생 시 fallback: 기존 방식
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const year = kst.getUTCFullYear();
        const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kst.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// === 토스트 메시지 함수 (전역) ===
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.display = 'none';
        toast.style.position = 'fixed';
        toast.style.top = '50%';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%,-50%)';
        toast.style.background = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.zIndex = '9999';
        toast.style.fontSize = '1rem';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

// 캘린더 초기화
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    let holidayDates = [];

    // 대시보드 방문자수 기록
    fetch(`${API_BASE_URL}/api/visit`, { method: 'POST' });

    // 탭 구조 초기화
    initTabStructure();

    // 탭 구조 초기화 함수
    function initTabStructure() {
        // 탭 이벤트 리스너 등록
        const tabButtons = document.querySelectorAll('#mainTabs button[data-bs-toggle="tab"]');
        
        tabButtons.forEach(button => {
            button.addEventListener('shown.bs.tab', function(event) {
                const targetTab = event.target.getAttribute('data-bs-target');
                
                // 탭별 지연 로딩 실행
                switch(targetTab) {
                    case '#schedule':
                        // 업무일정표는 이미 로딩됨
                        break;
                    case '#news':
                        loadNewsTab();
                        break;
                    case '#media':
                        loadMediaTab();
                        break;
                }
            });
        });
    }

    // 뉴스모니터링 탭 로딩
    async function loadNewsTab() {
        const newsTab = document.getElementById('news');
        if (newsTab.classList.contains('loaded')) return;
        
        // 로딩 상태 표시
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'tab-loading';
        loadingDiv.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <p>뉴스모니터링 로딩 중...</p>
        `;
        newsTab.appendChild(loadingDiv);
        
        try {
            // 리스크이슈 모니터링 로딩
            await renderKeywordDisplay();
            
            // 제휴처 탐색 로딩
            await renderPartnerDisplay();
            
            // 신기술 동향 로딩
            await renderTechDisplay();
            
            // 무한 스크롤 설정
            setupAllInfiniteScrolls();
            
            // 로딩 완료 표시
            newsTab.classList.add('loaded');
            loadingDiv.remove();
            
        } catch (error) {
            console.error('뉴스모니터링 탭 로딩 실패:', error);
            loadingDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle text-danger"></i>
                <p>뉴스모니터링 로딩 실패</p>
                <button class="btn btn-sm btn-primary" onclick="loadNewsTab()">다시 시도</button>
            `;
        }
    }

    // 언론보도 효과성 탭 로딩
    async function loadMediaTab() {
        const mediaTab = document.getElementById('media');
        if (mediaTab.classList.contains('loaded')) return;
        
        // 로딩 상태 표시
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'tab-loading';
        loadingDiv.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <p>언론보도 효과성 로딩 중...</p>
        `;
        mediaTab.appendChild(loadingDiv);
        
        try {
            // Chart.js 로드
            await loadChartJS();
            
            // 새로운 언론보도 효과성 초기화
            initAdvancedMediaAnalysis();
            
            // 로딩 완료 표시
            mediaTab.classList.add('loaded');
            loadingDiv.remove();
            
        } catch (error) {
            console.error('언론보도 효과성 탭 로딩 실패:', error);
            loadingDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle text-danger"></i>
                <p>언론보도 효과성 로딩 실패</p>
                <button class="btn btn-sm btn-primary" onclick="loadMediaTab()">다시 시도</button>
            `;
        }
    }

    // 고도화된 언론보도 효과성 분석 초기화
    function initAdvancedMediaAnalysis() {
        // 기본 날짜 설정 (최근 30일)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        
        // 키워드 관리 초기화
        initKeywordManager();
        
        // 이벤트 리스너 등록
        initEventListeners();
        
        console.log('고도화된 언론보도 효과성 분석 초기화 완료');
    }

    // 키워드 관리 기능
    function initKeywordManager() {
        const keywordInput = document.getElementById('keywordInput');
        const addKeywordBtn = document.getElementById('addKeywordBtn');
        const keywordTags = document.getElementById('keywordTags');
        
        let keywords = [];
        
        // 키워드 추가 함수
        function addKeyword(keyword) {
            keyword = keyword.trim();
            if (keyword && !keywords.includes(keyword)) {
                keywords.push(keyword);
                renderKeywordTags();
                keywordInput.value = '';
            }
        }
        
        // 키워드 제거 함수
        function removeKeyword(keyword) {
            keywords = keywords.filter(k => k !== keyword);
            renderKeywordTags();
        }
        
        // 키워드 태그 렌더링
        function renderKeywordTags() {
            keywordTags.innerHTML = keywords.map(keyword => `
                <span class="keyword-tag">
                    ${keyword}
                    <span class="remove" onclick="removeKeyword('${keyword}')">×</span>
                </span>
            `).join('');
        }
        
        // Enter 키로 키워드 추가
        keywordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword(this.value);
            }
        });
        
        // 추가 버튼 클릭
        addKeywordBtn.addEventListener('click', function() {
            addKeyword(keywordInput.value);
        });
        
        // 전역 함수로 등록
        window.removeKeyword = removeKeyword;
    }

    // 이벤트 리스너 초기화
    function initEventListeners() {
        const startAnalysisBtn = document.getElementById('startAdvancedAnalysis');
        const downloadReportBtn = document.getElementById('downloadReportBtn');
        const downloadDataBtn = document.getElementById('downloadDataBtn');
        
        // 분석 시작 버튼
        startAnalysisBtn.addEventListener('click', startAdvancedAnalysis);
        
        // 다운로드 버튼들
        downloadReportBtn.addEventListener('click', downloadReport);
        downloadDataBtn.addEventListener('click', downloadData);
    }

    // 고급 분석 시작
    async function startAdvancedAnalysis() {
        const keywords = Array.from(document.querySelectorAll('.keyword-tag')).map(tag => 
            tag.textContent.replace('×', '').trim()
        );
        
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        const sources = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        
        // 유효성 검사
        if (keywords.length === 0) {
            showToast('최소 하나의 키워드를 입력해주세요.');
            return;
        }
        
        if (!startDate || !endDate) {
            showToast('분석 기간을 설정해주세요.');
            return;
        }
        
        if (sources.length === 0) {
            showToast('최소 하나의 데이터 소스를 선택해주세요.');
            return;
        }
        
        // 진행상황 카드 표시
        document.getElementById('progressCard').style.display = 'block';
        document.getElementById('resultsCard').style.display = 'none';
        
        // 분석 요청
        try {
            const response = await fetch(`${API_BASE_URL}/api/hot-topic-analysis/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keywords,
                    startDate,
                    endDate,
                    sources
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    updateProgress('분석 완료!', 100);
                    console.log('분석 결과:', result.data);
                    console.log('결과 배열 길이:', result.data ? result.data.length : 'undefined');
                    displayResults(result.data);
                } else {
                    throw new Error(result.message || '분석 중 오류가 발생했습니다.');
                }
                
            } else {
                throw new Error('분석 요청 실패');
            }
            
        } catch (error) {
            console.error('분석 시작 실패:', error);
            showToast('분석을 시작하는 중 오류가 발생했습니다.');
        }
    }

    // 진행상황 업데이트
    function updateProgress(message, percentage) {
        const progressBar = document.getElementById('progressBar');
        const progressLog = document.getElementById('progressLog');
        
        // 진행률 업데이트
        progressBar.style.width = percentage + '%';
        progressBar.textContent = percentage + '%';
        
        // 로그 추가
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-message">${message}</span>
        `;
        progressLog.appendChild(logItem);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    // 결과 표시
    function displayResults(results) {
        // 진행상황 카드 숨기기
        document.getElementById('progressCard').style.display = 'none';
        
        // 결과 카드 표시
        document.getElementById('resultsCard').style.display = 'block';
        
        // 첫 번째 결과 데이터 사용 (단일 키워드 분석)
        const result = results[0];
        if (!result) {
            showToast('분석 결과를 찾을 수 없습니다.');
            // 진행상황 카드 다시 표시
            document.getElementById('progressCard').style.display = 'block';
            document.getElementById('resultsCard').style.display = 'none';
            return;
        }
        
        // 점수 업데이트
        document.getElementById('overallScore').textContent = result.metrics.overall || '-';
        document.getElementById('exposureScore').textContent = result.metrics.exposure || '-';
        document.getElementById('engagementScore').textContent = result.metrics.engagement || '-';
        document.getElementById('demandScore').textContent = result.metrics.demand || '-';
        
        // 차트 렌더링 (시계열 데이터)
        renderTrendChart(result);
        
        // AI 인사이트 표시
        console.log('AI Insights:', result.aiInsights);
        displayAIInsights(result.aiInsights);
        
        // 데이터 테이블 업데이트
        updateDataTable(result.sources);
        
        // 보고서 다운로드 버튼 활성화
        setupReportDownload(result._id);
        
        showToast('분석이 완료되었습니다!');
    }

    // 화제성 트렌드 차트 렌더링
    function renderTrendChart(result) {
        const ctx = document.getElementById('trendChart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        // 기존 차트 제거
        if (window.trendChart) {
            window.trendChart.destroy();
        }
        
        // 색상 팔레트
        const colors = {
            overall: '#667eea',
            exposure: '#17a2b8',
            engagement: '#28a745', 
            demand: '#ffc107'
        };
        
        // 단일 키워드 분석 결과를 차트 데이터로 변환
        const chartData = {
            labels: [result.date ? new Date(result.date).toLocaleDateString() : '분석일'],
            datasets: [
                {
                    label: '종합 지수',
                    data: [result.metrics?.overall || 0],
                    borderColor: colors.overall,
                    backgroundColor: colors.overall + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: colors.overall,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: '노출 지수',
                    data: [result.metrics?.exposure || 0],
                    borderColor: colors.exposure,
                    backgroundColor: colors.exposure + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '참여 지수',
                    data: [result.metrics?.engagement || 0],
                    borderColor: colors.engagement,
                    backgroundColor: colors.engagement + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '수요 지수',
                    data: [result.metrics?.demand || 0],
                    borderColor: colors.demand,
                    backgroundColor: colors.demand + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        };
        
        window.trendChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                onClick: function(event, elements) {
                    if (elements.length > 0) {
                        const elementIndex = elements[0].index;
                        const selectedDate = trendsData.dates[elementIndex];
                        showDetailedData(selectedDate, trendsData.details[elementIndex]);
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: colors.overall,
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                return `날짜: ${context[0].label}`;
                            },
                            label: function(context) {
                                return `화제성 지수: ${context.parsed.y.toFixed(1)}`;
                            },
                            afterLabel: function(context) {
                                return '클릭하여 상세 데이터 확인';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '화제성 지수',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                }
            }
        });
        
        // 차트 타입 변경 이벤트 리스너
        document.querySelectorAll('input[name="chartType"]').forEach(radio => {
            radio.addEventListener('change', function() {
                updateTrendChart(this.value, trendsData);
            });
        });
    }

    // 트렌드 차트 업데이트 (지표별 필터링)
    function updateTrendChart(chartType, trendsData) {
        if (!window.trendChart) return;
        
        const colors = {
            overall: '#667eea',
            exposure: '#17a2b8',
            engagement: '#28a745', 
            demand: '#ffc107'
        };
        
        const labels = {
            overall: '화제성 지수',
            exposure: '노출 지표',
            engagement: '참여 지표',
            demand: '수요 지표'
        };
        
        const dataset = {
            label: labels[chartType],
            data: trendsData[chartType] || [],
            borderColor: colors[chartType],
            backgroundColor: colors[chartType] + '20',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: colors[chartType],
            pointBorderColor: '#fff',
            pointBorderWidth: 2
        };
        
        window.trendChart.data.datasets = [dataset];
        window.trendChart.update();
    }

    // 상세 데이터 표시
    function showDetailedData(selectedDate, detailData) {
        const selectedDateInfo = document.getElementById('selectedDateInfo');
        const tbody = document.querySelector('#dataTable tbody');
        
        // 선택된 날짜 정보 업데이트
        selectedDateInfo.textContent = `선택된 날짜: ${selectedDate}`;
        
        // 상세 데이터 테이블 업데이트
        if (detailData && detailData.length > 0) {
            tbody.innerHTML = detailData.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td>${item.keyword}</td>
                    <td>${item.channel}</td>
                    <td>${item.exposure || '-'}</td>
                    <td>${item.engagement || '-'}</td>
                    <td>${item.demand || '-'}</td>
                    <td><strong>${item.overall || '-'}</strong></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        ${selectedDate}에 대한 상세 데이터가 없습니다.
                    </td>
                </tr>
            `;
        }
        
        // 테이블로 스크롤
        document.getElementById('dataTable').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }



    // AI 인사이트 표시
    function displayAIInsights(insights) {
        const container = document.getElementById('aiInsights');
        
        if (!insights) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    AI 인사이트를 생성할 수 없습니다.
                </div>
            `;
            return;
        }
        
        // 구조화된 AI 인사이트 표시
        container.innerHTML = `
            <div class="row">
                <!-- 핵심 요약 -->
                <div class="col-12 mb-3">
                    <div class="card border-primary">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-bullseye me-2"></i>핵심 요약</h6>
                        </div>
                        <div class="card-body">
                            <p class="mb-0">${insights.summary || '핵심 요약이 없습니다.'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- 주요 발견사항 -->
                <div class="col-md-6 mb-3">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-search me-2"></i>주요 발견사항</h6>
                        </div>
                        <div class="card-body">
                            <ul class="mb-0">
                                ${(insights.keyFindings || []).map(finding => `<li>${finding}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- 전략적 제안 -->
                <div class="col-md-6 mb-3">
                    <div class="card border-info">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0"><i class="fas fa-lightbulb me-2"></i>전략적 제안</h6>
                        </div>
                        <div class="card-body">
                            <h6>단기 전략 (1-2주)</h6>
                            <ul class="mb-2">
                                ${(insights.strategicRecommendations?.shortTerm || []).map(item => `<li>${item}</li>`).join('')}
                            </ul>
                            <h6>중기 전략 (1-3개월)</h6>
                            <ul class="mb-0">
                                ${(insights.strategicRecommendations?.mediumTerm || []).map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- 트렌드 전망 -->
                <div class="col-md-6 mb-3">
                    <div class="card border-warning">
                        <div class="card-header bg-warning text-dark">
                            <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>트렌드 전망</h6>
                        </div>
                        <div class="card-body">
                            <h6>긍정적 요인</h6>
                            <ul class="mb-2">
                                ${(insights.trendOutlook?.positiveFactors || []).map(factor => `<li>${factor}</li>`).join('')}
                            </ul>
                            <h6>부정적 요인</h6>
                            <ul class="mb-0">
                                ${(insights.trendOutlook?.negativeFactors || []).map(factor => `<li>${factor}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- 주의사항 및 기회요소 -->
                <div class="col-md-6 mb-3">
                    <div class="card border-danger">
                        <div class="card-header bg-danger text-white">
                            <h6 class="mb-0"><i class="fas fa-exclamation-triangle me-2"></i>주의사항 & 기회요소</h6>
                        </div>
                        <div class="card-body">
                            <h6>주의사항</h6>
                            <ul class="mb-2">
                                ${(insights.riskFactors || []).map(risk => `<li>${risk}</li>`).join('')}
                            </ul>
                            <h6>기회요소</h6>
                            <ul class="mb-0">
                                ${(insights.opportunities || []).map(opportunity => `<li>${opportunity}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- 액션 아이템 -->
                <div class="col-12 mb-3">
                    <div class="card border-secondary">
                        <div class="card-header bg-secondary text-white">
                            <h6 class="mb-0"><i class="fas fa-tasks me-2"></i>액션 아이템</h6>
                        </div>
                        <div class="card-body">
                            <ol class="mb-0">
                                ${(insights.actionItems || []).map(item => `<li>${item}</li>`).join('')}
                            </ol>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card border-info">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0"><i class="fas fa-rocket me-2"></i>권장사항</h6>
                        </div>
                        <div class="card-body">
                            <p class="mb-0">${insights.recommendation || '권장사항 데이터가 없습니다.'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 상세 분석 결과 -->
            <div class="mt-3">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-microscope me-2"></i>상세 분석 결과</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <h6 class="text-primary">📊 데이터 품질</h6>
                                <p class="small text-muted">${insights.dataQuality || '데이터 품질 정보가 없습니다.'}</p>
                            </div>
                            <div class="col-md-4">
                                <h6 class="text-success">🎯 예측 정확도</h6>
                                <p class="small text-muted">${insights.accuracy || '예측 정확도 정보가 없습니다.'}</p>
                            </div>
                            <div class="col-md-4">
                                <h6 class="text-warning">⏰ 분석 시점</h6>
                                <p class="small text-muted">${insights.timestamp || new Date().toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 데이터 테이블 업데이트
    function updateDataTable(details) {
        const tbody = document.querySelector('#dataTable tbody');
        
        if (!details || details.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">데이터가 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = details.map(item => `
            <tr>
                <td>${item.date}</td>
                <td>${item.keyword}</td>
                <td>${item.channel}</td>
                <td>${item.exposure || '-'}</td>
                <td>${item.engagement || '-'}</td>
                <td>${item.demand || '-'}</td>
            </tr>
        `).join('');
    }

    // PDF 보고서 다운로드
    function downloadReport() {
        showToast('PDF 보고서 다운로드 기능은 구현 예정입니다.');
    }

    // CSV 데이터 다운로드
    function downloadData() {
        showToast('CSV 데이터 다운로드 기능은 구현 예정입니다.');
    }

    // 일정 데이터 서버에서 불러오기
    async function loadUserEvents() {
        const res = await fetch(`${API_BASE_URL}/api/schedules`);
        const events = await res.json();
        return events.map(ev => ({
            ...ev,
            id: ev._id,
            start: ev.start,
            end: ev.end,
            title: ev.title,
            allDay: ev.allDay,
            extendedProps: { content: ev.content, id: ev._id },
            backgroundColor: ev.backgroundColor,
            borderColor: ev.borderColor,
            textColor: ev.textColor
        }));
    }
    // 일정 추가
    async function addUserEvent(event) {
        const res = await fetch(`${API_BASE_URL}/api/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        
        // 응답 상태 확인
        if (!res.ok) {
            throw new Error(`서버 오류: ${res.status} ${res.statusText}`);
        }
        
        const result = await res.json();
        
        // 로깅은 별도로 처리 (실패해도 일정 저장은 성공)
        try {
            await logUserAction('일정등록', { event });
        } catch (logError) {
            console.warn('사용자 액션 로깅 실패:', logError.message);
        }
        
        return result;
    }
    // 일정 수정
    async function updateUserEvent(id, event) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        
        // 응답 상태 확인
        if (!res.ok) {
            throw new Error(`서버 오류: ${res.status} ${res.statusText}`);
        }
        
        const result = await res.json();
        
        // 로깅은 별도로 처리 (실패해도 일정 수정은 성공)
        try {
            await logUserAction('일정수정', { id, event });
        } catch (logError) {
            console.warn('사용자 액션 로깅 실패:', logError.message);
        }
        
        return result;
    }
    // 일정 삭제
    async function deleteUserEvent(id) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, { method: 'DELETE' });
        
        // 응답 상태 확인
        if (!res.ok) {
            throw new Error(`서버 오류: ${res.status} ${res.statusText}`);
        }
        
        const result = await res.json();
        
        // 로깅은 별도로 처리 (실패해도 일정 삭제는 성공)
        try {
            await logUserAction('일정삭제', { id });
        } catch (logError) {
            console.warn('사용자 액션 로깅 실패:', logError.message);
        }
        
        return result;
    }

    // 공휴일 데이터 가져오기 (연도 전체)
    async function fetchHolidays(year) {
        try {
            // API 키가 이미 URL 인코딩되어 있으므로 그대로 사용
            // 만약 인코딩되지 않은 키라면 encodeURIComponent() 사용 필요
            const API_KEY = 'DTrcjG%2BXCsB9m%2F6xPK4LmJ%2FG61dwF%2B3h%2FM7Rzv4IbI9ilfsqDRFErvOryzE45LblhwWpU4GSwuoA9W8CxVav5A%3D%3D';
            const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${API_KEY}&solYear=${year}&_type=json&numOfRows=100`;
            
            console.log('[공휴일 API] 요청 URL:', url.replace(API_KEY, 'API_KEY_HIDDEN'));
            
            const response = await fetch(url);
            
            // 응답 상태 코드 확인
            if (!response.ok) {
                // 응답 본문을 텍스트로 먼저 읽어서 에러 메시지 확인
                const errorText = await response.text();
                console.error(`[공휴일 API] 호출 실패: ${response.status} ${response.statusText}`);
                console.error(`[공휴일 API] 응답 본문:`, errorText);
                
                // 403 에러의 경우 일반적으로 API 키 문제이거나 CORS 문제
                if (response.status === 403) {
                    console.error('[공휴일 API] 403 Forbidden - 가능한 원인:');
                    console.error('  1. API 키가 만료되었거나 유효하지 않음');
                    console.error('  2. CORS 정책으로 인한 브라우저 차단 (서버를 통한 프록시 필요)');
                    console.error('  3. API 사용량 초과');
                    console.error('  4. IP 차단 또는 지역 제한');
                }
                
                return [];
            }
            
            const data = await response.json();
            
            // API 응답 에러 체크 (data.go.kr API는 성공해도 에러 코드를 반환할 수 있음)
            if (data.response && data.response.header) {
                const resultCode = data.response.header.resultCode;
                const resultMsg = data.response.header.resultMsg;
                
                if (resultCode !== '00') {
                    console.error(`[공휴일 API] API 에러: ${resultCode} - ${resultMsg}`);
                    return [];
                }
            }
            
            if (data.response && data.response.body && data.response.body.items) {
                let items = data.response.body.items.item;
                if (!Array.isArray(items)) items = [items];
                const holidays = items.map(holiday => ({
                    date: `${holiday.locdate}`.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                    title: holiday.dateName
                }));
                console.log(`[공휴일 API] ${year}년 공휴일 ${holidays.length}개 로드 완료`);
                return holidays;
            }
            return [];
        } catch (error) {
            // 네트워크 에러나 JSON 파싱 에러
            if (error instanceof SyntaxError) {
                console.error('[공휴일 API] JSON 파싱 실패:', error.message);
                console.error('[공휴일 API] 응답이 JSON 형식이 아닙니다. API 키 문제일 수 있습니다.');
            } else {
                console.error('[공휴일 API] 데이터 가져오기 실패:', error.message);
            }
            return [];
        }
    }

    // 월별 공휴일만 반환
    function getMonthHolidays(holidays, year, month) {
        return holidays.filter(h => {
            const [y, m, d] = h.date.split('-').map(Number);
            return y === year && (m - 1) === month;
        }).map(h => ({
            title: h.title,
            start: h.date,
            allDay: true,
            backgroundColor: '#ff4444',
            borderColor: '#ff4444',
            textColor: '#fff'
        }));
    }

    // FullCalendar 인스턴스 생성
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ko',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        height: 'parent',
        events: async function(fetchInfo, successCallback, failureCallback) {
            // fetchInfo.start ~ fetchInfo.end의 중간 날짜를 기준으로 연/월 계산
            const midTime = (fetchInfo.start.getTime() + fetchInfo.end.getTime()) / 2;
            const currentDate = new Date(midTime);
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth(); // 0부터 시작 (5월이면 4)
            const holidays = await fetchHolidays(year);
            const monthHolidays = getMonthHolidays(holidays, year, month);
            try {
                const userEvents = await loadUserEvents();
                const filteredEvents = userEvents.filter(ev => {
                    const start = new Date(ev.start);
                    return start.getFullYear() === year && start.getMonth() === month;
                });
                holidayDates = monthHolidays.map(h => h.start || h.date);
                successCallback([...monthHolidays, ...filteredEvents]);
            } catch (error) {
                console.error('일정 로드 중 오류:', error);
                failureCallback(error);
            }
            setTimeout(() => {
                document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
                    const dateStr = cell.getAttribute('data-date');
                    const dayNum = new Date(dateStr).getDay();
                    const dateNumberEl = cell.querySelector('.fc-daygrid-day-number');
                    if (dateNumberEl) {
                        if (holidayDates.includes(dateStr)) {
                            dateNumberEl.style.color = '#ff4444';
                        } else if (dayNum === 0 || dayNum === 6) {
                            dateNumberEl.style.color = '#ff4444';
                        } else {
                            dateNumberEl.style.color = '#222';
                        }
                    }
                });
            }, 10);
        },
        eventDidMount: function(info) {
            if (info.event.backgroundColor === '#ff4444') {
                info.el.style.backgroundColor = '#ff4444';
                info.el.style.color = '#fff';
            }
        },
        dayCellDidMount: function(info) {
            const dayNum = info.date.getDay();
            if (dayNum === 0 || dayNum === 6) {
                info.el.style.backgroundColor = '#f8f9fa';
            }
        },
        dateClick: function(info) {
            // 항상 신규등록: 입력폼 초기화
            modalScheduleDate.value = info.dateStr;
            modalScheduleTitle.value = '';
            modalScheduleTime.value = '';
            modalScheduleContent.value = '';
            pendingEvent = { date: info.dateStr, action: 'create' };
            pwInput.value = '';
            pwModal.show();
        },
        eventClick: function(info) {
            // 공휴일이 아닌 사용자 일정만 등록 모달로 확인/수정/삭제 가능하게
            if (info.event.backgroundColor !== '#ff4444') {
                const event = info.event;
                // 수정: 기존 값 채우기
                modalScheduleDate.value = event.start ? event.start.toISOString().slice(0, 10) : '';
                modalScheduleTitle.value = event.title || '';
                if (event.start) {
                    const hours = event.start.getHours().toString().padStart(2, '0');
                    const minutes = event.start.getMinutes().toString().padStart(2, '0');
                    modalScheduleTime.value = `${hours}:${minutes}`;
                } else {
                    modalScheduleTime.value = '';
                }
                modalScheduleContent.value = (event.extendedProps && event.extendedProps.content) ? event.extendedProps.content : '';
                pendingEvent = { id: event.extendedProps && event.extendedProps.id ? event.extendedProps.id : event.id, action: 'edit' };
                document.getElementById('deleteScheduleBtn').style.display = 'inline-block';
                scheduleModal.show();
            }
        },
        eventContent: function(arg) {
            // 사용자 일정은 제목만, 공휴일은 기존대로
            if (arg.event.backgroundColor === '#ff4444') {
                if (arg.event.extendedProps && arg.event.extendedProps.content) {
                    return {
                        html: `<b>${arg.event.title}</b><br><small>${arg.event.extendedProps.content}</small>`
                    };
                } else {
                    return { html: `<b>${arg.event.title}</b>` };
                }
            } else {
                return { html: `<b>${arg.event.title}</b>` };
            }
        },
        datesSet: function() {
            calendar.refetchEvents();
        }
    });

    calendar.render();

    // 모달 관련 변수는 반드시 이 시점 이후에!
    let scheduleModal = new bootstrap.Modal(document.getElementById('scheduleModal'));
    let modalScheduleForm = document.getElementById('modalScheduleForm');
    let modalScheduleDate = document.getElementById('modalScheduleDate');
    let modalScheduleTitle = document.getElementById('modalScheduleTitle');
    let modalScheduleTime = document.getElementById('modalScheduleTime');
    let modalScheduleContent = document.getElementById('modalScheduleContent');
    let pwModal = new bootstrap.Modal(document.getElementById('pwModal'));
    let pwForm = document.getElementById('pwForm');
    let pwInput = document.getElementById('pwInput');
    let viewScheduleModal = new bootstrap.Modal(document.getElementById('viewScheduleModal'));
    let viewScheduleBody = document.getElementById('viewScheduleBody');

    // 임시로 일정 등록 정보 저장
    let pendingEvent = null;



    // 일정등록 모달 제출
    modalScheduleForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!(pendingEvent && pendingEvent.pwChecked)) {
            pendingEvent.action = pendingEvent && pendingEvent.id ? 'edit' : 'create';
            pwInput.value = '';
            pwModal.show();
            return;
        }
        const title = modalScheduleTitle.value;
        const date = modalScheduleDate.value;
        const time = modalScheduleTime.value;
        const content = modalScheduleContent.value;
        const start = date + 'T' + (time ? time : '00:00');
        let events = await loadUserEvents();
        let newEvent = {
            title,
            start,
            allDay: false,
            content,
            backgroundColor: '#1976d2',
            borderColor: '#1976d2',
            textColor: '#fff',
        };
        // === 스피너 표시 ===
        const submitBtn = modalScheduleForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 저장 중...';
        try {
            if (!(pendingEvent && pendingEvent.id)) {
                newEvent.id = Date.now().toString();
                events.push(newEvent);
                await addUserEvent(newEvent);
                calendar.refetchEvents();
                scheduleModal.hide();
                showToast('일정이 등록되었습니다.');
            } else {
                newEvent.id = pendingEvent.id;
                const beforeEvent = events.find(ev => ev.id === pendingEvent.id);
                events = events.map(ev => (ev.id === pendingEvent.id ? newEvent : ev));
                await updateUserEvent(pendingEvent.id, newEvent);
                calendar.refetchEvents();
                scheduleModal.hide();
                showToast('일정이 수정되었습니다.');
            }
        } catch (err) {
            console.error('일정 저장 오류:', err);
            showToast(`일정 저장 중 오류가 발생했습니다: ${err.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '등록';
            pendingEvent = null;
        }
    });

    // 일정 삭제 기능
    const deleteBtn = document.getElementById('deleteScheduleBtn');
    deleteBtn.addEventListener('click', async function() {
        if (!(pendingEvent && pendingEvent.pwChecked)) {
            pendingEvent.action = 'delete';
            pwInput.value = '';
            pwModal.show();
            return;
        }
        if (pendingEvent && pendingEvent.id) {
            // === 스피너 표시 ===
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 삭제 중...';
            try {
                let events = await loadUserEvents();
                events = events.filter(ev => ev.id !== pendingEvent.id);
                await deleteUserEvent(pendingEvent.id);
                calendar.refetchEvents();
                scheduleModal.hide();
                showToast('일정을 삭제했습니다.');
                pendingEvent = null;
            } catch (err) {
                console.error('일정 삭제 오류:', err);
                showToast(`일정 삭제 중 오류가 발생했습니다: ${err.message}`);
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '삭제';
            }
        }
    });

    // 비밀번호 확인 모달 제출
    pwForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (pwInput.value === 'admin123') {
            // 비밀번호 맞으면 액션별로 처리
            if (pendingEvent && pendingEvent.action === 'create') {
                pendingEvent.pwChecked = true;
                pwModal.hide();
                scheduleModal.show();
            } else if (pendingEvent && pendingEvent.action === 'edit') {
                pendingEvent.pwChecked = true;
                pwModal.hide();
                // 바로 저장 및 모달 종료까지 진행
                modalScheduleForm.requestSubmit();
            } else if (pendingEvent && pendingEvent.action === 'delete') {
                pendingEvent.pwChecked = true;
                pwModal.hide();
                document.getElementById('deleteScheduleBtn').click();
            }
        } else {
            alert('비밀번호가 일치하지 않습니다.');
            pwInput.value = '';
            pwInput.focus();
        }
    });

    // ===== 리스크 이슈 키워드 서버 연동 =====
    async function loadKeywords() {
        const res = await fetch(`${API_BASE_URL}/api/risk-keywords`);
        const keywords = await res.json();
        return keywords.map(k => k.value);
    }
    async function addKeyword(value) {
        const res = await fetch(`${API_BASE_URL}/api/risk-keywords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        return await res.json();
    }
    async function deleteKeyword(id) {
        const res = await fetch(`${API_BASE_URL}/api/risk-keywords/${id}`, { method: 'DELETE' });
        return await res.json();
    }

    // ===== 제휴처 조건 서버 연동 =====
    async function loadPartnerConditions() {
        const res = await fetch(`${API_BASE_URL}/api/partner-conditions`);
        const conds = await res.json();
        return conds.map(c => c.value);
    }
    async function addPartnerCondition(value) {
        const res = await fetch(`${API_BASE_URL}/api/partner-conditions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        return await res.json();
    }
    async function deletePartnerCondition(id) {
        const res = await fetch(`${API_BASE_URL}/api/partner-conditions/${id}`, { method: 'DELETE' });
        return await res.json();
    }

    // ===== 신기술 주제 서버 연동 =====
    async function loadTechTopics() {
        const res = await fetch(`${API_BASE_URL}/api/tech-topics`);
        const topics = await res.json();
        return topics.map(t => t.value);
    }
    async function addTechTopic(value) {
        const res = await fetch(`${API_BASE_URL}/api/tech-topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        return await res.json();
    }
    async function deleteTechTopic(id) {
        const res = await fetch(`${API_BASE_URL}/api/tech-topics/${id}`, { method: 'DELETE' });
        return await res.json();
    }



    // ===== 리스크 이슈 모니터링 1단계: 키워드 관리 및 뉴스 모킹 =====
    // 키워드 체크박스 UI 렌더링 (서버 연동)
    async function renderKeywordDisplay() {
        const keywords = await loadKeywords();
        const container = document.getElementById('keywordDisplay');
        if (!container) return;
        container.innerHTML = '';
        if (keywords.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 키워드가 없습니다.</span>';
            renderNews([]);
            return;
        }
        // 키워드를 텍스트로 표시
        const keywordText = keywords.join(', ');
        container.innerHTML = `<strong>설정된 키워드:</strong> ${keywordText}`;
        
        renderNews(keywords);
    }

    function renderNewsByChecked() {
        const container = document.getElementById('keywordCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked'))
            .flatMap(cb => cb.value.split('|').map(v => v.trim()));
        renderNews(checked);
    }

    // 리스크 이슈 모니터링 뉴스 UI 렌더링 (무한 스크롤 적용)
    let riskNewsData = {
        items: [],
        totalCount: 0,
        totalCountAll: 0, // 전체 누적 건수
        offset: 0,
        limit: 50,
        days: 7, // 초기값: 최근 7일
        loading: false,
        hasMore: true
    };

    async function renderNews(selectedKeywords) {
        const newsFeed = document.getElementById('newsFeed');
        if (!newsFeed) return;
        
        // 초기 로딩
        newsFeed.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>리스크이슈 로딩 중...</div></div>';
        
        // 데이터 초기화
        riskNewsData = {
            items: [],
            totalCount: 0,
            totalCountAll: 0, // 전체 누적 건수
            offset: 0,
            limit: 50,
            days: 7, // 초기값: 최근 7일
            loading: false,
            hasMore: true
        };
        
        await loadMoreRiskNews();
    }

    async function loadMoreRiskNews() {
        if (riskNewsData.loading || !riskNewsData.hasMore) return;
        
        riskNewsData.loading = true;
        const newsFeed = document.getElementById('newsFeed');
        
        try {
            // days 파라미터 동적 증가: 7일 → 14일 → 30일 → 90일 → 전체(9999일)
            const daysParam = riskNewsData.days;
            const response = await fetch(`${API_BASE_URL}/api/risk-news?limit=${riskNewsData.limit}&offset=${riskNewsData.offset}&days=${daysParam}`);
            const data = await response.json();
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (riskNewsData.offset === 0) {
                    riskNewsData.items = [];
                    riskNewsData.todayNews = [];
                    riskNewsData.otherNews = [];
                    newsFeed.innerHTML = '';
                }
                
                // 새 데이터 추가 (중복 제거)
                const existingIds = new Set(riskNewsData.items.map(item => item._id || item.link));
                const newData = data.data.filter(item => !existingIds.has(item._id || item.link));
                riskNewsData.items = [...riskNewsData.items, ...newData];
                
                // todayNews와 otherNews도 중복 제거하여 업데이트
                const allTodayNews = [...(riskNewsData.todayNews || []), ...(data.todayNews || [])];
                const allOtherNews = [...(riskNewsData.otherNews || []), ...(data.otherNews || [])];
                const todayNewsIds = new Set();
                const otherNewsIds = new Set();
                riskNewsData.todayNews = allTodayNews.filter(item => {
                    const id = item._id || item.link;
                    if (todayNewsIds.has(id)) return false;
                    todayNewsIds.add(id);
                    return true;
                });
                riskNewsData.otherNews = allOtherNews.filter(item => {
                    const id = item._id || item.link;
                    if (otherNewsIds.has(id)) return false;
                    otherNewsIds.add(id);
                    return true;
                });
                riskNewsData.totalCount = data.totalCount;
                // totalCountAll은 항상 업데이트 (API에서 전달된 값 우선 사용)
                if (data.totalCountAll !== undefined && data.totalCountAll !== null) {
                    riskNewsData.totalCountAll = data.totalCountAll;
                } else if (!riskNewsData.totalCountAll) {
                    // totalCountAll이 없으면 totalCount를 사용 (초기값)
                    riskNewsData.totalCountAll = data.totalCount;
                }
                
                // offset 업데이트 (새 데이터가 추가된 경우)
                if (newData.length > 0) {
                    riskNewsData.offset += newData.length;
                } else {
                    // 새 데이터가 없으면 현재 offset을 유지 (다음 요청을 위해)
                    riskNewsData.offset = data.offset || riskNewsData.offset;
                }
                
                // 더 이상 데이터가 없거나, 현재 days 범위의 데이터를 다 로드한 경우 days 증가
                const currentDataExhausted = data.data.length === 0 || (riskNewsData.offset >= data.totalCount);
                const moreDataAvailable = riskNewsData.items.length < riskNewsData.totalCountAll;
                
                if (currentDataExhausted && moreDataAvailable) {
                    // days를 점진적으로 증가: 7 → 14 → 30 → 90 → 9999 (전체)
                    if (riskNewsData.days < 9999) {
                        const oldDays = riskNewsData.days;
                        if (riskNewsData.days < 14) riskNewsData.days = 14;
                        else if (riskNewsData.days < 30) riskNewsData.days = 30;
                        else if (riskNewsData.days < 90) riskNewsData.days = 90;
                        else riskNewsData.days = 9999; // 전체 데이터
                        
                        // days가 증가했으면 offset 초기화하고 다시 로드 (기존 데이터는 유지)
                        if (oldDays !== riskNewsData.days) {
                            riskNewsData.offset = 0; // offset만 초기화, items는 유지
                            riskNewsData.loading = false; // 로딩 플래그 해제하여 재호출 가능하게
                            loadMoreRiskNews(); // 재귀 호출로 새로운 범위의 데이터 로드
                            return;
                        }
                    }
                }
                
                // 전체 데이터를 다 로드했는지 확인
                riskNewsData.hasMore = riskNewsData.items.length < riskNewsData.totalCountAll;
                
                // AI 분석보고서 데이터 저장 (첫 번째 로드에서만, 또는 기존 데이터가 없을 때)
                if (riskNewsData.offset === data.data.length || !riskNewsData.analysisReport) {
                    riskNewsData.analysisReport = data.analysisReport;
                }
                
                await renderRiskNewsContent();
            }
        } catch (error) {
            console.error('리스크 뉴스 로드 실패:', error);
            if (riskNewsData.offset === 0) {
                newsFeed.innerHTML = '<div class="alert alert-danger">뉴스를 불러오는데 실패했습니다.</div>';
            }
        } finally {
            riskNewsData.loading = false;
        }
    }

    async function renderRiskNewsContent() {
        console.log('[리스크 분석] renderRiskNewsContent 함수 호출됨');
        const newsFeed = document.getElementById('newsFeed');
        const today = await getKoreaToday();
        
        // 항상 전체 내용 렌더링 (조건 제거)
        newsFeed.innerHTML = '';
        
        // === 분석 보고서 표출 ===
        const analysisReport = riskNewsData.analysisReport;
        console.log('[리스크 분석] riskNewsData.analysisReport:', analysisReport);
        const reportDiv = document.createElement('div');
        reportDiv.className = 'card mb-4';
        reportDiv.style.cssText = 'border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #6c757d;';
        reportDiv.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 15px 20px;">
                <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>AI 분석 보고서 <small class="float-end">출처: ${analysisReport?.analysisModel || 'perplexity-ai'}</small></h6>
            </div>
            <div class="card-body" style="padding: 20px;" id="riskAnalysisContent">
                <!-- 마크다운 변환 중... -->
            </div>
        `;
        newsFeed.appendChild(reportDiv);
        
        // 마크다운 변환 후 DOM에 삽입
        console.log('[리스크 분석] 분석보고서 존재 여부:', !!analysisReport);
        console.log('[리스크 분석] 분석 내용 존재 여부:', !!analysisReport?.analysis);
        const contentDiv = reportDiv.querySelector('#riskAnalysisContent');
        console.log('[리스크 분석] contentDiv 찾기:', !!contentDiv);
        if (contentDiv) {
            const analysisText = analysisReport?.analysis || '분석 내용이 없습니다.';
            console.log('[리스크 분석] 분석 텍스트 길이:', analysisText.length);
            console.log('[리스크 분석] 분석 텍스트 시작:', analysisText.substring(0, 100));
            const formattedContent = formatStructuredAnalysis(analysisText);
            console.log('[리스크 분석] 변환된 HTML 길이:', formattedContent.length);
            console.log('[리스크 분석] 변환된 HTML 시작:', formattedContent.substring(0, 200));
            contentDiv.innerHTML = formattedContent;
            console.log('[리스크 분석] 마크다운 변환 완료');
        } else {
            console.error('[리스크 분석] contentDiv를 찾을 수 없습니다!');
        }
        
        // === 뉴스 현황 표시 ===
        const todayCount = riskNewsData.todayNews ? riskNewsData.todayNews.length : 0;
        
        const statusDiv = document.createElement('div');
        statusDiv.className = 'd-flex justify-content-end align-items-center mb-3';
        statusDiv.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${riskNewsData.totalCountAll > 0 ? riskNewsData.totalCountAll : (riskNewsData.totalCount || 0)}</b>건</span>
            <button class="btn btn-sm btn-outline-section-risk" id="refreshRiskBtn">정보갱신</button>
        `;
        newsFeed.appendChild(statusDiv);
        
        // 정보갱신 버튼 이벤트
        document.getElementById('refreshRiskBtn').onclick = async function() {
            const keywords = await loadKeywords();
            if (!keywords.length) {
                alert('등록된 키워드가 없습니다.');
                return;
            }
            newsFeed.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>리스크이슈 정보갱신 중...</div></div>';
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/collect-news/risk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    console.log('리스크 뉴스 수집 완료');
                } else {
                    console.error('리스크 뉴스 수집 실패');
                }
            } catch (error) {
                console.error('리스크 뉴스 수집 오류:', error);
            }
            
            await renderNews(keywords);
        };
        
        // === 뉴스 목록 렌더링 ===
        // 오늘의 뉴스 (서버에서 필터링된 데이터 사용)
        const todayNews = riskNewsData.todayNews || [];
        const otherNews = riskNewsData.otherNews || [];
        
        console.log('📋 리스크 뉴스 렌더링:', {
            totalItems: riskNewsData.items.length,
            todayNews: todayNews.length,
            otherNews: otherNews.length
        });
        
        // === 오늘의 뉴스 섹션 ===
        const todayDiv = document.createElement('div');
        todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
        newsFeed.appendChild(todayDiv);
        
        if (todayNews.length > 0) {
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'risk', 'Today');
                newsFeed.appendChild(card);
            });
        } else {
            const emptyTodayDiv = document.createElement('div');
            emptyTodayDiv.className = 'alert alert-info';
            emptyTodayDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다.</p>
                </div>
            `;
            newsFeed.appendChild(emptyTodayDiv);
        }
        
        // === 최근 누적 뉴스 섹션 (항상 표시) ===
        const recentDiv = document.createElement('div');
        recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
        newsFeed.appendChild(recentDiv);
        
        // 누적 뉴스 (todayNews + otherNews 합쳐서 사용)
        const allNews = [...todayNews, ...otherNews];
        if (allNews.length > 0) {
            allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            allNews.forEach(item => {
                const card = createNewsCard(item, 'risk');
                newsFeed.appendChild(card);
            });
        } else {
            const emptyRecentDiv = document.createElement('div');
            emptyRecentDiv.className = 'alert alert-info';
            emptyRecentDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>누적 뉴스가 없습니다</h5>
                    <p class="text-muted">기존 누적 데이터가 없습니다.</p>
                </div>
            `;
            newsFeed.appendChild(emptyRecentDiv);
        }
        
        // 무한 스크롤 로딩 표시
        if (riskNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'riskLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            newsFeed.appendChild(loadingDiv);
        }
    }

    // 분석 텍스트 포맷팅 함수
    function formatStructuredAnalysis(analysis) {
        if (!analysis) return '분석 내용이 없습니다.';
        
        // 문자열인 경우 먼저 마크다운 처리 (JSON 파싱보다 우선)
        if (typeof analysis === 'string') {
            // 마크다운 형식인지 확인 (##, ###, ** 등이 있으면 마크다운으로 처리)
            if (analysis.includes('##') || analysis.includes('###') || analysis.includes('**') || analysis.includes('- ') || analysis.includes('* ')) {
                return formatAnalysisText(analysis);
            }
            
            // JSON 파싱 시도
            try {
                const parsed = JSON.parse(analysis);
                if (typeof parsed === 'object' && parsed !== null) {
                    analysis = parsed;
                } else {
                    // 파싱은 성공했지만 객체가 아니면 원본 텍스트 사용
                    return formatAnalysisText(analysis);
                }
            } catch (e) {
                // JSON 파싱 실패 시 마크다운으로 처리
                return formatAnalysisText(analysis);
            }
        }
        
        // JSON 객체인지 확인
        if (typeof analysis === 'object' && analysis !== null) {
            let html = '';
            
            // 뉴스요약
            if (analysis.newsSummary) {
                html += `
                    <div style="margin-bottom: 20px;">
                        <strong style="color: #333; font-size: 1.1em;">뉴스요약</strong>
                        <div style="margin-top: 5px; color: #666; line-height: 1.6;">${formatAnalysisText(analysis.newsSummary)}</div>
                    </div>
                `;
            }
            
            // 감성점수
            if (analysis.sentimentScore !== undefined) {
                html += `
                    <div style="margin-bottom: 20px;">
                        <strong style="color: #333; font-size: 1.1em;">감성점수</strong>
                        <div style="margin-top: 5px; color: #666; line-height: 1.6;">${analysis.sentimentScore}</div>
                    </div>
                `;
            }
            
            // 주가정보
            if (analysis.stockSummary) {
                html += `
                    <div style="margin-bottom: 20px;">
                        <strong style="color: #333; font-size: 1.1em;">주가정보</strong>
                        <div style="margin-top: 5px; color: #666; line-height: 1.6;">${formatAnalysisText(analysis.stockSummary)}</div>
                    </div>
                `;
            }
            
            // 감성점수 해석
            if (analysis.sentimentCommentary) {
                html += `
                    <div style="margin-bottom: 20px;">
                        <strong style="color: #333; font-size: 1.1em;">감성분석 해석</strong>
                        <div style="margin-top: 5px; color: #666; line-height: 1.6;">${formatAnalysisText(analysis.sentimentCommentary)}</div>
                    </div>
                `;
            }
            
            // analysis 필드가 있으면 마크다운으로 처리
            if (analysis.analysis && typeof analysis.analysis === 'string') {
                html += formatAnalysisText(analysis.analysis);
            }
            
            return html || formatAnalysisText(JSON.stringify(analysis));
        }
        
        // 문자열인 경우 마크다운으로 처리
        return formatAnalysisText(analysis);
    }

    function formatAnalysisText(text) {
        if (!text) return '분석 내용이 없습니다.';
        
        console.log('[마크다운 변환] 시작:', text.substring(0, 100));
        
        // 마크다운을 HTML로 변환
        let html = String(text);
        
        // 코드 블록 제거 (이미 서버에서 처리했지만 혹시 모를 경우 대비)
        html = html.replace(/```[\s\S]*?```/g, '');
        
        // 줄 단위로 처리
        const lines = html.split('\n');
        let result = [];
        let inList = false;
        let listItems = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) {
                // 빈 줄: 리스트 종료
                if (inList && listItems.length > 0) {
                    result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
                    listItems.forEach(item => {
                        // 리스트 아이템 내부 마크다운 처리
                        let itemHtml = item;
                        itemHtml = itemHtml.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                        itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                        result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
                    });
                    result.push('</ul>');
                    listItems = [];
                    inList = false;
                }
                continue;
            }
            
            // 헤더 처리 (먼저 처리)
            if (line.startsWith('### ')) {
                if (inList) {
                    // 리스트 종료
                    if (listItems.length > 0) {
                        result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
                        listItems.forEach(item => {
                            let itemHtml = item.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                            itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                            result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
                        });
                        result.push('</ul>');
                        listItems = [];
                    }
                    inList = false;
                }
                const content = line.substring(4).trim();
                let contentHtml = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                result.push(`<h3 style="color: #333; font-size: 1.2em; margin-top: 20px; margin-bottom: 10px; font-weight: bold;">${contentHtml}</h3>`);
                continue;
            } else if (line.startsWith('## ')) {
                if (inList) {
                    if (listItems.length > 0) {
                        result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
                        listItems.forEach(item => {
                            let itemHtml = item.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                            itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                            result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
                        });
                        result.push('</ul>');
                        listItems = [];
                    }
                    inList = false;
                }
                const content = line.substring(3).trim();
                let contentHtml = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                result.push(`<h2 style="color: #333; font-size: 1.4em; margin-top: 25px; margin-bottom: 15px; font-weight: bold; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px;">${contentHtml}</h2>`);
                continue;
            } else if (line.startsWith('# ')) {
                if (inList) {
                    if (listItems.length > 0) {
                        result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
                        listItems.forEach(item => {
                            let itemHtml = item.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                            itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                            result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
                        });
                        result.push('</ul>');
                        listItems = [];
                    }
                    inList = false;
                }
                const content = line.substring(2).trim();
                let contentHtml = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                result.push(`<h1 style="color: #333; font-size: 1.6em; margin-top: 30px; margin-bottom: 20px; font-weight: bold;">${contentHtml}</h1>`);
                continue;
            }
            
            // 리스트 아이템 처리
            const listMatch = line.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                if (!inList) {
                    inList = true;
                    listItems = [];
                }
                listItems.push(listMatch[1]);
                continue;
            }
            
            // 일반 텍스트 처리
            if (inList) {
                // 리스트 종료
                if (listItems.length > 0) {
                    result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
                    listItems.forEach(item => {
                        let itemHtml = item;
                        itemHtml = itemHtml.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                        itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                        result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
                    });
                    result.push('</ul>');
                    listItems = [];
                }
                inList = false;
            }
            
            // 일반 텍스트 마크다운 처리
            let textHtml = line;
            textHtml = textHtml.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
            textHtml = textHtml.replace(/\*(.*?)\*/g, '<em>$1</em>');
            textHtml = textHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
            textHtml = textHtml.replace(/`([^`]+)`/g, '<code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>');
            
            result.push(`<p style="color: #666; line-height: 1.8; margin-bottom: 12px;">${textHtml}</p>`);
        }
        
        // 마지막 리스트 처리
        if (inList && listItems.length > 0) {
            result.push('<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">');
            listItems.forEach(item => {
                let itemHtml = item;
                itemHtml = itemHtml.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333; font-weight: bold;">$1</strong>');
                itemHtml = itemHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #007bff; text-decoration: none;">$1</a>');
                result.push(`<li style="margin-bottom: 5px; color: #666;">${itemHtml}</li>`);
            });
            result.push('</ul>');
        }
        
        const finalHtml = result.join('') || '분석 내용이 없습니다.';
        console.log('[마크다운 변환] 완료:', finalHtml.substring(0, 200));
        return finalHtml;
    }

    // 뉴스 카드 생성 함수
    function createNewsCard(item, category, badge = '') {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.style.cssText = 'border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; transition: transform 0.2s;';
        card.classList.add(`border-${category === 'risk' ? 'danger' : category === 'partner' ? 'primary' : 'success'}`, 'bg-light');
        
        const badgeHtml = badge ? `<span class="badge badge-section-${category} me-2">${badge}</span>` : '';
        
        card.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center" style="padding: 15px 20px; border-bottom: 1px solid #eee;">
                <h6 class="card-title mb-0" style="font-weight: bold; color: #333; margin: 0;">
                    ${badgeHtml}
                    <a href="${item.link}" target="_blank" style="color: #333; text-decoration: none;">${item.title.replace(/<[^>]+>/g, '')}</a>
                </h6>
            </div>
            <div class="card-body" style="padding: 20px;">
                ${item.aiSummary ? `<div style="color: #666; line-height: 1.6; margin-bottom: 15px;">${item.aiSummary}</div>` : ''}
                <div class="d-flex flex-wrap gap-1 mb-2">
                    ${(item.relatedKeywords || []).map(kw => 
                        `<span class="badge" style="background: #f0f0f0; color: #333; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">${kw}</span>`
                    ).join('')}
                </div>
                <div style="font-size: 0.8em; color: #999;">
                    출처: ${item.source || '알 수 없음'} | 
                    발행일: ${item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'N/A'} | 
                    수집일: ${item.collectedDate || 'N/A'} | 
                    <span class="badge badge-section-${category}">${item.keyword}</span>
                </div>
            </div>
        `;
        return card;
    }

    // 무한 스크롤 이벤트 리스너
    function setupAllInfiniteScrolls() {
        // 리스크 뉴스 무한 스크롤
        const riskObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !riskNewsData.loading && riskNewsData.hasMore) {
                    loadMoreRiskNews();
                }
            });
        }, { threshold: 0.1 });
        
        // 제휴처 뉴스 무한 스크롤
        const partnerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !partnerNewsData.loading && partnerNewsData.hasMore) {
                    loadMorePartnerNews();
                }
            });
        }, { threshold: 0.1 });
        
        // 신기술 뉴스 무한 스크롤
        const techObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !techNewsData.loading && techNewsData.hasMore) {
                    loadMoreTechNews();
                }
            });
        }, { threshold: 0.1 });
        
        // 로딩 인디케이터 관찰 시작
        function observeLoadingIndicators() {
            const riskLoadingIndicator = document.getElementById('riskLoadingIndicator');
            const partnerLoadingIndicator = document.getElementById('partnerLoadingIndicator');
            const techLoadingIndicator = document.getElementById('techLoadingIndicator');
            
            if (riskLoadingIndicator) {
                riskObserver.observe(riskLoadingIndicator);
            }
            if (partnerLoadingIndicator) {
                partnerObserver.observe(partnerLoadingIndicator);
            }
            if (techLoadingIndicator) {
                techObserver.observe(techLoadingIndicator);
            }
        }
        
        // DOM 변경 감지하여 새로운 로딩 인디케이터 관찰
        const observer = new MutationObserver(() => {
            observeLoadingIndicators();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 초기 관찰 시작
        observeLoadingIndicators();
    }

    // 탭 구조에서는 지연 로딩으로 처리됨

    // 제휴처 탐색 키워드 관리
    async function renderPartnerDisplay() {
        const conds = await loadPartnerConditions();
        const container = document.getElementById('partnerDisplay');
        if (!container) return;
        container.innerHTML = '';
        if (conds.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 조건이 없습니다.</span>';
            renderPartnerResults([]);
            return;
        }
        // 조건을 텍스트로 표시
        const conditionText = conds.join(', ');
        container.innerHTML = `<strong>설정된 조건:</strong> ${conditionText}`;
        
        // 기존 AI 분석 보고서 표출 제거 (새로운 디자인으로 대체)
        
        renderPartnerResults(conds);
    }
    function renderPartnerResultsByChecked() {
        const container = document.getElementById('partnerCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        renderPartnerResults(checked);
    }
    // 제휴처 탐색 뉴스 렌더링 (무한 스크롤 적용)
    let partnerNewsData = {
        items: [],
        totalCount: 0,
        totalCountAll: 0, // 전체 누적 건수
        offset: 0,
        limit: 50,
        days: 7, // 초기값: 최근 7일
        loading: false,
        hasMore: true
    };

    async function renderPartnerResults(selected) {
        const resultsDiv = document.getElementById('partnerResults');
        if (!resultsDiv) return;
        
        // 초기 로딩
        resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>제휴처탐색 로딩 중...</div></div>';
        
        // 데이터 초기화
        partnerNewsData = {
            items: [],
            totalCount: 0,
            totalCountAll: 0, // 전체 누적 건수
            offset: 0,
            limit: 50,
            days: 7, // 초기값: 최근 7일
            loading: false,
            hasMore: true
        };
        
        await loadMorePartnerNews();
    }

    async function loadMorePartnerNews() {
        if (partnerNewsData.loading || !partnerNewsData.hasMore) return;
        
        partnerNewsData.loading = true;
        const resultsDiv = document.getElementById('partnerResults');
        
        console.log('🔍 제휴처 뉴스 로딩 시작:', {
            offset: partnerNewsData.offset,
            limit: partnerNewsData.limit,
            hasMore: partnerNewsData.hasMore
        });
        
        try {
            // days 파라미터 동적 증가: 7일 → 14일 → 30일 → 90일 → 전체(9999일)
            const daysParam = partnerNewsData.days;
            const response = await fetch(`${API_BASE_URL}/api/partner-news?limit=${partnerNewsData.limit}&offset=${partnerNewsData.offset}&days=${daysParam}`);
            const data = await response.json();
            
            console.log('📥 제휴처 뉴스 응답:', data);
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (partnerNewsData.offset === 0) {
                    partnerNewsData.items = [];
                    partnerNewsData.todayNews = [];
                    partnerNewsData.otherNews = [];
                    resultsDiv.innerHTML = '';
                    console.log('🔄 첫 번째 로드 - 데이터 초기화');
                }
                
                // 새 데이터 추가 (중복 제거)
                const existingIds = new Set(partnerNewsData.items.map(item => item._id || item.link));
                const newData = data.data.filter(item => !existingIds.has(item._id || item.link));
                partnerNewsData.items = [...partnerNewsData.items, ...newData];
                
                // todayNews와 otherNews도 중복 제거하여 업데이트
                const allTodayNews = [...(partnerNewsData.todayNews || []), ...(data.todayNews || [])];
                const allOtherNews = [...(partnerNewsData.otherNews || []), ...(data.otherNews || [])];
                const todayNewsIds = new Set();
                const otherNewsIds = new Set();
                partnerNewsData.todayNews = allTodayNews.filter(item => {
                    const id = item._id || item.link;
                    if (todayNewsIds.has(id)) return false;
                    todayNewsIds.add(id);
                    return true;
                });
                partnerNewsData.otherNews = allOtherNews.filter(item => {
                    const id = item._id || item.link;
                    if (otherNewsIds.has(id)) return false;
                    otherNewsIds.add(id);
                    return true;
                });
                partnerNewsData.totalCount = data.totalCount;
                // totalCountAll은 항상 업데이트 (API에서 전달된 값 우선 사용)
                if (data.totalCountAll !== undefined && data.totalCountAll !== null) {
                    partnerNewsData.totalCountAll = data.totalCountAll;
                } else if (!partnerNewsData.totalCountAll) {
                    // totalCountAll이 없으면 totalCount를 사용 (초기값)
                    partnerNewsData.totalCountAll = data.totalCount;
                }
                
                // offset 업데이트 (새 데이터가 추가된 경우)
                if (newData.length > 0) {
                    partnerNewsData.offset += newData.length;
                } else {
                    // 새 데이터가 없으면 현재 offset을 유지 (다음 요청을 위해)
                    partnerNewsData.offset = data.offset || partnerNewsData.offset;
                }
                
                // 더 이상 데이터가 없거나, 현재 days 범위의 데이터를 다 로드한 경우 days 증가
                const currentDataExhausted = data.data.length === 0 || (partnerNewsData.offset >= data.totalCount);
                const moreDataAvailable = partnerNewsData.items.length < partnerNewsData.totalCountAll;
                
                if (currentDataExhausted && moreDataAvailable) {
                    // days를 점진적으로 증가: 7 → 14 → 30 → 90 → 9999 (전체)
                    if (partnerNewsData.days < 9999) {
                        const oldDays = partnerNewsData.days;
                        if (partnerNewsData.days < 14) partnerNewsData.days = 14;
                        else if (partnerNewsData.days < 30) partnerNewsData.days = 30;
                        else if (partnerNewsData.days < 90) partnerNewsData.days = 90;
                        else partnerNewsData.days = 9999; // 전체 데이터
                        
                        // days가 증가했으면 offset 초기화하고 다시 로드 (기존 데이터는 유지)
                        if (oldDays !== partnerNewsData.days) {
                            partnerNewsData.offset = 0; // offset만 초기화, items는 유지
                            partnerNewsData.loading = false; // 로딩 플래그 해제하여 재호출 가능하게
                            loadMorePartnerNews(); // 재귀 호출로 새로운 범위의 데이터 로드
                            return;
                        }
                    }
                }
                
                // 전체 데이터를 다 로드했는지 확인
                partnerNewsData.hasMore = partnerNewsData.items.length < partnerNewsData.totalCountAll;
                
                // AI 분석보고서 데이터 저장 (첫 번째 로드에서만, 또는 기존 데이터가 없을 때)
                if (partnerNewsData.offset === data.data.length || !partnerNewsData.analysisReport) {
                    partnerNewsData.analysisReport = data.analysisReport;
                }
                
                console.log('📊 제휴처 뉴스 데이터 업데이트:', {
                    itemsCount: partnerNewsData.items.length,
                    totalCount: partnerNewsData.totalCount,
                    hasMore: partnerNewsData.hasMore,
                    offset: partnerNewsData.offset
                });
                
                // 항상 전체 렌더링 (리스크 뉴스와 동일한 방식)
                await renderPartnerNewsContent();
            }
        } catch (error) {
            console.error('❌ 제휴처 뉴스 로드 실패:', error);
            if (partnerNewsData.offset === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-danger">뉴스를 불러오는데 실패했습니다.</div>';
            }
        } finally {
            partnerNewsData.loading = false;
        }
    }

    async function renderPartnerNewsContent() {
        console.log('[제휴처 분석] renderPartnerNewsContent 함수 호출됨');
        const resultsDiv = document.getElementById('partnerResults');
        const today = await getKoreaToday();
        
        // 항상 전체 내용 렌더링 (조건 제거)
        resultsDiv.innerHTML = '';
        
        // === AI 분석 보고서 표출 ===
        const analysisReport = partnerNewsData.analysisReport;
        console.log('[제휴처 분석] partnerNewsData.analysisReport:', analysisReport);
        const reportDiv = document.createElement('div');
        reportDiv.className = 'card mb-4';
        reportDiv.style.cssText = 'border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #1565c0;';
        reportDiv.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, #1565c0, #0d47a1); color: white; padding: 15px 20px;">
                <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>AI 분석 보고서 <small class="float-end">출처: ${analysisReport?.analysisModel || 'perplexity-ai'}</small></h6>
            </div>
            <div class="card-body" style="padding: 20px;" id="partnerAnalysisContent">
                <!-- 마크다운 변환 중... -->
            </div>
        `;
        resultsDiv.appendChild(reportDiv);
        
        // 마크다운 변환 후 DOM에 삽입
        console.log('[제휴처 분석] 분석보고서 존재 여부:', !!analysisReport);
        console.log('[제휴처 분석] 분석 내용 존재 여부:', !!analysisReport?.analysis);
        const contentDiv = reportDiv.querySelector('#partnerAnalysisContent');
        console.log('[제휴처 분석] contentDiv 찾기:', !!contentDiv);
        if (contentDiv) {
            const analysisText = analysisReport?.analysis || '분석 내용이 없습니다.';
            console.log('[제휴처 분석] 분석 텍스트 길이:', analysisText.length);
            const formattedContent = formatStructuredAnalysis(analysisText);
            console.log('[제휴처 분석] 변환된 HTML 길이:', formattedContent.length);
            contentDiv.innerHTML = formattedContent;
            console.log('[제휴처 분석] 마크다운 변환 완료');
        } else {
            console.error('[제휴처 분석] contentDiv를 찾을 수 없습니다!');
        }
        
        // === 상단 건수/정보갱신 버튼 ===
        const todayCount = partnerNewsData.todayNews ? partnerNewsData.todayNews.length : 0;
        
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${partnerNewsData.totalCountAll > 0 ? partnerNewsData.totalCountAll : (partnerNewsData.totalCount || 0)}</b>건</span>
            <button class="btn btn-sm btn-outline-section-partner" id="refreshPartnerBtn">정보갱신</button>
        `;
        resultsDiv.appendChild(topBar);
        
        // 정보갱신 버튼 이벤트
        document.getElementById('refreshPartnerBtn').onclick = async function() {
            const conds = await loadPartnerConditions();
            if (!conds.length) {
                alert('등록된 조건이 없습니다.');
                return;
            }
            resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>제휴처탐색 정보갱신 중...</div></div>';
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/collect-news/partner`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    console.log('제휴처탐색 뉴스 수집 완료');
                } else {
                    console.error('제휴처탐색 뉴스 수집 실패');
                }
            } catch (error) {
                console.error('제휴처탐색 뉴스 수집 오류:', error);
            }
            
            await renderPartnerResults(conds);
        };
        
        // === 뉴스 목록 렌더링 ===
        // 오늘의 뉴스 (서버에서 필터링된 데이터 사용)
        const todayNews = partnerNewsData.todayNews || [];
        const otherNews = partnerNewsData.otherNews || [];
        
        console.log('📋 제휴처 뉴스 렌더링:', {
            totalItems: partnerNewsData.items.length,
            todayNews: todayNews.length,
            otherNews: otherNews.length
        });
        
        // === 오늘의 뉴스 섹션 ===
        const todayDiv = document.createElement('div');
        todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
        resultsDiv.appendChild(todayDiv);
        
        if (todayNews.length > 0) {
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'partner', 'Today');
                resultsDiv.appendChild(card);
            });
        } else {
            const emptyTodayDiv = document.createElement('div');
            emptyTodayDiv.className = 'alert alert-info';
            emptyTodayDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyTodayDiv);
        }
        
        // === 최근 누적 뉴스 섹션 (항상 표시) ===
        const recentDiv = document.createElement('div');
        recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
        resultsDiv.appendChild(recentDiv);
        
        // 누적 뉴스 (todayNews + otherNews 합쳐서 사용)
        const allNews = [...todayNews, ...otherNews];
        if (allNews.length > 0) {
            allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            allNews.forEach(item => {
                const card = createNewsCard(item, 'partner');
                resultsDiv.appendChild(card);
            });
        } else {
            const emptyRecentDiv = document.createElement('div');
            emptyRecentDiv.className = 'alert alert-info';
            emptyRecentDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>누적 뉴스가 없습니다</h5>
                    <p class="text-muted">기존 누적 데이터가 없습니다.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyRecentDiv);
        }
        
        // 무한 스크롤 로딩 표시
        if (partnerNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'partnerLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            resultsDiv.appendChild(loadingDiv);
        }
    }



    // 신기술 동향 키워드 관리
    async function renderTechDisplay() {
        const topics = await loadTechTopics();
        const container = document.getElementById('techDisplay');
        if (!container) return;
        container.innerHTML = '';
        if (topics.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 주제가 없습니다.</span>';
            renderTechTrendResults([]);
            return;
        }
        // 주제를 텍스트로 표시
        const topicText = topics.join(', ');
        container.innerHTML = `<strong>설정된 주제:</strong> ${topicText}`;
        
        // 기존 AI 분석 보고서 표출 제거 (새로운 디자인으로 대체)
        
        renderTechTrendResults(topics);
    }
    function renderTechTrendResultsByChecked() {
        const container = document.getElementById('techCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        renderTechTrendResults(checked);
    }
    // 신기술 동향 뉴스 렌더링 (무한 스크롤 적용)
    let techNewsData = {
        items: [],
        totalCount: 0,
        totalCountAll: 0, // 전체 누적 건수
        offset: 0,
        limit: 50,
        days: 7, // 초기값: 최근 7일
        loading: false,
        hasMore: true
    };

    async function renderTechTrendResults(selected) {
        const resultsDiv = document.getElementById('techTrendResults');
        if (!resultsDiv) return;
        
        // 초기 로딩
        resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>신기술동향 로딩 중...</div></div>';
        
        // 데이터 초기화
        techNewsData = {
            items: [],
            totalCount: 0,
            totalCountAll: 0, // 전체 누적 건수
            offset: 0,
            limit: 50,
            days: 7, // 초기값: 최근 7일
            loading: false,
            hasMore: true
        };
        
        await loadMoreTechNews();
    }

    async function loadMoreTechNews() {
        if (techNewsData.loading || !techNewsData.hasMore) return;
        
        techNewsData.loading = true;
        const resultsDiv = document.getElementById('techTrendResults');
        
        try {
            // days 파라미터 동적 증가: 7일 → 14일 → 30일 → 90일 → 전체(9999일)
            const daysParam = techNewsData.days;
            const response = await fetch(`${API_BASE_URL}/api/tech-news?limit=${techNewsData.limit}&offset=${techNewsData.offset}&days=${daysParam}`);
            const data = await response.json();
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (techNewsData.offset === 0) {
                    techNewsData.items = [];
                    techNewsData.todayNews = [];
                    techNewsData.otherNews = [];
                    resultsDiv.innerHTML = '';
                }
                
                // 새 데이터 추가 (중복 제거)
                const existingIds = new Set(techNewsData.items.map(item => item._id || item.link));
                const newData = data.data.filter(item => !existingIds.has(item._id || item.link));
                techNewsData.items = [...techNewsData.items, ...newData];
                
                // todayNews와 otherNews도 중복 제거하여 업데이트
                const allTodayNews = [...(techNewsData.todayNews || []), ...(data.todayNews || [])];
                const allOtherNews = [...(techNewsData.otherNews || []), ...(data.otherNews || [])];
                const todayNewsIds = new Set();
                const otherNewsIds = new Set();
                techNewsData.todayNews = allTodayNews.filter(item => {
                    const id = item._id || item.link;
                    if (todayNewsIds.has(id)) return false;
                    todayNewsIds.add(id);
                    return true;
                });
                techNewsData.otherNews = allOtherNews.filter(item => {
                    const id = item._id || item.link;
                    if (otherNewsIds.has(id)) return false;
                    otherNewsIds.add(id);
                    return true;
                });
                techNewsData.totalCount = data.totalCount;
                // totalCountAll은 항상 업데이트 (API에서 전달된 값 우선 사용)
                if (data.totalCountAll !== undefined && data.totalCountAll !== null) {
                    techNewsData.totalCountAll = data.totalCountAll;
                } else if (!techNewsData.totalCountAll) {
                    // totalCountAll이 없으면 totalCount를 사용 (초기값)
                    techNewsData.totalCountAll = data.totalCount;
                }
                
                // offset 업데이트 (새 데이터가 추가된 경우)
                if (newData.length > 0) {
                    techNewsData.offset += newData.length;
                } else {
                    // 새 데이터가 없으면 현재 offset을 유지 (다음 요청을 위해)
                    techNewsData.offset = data.offset || techNewsData.offset;
                }
                
                // 더 이상 데이터가 없거나, 현재 days 범위의 데이터를 다 로드한 경우 days 증가
                const currentDataExhausted = data.data.length === 0 || (techNewsData.offset >= data.totalCount);
                const moreDataAvailable = techNewsData.items.length < techNewsData.totalCountAll;
                
                if (currentDataExhausted && moreDataAvailable) {
                    // days를 점진적으로 증가: 7 → 14 → 30 → 90 → 9999 (전체)
                    if (techNewsData.days < 9999) {
                        const oldDays = techNewsData.days;
                        if (techNewsData.days < 14) techNewsData.days = 14;
                        else if (techNewsData.days < 30) techNewsData.days = 30;
                        else if (techNewsData.days < 90) techNewsData.days = 90;
                        else techNewsData.days = 9999; // 전체 데이터
                        
                        // days가 증가했으면 offset 초기화하고 다시 로드 (기존 데이터는 유지)
                        if (oldDays !== techNewsData.days) {
                            techNewsData.offset = 0; // offset만 초기화, items는 유지
                            techNewsData.loading = false; // 로딩 플래그 해제하여 재호출 가능하게
                            loadMoreTechNews(); // 재귀 호출로 새로운 범위의 데이터 로드
                            return;
                        }
                    }
                }
                
                // 전체 데이터를 다 로드했는지 확인
                techNewsData.hasMore = techNewsData.items.length < techNewsData.totalCountAll;
                
                // AI 분석보고서 데이터 저장 (첫 번째 로드에서만, 또는 기존 데이터가 없을 때)
                if (techNewsData.offset === data.data.length || !techNewsData.analysisReport) {
                    techNewsData.analysisReport = data.analysisReport;
                }
                
                // 항상 전체 렌더링 (리스크 뉴스와 동일한 방식)
                await renderTechNewsContent();
            }
        } catch (error) {
            console.error('신기술 뉴스 로드 실패:', error);
            if (techNewsData.offset === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-danger">뉴스를 불러오는데 실패했습니다.</div>';
            }
        } finally {
            techNewsData.loading = false;
        }
    }

    async function renderTechNewsContent() {
        console.log('[신기술 분석] renderTechNewsContent 함수 호출됨');
        const resultsDiv = document.getElementById('techTrendResults');
        const today = await getKoreaToday();
        
        // 항상 전체 내용 렌더링 (조건 제거)
        resultsDiv.innerHTML = '';
        
        // === AI 분석 보고서 표출 ===
        const analysisReport = techNewsData.analysisReport;
        console.log('[신기술 분석] techNewsData.analysisReport:', analysisReport);
        const reportDiv = document.createElement('div');
        reportDiv.className = 'card mb-4';
        reportDiv.style.cssText = 'border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #512da8;';
        reportDiv.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, #512da8, #311b92); color: white; padding: 15px 20px;">
                <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>AI 분석 보고서 <small class="float-end">출처: ${analysisReport?.analysisModel || 'perplexity-ai'}</small></h6>
            </div>
            <div class="card-body" style="padding: 20px;" id="techAnalysisContent">
                <!-- 마크다운 변환 중... -->
            </div>
        `;
        resultsDiv.appendChild(reportDiv);
        
        // 마크다운 변환 후 DOM에 삽입
        console.log('[신기술 분석] 분석보고서 존재 여부:', !!analysisReport);
        console.log('[신기술 분석] 분석 내용 존재 여부:', !!analysisReport?.analysis);
        const contentDiv = reportDiv.querySelector('#techAnalysisContent');
        console.log('[신기술 분석] contentDiv 찾기:', !!contentDiv);
        if (contentDiv) {
            const analysisText = analysisReport?.analysis || '분석 내용이 없습니다.';
            console.log('[신기술 분석] 분석 텍스트 길이:', analysisText.length);
            const formattedContent = formatStructuredAnalysis(analysisText);
            console.log('[신기술 분석] 변환된 HTML 길이:', formattedContent.length);
            contentDiv.innerHTML = formattedContent;
            console.log('[신기술 분석] 마크다운 변환 완료');
        } else {
            console.error('[신기술 분석] contentDiv를 찾을 수 없습니다!');
        }
        
        // === 상단 건수/정보갱신 버튼 ===
        const todayCount = techNewsData.todayNews ? techNewsData.todayNews.length : 0;
        
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${techNewsData.totalCountAll > 0 ? techNewsData.totalCountAll : (techNewsData.totalCount || 0)}</b>건</span>
            <button class="btn btn-sm btn-outline-section-tech" id="refreshTechBtn">정보갱신</button>
        `;
        resultsDiv.appendChild(topBar);
        
        // 정보갱신 버튼 이벤트
        document.getElementById('refreshTechBtn').onclick = async function() {
            const topics = await loadTechTopics();
            if (!topics.length) {
                alert('등록된 주제가 없습니다.');
                return;
            }
            resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>신기술동향 정보갱신 중...</div></div>';
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/collect-news/tech`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    console.log('신기술동향 뉴스 수집 완료');
                } else {
                    console.error('신기술동향 뉴스 수집 실패');
                }
            } catch (error) {
                console.error('신기술동향 뉴스 수집 오류:', error);
            }
            
            await renderTechTrendResults(topics);
        };
        
        // === 뉴스 목록 렌더링 ===
        // 오늘의 뉴스 (서버에서 필터링된 데이터 사용)
        const todayNews = techNewsData.todayNews || [];
        const otherNews = techNewsData.otherNews || [];
        
        console.log('📋 신기술 뉴스 렌더링:', {
            totalItems: techNewsData.items.length,
            todayNews: todayNews.length,
            otherNews: otherNews.length
        });
        
        // === 오늘의 뉴스 섹션 ===
        const todayDiv = document.createElement('div');
        todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
        resultsDiv.appendChild(todayDiv);
        
        if (todayNews.length > 0) {
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'tech', 'Today');
                resultsDiv.appendChild(card);
            });
        } else {
            const emptyTodayDiv = document.createElement('div');
            emptyTodayDiv.className = 'alert alert-info';
            emptyTodayDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyTodayDiv);
        }
        
        // === 최근 누적 뉴스 섹션 (항상 표시) ===
        const recentDiv = document.createElement('div');
        recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
        resultsDiv.appendChild(recentDiv);
        
        // 누적 뉴스 (todayNews + otherNews 합쳐서 사용)
        const allNews = [...todayNews, ...otherNews];
        if (allNews.length > 0) {
            allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            allNews.forEach(item => {
                const card = createNewsCard(item, 'tech');
                resultsDiv.appendChild(card);
            });
        } else {
            const emptyRecentDiv = document.createElement('div');
            emptyRecentDiv.className = 'alert alert-info';
            emptyRecentDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>누적 뉴스가 없습니다</h5>
                    <p class="text-muted">기존 누적 데이터가 없습니다.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyRecentDiv);
        }
        
        // 무한 스크롤 로딩 표시
        if (techNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'techLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            resultsDiv.appendChild(loadingDiv);
        }
    }

    async function renderTechNewsList() {
        const resultsDiv = document.getElementById('techTrendResults');
        const today = await getKoreaToday();
        
        const todayNews = uniqueItems.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        });
        
        // 중복 제거 (link 기준)
        const uniqueItems = techNewsData.items.filter((item, index, self) => 
            index === self.findIndex(t => t.link === item.link)
        );
        
        const otherNews = uniqueItems.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr !== todayDateStr;
        });
        
        console.log('📋 신기술 뉴스 렌더링:', {
            totalItems: techNewsData.items.length,
            todayNews: todayNews.length,
            otherNews: otherNews.length
        });
        
        // 기존 뉴스 목록 컨테이너 제거
        const existingNewsList = resultsDiv.querySelector('.news-list-container');
        if (existingNewsList) {
            existingNewsList.remove();
        }
        
        // 뉴스 목록 컨테이너 생성
        const newsListContainer = document.createElement('div');
        newsListContainer.className = 'news-list-container';
        
        // === 오늘의 뉴스 섹션 (항상 표시) ===
        const todayDiv = document.createElement('div');
        todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
        newsListContainer.appendChild(todayDiv);
        
        if (todayNews.length > 0) {
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'tech', 'Today');
                            newsListContainer.appendChild(card);
        });
    } else {
        const emptyTodayDiv = document.createElement('div');
        emptyTodayDiv.className = 'alert alert-info';
        emptyTodayDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                <h5>금일은 뉴스가 없습니다</h5>
                <p class="text-muted">오늘 수집된 뉴스가 없습니다.</p>
            </div>
        `;
        newsListContainer.appendChild(emptyTodayDiv);
    }
    
    // === 최근 누적 뉴스 섹션 (항상 표시) ===
    const recentDiv = document.createElement('div');
    recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
    newsListContainer.appendChild(recentDiv);
    
    if (otherNews.length > 0) {
        otherNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        otherNews.forEach(item => {
            const card = createNewsCard(item, 'tech');
            newsListContainer.appendChild(card);
        });
    } else {
        const emptyRecentDiv = document.createElement('div');
        emptyRecentDiv.className = 'alert alert-info';
        emptyRecentDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                <h5>누적 뉴스가 없습니다</h5>
                <p class="text-muted">기존 누적 데이터가 없습니다.</p>
            </div>
        `;
        newsListContainer.appendChild(emptyRecentDiv);
    }
    
    // 뉴스 목록 컨테이너를 resultsDiv에 추가
    resultsDiv.appendChild(newsListContainer);
    
    // 무한 스크롤 로딩 표시
    if (techNewsData.hasMore) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'techLoadingIndicator';
        loadingDiv.className = 'd-flex justify-content-center my-3';
        loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
        resultsDiv.appendChild(loadingDiv);
    }
    }

    // 제휴처 탐색 정보 수집 및 저장 (네이버 뉴스 API 비활성화, 퍼플렉시티 API만 사용)
    async function fetchAndSaveAllPartners(keywordsParam) {
        // 네이버 뉴스 API 수집 비활성화 - 퍼플렉시티 API만 사용
        console.log('네이버 뉴스 API 수집 비활성화됨 - 퍼플렉시티 API만 사용');
        return;
    }
    async function checkAndUpdatePartnerNews() {
        const today = await getKoreaToday();
        const lastUpdate = localStorage.getItem('partnerNews_lastUpdate');
        const updateTime = localStorage.getItem('newsUpdateTime') || '07:00';
        const now = new Date();
        const [h, m] = updateTime.split(':').map(Number);
        const updateDate = new Date(today + 'T' + updateTime);
        if (lastUpdate !== today && now >= updateDate) {
            await fetchAndSaveAllPartners();
            await renderPartnerResults(loadPartnerConditions());
        } else {
            await renderPartnerResults(loadPartnerConditions());
        }
    }
    // 신기술 동향 정보 수집 및 저장 (네이버 뉴스 API 비활성화, 퍼플렉시티 API만 사용)
    async function fetchAndSaveAllTechs(keywordsParam) {
        // 네이버 뉴스 API 수집 비활성화 - 퍼플렉시티 API만 사용
        console.log('네이버 뉴스 API 수집 비활성화됨 - 퍼플렉시티 API만 사용');
        return;
    }
    async function checkAndUpdateTechNews() {
        const today = await getKoreaToday();
        const lastUpdate = localStorage.getItem('techNews_lastUpdate');
        const updateTime = localStorage.getItem('newsUpdateTime') || '07:00';
        const now = new Date();
        const [h, m] = updateTime.split(':').map(Number);
        const updateDate = new Date(today + 'T' + updateTime);
        if (lastUpdate !== today && now >= updateDate) {
            await fetchAndSaveAllTechs();
            await renderTechTrendResults(loadTechTopics());
        } else {
            await renderTechTrendResults(loadTechTopics());
        }
    }

    // 탭 구조에서는 지연 로딩으로 처리됨

    // 관리자 페이지에서 partnerConditions, techTopics 관리 함수 (입력/저장/삭제/불러오기)
    // 관리자 페이지에서만 동작, localStorage 연동
    if (document.getElementById('addPartnerCondition')) {
        const partnerInput = document.getElementById('partnerConditionInput');
        const addBtn = document.getElementById('addPartnerCondition');
        const listDiv = document.getElementById('partnerConditionsList');
        function updatePartnerList() {
            const items = loadPartnerConditions();
            listDiv.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-group-item d-flex justify-content-between align-items-center';
                div.innerHTML = `<span>${item}</span><button class="btn btn-outline-danger btn-sm" onclick="removePartnerCondition('${item}')"><i class="fas fa-minus"></i></button>`;
                listDiv.appendChild(div);
            });
        }
        window.removePartnerCondition = function(item) {
            let items = loadPartnerConditions();
            items = items.filter(i => i !== item);
            savePartnerConditions(items);
            updatePartnerList();
        };
        addBtn.onclick = function() {
            const val = partnerInput.value.trim();
            if (val) {
                let items = loadPartnerConditions();
                if (!items.includes(val)) {
                    items.push(val);
                    savePartnerConditions(items);
                    updatePartnerList();
                }
                partnerInput.value = '';
            }
        };
        updatePartnerList();
    }
    if (document.getElementById('addTechTopic')) {
        const techInput = document.getElementById('techTopicInput');
        const addBtn = document.getElementById('addTechTopic');
        const listDiv = document.getElementById('techTopicsList');
        function updateTechList() {
            const items = loadTechTopics();
            listDiv.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-group-item d-flex justify-content-between align-items-center';
                div.innerHTML = `<span>${item}</span><button class="btn btn-outline-danger btn-sm" onclick="removeTechTopic('${item}')"><i class="fas fa-minus"></i></button>`;
                listDiv.appendChild(div);
            });
        }
        window.removeTechTopic = function(item) {
            let items = loadTechTopics();
            items = items.filter(i => i !== item);
            saveTechTopics(items);
            updateTechList();
        };
        addBtn.onclick = function() {
            const val = techInput.value.trim();
            if (val) {
                let items = loadTechTopics();
                if (!items.includes(val)) {
                    items.push(val);
                    saveTechTopics(items);
                    updateTechList();
                }
                techInput.value = '';
            }
        };
        updateTechList();
    }

    // 리스크이슈/제휴처탐색/신기술동향 정보갱신 버튼 클릭 시 로그 기록
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'refreshNewsBtn') {
            logUserAction('리스크이슈정보갱신');
        }
        if (e.target && e.target.id === 'refreshPartnerBtn') {
            logUserAction('제휴처탐색정보갱신');
        }
        if (e.target && e.target.id === 'refreshTechBtn') {
            logUserAction('신기술동향정보갱신');
        }
    });

    setupAllInfiniteScrolls();

    // 탭 구조에서는 지연 로딩으로 처리됨

    // 탭 구조에서는 지연 로딩으로 처리됨
});

// 디바운스 유틸리티 함수
// === 언론보도 효과성 측정 기능 ===
let mediaEffectivenessData = {
    news: [],
    aggregated: {},
    loading: false,
    chart: null
};

// 언론보도 효과성 측정 초기화
function initMediaEffectiveness() {
    // HTML 요소 존재 여부 확인
    const mediaKeyword = document.getElementById('mediaKeyword');
    const analyzeMediaBtn = document.getElementById('analyzeMediaBtn');
    
    if (!mediaKeyword || !analyzeMediaBtn) {
        console.warn('언론보도 효과성 측정 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 이벤트 리스너 중복 등록 방지
    analyzeMediaBtn.removeEventListener('click', searchMediaEffectiveness);
    
    // 이벤트 리스너 등록
    analyzeMediaBtn.addEventListener('click', searchMediaEffectiveness);
    
    // 초기 상태 설정
    updateMediaNewsCount(0);
}

// 언론보도 효과성 검색
async function searchMediaEffectiveness() {
    const keyword = document.getElementById('mediaKeyword').value.trim();
    
    if (!keyword) {
        showToast('키워드를 입력해주세요.');
        return;
    }
    
    mediaEffectivenessData.loading = true;
    showMediaLoading(true);
    hideMediaError();
    
    try {
        // 최근 30일 데이터 검색
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const response = await fetch(`${API_BASE_URL}/api/media-effectiveness?keyword=${encodeURIComponent(keyword)}&startDate=${startDateStr}&endDate=${endDateStr}&aggregation=day&limit=1000`);
        const data = await response.json();
        
        if (data.success) {
            mediaEffectivenessData.news = data.data.news;
            mediaEffectivenessData.aggregated = data.data.aggregated;
            
            renderMediaNewsList();
            renderMediaChart();
            updateMediaNewsCount(data.data.totalCount);
            
            showToast(`검색 완료: ${data.data.totalCount}건의 뉴스를 찾았습니다.`);
        } else {
            throw new Error(data.error || '검색 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('언론보도 효과성 검색 실패:', error);
        showMediaError(error.message);
    } finally {
        mediaEffectivenessData.loading = false;
        showMediaLoading(false);
    }
}

// 언론보도 효과성 차트 표시
function showMediaChart() {
    if (!mediaEffectivenessData.news.length) {
        showToast('먼저 뉴스를 검색해주세요.');
        return;
    }
    
    showMediaChartArea(true);
    renderMediaChart();
}

// 언론보도 효과성 차트 렌더링
function renderMediaChart() {
    const container = document.getElementById('mediaChartContainer');
    
    if (!container) {
        console.error('차트 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    // Chart.js 로드 확인
    if (typeof Chart === 'undefined') {
        console.error('Chart.js가 로드되지 않았습니다.');
        showToast('차트 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    // 기존 차트 제거
    if (mediaEffectivenessData.chart) {
        mediaEffectivenessData.chart.destroy();
    }
    
    const aggregated = mediaEffectivenessData.aggregated;
    const labels = Object.keys(aggregated).sort();
    const data = labels.map(label => aggregated[label]);
    
    // 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.id = 'mediaChart';
    container.innerHTML = '';
    container.appendChild(canvas);
    
    try {
        mediaEffectivenessData.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '뉴스 건수',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('차트 생성 실패:', error);
        showToast('차트를 생성하는 중 오류가 발생했습니다.');
    }
}

// 언론보도 효과성 뉴스 리스트 렌더링
function renderMediaNewsList() {
    const container = document.getElementById('mediaResults');
    
    if (!container) {
        console.error('뉴스 리스트 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    const news = mediaEffectivenessData.news;
    
    if (!news.length) {
        container.innerHTML = '<div class="text-center text-muted">검색된 뉴스가 없습니다.</div>';
        updateMediaNewsCount(0);
        return;
    }
    
    try {
        container.innerHTML = news.map((item, index) => `
            <div class="media-news-item" onclick="openMediaNewsDetail(${index})">
                <div class="media-news-title">${item.title || '제목 없음'}</div>
                <div class="media-news-meta">
                    <span class="media-news-source">${item.source || '알 수 없음'}</span>
                    <span>📅 ${item.pubDate || '날짜 없음'}</span>
                </div>
                <div class="media-news-description">${item.description || '내용 없음'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('뉴스 리스트 렌더링 실패:', error);
        container.innerHTML = '<div class="text-center text-danger">뉴스 목록을 표시하는 중 오류가 발생했습니다.</div>';
    }
}

// 언론보도 효과성 뉴스 상세 모달
function openMediaNewsDetail(index) {
    const news = mediaEffectivenessData.news[index];
    
    if (!news) {
        showToast('뉴스 정보를 찾을 수 없습니다.');
        return;
    }
    
    const modalHtml = `
        <div class="modal fade" id="mediaNewsDetailModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">뉴스 상세</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <strong>제목:</strong> ${news.title || '제목 없음'}
                        </div>
                        <div class="mb-3">
                            <strong>링크주소URL:</strong> 
                            <a href="${news.link || '#'}" target="_blank">${news.link || '링크 없음'}</a>
                        </div>
                        <div class="mb-3">
                            <strong>발행일:</strong> ${news.pubDate || '날짜 없음'}
                        </div>
                        <div class="mb-3">
                            <strong>언론사명:</strong> ${news.source || '알 수 없음'}
                        </div>
                        <div class="mb-3">
                            <strong>주요내용:</strong><br>
                            ${news.description || '내용 없음'}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    try {
        // 기존 모달 제거
        const existingModal = document.getElementById('mediaNewsDetailModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 새 모달 추가 및 표시
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('mediaNewsDetailModal'));
        modal.show();
        
        // 모달 닫힐 때 제거
        document.getElementById('mediaNewsDetailModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    } catch (error) {
        console.error('모달 생성 실패:', error);
        showToast('뉴스 상세 정보를 표시하는 중 오류가 발생했습니다.');
    }
}

// 언론보도 효과성 데이터 엑셀 다운로드
function exportMediaData() {
    if (!mediaEffectivenessData.news.length) {
        showToast('먼저 뉴스를 검색해주세요.');
        return;
    }
    
    const news = mediaEffectivenessData.news;
    const csvContent = [
        ['제목', '링크주소URL', '발행일', '언론사명', '주요내용'],
        ...news.map(item => [
            item.title,
            item.link,
            item.pubDate,
            item.source,
            item.description
        ])
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `언론보도효과성_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV 파일이 다운로드되었습니다.');
}

// 언론보도 효과성 UI 제어 함수들
function showMediaLoading(show) {
    const analyzeBtn = document.getElementById('analyzeMediaBtn');
    if (analyzeBtn) {
        if (show) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>분석 중...';
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-search me-2"></i>분석 시작';
        }
    }
}

function showMediaError(message) {
    const container = document.getElementById('mediaResults');
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

function hideMediaError() {
    // 에러 숨기기는 별도 처리 불필요
}

// 보고서 다운로드 설정
function setupReportDownload(analysisId) {
    const downloadBtn = document.getElementById('downloadReport');
    if (downloadBtn) {
        downloadBtn.onclick = () => downloadReport(analysisId);
        downloadBtn.style.display = 'block';
    }
}

// 보고서 다운로드
async function downloadReport(analysisId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/hot-topic-analysis/report/${analysisId}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hot-topic-report-${analysisId}.html`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('보고서가 다운로드되었습니다.');
        } else {
            throw new Error('보고서 다운로드 실패');
        }
    } catch (error) {
        console.error('보고서 다운로드 오류:', error);
        showToast('보고서 다운로드 중 오류가 발생했습니다.');
    }
}

// 뉴스 건수 업데이트 함수
function updateMediaNewsCount(count) {
    // 탭 구조에서는 별도 건수 표시 없음
    console.log(`언론보도 효과성 뉴스 건수: ${count}`);
}

// Chart.js 라이브러리 로드
function loadChartJS() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
            console.log('Chart.js 로드 완료');
            resolve();
        };
        script.onerror = () => {
            console.error('Chart.js 로드 실패');
            reject(new Error('Chart.js 로드 실패'));
        };
        document.head.appendChild(script);
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// force redeploy

// 사용자 액션 로깅 함수
async function logUserAction(action, meta = {}) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/log/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'dashboard',
                action, 
                userAgent: navigator.userAgent,
                meta 
            })
        });
        if (!res.ok) {
            console.warn('사용자 액션 로깅 실패:', res.status);
        }
    } catch (e) {
        console.warn('사용자 액션 로깅 중 오류:', e.message);
    }
}