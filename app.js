// pubDate에서 YYYY-MM-DD 추출 함수 (전역)
function extractDate(pubDate) {
    if (!pubDate) return '';
    // 예: 2025. 5. 19. 오전 9:02:00
    const match = pubDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (match) {
        const [, y, m, d] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // ISO 포맷(UTC)일 경우 9시간 더해서 KST로 변환
    const d = new Date(pubDate);
    if (isNaN(d)) return '';
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

// 한국 시간 기준 오늘 날짜 구하기
function getKoreaToday() {
    const now = new Date();
    const koreaOffset = 9 * 60; // 9시간
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utc + (koreaOffset * 60000));
    return koreaTime.toISOString().slice(0, 10);
}

// 캘린더 초기화
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    let holidayDates = [];

    // API 기본 URL 설정
    const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

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
        return await res.json();
    }
    // 일정 수정
    async function updateUserEvent(id, event) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        return await res.json();
    }
    // 일정 삭제
    async function deleteUserEvent(id) {
        const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, { method: 'DELETE' });
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
    async function renderKeywordCheckboxes() {
        const keywords = await loadKeywords();
        const container = document.getElementById('keywordCheckboxList');
        if (!container) return;
        container.innerHTML = '';
        if (keywords.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 키워드가 없습니다.</span>';
            renderNews([]);
            return;
        }
        keywords.forEach((kw, idx) => {
            const id = `risk-checkbox-${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input me-1 section-risk';
            checkbox.value = kw;
            checkbox.checked = true;
            checkbox.onchange = renderNewsByChecked;
            checkbox.setAttribute('aria-label', `키워드 ${kw} 선택`);
            checkbox.id = id;
            const label = document.createElement('label');
            label.className = 'form-check-label me-3';
            label.setAttribute('for', id);
            label.appendChild(document.createTextNode(kw));
            container.appendChild(checkbox);
            container.appendChild(label);
        });
    }

    function renderNewsByChecked() {
        const container = document.getElementById('keywordCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked'))
            .flatMap(cb => cb.value.split('|').map(v => v.trim()));
        renderNews(checked);
    }

    // 리스크 이슈 모니터링 뉴스 UI 렌더링 (체크박스 기반 필터)
    async function renderNews(selectedKeywords) {
        const newsFeed = document.getElementById('newsFeed');
        if (!newsFeed) return;
        // 최초 로딩/정보갱신 시 로딩 스피너 표시
        newsFeed.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>리스크이슈 로딩 중...</div></div>';
        const keywords = selectedKeywords || await loadKeywords();
        const getRes = await fetch(`${API_BASE_URL}/api/risk-news`);
        const allNews = await getRes.json();
        const today = getKoreaToday();
        let filtered = [];
        if (keywords.length > 0) {
            filtered = allNews.filter(news => {
                if (!news.keyword) return false;
                const newsKeywords = news.keyword.split('|').map(k => k.trim());
                return newsKeywords.some(k => keywords.includes(k));
            });
        }
        const todayCount = filtered.filter(item => extractDate(item.pubDate) === today).length;
        newsFeed.innerHTML = '';
        // === 상단 건수/갱신 버튼 추가 ===
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${filtered.length}</b>건</span>
            <button class="btn btn-sm btn-outline-section-risk" id="refreshNewsBtn">정보갱신</button>
        `;
        newsFeed.appendChild(topBar);
        document.getElementById('refreshNewsBtn').onclick = async function() {
            const checked = Array.from(document.querySelectorAll('#keywordCheckboxList input[type=checkbox]:checked')).map(cb => cb.value);
            if (!checked.length) {
                alert('체크된 키워드가 없습니다.');
                return;
            }
            newsFeed.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>리스크이슈 정보갱신 중...</div></div>';
            await fetchAndSaveAllNews(checked);
            await renderNews(checked);
        };

        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'news-item';
            emptyDiv.textContent = '표시할 뉴스가 없습니다.';
            newsFeed.appendChild(emptyDiv);
            return;
        }
        filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        filtered.forEach(item => {
            const isToday = extractDate(item.pubDate) === today;
            const card = document.createElement('div');
            card.className = 'card mb-2';
            if (isToday) {
                card.classList.add('border-primary', 'bg-light');
            }
            card.innerHTML = `
              <div class="card-body d-flex flex-column flex-md-row justify-content-between align-items-center">
                <div class="flex-grow-1">
                  ${isToday ? '<span class="badge badge-section-risk me-2">Today</span>' : ''}
                  <a href="${item.link}" target="_blank"><b class="main-color">${item.title.replace(/<[^>]+>/g, '')}</b></a>
                  <div class="text-muted small mb-1">${item.pubDate ? new Date(item.pubDate).toLocaleString() : ''} | <span class="badge badge-section-risk">${item.keyword}</span></div>
                </div>
              </div>
            `;
            newsFeed.appendChild(card);
        });
    }

    // fetchAndSaveAllNews를 체크된 키워드만 대상으로 동작하도록 개선
    async function fetchAndSaveAllNews(keywordsParam) {
        const keywords = keywordsParam || await loadKeywords();
        if (!Array.isArray(keywords) || keywords.length === 0) return;
        const today = getKoreaToday();
        let allNews = [];
        for (const kw of keywords) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/naver-news?query=${encodeURIComponent(kw)}&max=100`);
                if (!res.ok) {
                    continue;
                }
                const data = await res.json();
                if (data.items) {
                    data.items.forEach(item => {
                        if (!allNews.some(n => n.link === item.link)) {
                            allNews.push({ ...item, keyword: kw });
                        }
                    });
                }
            } catch (e) {
            }
        }
        // 서버에 저장
        await fetch(`${API_BASE_URL}/api/risk-news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: allNews })
        });
        // 서버에서 최신 데이터 GET
        const getRes = await fetch(`${API_BASE_URL}/api/risk-news`);
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
        
        localStorage.setItem(`riskNews_${today}`, JSON.stringify(recentNews));
        localStorage.setItem('riskNews_lastUpdate', today);
    }

    // 대시보드 진입 시 자동 뉴스 갱신 체크 및 체크박스/뉴스 렌더링 순서 보장
    if (document.getElementById('newsFeed')) {
        renderKeywordCheckboxes().then(() => {
            renderNewsByChecked();
        });
    }

    // 제휴처 탐색, 신기술 동향도 체크박스 렌더링 후 필터링 함수 실행
    renderPartnerCheckboxes().then(() => renderPartnerResultsByChecked());
    renderTechCheckboxes().then(() => renderTechTrendResultsByChecked());

    // 제휴처 탐색 키워드 관리
    async function renderPartnerCheckboxes() {
        const conds = await loadPartnerConditions();
        const container = document.getElementById('partnerCheckboxList');
        if (!container) return;
        container.innerHTML = '';
        if (conds.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 조건이 없습니다.</span>';
            renderPartnerResults([]);
            return;
        }
        conds.forEach((kw, idx) => {
            const id = `partner-checkbox-${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input me-1 section-partner';
            checkbox.value = kw;
            checkbox.checked = true;
            checkbox.onchange = renderPartnerResultsByChecked;
            checkbox.setAttribute('aria-label', `조건 ${kw} 선택`);
            checkbox.id = id;
            const label = document.createElement('label');
            label.className = 'form-check-label me-3';
            label.setAttribute('for', id);
            label.appendChild(document.createTextNode(kw));
            container.appendChild(checkbox);
            container.appendChild(label);
        });
    }
    function renderPartnerResultsByChecked() {
        const container = document.getElementById('partnerCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        renderPartnerResults(checked);
    }
    async function renderPartnerResults(selected) {
        const resultsDiv = document.getElementById('partnerResults');
        if (!resultsDiv) return;
        // 최초 로딩/정보갱신 시 로딩 스피너 표시
        resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>제휴처탐색 로딩 중...</div></div>';
        const getRes = await fetch(`${API_BASE_URL}/api/partner-news`);
        const allData = await getRes.json();
        const today = getKoreaToday();
        let filtered = [];
        if (selected && selected.length > 0) {
            const selectedNorm = selected.map(s => s.toLowerCase().trim());
            filtered = allData.filter(item => {
                if (!item.keyword) return false;
                const newsKeywords = item.keyword.split('|').map(k => k.toLowerCase().trim());
                return newsKeywords.some(k => selectedNorm.includes(k));
            });
        }
        const todayCount = filtered.filter(item => extractDate(item.pubDate) === today).length;
        resultsDiv.innerHTML = '';
        // 제휴처탐색 상단 건수/정보갱신 버튼 - '금일: x건, 누적: y건' 형식
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${filtered.length}</b>건</span>
            <button class="btn btn-sm btn-outline-section-partner" id="refreshPartnerBtn">정보갱신</button>
        `;
        resultsDiv.appendChild(topBar);
        document.getElementById('refreshPartnerBtn').onclick = async function() {
            const checked = Array.from(document.querySelectorAll('#partnerCheckboxList input[type=checkbox]:checked')).map(cb => cb.value);
            if (!checked.length) {
                alert('체크된 조건이 없습니다.');
                return;
            }
            resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>제휴처탐색 정보갱신 중...</div></div>';
            await fetchAndSaveAllPartners(checked);
            await renderPartnerResults(checked);
        };
        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'news-item';
            emptyDiv.textContent = '표시할 정보가 없습니다.';
            resultsDiv.appendChild(emptyDiv);
            return;
        }
        filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        filtered.forEach(item => {
            const isToday = extractDate(item.pubDate) === today;
            const card = document.createElement('div');
            card.className = 'card mb-2';
            if (isToday) {
                card.classList.add('border-primary', 'bg-light');
            }
            card.innerHTML = `
              <div class="card-body d-flex flex-column flex-md-row justify-content-between align-items-center">
                <div class="flex-grow-1">
                  ${isToday ? '<span class="badge badge-section-partner me-2">Today</span>' : ''}
                  <a href="${item.link}" target="_blank"><b class="main-color">${item.title.replace(/<[^>]+>/g, '')}</b></a>
                  <div class="text-muted small mb-1">${item.pubDate ? new Date(item.pubDate).toLocaleString() : ''} | <span class="badge badge-section-partner">${item.keyword}</span></div>
                </div>
              </div>
            `;
            resultsDiv.appendChild(card);
        });
    }
    // 신기술 동향 키워드 관리
    async function renderTechCheckboxes() {
        const topics = await loadTechTopics();
        const container = document.getElementById('techCheckboxList');
        if (!container) return;
        container.innerHTML = '';
        if (topics.length === 0) {
            container.innerHTML = '<span class="text-muted">등록된 주제가 없습니다.</span>';
            renderTechTrendResults([]);
            return;
        }
        topics.forEach((kw, idx) => {
            const id = `tech-checkbox-${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input me-1 section-tech';
            checkbox.value = kw;
            checkbox.checked = true;
            checkbox.onchange = renderTechTrendResultsByChecked;
            checkbox.setAttribute('aria-label', `주제 ${kw} 선택`);
            checkbox.id = id;
            const label = document.createElement('label');
            label.className = 'form-check-label me-3';
            label.setAttribute('for', id);
            label.appendChild(document.createTextNode(kw));
            container.appendChild(checkbox);
            container.appendChild(label);
        });
    }
    function renderTechTrendResultsByChecked() {
        const container = document.getElementById('techCheckboxList');
        if (!container) return;
        const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        renderTechTrendResults(checked);
    }
    async function renderTechTrendResults(selected) {
        const resultsDiv = document.getElementById('techTrendResults');
        if (!resultsDiv) return;
        // 최초 로딩/정보갱신 시 로딩 스피너 표시
        resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>신기술동향 로딩 중...</div></div>';
        const getRes = await fetch(`${API_BASE_URL}/api/tech-news`);
        const allData = await getRes.json();
        const today = getKoreaToday();
        let filtered = [];
        if (selected && selected.length > 0) {
            const selectedNorm = selected.map(s => s.toLowerCase().trim());
            filtered = allData.filter(item => {
                if (!item.keyword) return false;
                const newsKeywords = item.keyword.split('|').map(k => k.toLowerCase().trim());
                return newsKeywords.some(k => selectedNorm.includes(k));
            });
        }
        const todayCount = filtered.filter(item => extractDate(item.pubDate) === today).length;
        resultsDiv.innerHTML = '';
        // 신기술동향 상단 건수/정보갱신 버튼 - '금일: x건, 누적: y건' 형식
        const topBar = document.createElement('div');
        topBar.className = 'd-flex justify-content-end align-items-center mb-2';
        topBar.innerHTML = `
            <span class="me-2 text-secondary small">금일: <b>${todayCount}</b>건, 누적: <b>${filtered.length}</b>건</span>
            <button class="btn btn-sm btn-outline-section-tech" id="refreshTechBtn">정보갱신</button>
        `;
        resultsDiv.appendChild(topBar);
        document.getElementById('refreshTechBtn').onclick = async function() {
            const checked = Array.from(document.querySelectorAll('#techCheckboxList input[type=checkbox]:checked')).map(cb => cb.value);
            if (!checked.length) {
                alert('체크된 주제가 없습니다.');
                return;
            }
            resultsDiv.innerHTML = '<div class="d-flex flex-column align-items-center my-3"><div class="spinner-border text-primary mb-2" role="status"></div><div>신기술동향 정보갱신 중...</div></div>';
            await fetchAndSaveAllTechs(checked);
            await renderTechTrendResults(checked);
        };
        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'news-item';
            emptyDiv.textContent = '표시할 정보가 없습니다.';
            resultsDiv.appendChild(emptyDiv);
            return;
        }
        filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        filtered.forEach(item => {
            const isToday = extractDate(item.pubDate) === today;
            const card = document.createElement('div');
            card.className = 'card mb-2';
            if (isToday) {
                card.classList.add('border-primary', 'bg-light');
            }
            card.innerHTML = `
              <div class="card-body d-flex flex-column flex-md-row justify-content-between align-items-center">
                <div class="flex-grow-1">
                  ${isToday ? '<span class="badge badge-section-tech me-2">Today</span>' : ''}
                  <a href="${item.link}" target="_blank"><b class="main-color">${item.title.replace(/<[^>]+>/g, '')}</b></a>
                  <div class="text-muted small mb-1">${item.pubDate ? new Date(item.pubDate).toLocaleString() : ''} | <span class="badge badge-section-tech">${item.keyword}</span></div>
                </div>
              </div>
            `;
            resultsDiv.appendChild(card);
        });
    }

    // 제휴처 탐색 정보 수집 및 저장
    async function fetchAndSaveAllPartners(keywordsParam) {
        const keywords = keywordsParam || await loadPartnerConditions();
        if (!Array.isArray(keywords) || keywords.length === 0) return;
        const today = getKoreaToday();
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
    function checkAndUpdatePartnerNews() {
        const today = getKoreaToday();
        const lastUpdate = localStorage.getItem('partnerNews_lastUpdate');
        const updateTime = localStorage.getItem('newsUpdateTime') || '07:00';
        const now = new Date();
        const [h, m] = updateTime.split(':').map(Number);
        const updateDate = new Date(today + 'T' + updateTime);
        if (lastUpdate !== today && now >= updateDate) {
            fetchAndSaveAllPartners().then(() => renderPartnerResults(loadPartnerConditions()));
        } else {
            renderPartnerResults(loadPartnerConditions());
        }
    }
    // 신기술 동향 정보 수집 및 저장
    async function fetchAndSaveAllTechs(keywordsParam) {
        const keywords = keywordsParam || await loadTechTopics();
        if (!Array.isArray(keywords) || keywords.length === 0) return;
        const today = getKoreaToday();
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
    function checkAndUpdateTechNews() {
        const today = getKoreaToday();
        const lastUpdate = localStorage.getItem('techNews_lastUpdate');
        const updateTime = localStorage.getItem('newsUpdateTime') || '07:00';
        const now = new Date();
        const [h, m] = updateTime.split(':').map(Number);
        const updateDate = new Date(today + 'T' + updateTime);
        if (lastUpdate !== today && now >= updateDate) {
            fetchAndSaveAllTechs().then(() => renderTechTrendResults(loadTechTopics()));
        } else {
            renderTechTrendResults(loadTechTopics());
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

