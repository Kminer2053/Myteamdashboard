import './styles.css';
const API_BASE_URL = import.meta.env.VITE_API_URL;

document.addEventListener('DOMContentLoaded', function() {
    let isAuthenticated = false;
    const passwordModal = new bootstrap.Modal(document.getElementById('adminPwModal'));
    
    // 페이지 로드 시 비밀번호 확인 모달 표시
    passwordModal.show();

    // 비밀번호 확인 (폼 submit 이벤트로 변경)
    document.getElementById('adminPwForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const passwordInput = document.getElementById('adminPwInput');
        if (passwordInput.value === 'admin123') { // 실제로는 더 안전한 인증 방식 사용 필요
            isAuthenticated = true;
            passwordModal.hide();
            document.querySelectorAll('.input-group').forEach(group => {
                group.style.display = 'flex';
            });
            updateList('riskKeywords', riskKeywordsList);
            updateList('partnerConditions', partnerConditionsList);
            updateList('techTopics', techTopicsList);
        } else {
            alert('비밀번호가 일치하지 않습니다.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // 모달이 닫힐 때 메인 페이지로 리다이렉트
    document.getElementById('adminPwModal').addEventListener('hidden.bs.modal', function() {
        if (!isAuthenticated) {
            window.location.href = 'index.html';
        }
    });

    // 리스크 이슈 키워드 관리
    const riskKeywordInput = document.getElementById('riskKeywordInput');
    const addRiskKeywordBtn = document.getElementById('addRiskKeyword');
    const riskKeywordsList = document.getElementById('riskKeywordsList');

    addRiskKeywordBtn.addEventListener('click', function() {
        if (!isAuthenticated) {
            return;
        }
        const keyword = riskKeywordInput.value.trim();
        if (keyword) {
            addItem('riskKeywords', keyword, riskKeywordsList);
            riskKeywordInput.value = '';
        }
    });

    // 제휴처 탐색 조건 관리
    const partnerConditionInput = document.getElementById('partnerConditionInput');
    const addPartnerConditionBtn = document.getElementById('addPartnerCondition');
    const partnerConditionsList = document.getElementById('partnerConditionsList');

    addPartnerConditionBtn.addEventListener('click', function() {
        if (!isAuthenticated) {
            return;
        }
        const condition = partnerConditionInput.value.trim();
        if (condition) {
            addItem('partnerConditions', condition, partnerConditionsList);
            partnerConditionInput.value = '';
        }
    });

    // 신기술 동향 주제 관리
    const techTopicInput = document.getElementById('techTopicInput');
    const addTechTopicBtn = document.getElementById('addTechTopic');
    const techTopicsList = document.getElementById('techTopicsList');

    addTechTopicBtn.addEventListener('click', function() {
        if (!isAuthenticated) {
            return;
        }
        const topic = techTopicInput.value.trim();
        if (topic) {
            addItem('techTopics', topic, techTopicsList);
            techTopicInput.value = '';
        }
    });

    // 공통 함수: 항목 추가 (서버 연동)
    async function addItem(storageKey, value, listElement) {
        if (storageKey === 'riskKeywords') {
            await addKeyword(value);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'partnerConditions') {
            await addPartnerCondition(value);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'techTopics') {
            await addTechTopic(value);
            await updateList(storageKey, listElement);
        }
    }

    // 공통 함수: 항목 삭제 (서버 연동)
    async function removeItem(storageKey, value, listElement) {
        if (storageKey === 'riskKeywords') {
            const keywords = await loadKeywords();
            const item = keywords.find(k => k.value === value);
            if (item) await deleteKeyword(item._id);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'partnerConditions') {
            const conds = await loadPartnerConditions();
            const item = conds.find(c => c.value === value);
            if (item) await deletePartnerCondition(item._id);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'techTopics') {
            const topics = await loadTechTopics();
            const item = topics.find(t => t.value === value);
            if (item) await deleteTechTopic(item._id);
            await updateList(storageKey, listElement);
        }
    }

    // 공통 함수: 목록 업데이트 (서버 연동)
    async function updateList(storageKey, listElement) {
        let items = [];
        if (storageKey === 'riskKeywords') {
            items = await loadKeywords();
        } else if (storageKey === 'partnerConditions') {
            items = await loadPartnerConditions();
        } else if (storageKey === 'techTopics') {
            items = await loadTechTopics();
        }
        listElement.innerHTML = '';
        items.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.innerHTML = `
                <span>${item.value}</span>
                <button class="btn btn-outline-danger btn-sm" onclick="removeItem('${storageKey}', '${item.value}', this.parentElement.parentElement)">
                    <i class="fas fa-minus"></i>
                </button>
            `;
            listElement.appendChild(listItem);
        });
    }

    // 초기 데이터 로드 (서버 연동)
    async function loadData() {
        await updateList('riskKeywords', riskKeywordsList);
        await updateList('partnerConditions', partnerConditionsList);
        await updateList('techTopics', techTopicsList);
        // 인증 전에는 입력 그룹 숨기기
        document.querySelectorAll('.input-group').forEach(group => {
            group.style.display = 'none';
        });
    }

    // 초기 데이터 로드
    loadData();

    // 전역 함수로 등록 (함수 정의 이후에 위치)
    window.removeItem = removeItem;
    window.updateList = updateList;
    window.addItem = addItem;

    // ===== 서버 연동 함수 =====
    async function loadKeywords() {
        const res = await fetch(`${API_BASE_URL}/api/risk-keywords`);
        const keywords = await res.json();
        return keywords;
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
    async function loadPartnerConditions() {
        const res = await fetch(`${API_BASE_URL}/api/partner-conditions`);
        const conds = await res.json();
        return conds;
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
    async function loadTechTopics() {
        const res = await fetch(`${API_BASE_URL}/api/tech-topics`);
        const topics = await res.json();
        return topics;
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
}); 