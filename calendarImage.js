const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const Schedule = require('./models/Schedule');

const IMAGE_DIR = path.join(__dirname, 'calendar_images');
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

// 한국시간 기준 문자열 반환
function getKoreaNowString() {
    const now = new Date();
    const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = korea.getFullYear();
    const mm = String(korea.getMonth() + 1).padStart(2, '0');
    const dd = String(korea.getDate()).padStart(2, '0');
    const hh = String(korea.getHours()).padStart(2, '0');
    const min = String(korea.getMinutes()).padStart(2, '0');
    const ss = String(korea.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

// 최신 일정 등록 시각(한국시간 기준) 반환
async function getLatestScheduleTime() {
    const latest = await Schedule.findOne().sort({ createdAt: -1 });
    if (!latest) return null;
    const korea = new Date(latest.createdAt.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = korea.getFullYear();
    const mm = String(korea.getMonth() + 1).padStart(2, '0');
    const dd = String(korea.getDate()).padStart(2, '0');
    const hh = String(korea.getHours()).padStart(2, '0');
    const min = String(korea.getMinutes()).padStart(2, '0');
    const ss = String(korea.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

// 가장 최근 생성된 이미지 파일명 반환
function getLatestCalendarImageFile() {
    const files = fs.readdirSync(IMAGE_DIR).filter(f => f.startsWith('calendar_') && f.endsWith('.png'));
    if (files.length === 0) return null;
    files.sort();
    return files[files.length - 1];
}

// 달력 이미지 생성
function generateCalendarImage(year, month, schedules, filename) {
    const width = 400, height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${year}년 ${month + 1}월`, 20, 30);
    ctx.font = '16px sans-serif';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach((d, i) => ctx.fillText(d, 20 + i * 50, 60));
    let day = 1;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let w = 0; w < 6; w++) {
        for (let d = 0; d < 7; d++) {
            const x = 20 + d * 50;
            const y = 90 + w * 30;
            if (w === 0 && d < firstDay) continue;
            if (day > daysInMonth) break;
            ctx.fillStyle = '#222';
            ctx.fillText(day, x, y);
            day++;
        }
    }
    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(IMAGE_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

// 메인: 최신 일정 등록 시각 이후에만 새 이미지 생성, 아니면 기존 이미지 반환
async function getOrCreateCalendarImage(year, month) {
    const latestScheduleTime = await getLatestScheduleTime();
    const latestImageFile = getLatestCalendarImageFile();
    let needNew = true;
    if (latestImageFile && latestScheduleTime) {
        const imageTime = latestImageFile.split('_')[1].replace('.png', '');
        if (imageTime >= latestScheduleTime) needNew = false;
    }
    if (needNew) {
        const schedules = await Schedule.find({
            start: {
                $gte: new Date(year, month, 1),
                $lt: new Date(year, month + 1, 1)
            }
        });
        const filename = `calendar_${getKoreaNowString()}.png`;
        return generateCalendarImage(year, month, schedules, filename);
    } else {
        return path.join(IMAGE_DIR, latestImageFile);
    }
}

module.exports = { getOrCreateCalendarImage }; 