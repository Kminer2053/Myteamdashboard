const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getOrCreateCalendarImage } = require('./calendarImage');
const RiskNews = require('./models/RiskNews');
const PartnerNews = require('./models/PartnerNews');
const TechNews = require('./models/TechNews');

// 카카오톡 봇 설정
const KAKAO_BOT_TOKEN = process.env.KAKAO_BOT_TOKEN;
const KAKAO_BOT_SECRET = process.env.KAKAO_BOT_SECRET;

const HOLIDAY_API_KEY = process.env.HOLIDAY_API_KEY || 'DTrcjG%2BXCsB9m%2F6xPK4LmJ%2FG61dwF%2B3h%2FM7Rzv4IbI9ilfsqDRFErvOryzE45LblhwWpU4GSwuoA9W8CxVav5A%3D%3D';

// pubDate에서 YYYY-MM-DD 추출 함수 (app.js와 동일)
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

// 메시지 전송 함수
// async function sendMessage(roomId, message) {
//     try {
//         await axios.post('https://openapi.kakaotalk.com/v1/message/send', {
//             room_id: roomId,
//             message: message
//         }, {
//             headers: {
//                 'Authorization': `Bearer ${KAKAO_BOT_TOKEN}`,
//                 'Content-Type': 'application/json'
//             }
//         });
//     } catch (error) {
//         console.error('메시지 전송 실패:', error);
//     }
// }

// 메시지 라우팅 (/ prefix 명령어 지원)
function routeMessage(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // / prefix 명령어 우선 처리
    if (message === '/리스크') {
        return 'risk';
    }
    if (message === '/제휴') {
        return 'partner';
    }
    if (message === '/기술') {
        return 'tech';
    }
    if (message === '/일정') {
        return 'schedule';
    }
    if (message === '/뉴스') {
        return 'all';
    }
    if (message === '/도움말' || message === '/헬프' || message === '/help') {
        return 'help';
    }
    
    // 점심 추천 명령어 처리
    if (message.startsWith('/점심') || message.startsWith('/추천')) {
        return 'lunch_recommend';
    }
    
    // 기존 키워드 기반 라우팅 (하위 호환성)
    if (message.includes('스케줄공지') || message.includes('자동공지')) {
        return 'auto_announce';
    }
    if (message.includes('리스크') || message.includes('위험')) {
        return 'risk';
    }
    if (message.includes('제휴') || message.includes('파트너')) {
        return 'partner';
    }
    if (message.includes('기술') || message.includes('트렌드')) {
        return 'tech';
    }
    if (message.includes('일정') || message.includes('스케줄')) {
        return 'schedule';
    }
    if (message.includes('뉴스') || message.includes('모니터링')) {
        return 'all';
    }
    if (message.includes('도움말') || message === 'help') {
        return 'help';
    }
    return 'default';
}

