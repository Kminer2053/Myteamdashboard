const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

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
            addItem('riskKeywords', keyword, riskKeywordsList, '키워드');
            logUserAction('리스크키워드추가', { keyword });
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
            addItem('partnerConditions', condition, partnerConditionsList, '조건');
            logUserAction('제휴조건추가', { condition });
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
            addItem('techTopics', topic, techTopicsList, '주제');
            logUserAction('신기술주제추가', { topic });
            techTopicInput.value = '';
        }
    });

    // ===== 이메일 수신자 관리 =====
    const emailNameInput = document.getElementById('emailNameInput');
    const emailInput = document.getElementById('emailInput');
    const addEmailBtn = document.getElementById('addEmail');
    const emailList = document.getElementById('emailList');

    addEmailBtn.addEventListener('click', function() {
        if (!isAuthenticated) return;
        const name = emailNameInput.value.trim();
        const email = emailInput.value.trim();
        if (!name) {
            showToast('이름을 입력하세요.');
            return;
        }
        if (email && validateEmail(email)) {
            addEmail({ name, email });
            emailInput.value = '';
            emailNameInput.value = '';
        } else {
            showToast('올바른 이메일 주소를 입력하세요.');
        }
    });

    async function addEmail({ name, email }) {
        await fetch(`${API_BASE_URL}/api/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        await updateEmailList();
        showToast('이메일이 추가되었습니다.');
        logUserAction('이메일추가', { name, email });
    }

    async function removeEmail(email) {
        await fetch(`${API_BASE_URL}/api/emails/${encodeURIComponent(email)}`, { method: 'DELETE' });
        await updateEmailList();
        showToast('이메일이 삭제되었습니다.');
        logUserAction('이메일삭제', { email });
    }

    async function updateEmailList() {
        const res = await fetch(`${API_BASE_URL}/api/emails`);
        const emails = await res.json();
        emailList.innerHTML = '';
        emails.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.innerHTML = `
                <span>${item.name} (${item.email})</span>
                <button class="btn btn-outline-danger btn-sm" onclick="removeEmail('${item.email}')">
                    <i class="fas fa-minus"></i>
                </button>
            `;
            emailList.appendChild(listItem);
        });
    }

    function validateEmail(email) {
        // 간단한 이메일 형식 체크
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // 페이지 로드 시 이메일 리스트 불러오기
    updateEmailList();

    // 공통 함수: 항목 추가 (서버 연동)
    async function addItem(storageKey, value, listElement, label) {
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
        if (label) showToast(`${label}가 추가되었습니다.`);
    }

    // 공통 함수: 항목 삭제 (서버 연동)
    async function removeItem(storageKey, value, listElement) {
        let label = '';
        if (storageKey === 'riskKeywords') {
            label = '키워드';
            const keywords = await loadKeywords();
            const item = keywords.find(k => k.value === value);
            if (item) await deleteKeyword(item._id);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'partnerConditions') {
            label = '조건';
            const conds = await loadPartnerConditions();
            const item = conds.find(c => c.value === value);
            if (item) await deletePartnerCondition(item._id);
            await updateList(storageKey, listElement);
        } else if (storageKey === 'techTopics') {
            label = '주제';
            const topics = await loadTechTopics();
            const item = topics.find(t => t.value === value);
            if (item) await deleteTechTopic(item._id);
            await updateList(storageKey, listElement);
        }
        if (label) showToast(`${label}가 삭제되었습니다.`);
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

    window.removeEmail = removeEmail;

    // 로그 기록 함수
    async function logUserAction(action, meta = {}) {
        try {
            await fetch(`${API_BASE_URL}/api/log/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'admin',
                    action,
                    userAgent: navigator.userAgent,
                    meta
                })
            });
        } catch (e) {}
    }

    // 뉴스 갱신 시간 저장/불러오기
    const saveBtn = document.getElementById('saveNewsUpdateTime');
    const timeInput = document.getElementById('newsUpdateTime');
    if (saveBtn && timeInput) {
        // 저장 버튼 클릭 시 서버로 POST
        saveBtn.onclick = async function() {
            const value = timeInput.value;
            const spinner = document.getElementById('newsUpdateSpinner');
            if (spinner) spinner.style.display = 'inline-block';
            saveBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/settings/news-update-time`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value })
                });
                if (res.ok) {
                    const data = await res.json();
                    showToast(`뉴스갱신 시간이 ${data.value}으로 변경되었습니다.`);
                    logUserAction('뉴스갱신시간변경', { value });
                } else {
                    alert('저장 실패: ' + (await res.text()));
                }
            } catch (e) {
                alert('저장 중 오류: ' + e.message);
            } finally {
                if (spinner) spinner.style.display = 'none';
                saveBtn.disabled = false;
            }
        };
    }

    // === DB 사용량 관리 ===
    const dbUsageEl = document.getElementById('dbUsage');
    const dbLimitMBEl = document.getElementById('dbLimitMB');
    const dbDeleteMBEl = document.getElementById('dbDeleteMB');
    const saveDbSettingBtn = document.getElementById('saveDbSetting');
    const dbSettingSpinner = document.getElementById('dbSettingSpinner');

    async function loadDbUsage() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/db/usage`);
            const data = await res.json();
            dbUsageEl.textContent = data.usedMB;
        } catch (e) {
            dbUsageEl.textContent = '-';
        }
    }
    async function loadDbSetting() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/db/setting`);
            const data = await res.json();
            if (data.limitMB) dbLimitMBEl.value = data.limitMB;
            if (data.deleteMB) dbDeleteMBEl.value = data.deleteMB;
        } catch (e) {}
    }
    if (dbUsageEl && dbLimitMBEl && dbDeleteMBEl && saveDbSettingBtn) {
        loadDbUsage();
        loadDbSetting();
        saveDbSettingBtn.onclick = async function() {
            const limitMB = Number(dbLimitMBEl.value);
            const deleteMB = Number(dbDeleteMBEl.value);
            if (!limitMB || !deleteMB) {
                showToast('제한용량과 삭제량을 모두 입력하세요.');
                return;
            }
            dbSettingSpinner.style.display = 'inline-block';
            saveDbSettingBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/db/setting`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ limitMB, deleteMB })
                });
                if (res.ok) {
                    showToast('DB 설정이 저장되었습니다.');
                    logUserAction('DB설정저장', { limitMB, deleteMB });
                } else {
                    alert('저장 실패: ' + (await res.text()));
                }
            } catch (e) {
                alert('저장 중 오류: ' + e.message);
            } finally {
                dbSettingSpinner.style.display = 'none';
                saveDbSettingBtn.disabled = false;
            }
        };
    }

    // === 통계 메일링 관리 ===
    const statMailInput = document.getElementById('statMailInput');
    const saveStatMailBtn = document.getElementById('saveStatMail');
    const statMailSpinner = document.getElementById('statMailSpinner');
    async function loadStatMail() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/mail/stat-setting`);
            const data = await res.json();
            if (data.email) statMailInput.value = data.email;
        } catch (e) {}
    }
    if (statMailInput && saveStatMailBtn) {
        loadStatMail();
        saveStatMailBtn.onclick = async function() {
            const email = statMailInput.value.trim();
            if (!email) {
                showToast('이메일을 입력하세요.');
                return;
            }
            statMailSpinner.style.display = 'inline-block';
            saveStatMailBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/mail/stat-setting`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if (res.ok) {
                    showToast('통계 메일이 저장되었습니다.');
                    logUserAction('통계메일저장', { email });
                } else {
                    alert('저장 실패: ' + (await res.text()));
                }
            } catch (e) {
                alert('저장 중 오류: ' + e.message);
            } finally {
                statMailSpinner.style.display = 'none';
                saveStatMailBtn.disabled = false;
            }
        };
    }

    // ===== 카테고리별 AI 프롬프트 관리 =====
    const promptInputRisk = document.getElementById('promptInputRisk');
    const savePromptRisk = document.getElementById('savePromptRisk');
    const promptInputPartner = document.getElementById('promptInputPartner');
    const savePromptPartner = document.getElementById('savePromptPartner');
    const promptInputTech = document.getElementById('promptInputTech');
    const savePromptTech = document.getElementById('savePromptTech');

    // 프롬프트 불러오기
    async function loadPrompt(category, inputEl) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/prompt/${category}`);
            if (res.ok) {
                const data = await res.json();
                inputEl.value = data.value || '';
            }
        } catch (e) {}
    }
    // 프롬프트 저장
    async function savePrompt(category, inputEl, btn) {
        const value = inputEl.value.trim();
        if (!value) {
            showToast('프롬프트를 입력하세요.');
            return;
        }
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/api/prompt/${category}` , {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            if (res.ok) {
                showToast('프롬프트가 저장되었습니다.');
                logUserAction('프롬프트저장', { category, value });
            } else {
                alert('저장 실패: ' + (await res.text()));
            }
        } catch (e) {
            alert('저장 중 오류: ' + e.message);
        } finally {
            btn.disabled = false;
        }
    }
    // 진입 시 불러오기
    if (promptInputRisk) loadPrompt('risk', promptInputRisk);
    if (promptInputPartner) loadPrompt('partner', promptInputPartner);
    if (promptInputTech) loadPrompt('tech', promptInputTech);
    // 저장 버튼 이벤트
    if (savePromptRisk && promptInputRisk) {
        savePromptRisk.onclick = () => savePrompt('risk', promptInputRisk, savePromptRisk);
    }
    if (savePromptPartner && promptInputPartner) {
        savePromptPartner.onclick = () => savePrompt('partner', promptInputPartner, savePromptPartner);
    }
    if (savePromptTech && promptInputTech) {
        savePromptTech.onclick = () => savePrompt('tech', promptInputTech, savePromptTech);
    }
}); 