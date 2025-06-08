const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getOrCreateCalendarImage } = require('./calendarImage');
const { RiskNews, PartnerNews, TechNews } = require('./models');

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

// 메시지 라우팅
function routeMessage(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
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

// 오늘 날짜의 뉴스만 필터링 (extractDate 사용)
async function filterTodayNews(news) {
    const today = await getKoreaToday();
    return news.filter(item => {
        if (!item.pubDate) return false;
        const extracted = extractDate(item.pubDate);
        return extracted === today;
    });
}

// 연도별 공휴일 데이터 가져오기 (공공데이터포털)
async function fetchHolidays(year) {
    try {
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&_type=json&numOfRows=100`;
        const response = await axios.get(url);
        const data = response.data;
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

// 메시지 처리 엔드포인트
router.post('/message', async (req, res) => {
    try {
        // 요청 로그 추가
        console.log('[카카오봇] /kakao/message 요청:', req.body);
        const { message } = req.body;
        const route = routeMessage(message);
        let responseMessage = '';
        
        switch (route) {
            case 'auto_announce': {
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
                // ③ 오늘 뉴스 요약
                const newsSummary = await generateNewsSummary();
                // 최종 조합 (3000자 제한 없음)
                responseMessage = '📢 금일일정 및 뉴스\n\n';
                responseMessage += textCalendar + '\n';
                responseMessage += detailList + '\n';
                responseMessage += newsSummary + '\n';
                responseMessage += '\n대시보드 바로가기: https://myteamdashboard.vercel.app/index.html';
                break;
            }
            case 'risk':
                const [riskNews, riskKeywords] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/risk-keywords`)
                ]);
                
                const todayRiskNews = await filterTodayNews(riskNews.data);
                
                responseMessage = "📰 리스크 이슈 뉴스\n\n";
                responseMessage += "🔍 검색 키워드:\n";
                riskKeywords.data.forEach(keyword => {
                    responseMessage += `- ${keyword.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayRiskNews.length}건\n\n`;
                
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
                
            case 'partner':
                const [partnerNews, partnerConditions] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/partner-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/partner-conditions`)
                ]);
                
                const todayPartnerNews = await filterTodayNews(partnerNews.data);
                
                responseMessage = "🤝 제휴처 탐색 결과\n\n";
                responseMessage += "🔍 검색 조건:\n";
                partnerConditions.data.forEach(condition => {
                    responseMessage += `- ${condition.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 정보: ${todayPartnerNews.length}건\n\n`;
                
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
                
            case 'tech':
                const [techNews, techTopics] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/tech-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/tech-topics`)
                ]);
                
                const todayTechNews = await filterTodayNews(techNews.data);
                
                responseMessage = "🔬 신기술 동향\n\n";
                responseMessage += "🔍 검색 주제:\n";
                techTopics.data.forEach(topic => {
                    responseMessage += `- ${topic.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayTechNews.length}건\n\n`;
                
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
                
            case 'schedule':
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
                
            case 'all':
                const [allRiskNews, allPartnerNews, allTechNews] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/partner-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/tech-news`)
                ]);
                
                const todayAllRiskNews = await filterTodayNews(allRiskNews.data);
                const todayAllPartnerNews = await filterTodayNews(allPartnerNews.data);
                const todayAllTechNews = await filterTodayNews(allTechNews.data);
                
                responseMessage = "📰 오늘의 뉴스 모니터링\n\n";
                responseMessage += "📊 뉴스 현황\n";
                responseMessage += `- 리스크 이슈: ${todayAllRiskNews.length}건\n`;
                responseMessage += `- 제휴처 탐색: ${todayAllPartnerNews.length}건\n`;
                responseMessage += `- 신기술 동향: ${todayAllTechNews.length}건\n\n`;
                
                if (todayAllRiskNews.length > 0) {
                    responseMessage += "📰 리스크 이슈\n";
                    todayAllRiskNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                if (todayAllPartnerNews.length > 0) {
                    responseMessage += "\n🤝 제휴처 탐색\n";
                    todayAllPartnerNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                if (todayAllTechNews.length > 0) {
                    responseMessage += "\n🔬 신기술 동향\n";
                    todayAllTechNews.slice(0, 3).forEach((item, index) => {
                        const cleanTitle = cleanHtml(item.title);
                        responseMessage += `[${index + 1}] ${cleanTitle}\n`;
                        if (item.link) responseMessage += `🔗 ${item.link}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                break;
                
            case 'help':
                responseMessage = `📱 대시보드 봇 사용법\n\n1. 리스크 이슈 조회\n   - \"리스크\" 입력\n   - 검색 키워드 기반 필터링\n   - 오늘 등록된 뉴스만 표시\n\n2. 제휴처 탐색\n   - \"제휴\" 입력\n   - 검색 조건 기반 필터링\n   - 오늘 등록된 정보만 표시\n\n3. 신기술 동향\n   - \"기술\" 입력\n   - 검색 주제 기반 필터링\n   - 오늘 등록된 뉴스만 표시\n\n4. 일정 조회\n   - \"일정\" 입력\n   - 월간 캘린더와 일정 목록 표시\n   - 오늘 이후의 일정만 표시\n\n5. 뉴스 모니터링\n   - \"뉴스\" 입력\n   - 모든 카테고리의 오늘의 뉴스 표시\n   - 카테고리별 최신 3개 뉴스 표시\n\n6. 도움말\n   - \"도움말\" 입력\n   - 사용 가능한 명령어 목록 표시`;
                break;
                
            default:
                responseMessage = "안녕하세요! 대시보드 봇입니다. 👋\n\n사용 가능한 명령어:\n- 리스크\n- 제휴\n- 기술\n- 일정\n- 뉴스\n- 도움말";
        }
        
        // 메시지 반환만 수행
        // 모든 응답 메시지 마지막에 대시보드 링크 추가
        if (typeof responseMessage === 'string') {
            responseMessage += "\n\n대시보드 바로가기: https://myteamdashboard.vercel.app/index.html";
        }
        res.json({ message: responseMessage });
    } catch (error) {
        console.error('메시지 처리 실패:', error);
        res.status(500).json({ error: '메시지 처리 실패' });
    }
});