// 공인된 KST 기준 오늘 날짜를 가져오는 비동기 함수 (axios 사용)
async function getKoreaToday() {
    try {
        const res = await axios.get('https://worldtimeapi.org/api/timezone/Asia/Seoul');
        const data = res.data;
        // data.datetime 예시: "2025-06-06T03:49:00.123456+09:00"
        return data.datetime.slice(0, 10); // "YYYY-MM-DD"
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

// 오늘 날짜의 뉴스만 필터링 (collectedDate 사용)
async function filterTodayNews(news) {
    const today = await getKoreaToday();
    return news.filter(item => {
        if (!item.collectedDate) return false;
        return item.collectedDate === today;
    });
}

// 연도별 공휴일 데이터 가져오기 (Nager.Date API)
async function fetchHolidays(year) {
    try {
        // Nager.Date API - 한국 공휴일 정보 (API 키 불필요, Rate limit 없음)
        // https://date.nager.at/API
        const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
        const response = await axios.get(url);
        const data = response.data;
        
        // Nager.Date API 응답 형식: 직접 배열
        if (Array.isArray(data) && data.length > 0) {
            return data
                .filter(holiday => holiday.types && holiday.types.includes('Public')) // 공휴일만 필터링
                .map(holiday => ({
                    date: holiday.date, // 이미 YYYY-MM-DD 형식
                    title: holiday.localName || holiday.name // 한국어 이름 우선, 없으면 영어 이름
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
    });
}

// 6글자 고정 폭으로 맞추는 함수
function padCell6(cell) {
    if (cell.length === 6) return cell;
    if (cell.length > 6) return cell.slice(0, 6);
    return cell.padEnd(6, ' ');
}

// 카카오 일정 등록 URL 생성 함수 (마크다운 링크 X, URL만 반환)
function makeKakaoScheduleLink(title, dateStr) {
    // dateStr: "2025년 06월 10일 09:00" → "2025-06-10T09:00"
    const match = dateStr.match(/(\d{4})년 (\d{2})월 (\d{2})일 (\d{2}):(\d{2})/);
    if (!match) return '';
    const [, y, m, d, h, min] = match;
    const iso = `${y}-${m}-${d}T${h}:${min}`;
    const url = `https://calendar.kakao.com/create?title=${encodeURIComponent(title)}&start=${iso}`;
    return url;
}

// 텍스트 달력 생성 함수 (6자 고정폭, 기호만 표기)
async function generateTextCalendar(year, month, schedules, monthHolidays) {
    const todayStr = await getKoreaToday();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    // 날짜별 표시 정보
    const scheduleByDay = {};
    schedules.forEach(sch => {
        const d = new Date(sch.start);
        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (!scheduleByDay[day]) scheduleByDay[day] = [];
            scheduleByDay[day].push(sch);
        }
    });
    const holidayByDay = {};
    monthHolidays.forEach(h => {
        const d = Number(h.date.split('-')[2]);
        holidayByDay[d] = h.title;
    });

    let cal = `📅 ${year}년 ${month + 1}월\n\n`;
    cal += '일     월     화     수     목     금     토\n';
    let day = 1;
    for (let i = 0; i < 6; i++) {
        let week = '';
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startingDay) {
                week += padCell6('');
            } else if (day > daysInMonth) {
                week += padCell6('');
            } else {
                let cell = '';
                const isToday = (year === Number(todayStr.split('-')[0]) && month + 1 === Number(todayStr.split('-')[1]) && day === Number(todayStr.split('-')[2]));
                if (holidayByDay[day]) {
                    cell = '🗓️';
                } else if (scheduleByDay[day]) {
                    cell = '★';
                } else {
                    cell = String(day);
                }
                if (isToday) {
                    cell = `[${cell}]`;
                }
                week += padCell6(cell);
                day++;
            }
            if (j < 6) week += ' ';
        }
        cal += week + '\n';
        if (day > daysInMonth) break;
    }
    cal += '\n공휴일: 🗓️  일정: ★\n';
    return cal;
}

// 세부 목록 생성 함수 (미래 일정 날짜를 카카오톡 인식 포맷으로만 출력)
async function generateDetailList(year, month, schedules, monthHolidays) {
    const now = new Date();
    // KST 기준 현재 시각
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    // 공휴일
    let holiList = monthHolidays.map(h => ({...h, isToday: false}));
    let holiStr = '🗓️ 공휴일\n';
    let holiIdx = 1;
    holiList.forEach(h => {
        // 날짜를 M월 D일 형식으로 변환
        const [y, m, d] = h.date.split('-');
        holiStr += `${holiIdx}. ${parseInt(m)}월 ${parseInt(d)}일 : ${h.title}\n`;
        holiIdx++;
    });
    if (holiIdx === 1) holiStr += '해당월 공휴일 없음\n';

    // 업무일정: 지난 일정 + 미래 일정 모두 표기, 구분선은 현재 시점 이후 첫 일정 앞에만
    let workList = schedules
        .filter(sch => {
            const d = new Date(sch.start);
            return d.getFullYear() === year && d.getMonth() === month;
        })
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    let workStr = '★ 업무일정\n';
    let insertedDivider = false;
    if (workList.length > 0) {
        workList.forEach((sch, idx) => {
            const d = new Date(sch.start);
            const dateStr = formatKST(sch.start);
            if (!insertedDivider && d >= kstNow) {
                workStr += '--------금일--------\n';
                insertedDivider = true;
            }
            workStr += `${idx+1}. ${sch.title}\n`;
            if (d >= kstNow) {
                workStr += `🕒 ${dateStr}\n`;
            } else {
                workStr += `🕒 ${dateStr}\n`;
            }
        });
        if (!insertedDivider) {
            // 모든 일정이 과거라면 마지막에 구분선 추가
            workStr += '--------금일--------\n';
        }
    } else {
        workStr += '해당월 일정 없음\n';
    }

    return holiStr + '\n' + workStr;
}

// 한국시간 기준 포맷 함수
function formatKST(date) {
    if (!date) return '-';
    const d = new Date(date instanceof Date ? date.getTime() : date);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}년 ${mm}월 ${dd}일 ${hh}:${min}`;
}

// HTML 태그 제거 및 엔티티 디코딩 함수
function cleanHtml(str) {
    if (!str) return '';
    // 태그 제거
    let text = str.replace(/<[^>]+>/g, '');
    // 엔티티 디코딩 (대표적인 것만)
    text = text.replace(/&quot;/g, '"')
               .replace(/&apos;/g, "'")
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
    return text;
}

// AI 분석보고서 텍스트 정리 함수
function formatAnalysisText(text) {
    if (!text) return '분석 내용이 없습니다.';
    
    // 줄바꿈을 카카오톡에서 보기 좋게 처리
    let formatted = text.replace(/\n/g, '\n');
    
    // 너무 긴 텍스트는 줄임
    if (formatted.length > 500) {
        formatted = formatted.substring(0, 500) + '...';
    }
    
    return formatted;
}

const logUserAction = async (action, userId = '', meta = {}) => {
  try {
    await axios.post(`${process.env.API_BASE_URL}/api/log/action`, {
      type: 'kakao',
      action,
      userId,
      userAgent: 'kakao-bot',
      meta
    });
  } catch (e) {
    // 무시
  }
};

// 메시지 처리 엔드포인트
// 메신저봇R에서 / 또는 ! 로 시작하는 메시지를 모두 이 URL로 전달하는 방식 지원
router.post('/message', async (req, res) => {
    try {
        console.log('[카카오봇] /kakao/message 요청:', req.body);
        // body 형식 다양하게 수신 (메신저봇R: text/message, 카카오 오픈빌더: userRequest.utterance 등)
        const userMessage = (
            req.body.userRequest?.utterance ||
            req.body.message ||
            req.body.text ||
            req.body.content ||
            ''
        ).trim();
        const action = routeMessage(userMessage);
        let responseMessage = '';
        const userId = req.body.userRequest?.user?.id || req.body.userId || req.body.user_id || '';
        
        switch (action) {
            case 'auto_announce': {
                await logUserAction('스케줄공지', userId);
                // ① 일정(캘린더+목록)
                const schedules = await axios.get(`${process.env.API_BASE_URL}/api/schedules`);
                const scheduleDate = new Date();
                const currentMonth = scheduleDate.getMonth();
                const currentYear = scheduleDate.getFullYear();
                // 공휴일 데이터 가져오기
                const holidays = await fetchHolidays(currentYear);
                const monthHolidays = getMonthHolidays(holidays, currentYear, currentMonth);
                // 텍스트 달력 생성
                const textCalendar = await generateTextCalendar(currentYear, currentMonth, schedules.data, monthHolidays);
                // 세부 일정 목록 생성
                const detailList = await generateDetailList(currentYear, currentMonth, schedules.data, monthHolidays);
                // ③ 오늘 뉴스 요약 (AI 분석보고서 포함)
                const newsSummary = await generateNewsSummary();
                // 최종 조합 (3000자 제한 없음)
                responseMessage = '📢 금일일정 및 뉴스\n\n';
                responseMessage += textCalendar + '\n';
                responseMessage += detailList + '\n';
                responseMessage += newsSummary + '\n';
                break;
            }
            case 'risk': {
                await logUserAction('리스크', userId);
                const [riskNewsResponse, riskKeywords] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/risk-keywords`)
                ]);
                
                const todayRiskNews = await filterTodayNews(riskNewsResponse.data.data);
                const analysisReport = riskNewsResponse.data.analysisReport;
                
                responseMessage = "📰 리스크 이슈 뉴스\n\n";
                
                responseMessage += "🔍 검색 키워드:\n";
                riskKeywords.data.forEach(keyword => {
                    responseMessage += `- ${keyword.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayRiskNews.length}건\n\n`;
                
                // AI 분석보고서 표시
                if (analysisReport && analysisReport.analysis) {
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                if (todayRiskNews.length > 0) {
                    todayRiskNews.forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n`;
                        responseMessage += `🔍 키워드: ${item.keyword}\n\n`;
                    });
                } else {
                    responseMessage += "오늘 등록된 뉴스가 없습니다.\n";
                }
                break;
            }
            case 'partner': {
                await logUserAction('제휴', userId);
                const [partnerNewsResponse, partnerConditions] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/partner-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/partner-conditions`)
                ]);
                
                const todayPartnerNews = await filterTodayNews(partnerNewsResponse.data.data);
                const analysisReport = partnerNewsResponse.data.analysisReport;
                
                responseMessage = "🤝 제휴처 탐색 결과\n\n";
                
                responseMessage += "🔍 검색 조건:\n";
                partnerConditions.data.forEach(condition => {
                    responseMessage += `- ${condition.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 정보: ${todayPartnerNews.length}건\n\n`;
                
                // AI 분석보고서 표시
                if (analysisReport && analysisReport.analysis) {
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                if (todayPartnerNews.length > 0) {
                    todayPartnerNews.forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n`;
                        responseMessage += `🔍 조건: ${item.keyword}\n\n`;
                    });
                } else {
                    responseMessage += "오늘 등록된 정보가 없습니다.\n";
                }
                break;
            }
            case 'tech': {
                await logUserAction('기술', userId);
                const [techNewsResponse, techTopics] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/tech-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/tech-topics`)
                ]);
                
                const todayTechNews = await filterTodayNews(techNewsResponse.data.data);
                const analysisReport = techNewsResponse.data.analysisReport;
                
                responseMessage = "🔬 신기술 동향\n\n";
                
                responseMessage += "🔍 검색 주제:\n";
                techTopics.data.forEach(topic => {
                    responseMessage += `- ${topic.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayTechNews.length}건\n\n`;
                
                // AI 분석보고서 표시
                if (analysisReport && analysisReport.analysis) {
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                if (todayTechNews.length > 0) {
                    todayTechNews.forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n`;
                        responseMessage += `🔍 주제: ${item.keyword}\n\n`;
                    });
                } else {
                    responseMessage += "오늘 등록된 뉴스가 없습니다.\n";
                }
                break;
            }
            case 'schedule': {
                await logUserAction('일정', userId);
                const schedules = await axios.get(`${process.env.API_BASE_URL}/api/schedules`);
                const scheduleDate = new Date();
                const currentMonth = scheduleDate.getMonth();
                const currentYear = scheduleDate.getFullYear();
                // 공휴일 데이터 가져오기
                const holidays = await fetchHolidays(currentYear);
                const monthHolidays = getMonthHolidays(holidays, currentYear, currentMonth);
                // 텍스트 달력 생성
                const textCalendar = await generateTextCalendar(currentYear, currentMonth, schedules.data, monthHolidays);
                // 세부 목록 생성
                const detailList = await generateDetailList(currentYear, currentMonth, schedules.data, monthHolidays);
                responseMessage = textCalendar + '\n' + detailList;
                break;
            }
            case 'all': {
                await logUserAction('뉴스', userId);
                const [allRiskNewsResponse, allPartnerNewsResponse, allTechNewsResponse] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/partner-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/tech-news`)
                ]);
                
                const todayAllRiskNews = await filterTodayNews(allRiskNewsResponse.data.data);
                const todayAllPartnerNews = await filterTodayNews(allPartnerNewsResponse.data.data);
                const todayAllTechNews = await filterTodayNews(allTechNewsResponse.data.data);
                
                responseMessage = "📰 오늘의 뉴스 모니터링\n\n";
                responseMessage += "📊 뉴스 현황\n";
                responseMessage += `- 리스크 이슈: ${todayAllRiskNews.length}건\n`;
                responseMessage += `- 제휴처 탐색: ${todayAllPartnerNews.length}건\n`;
                responseMessage += `- 신기술 동향: ${todayAllTechNews.length}건\n\n`;
                
                // 리스크 이슈 AI 분석보고서 (먼저 표시)
                if (allRiskNewsResponse.data.analysisReport && allRiskNewsResponse.data.analysisReport.analysis) {
                    responseMessage += "📰 리스크 이슈\n";
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(allRiskNewsResponse.data.analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                // 리스크 이슈 뉴스 (AI 분석보고서 후에 표시)
                if (todayAllRiskNews.length > 0) {
                    responseMessage += "📰 리스크 이슈 뉴스\n";
                    todayAllRiskNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                // 제휴처 탐색 AI 분석보고서 (먼저 표시)
                if (allPartnerNewsResponse.data.analysisReport && allPartnerNewsResponse.data.analysisReport.analysis) {
                    responseMessage += "🤝 제휴처 탐색\n";
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(allPartnerNewsResponse.data.analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                // 제휴처 탐색 뉴스 (AI 분석보고서 후에 표시)
                if (todayAllPartnerNews.length > 0) {
                    responseMessage += "🤝 제휴처 탐색 뉴스\n";
                    todayAllPartnerNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                // 신기술 동향 AI 분석보고서 (먼저 표시)
                if (allTechNewsResponse.data.analysisReport && allTechNewsResponse.data.analysisReport.analysis) {
                    responseMessage += "🔬 신기술 동향\n";
                    responseMessage += "🤖 AI 분석보고서\n";
                    responseMessage += "━━━━━━━━━━━━━━━━━━━━\n";
                    responseMessage += formatAnalysisText(allTechNewsResponse.data.analysisReport.analysis);
                    responseMessage += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
                }
                
                // 신기술 동향 뉴스 (AI 분석보고서 후에 표시)
                if (todayAllTechNews.length > 0) {
                    responseMessage += "🔬 신기술 동향 뉴스\n";
                    todayAllTechNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                break;
            }
            case 'lunch_recommend': {
                await logUserAction('점심추천', userId);
                try {
                    // 명령어에서 자연어 텍스트 추출
                    const originalMessage = userMessage.trim();
                    let requestText = '';
                    
                    if (originalMessage.startsWith('/점심')) {
                        requestText = originalMessage.replace('/점심', '').trim();
                    } else if (originalMessage.startsWith('/추천')) {
                        requestText = originalMessage.replace('/추천', '').trim();
                    }
                    
                    // 자연어 텍스트가 없으면 빈 문자열로 전달 (TOP3 반환을 위해)
                    // requestText가 빈 문자열이면 recommendLunch에서 TOP3 반환
                    
                    // 추천 API 호출 (Render에서는 API_BASE_URL 또는 RENDER_EXTERNAL_URL 사용)
                    const baseUrl = process.env.API_BASE_URL ||
                        process.env.RENDER_EXTERNAL_URL ||
                        `http://localhost:${process.env.PORT || 4000}`;
                    const recommendResponse = await axios.post(`${baseUrl}/lunch/recommend`, {
                        text: requestText || '', // 빈 문자열이면 빈 문자열로 전달
                        preset: [],
                        exclude: []
                    }, {
                        timeout: 30000 // 30초 타임아웃
                    });
                    
                    if (recommendResponse.data.success && recommendResponse.data.data && recommendResponse.data.data.length > 0) {
                        const recommendations = recommendResponse.data.data;
                        responseMessage = '🍽️ 점심 추천 결과\n\n';
                        
                        recommendations.forEach((item, index) => {
                            const emoji = index === 0 ? '1️⃣' : index === 1 ? '2️⃣' : '3️⃣';
                            responseMessage += `${emoji} ${item.name || '이름 없음'}\n`;
                            
                            if (item.reason) {
                                responseMessage += `📍 이유: ${item.reason}\n`;
                            }
                            
                            if (item.address_text) {
                                responseMessage += `📍 주소: ${item.address_text}\n`;
                            }
                            
                            if (item.naver_map_url) {
                                responseMessage += `🗺️ 지도: ${item.naver_map_url}\n`;
                            }
                            
                            if (item.category) {
                                responseMessage += `🏷️ 카테고리: ${item.category}\n`;
                            }
                            
                            if (item.walk_min) {
                                responseMessage += `🚶 도보: ${item.walk_min}분\n`;
                            }
                            
                            responseMessage += '\n';
                        });
                        
                        // 웹페이지 링크 추가
                        const lunchWebUrl = process.env.LUNCH_WEB_URL;
                        if (lunchWebUrl) {
                            responseMessage += `💻 더 많은 기능: ${lunchWebUrl}\n`;
                        }
                    } else {
                        responseMessage = '😔 추천 결과를 찾을 수 없습니다.\n\n다른 조건으로 다시 시도해보세요!';
                    }
                } catch (error) {
                    console.error('점심 추천 실패:', error.response?.data || error.message);
                    const detail = error.response?.data?.error || error.message || '';
                    responseMessage = '❌ 점심 추천 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.';
                    if (detail && detail.length < 80) {
                        responseMessage += `\n(${detail})`;
                    }
                }
                break;
            }
            case 'help': {
                await logUserAction('도움말', userId);
                responseMessage = `📱 대시보드 봇 사용법\n\n[일반 명령어] (/ prefix 사용)\n\n1. 리스크 이슈 조회\n   - \"/리스크\" 입력\n   - 오늘 등록된 리스크 뉴스 표시\n\n2. 제휴처 탐색\n   - \"/제휴\" 입력\n   - 오늘 등록된 제휴 정보 표시\n\n3. 신기술 동향\n   - \"/기술\" 입력\n   - 오늘 등록된 기술 뉴스 표시\n\n4. 일정 조회\n   - \"/일정\" 입력\n   - 월간 캘린더와 일정 목록 표시\n\n5. 뉴스 모니터링\n   - \"/뉴스\" 입력\n   - 모든 카테고리의 오늘의 뉴스 표시\n\n6. 점심 추천\n   - \"/점심 [요청]\" 입력\n   - 예: \"/점심 가까운 곳에서 혼밥 가능한 곳\"\n\n7. 도움말\n   - \"/도움말\" 입력\n   - 사용 가능한 명령어 목록 표시\n\n[관리자 명령어] (! prefix 사용)\n- !방이름 : 현재 방 이름 확인\n- !방추가 <방이름> : 방 등록\n- !방삭제 <방이름> : 방 삭제\n- !방업데이트 : 방 이름 변경 시 자동 업데이트\n- !방목록 : 등록된 방 목록\n- !상태 : 봇 상태 확인`;
                break;
            }
            default: {
                await logUserAction('기타', userId, { message: userMessage });
                const isPrefixCommand = /^[\/!]/.test(userMessage);
                responseMessage = isPrefixCommand
                    ? "해당하는 명령이 없습니다. 아래 명령어를 참고해 주세요.\n\n사용 가능한 명령어:\n- /리스크\n- /제휴\n- /기술\n- /일정\n- /뉴스\n- /점심 [요청]\n- /도움말\n\n관리자 명령어:\n- !방이름\n- !방추가\n- !방삭제\n- !방업데이트\n- !방목록\n- !상태"
                    : "안녕하세요! 대시보드 봇입니다. 👋\n\n사용 가능한 명령어:\n- /리스크\n- /제휴\n- /기술\n- /일정\n- /뉴스\n- /점심 [요청]\n- /도움말\n\n관리자 명령어:\n- !방이름\n- !방추가\n- !방삭제\n- !방업데이트\n- !방목록\n- !상태";
            }
        }
        
        if (typeof responseMessage === 'string') {
            responseMessage += "\n\n대시보드 바로가기: https://myteamdashboard.vercel.app/index.html";
        }
        // message와 response 둘 다 반환 (메신저봇R 등에서 response 필드를 쓰는 경우 대응)
        res.json({ message: responseMessage, response: responseMessage });
    } catch (error) {
        console.error('메시지 처리 실패:', error);
        res.status(500).json({ error: '메시지 처리 실패' });
    }
});

// 📰 오늘의 뉴스 요약 생성 함수
async function generateNewsSummary() {
    let summary = '📰 오늘의 뉴스 요약\n';
    try {
        // 리스크 이슈 뉴스
        const riskNewsResponse = await axios.get(`${process.env.API_BASE_URL}/api/risk-news`);
        const todayRiskNews = await filterTodayNews(riskNewsResponse.data.data);
        
        // 제휴처 탐색 뉴스
        const partnerNewsResponse = await axios.get(`${process.env.API_BASE_URL}/api/partner-news`);
        const todayPartnerNews = await filterTodayNews(partnerNewsResponse.data.data);
        
        // 신기술 동향 뉴스
        const techNewsResponse = await axios.get(`${process.env.API_BASE_URL}/api/tech-news`);
        const todayTechNews = await filterTodayNews(techNewsResponse.data.data);
        
        summary += `- 리스크 이슈: ${todayRiskNews.length}건\n`;
        summary += `- 제휴처 탐색: ${todayPartnerNews.length}건\n`;
        summary += `- 신기술 동향: ${todayTechNews.length}건\n\n`;
        
        // 리스크 이슈 AI 분석보고서 (먼저 표시)
        if (riskNewsResponse.data.analysisReport && riskNewsResponse.data.analysisReport.analysis) {
            summary += '📰 리스크 이슈\n';
            summary += '🤖 AI 분석보고서\n';
            summary += '━━━━━━━━━━━━━━━━━━━━\n';
            summary += formatAnalysisText(riskNewsResponse.data.analysisReport.analysis);
            summary += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
        }
        
        // 리스크 이슈 뉴스 상세 (AI 분석보고서 후에 표시)
        if (todayRiskNews.length > 0) {
            summary += '[리스크 이슈 주요 뉴스]\n';
            todayRiskNews.forEach((news, idx) => {
                summary += `${idx + 1}. ${cleanHtml(news.title)}\n`;
                summary += `   ${news.link}\n`;
            });
            summary += '\n';
        }
        
        // 제휴처 탐색 AI 분석보고서 (먼저 표시)
        if (partnerNewsResponse.data.analysisReport && partnerNewsResponse.data.analysisReport.analysis) {
            summary += '🤝 제휴처 탐색\n';
            summary += '🤖 AI 분석보고서\n';
            summary += '━━━━━━━━━━━━━━━━━━━━\n';
            summary += formatAnalysisText(partnerNewsResponse.data.analysisReport.analysis);
            summary += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
        }
        
        // 제휴처 탐색 뉴스 상세 (AI 분석보고서 후에 표시)
        if (todayPartnerNews.length > 0) {
            summary += '[제휴처 탐색 주요 뉴스]\n';
            todayPartnerNews.forEach((news, idx) => {
                summary += `${idx + 1}. ${cleanHtml(news.title)}\n`;
                summary += `   ${news.link}\n`;
            });
            summary += '\n';
        }
        
        // 신기술 동향 AI 분석보고서 (먼저 표시)
        if (techNewsResponse.data.analysisReport && techNewsResponse.data.analysisReport.analysis) {
            summary += '🔬 신기술 동향\n';
            summary += '🤖 AI 분석보고서\n';
            summary += '━━━━━━━━━━━━━━━━━━━━\n';
            summary += formatAnalysisText(techNewsResponse.data.analysisReport.analysis);
            summary += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
        }
        
        // 신기술 동향 뉴스 상세 (AI 분석보고서 후에 표시)
        if (todayTechNews.length > 0) {
            summary += '[신기술 동향 주요 뉴스]\n';
            todayTechNews.forEach((news, idx) => {
                summary += `${idx + 1}. ${cleanHtml(news.title)}\n`;
                summary += `   ${news.link}\n`;
            });
            summary += '\n';
        }
    } catch (error) {
        console.error('뉴스 요약 생성 중 에러 발생:', error);
        summary += '\n뉴스 데이터를 가져오는 중 오류가 발생했습니다.';
    }
    return summary;
}

module.exports = router; 