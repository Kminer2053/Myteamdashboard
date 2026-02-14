// API 기본 URL 설정
const API_BASE_URL = window.API_BASE_URL || 'https://myteamdashboard.onrender.com';

// 전역 상태
let selectedPresets = [];
let excludedPlaces = [];

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRecommend();
    initList();
    initRegister();
    loadPlaces();
});

// 탭 전환
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 탭 버튼 활성화
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 탭 콘텐츠 표시
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// 추천 기능 초기화
function initRecommend() {
    const recommendBtn = document.getElementById('recommend-btn');
    const chips = document.querySelectorAll('.chip');
    
    // 프리셋 칩 선택
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const preset = chip.getAttribute('data-preset');
            chip.classList.toggle('active');
            
            if (chip.classList.contains('active')) {
                if (!selectedPresets.includes(preset)) {
                    selectedPresets.push(preset);
                }
            } else {
                selectedPresets = selectedPresets.filter(p => p !== preset);
            }
        });
    });
    
    // 추천 버튼 클릭
    recommendBtn.addEventListener('click', async () => {
        const text = document.getElementById('recommend-text').value.trim();
        
        if (!text) {
            showToast('추천 요청을 입력해주세요.');
            return;
        }
        
        await requestRecommendation(text, selectedPresets, excludedPlaces);
    });
}

// 추천 요청
async function requestRecommendation(text, preset = [], exclude = []) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                preset: preset,
                exclude: exclude
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            displayRecommendations(data.data);
        } else {
            showToast('추천 결과를 찾을 수 없습니다.');
            document.getElementById('recommend-results').innerHTML = 
                '<div class="empty-state"><div class="empty-state-icon">😔</div><div class="empty-state-text">추천 결과가 없습니다</div></div>';
        }
    } catch (error) {
        console.error('추천 요청 실패:', error);
        showToast('추천 요청 중 오류가 발생했습니다.');
    } finally {
        showLoading(false);
    }
}

// 추천 결과 표시
function displayRecommendations(recommendations) {
    const resultsContainer = document.getElementById('recommend-results');
    
    if (recommendations.length === 0) {
        resultsContainer.innerHTML = 
            '<div class="empty-state"><div class="empty-state-icon">😔</div><div class="empty-state-text">추천 결과가 없습니다</div></div>';
        return;
    }
    
    resultsContainer.innerHTML = recommendations.map((place, index) => {
        const rankEmoji = index === 0 ? '1️⃣' : index === 1 ? '2️⃣' : '3️⃣';
        
        return `
            <div class="place-card">
                <div class="place-card-header">
                    <div>
                        <div class="place-name">${rankEmoji} ${escapeHtml(place.name || '이름 없음')}</div>
                    </div>
                    <div class="place-rank">${index + 1}위</div>
                </div>
                ${place.reason ? `<div class="place-reason">📍 ${escapeHtml(place.reason)}</div>` : ''}
                <div class="place-info">
                    ${place.address_text ? `<div class="place-info-item">📍 ${escapeHtml(place.address_text)}</div>` : ''}
                    ${place.category ? `<div class="place-info-item">🏷️ ${escapeHtml(place.category)}</div>` : ''}
                    ${place.price_level ? `<div class="place-info-item">💰 ${escapeHtml(place.price_level)}</div>` : ''}
                    ${place.walk_min ? `<div class="place-info-item">🚶 도보 ${place.walk_min}분</div>` : ''}
                    ${place.tags ? `<div class="place-info-item"># ${escapeHtml(place.tags)}</div>` : ''}
                </div>
                <div class="place-actions">
                    ${place.naver_map_url ? `<button class="btn-secondary" onclick="openMap('${escapeHtml(place.naver_map_url)}')">🗺️ 지도 열기</button>` : ''}
                    <button class="btn-secondary btn-exclude" onclick="excludePlace('${place.place_id}')">제외</button>
                </div>
            </div>
        `;
    }).join('');
}

// 지도 열기
function openMap(url) {
    window.open(url, '_blank');
}

// 장소 제외
function excludePlace(placeId) {
    if (!excludedPlaces.includes(placeId)) {
        excludedPlaces.push(placeId);
    }
    
    const text = document.getElementById('recommend-text').value.trim();
    if (text) {
        requestRecommendation(text, selectedPresets, excludedPlaces);
    }
    
    showToast('제외 목록에 추가되었습니다.');
}

// 목록 기능 초기화
function initList() {
    const searchInput = document.getElementById('search-input');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterPlaces(query);
    });
}

// 장소 목록 로드
async function loadPlaces() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/places`);
        const data = await response.json();
        
        if (data.success && data.data) {
            window.allPlaces = data.data;
            displayPlaces(data.data);
        } else {
            showToast('장소 목록을 불러오는데 실패했습니다.');
        }
    } catch (error) {
        console.error('장소 목록 로드 실패:', error);
        showToast('장소 목록을 불러오는데 실패했습니다.');
    } finally {
        showLoading(false);
    }
}

