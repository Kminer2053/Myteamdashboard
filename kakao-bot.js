const express = require('express');
const router = express.Router();
const axios = require('axios');

// 카카오톡 봇 설정
const KAKAO_BOT_TOKEN = process.env.KAKAO_BOT_TOKEN;
const KAKAO_BOT_SECRET = process.env.KAKAO_BOT_SECRET;

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

// 한국시간 기준 오늘 날짜 구하기
function getKoreaToday() {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return koreaTime.toISOString().split('T')[0];
}

// 오늘 날짜의 뉴스만 필터링
function filterTodayNews(news) {
    const today = getKoreaToday();
    return news.filter(item => item.pubDate.startsWith(today));
}

// 캘린더 생성 함수
function generateCalendar(year, month, schedules) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const schedulesByDate = {};
    schedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.start);
        if (scheduleDate.getMonth() === month && scheduleDate.getFullYear() === year) {
            const day = scheduleDate.getDate();
            if (!schedulesByDate[day]) {
                schedulesByDate[day] = [];
            }
            schedulesByDate[day].push(schedule);
        }
    });
    
    let calendar = `📅 ${year}년 ${month + 1}월\n\n`;
    calendar += "일  월  화  수  목  금  토\n";
    
    let day = 1;
    for (let i = 0; i < 6; i++) {
        let week = "";
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startingDay) {
                week += "    ";
            } else if (day > daysInMonth) {
                break;
            } else {
                const currentDate = new Date(year, month, day);
                const isToday = currentDate.toDateString() === new Date().toDateString();
                const hasSchedule = schedulesByDate[day] && schedulesByDate[day].length > 0;
                
                if (hasSchedule) {
                    week += isToday ? `[●${day}]` : `●${day} `;
                } else {
                    week += isToday ? `[${day}] ` : `${day}  `;
                }
                day++;
            }
        }
        calendar += week + "\n";
    }
    
    calendar += "\n● : 일정 있음";
    return calendar;
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

// 메시지 처리 엔드포인트
router.post('/message', async (req, res) => {
    try {
        // 요청 로그 추가
        console.log('[카카오봇] /kakao/message 요청:', req.body);
        const { message } = req.body;
        const route = routeMessage(message);
        let responseMessage = '';
        
        switch (route) {
            case 'risk':
                const [riskNews, riskKeywords] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/risk-keywords`)
                ]);
                
                const todayRiskNews = filterTodayNews(riskNews.data);
                
                responseMessage = "📰 리스크 이슈 뉴스\n\n";
                responseMessage += "🔍 검색 키워드:\n";
                riskKeywords.data.forEach(keyword => {
                    responseMessage += `- ${keyword.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayRiskNews.length}건\n\n`;
                
                if (todayRiskNews.length > 0) {
                    todayRiskNews.forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
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
                
                const todayPartnerNews = filterTodayNews(partnerNews.data);
                
                responseMessage = "🤝 제휴처 탐색 결과\n\n";
                responseMessage += "🔍 검색 조건:\n";
                partnerConditions.data.forEach(condition => {
                    responseMessage += `- ${condition.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 정보: ${todayPartnerNews.length}건\n\n`;
                
                if (todayPartnerNews.length > 0) {
                    todayPartnerNews.forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
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
                
                const todayTechNews = filterTodayNews(techNews.data);
                
                responseMessage = "🔬 신기술 동향\n\n";
                responseMessage += "🔍 검색 주제:\n";
                techTopics.data.forEach(topic => {
                    responseMessage += `- ${topic.value}\n`;
                });
                responseMessage += `\n📊 오늘 등록된 뉴스: ${todayTechNews.length}건\n\n`;
                
                if (todayTechNews.length > 0) {
                    todayTechNews.forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
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
                
                const futureSchedules = schedules.data.filter(s => new Date(s.start) >= scheduleDate);
                
                responseMessage = generateCalendar(currentYear, currentMonth, schedules.data);
                responseMessage += "\n\n📅 상세 일정 목록 (오늘 이후)\n\n";
                
                if (futureSchedules.length === 0) {
                    responseMessage += "등록된 일정이 없습니다.";
                } else {
                    responseMessage += `총 ${futureSchedules.length}개의 일정이 있습니다.\n\n`;
                    futureSchedules.forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
                        responseMessage += `⏰ ${formatKST(item.start)}\n`;
                        if (item.description) {
                            responseMessage += `📝 ${item.description}\n`;
                        }
                        responseMessage += '\n';
                    });
                }
                break;
                
            case 'all':
                const [allRiskNews, allPartnerNews, allTechNews] = await Promise.all([
                    axios.get(`${process.env.API_BASE_URL}/api/risk-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/partner-news`),
                    axios.get(`${process.env.API_BASE_URL}/api/tech-news`)
                ]);
                
                const todayStr = getKoreaToday();
                const todayAllRiskNews = allRiskNews.data.filter(item => item.pubDate.startsWith(todayStr));
                const todayAllPartnerNews = allPartnerNews.data.filter(item => item.pubDate.startsWith(todayStr));
                const todayAllTechNews = allTechNews.data.filter(item => item.pubDate.startsWith(todayStr));
                
                responseMessage = "📰 오늘의 뉴스 모니터링\n\n";
                responseMessage += "📊 뉴스 현황\n";
                responseMessage += `- 리스크 이슈: ${todayAllRiskNews.length}건\n`;
                responseMessage += `- 제휴처 탐색: ${todayAllPartnerNews.length}건\n`;
                responseMessage += `- 신기술 동향: ${todayAllTechNews.length}건\n\n`;
                
                if (todayAllRiskNews.length > 0) {
                    responseMessage += "📰 리스크 이슈\n";
                    todayAllRiskNews.slice(0, 3).forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                if (todayAllPartnerNews.length > 0) {
                    responseMessage += "\n🤝 제휴처 탐색\n";
                    todayAllPartnerNews.slice(0, 3).forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
                        responseMessage += `📅 ${formatKST(item.pubDate)}\n\n`;
                    });
                }
                
                if (todayAllTechNews.length > 0) {
                    responseMessage += "\n🔬 신기술 동향\n";
                    todayAllTechNews.slice(0, 3).forEach((item, index) => {
                        responseMessage += `[${index + 1}] ${item.title}\n`;
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
        res.json({ message: responseMessage });
    } catch (error) {
        console.error('메시지 처리 실패:', error);
        res.status(500).json({ error: '메시지 처리 실패' });
    }
});

module.exports = router; 