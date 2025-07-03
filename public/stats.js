const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

const periodSelect = document.getElementById('periodSelect');
const typeSelect = document.getElementById('typeSelect');
const downloadBtn = document.getElementById('downloadBtn');
const statsTableBody = document.querySelector('#statsTable tbody');
let chart;

function getPeriodRange(period) {
    const now = new Date();
    let start, end;
    if (period === 'day') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (period === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
        start = null;
        end = null;
    }
    return { start, end };
}

async function fetchStats() {
    const period = periodSelect.value;
    const type = typeSelect.value;
    const { start, end } = getPeriodRange(period);
    let url = `${API_BASE_URL}/api/stats/summary?`;
    if (start) url += `start=${start.toISOString()}&`;
    if (end) url += `end=${end.toISOString()}&`;
    if (type !== 'all') url += `type=${type}`;
    const res = await fetch(url);
    return await res.json();
}

function renderTable(data) {
    statsTableBody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row._id.type}</td><td>${row._id.action}</td><td>${row.count}</td>`;
        statsTableBody.appendChild(tr);
    });
}

function renderChart(data) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    const labels = data.map(row => row._id.action);
    const counts = data.map(row => row.count);
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '건수',
                data: counts,
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

async function updateStats() {
    const data = await fetchStats();
    renderTable(data);
    renderChart(data);
}

async function fetchVisitStats() {
    const res = await fetch(`${API_BASE_URL}/api/stats/visit`);
    return await res.json();
}

async function updateVisitStats() {
    const data = await fetchVisitStats();
    document.getElementById('visitToday').textContent = data.today ?? '-';
    document.getElementById('visitMonth').textContent = data.month ?? '-';
    document.getElementById('visitTotal').textContent = data.total ?? '-';
}

periodSelect.addEventListener('change', updateStats);
typeSelect.addEventListener('change', updateStats);
window.addEventListener('DOMContentLoaded', () => {
    updateStats();
    updateVisitStats();
});

downloadBtn.addEventListener('click', async () => {
    const data = await fetchStats();
    let csv = '구분,명령어/액션,건수\n';
    data.forEach(row => {
        csv += `${row._id.type},${row._id.action},${row.count}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stats.csv';
    a.click();
    URL.revokeObjectURL(url);
}); 