// 장소 목록 표시
function displayPlaces(places) {
    const placesList = document.getElementById('places-list');
    
    if (places.length === 0) {
        placesList.innerHTML = 
            '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">등록된 장소가 없습니다</div></div>';
        return;
    }
    
    placesList.innerHTML = places.map(place => `
        <div class="place-card">
            <div class="place-card-header">
                <div class="place-name">${escapeHtml(place.name || '이름 없음')}</div>
            </div>
            <div class="place-info">
                ${place.address_text ? `<div class="place-info-item">📍 ${escapeHtml(place.address_text)}</div>` : ''}
                ${place.category ? `<div class="place-info-item">🏷️ ${escapeHtml(place.category)}</div>` : ''}
                ${place.price_level ? `<div class="place-info-item">💰 ${escapeHtml(place.price_level)}</div>` : ''}
                ${place.walk_min ? `<div class="place-info-item">🚶 도보 ${place.walk_min}분</div>` : ''}
                ${place.tags ? `<div class="place-info-item"># ${escapeHtml(place.tags)}</div>` : ''}
            </div>
            <div class="place-actions">
                ${place.naver_map_url ? `<button class="btn-secondary" onclick="openMap('${escapeHtml(place.naver_map_url)}')">🗺️ 지도 열기</button>` : ''}
            </div>
        </div>
    `).join('');
}

// 장소 필터링
function filterPlaces(query) {
    if (!window.allPlaces) return;
    
    const filtered = window.allPlaces.filter(place => {
        const name = (place.name || '').toLowerCase();
        const address = (place.address_text || '').toLowerCase();
        const category = (place.category || '').toLowerCase();
        const tags = (place.tags || '').toLowerCase();
        
        return name.includes(query) || 
               address.includes(query) || 
               category.includes(query) || 
               tags.includes(query);
    });
    
    displayPlaces(filtered);
}

// 등록 기능 초기화 (2단계: URL 자동 채우기 -> 확인/수정 후 등록)
function initRegister() {
    const form = document.getElementById('place-form');
    const step1 = document.getElementById('register-step1');
    const step2 = document.getElementById('register-step2');
    const btnAutoFill = document.getElementById('btn-auto-fill');
    const btnManualEntry = document.getElementById('btn-manual-entry');
    const inputNaverUrl = document.getElementById('place-naver-url');

    btnAutoFill.addEventListener('click', () => scrapeNaverAndFillForm());
    btnManualEntry.addEventListener('click', () => {
        step1.style.display = 'none';
        step2.style.display = 'block';
        clearPlaceForm();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPlace();
    });
}

// 네이버 지도 URL로 정보 크롤링 후 폼 채우기
async function scrapeNaverAndFillForm() {
    const urlInput = document.getElementById('place-naver-url');
    const url = (urlInput && urlInput.value) ? urlInput.value.trim() : '';
    if (!url) {
        showToast('네이버 지도 URL을 입력해 주세요.');
        return;
    }
    if (!url.includes('naver') && !url.includes('map.naver')) {
        showToast('네이버 지도 URL을 입력해 주세요.');
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/scrape-naver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ naverMapUrl: url })
        });
        const result = await response.json();
        if (result.success && result.data) {
            fillPlaceForm(result.data);
            document.getElementById('place-map-url').value = result.data.naver_map_url || url;
            document.getElementById('register-step1').style.display = 'none';
            document.getElementById('register-step2').style.display = 'block';
            showToast('정보를 불러왔습니다. 확인 후 등록하세요.');
        } else {
            showToast(result.error || '정보를 가져오지 못했습니다.');
            if (result.manualEntry) {
                document.getElementById('btn-manual-entry').click();
            }
        }
    } catch (err) {
        console.error('scrape-naver error:', err);
        showToast('연결에 실패했습니다. 수동 입력을 이용해 주세요.');
        document.getElementById('btn-manual-entry').click();
    } finally {
        showLoading(false);
    }
}

function fillPlaceForm(data) {
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value != null ? value : '';
    };
    const setCheck = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!value;
    };
    set('place-name', data.name);
    set('place-address', data.address_text);
    set('place-map-url', data.naver_map_url);
    set('place-category', data.category || '');
    set('place-price', data.price_level || '');
    set('place-walk', data.walk_min != null ? data.walk_min : 0);
    set('place-tags', data.tags || '');
    setCheck('place-solo', data.solo_ok);
    setCheck('place-group', data.group_ok);
    setCheck('place-indoor', data.indoor_ok);
}

function clearPlaceForm() {
    fillPlaceForm({
        name: '', address_text: '', naver_map_url: '', category: '', price_level: '',
        walk_min: 0, tags: '', solo_ok: false, group_ok: false, indoor_ok: false
    });
}

// 장소 등록
async function submitPlace() {
    const formData = {
        name: document.getElementById('place-name').value.trim(),
        address_text: document.getElementById('place-address').value.trim(),
        naver_map_url: document.getElementById('place-map-url').value.trim(),
        category: document.getElementById('place-category').value,
        price_level: document.getElementById('place-price').value,
        walk_min: parseInt(document.getElementById('place-walk').value) || 0,
        solo_ok: document.getElementById('place-solo').checked,
        group_ok: document.getElementById('place-group').checked,
        indoor_ok: document.getElementById('place-indoor').checked,
        tags: document.getElementById('place-tags').value.trim()
    };
    
    if (!formData.name || !formData.address_text) {
        showToast('이름과 주소는 필수 항목입니다.');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/places`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('장소가 등록되었습니다.');
            document.getElementById('place-form').reset();
            // 등록 탭 2단계 -> 1단계로 초기화
            const step1 = document.getElementById('register-step1');
            const step2 = document.getElementById('register-step2');
            const urlInput = document.getElementById('place-naver-url');
            if (step1 && step2) {
                step1.style.display = 'block';
                step2.style.display = 'none';
            }
            if (urlInput) urlInput.value = '';
            loadPlaces();
            document.querySelector('[data-tab="list-tab"]').click();
        } else {
            showToast('등록에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('장소 등록 실패:', error);
        showToast('등록 중 오류가 발생했습니다.');
    } finally {
        showLoading(false);
    }
}

// 로딩 표시
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
}

// 토스트 메시지 표시
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 전역 함수로 노출 (HTML에서 호출)
window.openMap = openMap;
window.excludePlace = excludePlace;
