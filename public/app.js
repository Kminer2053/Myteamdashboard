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

// 캘린더 초기화
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    let holidayDates = [];

    // API 기본 URL 설정
    const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

    // 대시보드 방문자수 기록
    fetch(`${API_BASE_URL}/api/visit`, { method: 'POST' });

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
        await logUserAction('일정등록', { event });
        return await res.json();
    }
    // 일정 수정
    async function updateUserEvent(id, event) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        await logUserAction('일정수정', { id, event });
        return await res.json();
    }
    // 일정 삭제
    async function deleteUserEvent(id) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, { method: 'DELETE' });
        await logUserAction('일정삭제', { id });
        return await res.json();
    }

    // 공휴일 데이터 가져오기 (연도 전체)
    async function fetchHolidays(year) {
        try {
            const API_KEY = 'DTrcjG%2BXCsB9m%2F6xPK4LmJ%2FG61dwF%2B3h%2FM7Rzv4IbI9ilfsqDRFErvOryzE45LblhwWpU4GSwuoA9W8CxVav5A%3D%3D';
            const response = await fetch(`https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${API_KEY}&solYear=${year}&_type=json&numOfRows=100`);
            const data = await response.json();
            if (data.response && data.response.body && data.response.body.items) {
                let items = data.response.body.items.item;
                if (!Array.isArray(items)) items = [items];
                return items.map(holiday => ({
                    date: `${holiday.locdate}`.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                    title: holiday.dateName
                }));
            }
            return [];
        } catch (error) {
            console.error('공휴일 데이터를 가져오는데 실패했습니다:', error);
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

    // === 토스트 메시지 함수 추가 ===
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
            showToast('오류가 발생했습니다.');
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
                showToast('오류가 발생했습니다.');
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
        offset: 0,
        limit: 50,
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
            offset: 0,
            limit: 50,
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
            const response = await fetch(`${API_BASE_URL}/api/risk-news?limit=${riskNewsData.limit}&offset=${riskNewsData.offset}`);
            const data = await response.json();
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (riskNewsData.offset === 0) {
                    riskNewsData.items = [];
                    newsFeed.innerHTML = '';
                }
                
                // 새 데이터 추가
                riskNewsData.items = [...riskNewsData.items, ...data.data];
                riskNewsData.totalCount = data.totalCount;
                riskNewsData.hasMore = data.hasMore;
                riskNewsData.offset += data.data.length;
                
                // 분석 보고서 데이터 (백엔드에서 전달받음)
                const analysisReport = data.analysisReport;
                
                await renderRiskNewsContent(analysisReport);
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

    async function renderRiskNewsContent(analysisReport) {
        const newsFeed = document.getElementById('newsFeed');
        const today = await getKoreaToday();
        
        // 첫 번째 로드인 경우에만 전체 내용 렌더링 (조건 수정)
        if (riskNewsData.offset === riskNewsData.limit && riskNewsData.items.length === riskNewsData.limit) {
            newsFeed.innerHTML = '';
            
            // === 분석 보고서 표출 ===
            if (analysisReport) {
                const reportDiv = document.createElement('div');
                reportDiv.className = 'card mb-4';
                reportDiv.style.cssText = 'border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #dc3545;';
                reportDiv.innerHTML = `
                    <div class="card-header" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 15px 20px;">
                        <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>AI 분석 보고서 <small class="float-end">출처: ${analysisReport.analysisModel || 'perplexity-ai'}</small></h6>
                    </div>
                    <div class="card-body" style="padding: 20px;">
                        <div style="color: #666; line-height: 1.6; margin-bottom: 15px;">${analysisReport.newsSummary || analysisReport.analysis || '분석 내용이 없습니다.'}</div>
                        <div class="row">
                            <div class="col-md-3">
                                <small class="text-muted">감성점수</small><br>
                                <span class="badge" style="background: ${analysisReport.sentimentScore > 50 ? '#28a745' : analysisReport.sentimentScore > 30 ? '#ffc107' : '#dc3545'}; color: white;">${analysisReport.sentimentScore || 0}점</span>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted">주가정보</small><br>
                                <span class="text-muted">${analysisReport.stockInfo || '정보 없음'}</span>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted">총 뉴스</small><br>
                                <span class="badge badge-secondary">${analysisReport.newsCount || analysisReport.totalNewsCount || 0}건</span>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted">분석일</small><br>
                                <span class="text-muted">${analysisReport.analysisDate || new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                `;
                newsFeed.appendChild(reportDiv);
            }
            
            // === 뉴스 현황 표시 ===
            const todayCount = riskNewsData.items.filter(item => {
                const itemDate = new Date(item.pubDate);
                const todayDate = new Date(today);
                const itemDateStr = itemDate.toISOString().split('T')[0];
                const todayDateStr = todayDate.toISOString().split('T')[0];
                return itemDateStr === todayDateStr;
            }).length;
            
            const statusDiv = document.createElement('div');
            statusDiv.className = 'd-flex justify-content-end align-items-center mb-3';
            statusDiv.innerHTML = `
                <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${riskNewsData.totalCount}</b>건</span>
                <button class="btn btn-sm btn-outline-danger" id="refreshRiskBtn">정보갱신</button>
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
        }
        
        // === 뉴스 목록 렌더링 ===
        const todayNews = riskNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        });
        
        const otherNews = riskNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr !== todayDateStr;
        });
        
        // 오늘 뉴스 표시
        if (todayNews.length > 0) {
            const todayDiv = document.createElement('div');
            todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
            newsFeed.appendChild(todayDiv);
            
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'risk', 'Today');
                newsFeed.appendChild(card);
            });
        }
        
        // 누적 뉴스 표시
        if (otherNews.length > 0) {
            const recentDiv = document.createElement('div');
            recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
            newsFeed.appendChild(recentDiv);
            
            otherNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            otherNews.forEach(item => {
                const card = createNewsCard(item, 'risk');
                newsFeed.appendChild(card);
            });
        }
        
        // 무한 스크롤 로딩 표시
        if (riskNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'riskLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            newsFeed.appendChild(loadingDiv);
        }
        
        // 뉴스가 없는 경우
        if (riskNewsData.items.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'alert alert-info';
            emptyDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다. 기존 누적 데이터를 확인해보세요.</p>
                </div>
            `;
            newsFeed.appendChild(emptyDiv);
        }
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
                    ${item.pubDate ? new Date(item.pubDate).toLocaleString() : ''} | 
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

    // 제휴처 탐색, 신기술 동향도 체크박스 렌더링 후 필터링 함수 실행
            renderPartnerDisplay();
            renderTechDisplay();

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
        
        // 분석 보고서 데이터 가져오기
        let analysisReport = null;
        try {
            const reportRes = await fetch(`${API_BASE_URL}/api/partner-analysis`);
            const reportResponse = await reportRes.json();
            if (reportResponse.success && reportResponse.data && reportResponse.data.length > 0) {
                analysisReport = reportResponse.data[0]; // 최신 분석 보고서
            }
        } catch (error) {
            console.error('분석 보고서 조회 실패:', error);
        }
        
        // 분석 보고서 표출
        if (analysisReport) {
            const analysisDiv = document.createElement('div');
            analysisDiv.className = 'mt-3 p-3 bg-light border rounded';
            analysisDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0"><i class="fas fa-chart-line text-primary"></i> AI 분석 보고서</h6>
                    <small class="text-muted">${analysisReport.analysisModel || 'perplexity-ai'}</small>
                </div>
                <div style="color: #666; line-height: 1.6; font-size: 0.9em;">
                    ${analysisReport.analysis || '분석 데이터가 없습니다.'}
                </div>
                <div class="mt-2 text-muted small">
                    <span class="me-3">총 뉴스: ${analysisReport.totalNewsCount || 0}건</span>
                    <span>분석일: ${new Date(analysisReport.date).toLocaleDateString()}</span>
                </div>
            `;
            container.appendChild(analysisDiv);
        }
        
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
        offset: 0,
        limit: 50,
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
            offset: 0,
            limit: 50,
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
            const response = await fetch(`${API_BASE_URL}/api/partner-news?limit=${partnerNewsData.limit}&offset=${partnerNewsData.offset}`);
            const data = await response.json();
            
            console.log('📥 제휴처 뉴스 응답:', data);
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (partnerNewsData.offset === 0) {
                    partnerNewsData.items = [];
                    resultsDiv.innerHTML = '';
                    console.log('🔄 첫 번째 로드 - 데이터 초기화');
                }
                
                // 새 데이터 추가
                partnerNewsData.items = [...partnerNewsData.items, ...data.data];
                partnerNewsData.totalCount = data.totalCount;
                partnerNewsData.hasMore = data.hasMore;
                partnerNewsData.offset += data.data.length;
                
                console.log('📊 제휴처 뉴스 데이터 업데이트:', {
                    itemsCount: partnerNewsData.items.length,
                    totalCount: partnerNewsData.totalCount,
                    hasMore: partnerNewsData.hasMore,
                    offset: partnerNewsData.offset
                });
                
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
        const resultsDiv = document.getElementById('partnerResults');
        const today = await getKoreaToday();
        
        // 항상 전체 내용 렌더링 (조건 제거)
        resultsDiv.innerHTML = '';
        
        // === 상단 건수/정보갱신 버튼 ===
        const todayCount = partnerNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        }).length;
        
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${partnerNewsData.totalCount}</b>건</span>
            <button class="btn btn-sm btn-outline-primary" id="refreshPartnerBtn">정보갱신</button>
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
        const todayNews = partnerNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        });
        
        const otherNews = partnerNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr !== todayDateStr;
        });
        
        console.log('📋 제휴처 뉴스 렌더링:', {
            totalItems: partnerNewsData.items.length,
            todayNews: todayNews.length,
            otherNews: otherNews.length
        });
        
        // 오늘 뉴스 표시
        if (todayNews.length > 0) {
            const todayDiv = document.createElement('div');
            todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
            resultsDiv.appendChild(todayDiv);
            
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'partner', 'Today');
                resultsDiv.appendChild(card);
            });
        }
        
        // 누적 뉴스 표시
        if (otherNews.length > 0) {
            const recentDiv = document.createElement('div');
            recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
            resultsDiv.appendChild(recentDiv);
            
            otherNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            otherNews.forEach(item => {
                const card = createNewsCard(item, 'partner');
                resultsDiv.appendChild(card);
            });
        }
        
        // 무한 스크롤 로딩 표시
        if (partnerNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'partnerLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            resultsDiv.appendChild(loadingDiv);
        }
        
        // 뉴스가 없는 경우
        if (partnerNewsData.items.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'alert alert-info';
            emptyDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다. 기존 누적 데이터를 확인해보세요.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyDiv);
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
        
        // 분석 보고서 데이터 가져오기
        let analysisReport = null;
        try {
            const reportRes = await fetch(`${API_BASE_URL}/api/tech-analysis`);
            const reportResponse = await reportRes.json();
            if (reportResponse.success && reportResponse.data && reportResponse.data.length > 0) {
                analysisReport = reportResponse.data[0]; // 최신 분석 보고서
            }
        } catch (error) {
            console.error('분석 보고서 조회 실패:', error);
        }
        
        // 분석 보고서 표출
        if (analysisReport) {
            const analysisDiv = document.createElement('div');
            analysisDiv.className = 'mt-3 p-3 bg-light border rounded';
            analysisDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0"><i class="fas fa-chart-line text-primary"></i> AI 분석 보고서</h6>
                    <small class="text-muted">${analysisReport.analysisModel || 'perplexity-ai'}</small>
                </div>
                <div style="color: #666; line-height: 1.6; font-size: 0.9em;">
                    ${analysisReport.analysis || '분석 데이터가 없습니다.'}
                </div>
                <div class="mt-2 text-muted small">
                    <span class="me-3">총 뉴스: ${analysisReport.totalNewsCount || 0}건</span>
                    <span>분석일: ${new Date(analysisReport.date).toLocaleDateString()}</span>
                </div>
            `;
            container.appendChild(analysisDiv);
        }
        
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
        offset: 0,
        limit: 50,
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
            offset: 0,
            limit: 50,
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
            const response = await fetch(`${API_BASE_URL}/api/tech-news?limit=${techNewsData.limit}&offset=${techNewsData.offset}`);
            const data = await response.json();
            
            if (data.success) {
                // 첫 번째 로드인 경우 기존 데이터 초기화
                if (techNewsData.offset === 0) {
                    techNewsData.items = [];
                    resultsDiv.innerHTML = '';
                }
                
                // 새 데이터 추가
                techNewsData.items = [...techNewsData.items, ...data.data];
                techNewsData.totalCount = data.totalCount;
                techNewsData.hasMore = data.hasMore;
                techNewsData.offset += data.data.length;
                
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
        const resultsDiv = document.getElementById('techTrendResults');
        const today = await getKoreaToday();
        
        // 항상 전체 내용 렌더링 (조건 제거)
        resultsDiv.innerHTML = '';
        
        // === 상단 건수/정보갱신 버튼 ===
        const todayCount = techNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        }).length;
        
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${techNewsData.totalCount}</b>건</span>
            <button class="btn btn-sm btn-outline-success" id="refreshTechBtn">정보갱신</button>
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
        const todayNews = techNewsData.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            const todayDate = new Date(today);
            const itemDateStr = itemDate.toISOString().split('T')[0];
            const todayDateStr = todayDate.toISOString().split('T')[0];
            return itemDateStr === todayDateStr;
        });
        
        const otherNews = techNewsData.items.filter(item => {
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
        
        // 오늘 뉴스 표시
        if (todayNews.length > 0) {
            const todayDiv = document.createElement('div');
            todayDiv.innerHTML = '<h6 class="mb-2">오늘의 뉴스</h6>';
            resultsDiv.appendChild(todayDiv);
            
            todayNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            todayNews.forEach(item => {
                const card = createNewsCard(item, 'tech', 'Today');
                resultsDiv.appendChild(card);
            });
        }
        
        // 누적 뉴스 표시
        if (otherNews.length > 0) {
            const recentDiv = document.createElement('div');
            recentDiv.innerHTML = '<h6 class="mt-3 mb-2">최근 누적 뉴스</h6>';
            resultsDiv.appendChild(recentDiv);
            
            otherNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            otherNews.forEach(item => {
                const card = createNewsCard(item, 'tech');
                resultsDiv.appendChild(card);
            });
        }
        
        // 무한 스크롤 로딩 표시
        if (techNewsData.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'techLoadingIndicator';
            loadingDiv.className = 'd-flex justify-content-center my-3';
            loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
            resultsDiv.appendChild(loadingDiv);
        }
        
        // 뉴스가 없는 경우
        if (techNewsData.items.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'alert alert-info';
            emptyDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle" style="font-size: 2em; color: #17a2b8; margin-bottom: 10px;"></i>
                    <h5>금일은 뉴스가 없습니다</h5>
                    <p class="text-muted">오늘 수집된 뉴스가 없습니다. 기존 누적 데이터를 확인해보세요.</p>
                </div>
            `;
            resultsDiv.appendChild(emptyDiv);
        }
    }

    // 제휴처 탐색 정보 수집 및 저장
    async function fetchAndSaveAllPartners(keywordsParam) {
        const keywords = keywordsParam || await loadPartnerConditions();
        if (!Array.isArray(keywords) || keywords.length === 0) return;
        const today = await getKoreaToday();
        let allNews = [];
        for (const kw of keywords) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/naver-news?query=${encodeURIComponent(kw)}&max=100`);
                const data = await res.json();
                if (data.items) {
                    data.items.forEach(item => {
                        if (!allNews.some(n => n.link === item.link)) {
                            allNews.push({ ...item, keyword: kw });
                        }
                    });
                }
            } catch (e) { /* 네트워크 오류 등 무시 */ }
        }
        await fetch(`${API_BASE_URL}/api/partner-news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: allNews })
        });
        const getRes = await fetch(`${API_BASE_URL}/api/partner-news`);
        const news = await getRes.json();
        
        // 선택된 조건에 해당하는 뉴스만 필터링
        const filteredNews = news.filter(item => keywords.includes(item.keyword));
        
        // 최근 일주일 데이터만 필터링
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentNews = filteredNews.filter(item => {
            const pubDate = new Date(item.pubDate);
            return pubDate >= oneWeekAgo;
        });
        
        localStorage.setItem(`partnerNews_${today}`, JSON.stringify(recentNews));
        localStorage.setItem('partnerNews_lastUpdate', today);
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
    // 신기술 동향 정보 수집 및 저장
    async function fetchAndSaveAllTechs(keywordsParam) {
        const keywords = keywordsParam || await loadTechTopics();
        if (!Array.isArray(keywords) || keywords.length === 0) return;
        const today = await getKoreaToday();
        let allNews = [];
        for (const kw of keywords) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/naver-news?query=${encodeURIComponent(kw)}&max=100`);
                const data = await res.json();
                if (data.items) {
                    data.items.forEach(item => {
                        if (!allNews.some(n => n.link === item.link)) {
                            allNews.push({ ...item, keyword: kw });
                        }
                    });
                }
            } catch (e) { /* 네트워크 오류 등 무시 */ }
        }
        await fetch(`${API_BASE_URL}/api/tech-news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: allNews })
        });
        const getRes = await fetch(`${API_BASE_URL}/api/tech-news`);
        const news = await getRes.json();
        
        // 선택된 키워드에 해당하는 뉴스만 필터링
        const filteredNews = news.filter(item => keywords.includes(item.keyword));
        
        // 최근 일주일 데이터만 필터링
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentNews = filteredNews.filter(item => {
            const pubDate = new Date(item.pubDate);
            return pubDate >= oneWeekAgo;
        });
        
        localStorage.setItem(`techNews_${today}`, JSON.stringify(recentNews));
        localStorage.setItem('techNews_lastUpdate', today);
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

    // 페이지 로드 시 자동 갱신 체크
    if (document.getElementById('partnerResults')) checkAndUpdatePartnerNews();
    if (document.getElementById('techTrendResults')) checkAndUpdateTechNews();

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

    // 대시보드 진입 시 자동 뉴스 갱신 체크 및 체크박스/뉴스 렌더링 순서 보장
    if (document.getElementById('newsFeed')) {
        renderKeywordDisplay().then(() => {
            renderNewsByChecked();
        });
    }

    // 무한 스크롤 초기화
    setupAllInfiniteScrolls();
});

// 디바운스 유틸리티 함수
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