async function generateNewsSummary() {
    const today = await getKoreaToday();
    let summary = '📰 오늘의 뉴스 요약\n';
    
    // 리스크 이슈 뉴스
    const riskNews = await RiskNews.find({
        pubDate: { $regex: new RegExp(today.replace(/-/g, '\\. ')) }
    });
    
    // 제휴처 탐색 뉴스
    const partnerNews = await PartnerNews.find({
        pubDate: { $regex: new RegExp(today.replace(/-/g, '\\. ')) }
    });
    
    // 신기술 동향 뉴스
    const techNews = await TechNews.find({
        pubDate: { $regex: new RegExp(today.replace(/-/g, '\\. ')) }
    });
    
    summary += `- 리스크 이슈: ${riskNews.length}건\n`;
    summary += `- 제휴처 탐색: ${partnerNews.length}건\n`;
    summary += `- 신기술 동향: ${techNews.length}건\n\n`;
    
    // 리스크 이슈 뉴스 상세
    if (riskNews.length > 0) {
        summary += '[리스크 이슈 주요 뉴스]\n';
        riskNews.slice(0, 3).forEach((news, idx) => {
            summary += `${idx + 1}. ${news.title}\n`;
            summary += `   ${news.link}\n`;
        });
        summary += '\n';
    }
    
    // 제휴처 탐색 뉴스 상세
    if (partnerNews.length > 0) {
        summary += '[제휴처 탐색 주요 뉴스]\n';
        partnerNews.slice(0, 3).forEach((news, idx) => {
            summary += `${idx + 1}. ${news.title}\n`;
            summary += `   ${news.link}\n`;
        });
        summary += '\n';
    }
    
    // 신기술 동향 뉴스 상세
    if (techNews.length > 0) {
        summary += '[신기술 동향 주요 뉴스]\n';
        techNews.slice(0, 3).forEach((news, idx) => {
            summary += `${idx + 1}. ${news.title}\n`;
            summary += `   ${news.link}\n`;
        });
        summary += '\n';
    }
    
    return summary;
}

module.exports = router; 