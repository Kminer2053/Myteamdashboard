const API_BASE_URL = window.VITE_API_URL || 'https://myteamdashboard.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    let isAuthenticated = false;
    let adminToken = null; // 어드민 세션 토큰
    const passwordModal = new bootstrap.Modal(document.getElementById('adminPwModal'));
    
    // 페이지 로드 시 비밀번호 확인 모달 표시
    passwordModal.show();

    // 비밀번호 확인 (폼 submit 이벤트로 변경)
    document.getElementById('adminPwForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const passwordInput = document.getElementById('adminPwInput');
        
        try {
            // 서버에 인증 요청
            const response = await fetch(`${API_BASE_URL}/api/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passwordInput.value })
            });
            
            if (response.ok) {
                const data = await response.json();
                adminToken = data.token;
                isAuthenticated = true;
                passwordModal.hide();
                // 관리자 페이지 컨텐츠 표시
                const adminPageContent = document.getElementById('adminPageContent');
                if (adminPageContent) {
                    adminPageContent.style.display = '';
                }
                document.querySelectorAll('.input-group').forEach(group => {
                    group.style.display = 'flex';
                });
                updateList('riskKeywords', riskKeywordsList);
                updateList('partnerConditions', partnerConditionsList);
                updateList('techTopics', techTopicsList);
                loadTokenLimits();
                loadPerplexityTimeout();
                // 카카오봇 설정 로드
                loadBotConfig();
                loadBotStats();
                loadDailyAnnounce();
            } else {
                alert('비밀번호가 일치하지 않습니다.');
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('인증 오류:', error);
            alert('인증 처리 중 오류가 발생했습니다.');
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

    // ===== 토큰 제한 설정 관리 =====
    const tokenLimitRisk = document.getElementById('tokenLimitRisk');
    const tokenLimitPartner = document.getElementById('tokenLimitPartner');
    const tokenLimitTech = document.getElementById('tokenLimitTech');
    const unlimitedRisk = document.getElementById('unlimitedRisk');
    const unlimitedPartner = document.getElementById('unlimitedPartner');
    const unlimitedTech = document.getElementById('unlimitedTech');
    const saveTokenLimitsBtn = document.getElementById('saveTokenLimits');

    // 토큰 제한 설정 로드
    async function loadTokenLimits() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/token-limits`);
            if (response.ok) {
                const tokenLimits = await response.json();
                
                // 리스크 이슈
                if (tokenLimits.risk === null || tokenLimits.risk === -1) {
                    unlimitedRisk.checked = true;
                    tokenLimitRisk.value = '';
                    tokenLimitRisk.disabled = true;
                } else {
                    unlimitedRisk.checked = false;
                    tokenLimitRisk.value = tokenLimits.risk || 3000;
                    tokenLimitRisk.disabled = false;
                }
                
                // 제휴처 탐색
                if (tokenLimits.partner === null || tokenLimits.partner === -1) {
                    unlimitedPartner.checked = true;
                    tokenLimitPartner.value = '';
                    tokenLimitPartner.disabled = true;
                } else {
                    unlimitedPartner.checked = false;
                    tokenLimitPartner.value = tokenLimits.partner || 3000;
                    tokenLimitPartner.disabled = false;
                }
                
                // 신기술 동향
                if (tokenLimits.tech === null || tokenLimits.tech === -1) {
                    unlimitedTech.checked = true;
                    tokenLimitTech.value = '';
                    tokenLimitTech.disabled = true;
                } else {
                    unlimitedTech.checked = false;
                    tokenLimitTech.value = tokenLimits.tech || 3000;
                    tokenLimitTech.disabled = false;
                }
            }
        } catch (error) {
            console.error('토큰 제한 설정 로드 실패:', error);
        }
    }

    // 무제한 체크박스 이벤트 핸들러
    unlimitedRisk.addEventListener('change', function() {
        tokenLimitRisk.disabled = this.checked;
        if (this.checked) {
            tokenLimitRisk.value = '';
        } else {
            tokenLimitRisk.value = '3000';
        }
    });
    
    unlimitedPartner.addEventListener('change', function() {
        tokenLimitPartner.disabled = this.checked;
        if (this.checked) {
            tokenLimitPartner.value = '';
        } else {
            tokenLimitPartner.value = '3000';
        }
    });
    
    unlimitedTech.addEventListener('change', function() {
        tokenLimitTech.disabled = this.checked;
        if (this.checked) {
            tokenLimitTech.value = '';
        } else {
            tokenLimitTech.value = '3000';
        }
    });

    // 토큰 제한 설정 저장
    saveTokenLimitsBtn.addEventListener('click', async function() {
        if (!isAuthenticated) return;
        
        // 무제한 체크 여부에 따라 값 설정
        const risk = unlimitedRisk.checked ? null : parseInt(tokenLimitRisk.value);
        const partner = unlimitedPartner.checked ? null : parseInt(tokenLimitPartner.value);
        const tech = unlimitedTech.checked ? null : parseInt(tokenLimitTech.value);
        
        // 무제한이 아닌 경우 유효성 검사
        if (!unlimitedRisk.checked && (!risk || risk < 1000 || risk > 8000)) {
            showToast('리스크 이슈 토큰 제한은 1000-8000 사이의 값이어야 합니다.');
            return;
        }
        if (!unlimitedPartner.checked && (!partner || partner < 1000 || partner > 8000)) {
            showToast('제휴처 탐색 토큰 제한은 1000-8000 사이의 값이어야 합니다.');
            return;
        }
        if (!unlimitedTech.checked && (!tech || tech < 1000 || tech > 8000)) {
            showToast('신기술 동향 토큰 제한은 1000-8000 사이의 값이어야 합니다.');
            return;
        }
        
        saveTokenLimitsBtn.disabled = true;
        const spinner = saveTokenLimitsBtn.querySelector('.spinner-border');
        if (spinner) spinner.classList.remove('d-none');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/token-limits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ risk, partner, tech })
            });
            
            if (response.ok) {
                showToast('토큰 제한 설정이 저장되었습니다.');
                logUserAction('토큰제한설정', { risk, partner, tech });
            } else {
                showToast('토큰 제한 설정 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('토큰 제한 설정 저장 실패:', error);
            showToast('토큰 제한 설정 저장 중 오류가 발생했습니다.');
        } finally {
            saveTokenLimitsBtn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
        }
    });

    // ===== 화제성 분석 타임아웃 설정 =====
    const perplexityTimeoutInput = document.getElementById('perplexityTimeout');
    const savePerplexityTimeoutBtn = document.getElementById('savePerplexityTimeout');
    const perplexityTimeoutSpinner = document.getElementById('perplexityTimeoutSpinner');

    // 타임아웃 설정 로드
    async function loadPerplexityTimeout() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/perplexity-timeout`);
            if (response.ok) {
                const data = await response.json();
                perplexityTimeoutInput.value = data.timeout || 300000;
            }
        } catch (error) {
            console.error('타임아웃 설정 로드 실패:', error);
        }
    }

    // 타임아웃 설정 저장
    if (savePerplexityTimeoutBtn) {
        savePerplexityTimeoutBtn.addEventListener('click', async function() {
            if (!isAuthenticated) return;
            
            const timeout = parseInt(perplexityTimeoutInput.value);
            
            // 유효성 검사
            if (!timeout || timeout < 60000) {
                showToast('타임아웃은 최소 60000ms (1분) 이상이어야 합니다.');
                return;
            }
            
            perplexityTimeoutSpinner.style.display = 'block';
            savePerplexityTimeoutBtn.disabled = true;
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/perplexity-timeout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ timeout })
                });
                
                if (response.ok) {
                    showToast('타임아웃 설정이 저장되었습니다.');
                    logUserAction('Perplexity타임아웃설정', { timeout });
                } else {
                    showToast('타임아웃 설정 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('타임아웃 설정 저장 실패:', error);
                showToast('타임아웃 설정 저장 중 오류가 발생했습니다.');
            } finally {
                perplexityTimeoutSpinner.style.display = 'none';
                savePerplexityTimeoutBtn.disabled = false;
            }
        });
    }

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
        const spinner = btn.querySelector('.spinner-border');
        if (spinner) spinner.classList.remove('d-none');
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
            if (spinner) spinner.classList.add('d-none');
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

    // ===== AI API 테스트 기능 =====
    const testRiskApi = document.getElementById('testRiskApi');
    const testPartnerApi = document.getElementById('testPartnerApi');
    const testTechApi = document.getElementById('testTechApi');

    // API 테스트 함수
    async function testApi(category, resultElement) {
        try {
            // 해당 카테고리의 키워드들 가져오기
            let keywords = [];
            let customPrompt = '';
            
            if (category === 'risk') {
                const res = await fetch(`${API_BASE_URL}/api/risk-keywords`);
                const data = await res.json();
                keywords = data.map(k => k.value);
                
                // 커스텀 프롬프트 가져오기
                try {
                    const promptRes = await fetch(`${API_BASE_URL}/api/prompt/risk`);
                    if (promptRes.ok) {
                        const promptData = await promptRes.json();
                        customPrompt = promptData.value || '';
                    }
                } catch (e) {}
                
            } else if (category === 'partner') {
                const res = await fetch(`${API_BASE_URL}/api/partner-conditions`);
                const data = await res.json();
                keywords = data.map(c => c.value);
                
                try {
                    const promptRes = await fetch(`${API_BASE_URL}/api/prompt/partner`);
                    if (promptRes.ok) {
                        const promptData = await promptRes.json();
                        customPrompt = promptData.value || '';
                    }
                } catch (e) {}
                
            } else if (category === 'tech') {
                const res = await fetch(`${API_BASE_URL}/api/tech-topics`);
                const data = await res.json();
                keywords = data.map(t => t.value);
                
                try {
                    const promptRes = await fetch(`${API_BASE_URL}/api/prompt/tech`);
                    if (promptRes.ok) {
                        const promptData = await promptRes.json();
                        customPrompt = promptData.value || '';
                    }
                } catch (e) {}
            }

            if (keywords.length === 0) {
                resultElement.querySelector('pre').textContent = '키워드가 없습니다. 먼저 키워드를 추가해주세요.';
                resultElement.style.display = 'block';
                return;
            }

            // API 테스트 요청
            const testData = {
                keywords: keywords,
                category: category,
                customPrompt: customPrompt
            };

            resultElement.querySelector('pre').textContent = 'API 테스트 중...';
            resultElement.style.display = 'block';

            const response = await fetch(`${API_BASE_URL}/api/test-perplexity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });

            const result = await response.json();
            
            // 결과 표시
            const resultText = JSON.stringify(result, null, 2);
            resultElement.querySelector('pre').textContent = resultText;
            
            // 성공/실패에 따른 색상 변경
            if (result.success) {
                resultElement.querySelector('pre').style.backgroundColor = '#d4edda';
                resultElement.querySelector('pre').style.border = '1px solid #c3e6cb';
            } else {
                resultElement.querySelector('pre').style.backgroundColor = '#f8d7da';
                resultElement.querySelector('pre').style.border = '1px solid #f5c6cb';
            }

        } catch (error) {
            resultElement.querySelector('pre').textContent = `테스트 실패: ${error.message}`;
            resultElement.querySelector('pre').style.backgroundColor = '#f8d7da';
            resultElement.querySelector('pre').style.border = '1px solid #f5c6cb';
            resultElement.style.display = 'block';
        }
    }

    // 테스트 버튼 이벤트 리스너
    if (testRiskApi) {
        testRiskApi.onclick = () => testApi('risk', document.getElementById('testRiskResult'));
    }
    if (testPartnerApi) {
        testPartnerApi.onclick = () => testApi('partner', document.getElementById('testPartnerResult'));
    }
    if (testTechApi) {
        testTechApi.onclick = () => testApi('tech', document.getElementById('testTechResult'));
    }

    // ========================================
    // 카카오봇 관리 로직
    // ========================================
    
    let botRooms = [];
    let botAdmins = [];

    // 카카오봇 설정 로드
    async function loadBotConfig() {
        if (!adminToken) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/bot/config`, {
                headers: { 'X-ADMIN-TOKEN': adminToken }
            });
            
            if (response.ok) {
                const data = await response.json();
                botRooms = data.rooms || [];
                botAdmins = data.admins || [];
                renderBotRooms();
                renderBotAdmins();
                logUserAction('카카오봇_설정조회', {});
            }
        } catch (error) {
            console.error('봇 설정 로드 오류:', error);
        }
    }

    // 카카오봇 설정 저장
    async function saveBotConfig() {
        if (!adminToken) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/bot/config`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-ADMIN-TOKEN': adminToken 
                },
                body: JSON.stringify({ rooms: botRooms, admins: botAdmins })
            });
            
            if (response.ok) {
                console.log('봇 설정 저장 완료');
                logUserAction('카카오봇_설정저장', {});
            }
        } catch (error) {
            console.error('봇 설정 저장 오류:', error);
        }
    }

    // 방 목록 렌더링
    function renderBotRooms() {
        const tbody = document.getElementById('botRoomsTableBody');
        tbody.innerHTML = '';
        
        botRooms.forEach((room, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${room.roomName}</td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" ${room.enabled ? 'checked' : ''} 
                            data-index="${index}" data-field="enabled">
                    </div>
                </td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" ${room.scheduleNotify ? 'checked' : ''} 
                            data-index="${index}" data-field="scheduleNotify">
                    </div>
                </td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" ${room.commandsEnabled ? 'checked' : ''} 
                            data-index="${index}" data-field="commandsEnabled">
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" data-index="${index}">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // 토글 스위치 이벤트
        tbody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const field = this.dataset.field;
                botRooms[index][field] = this.checked;
                saveBotConfig();
                logUserAction(`카카오봇_방토글_${field}`, { 
                    roomName: botRooms[index].roomName, 
                    value: this.checked 
                });
            });
        });

        // 삭제 버튼 이벤트
        tbody.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const roomName = botRooms[index].roomName;
                if (confirm(`"${roomName}" 방을 삭제하시겠습니까?`)) {
                    botRooms.splice(index, 1);
                    renderBotRooms();
                    saveBotConfig();
                    logUserAction('카카오봇_방삭제', { roomName });
                }
            });
        });
    }

    // 관리자 목록 렌더링
    function renderBotAdmins() {
        const container = document.getElementById('botAdminsList');
        container.innerHTML = '';
        
        botAdmins.forEach((admin, index) => {
            const chip = document.createElement('span');
            chip.className = 'badge bg-primary d-flex align-items-center';
            chip.style.fontSize = '0.9rem';
            chip.innerHTML = `
                ${admin}
                <button type="button" class="btn-close btn-close-white ms-2" style="font-size:0.6rem" 
                    data-index="${index}" aria-label="삭제"></button>
            `;
            container.appendChild(chip);
        });

        // 삭제 버튼 이벤트
        container.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                botAdmins.splice(index, 1);
                renderBotAdmins();
                saveBotConfig();
            });
        });
    }

    // 봇 통계 로드
    async function loadBotStats() {
        if (!adminToken) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/bot/outbox/stats?limit=10`, {
                headers: { 'X-ADMIN-TOKEN': adminToken }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // 카운트 업데이트
                document.getElementById('botPendingCount').textContent = data.pending;
                document.getElementById('botSentCount').textContent = data.sent;
                document.getElementById('botFailedCount').textContent = data.failed;
                
                // 로그 테이블 렌더링
                const tbody = document.getElementById('botLogsTableBody');
                tbody.innerHTML = '';
                
                if (data.recentLogs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">로그가 없습니다</td></tr>';
                } else {
                    data.recentLogs.forEach(log => {
                        const tr = document.createElement('tr');
                        const statusBadge = 
                            log.status === 'sent' ? '<span class="badge bg-success">전송완료</span>' :
                            log.status === 'pending' ? '<span class="badge bg-secondary">대기중</span>' :
                            '<span class="badge bg-danger">실패</span>';
                        
                        const time = log.sentAt ? new Date(log.sentAt).toLocaleString('ko-KR') : 
                                     new Date(log.createdAt).toLocaleString('ko-KR');
                        
                        tr.innerHTML = `
                            <td>${log.targetRoom}</td>
                            <td><small>${log.message}</small></td>
                            <td>${statusBadge}</td>
                            <td>${log.attempts}</td>
                            <td><small>${time}</small></td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                
                logUserAction('카카오봇_outbox조회', {});
            }
        } catch (error) {
            console.error('봇 통계 로드 오류:', error);
        }
    }

    // 방 추가 버튼
    const addBotRoomBtn = document.getElementById('addBotRoom');
    if (addBotRoomBtn) {
        addBotRoomBtn.addEventListener('click', async function() {
            if (!isAuthenticated) return;
            
            const input = document.getElementById('botRoomNameInput');
            const roomName = input.value.trim();
            
            if (!roomName) {
                alert('방 이름을 입력해주세요.');
                return;
            }
            
            // 중복 체크
            if (botRooms.find(r => r.roomName === roomName)) {
                alert('이미 존재하는 방입니다.');
                return;
            }
            
            addBotRoomBtn.disabled = true;
            const spinner = addBotRoomBtn.querySelector('.spinner-border');
            if (spinner) spinner.classList.remove('d-none');
            
            try {
                botRooms.push({
                    roomName: roomName,
                    enabled: true,
                    scheduleNotify: true,
                    commandsEnabled: true
                });
                
                input.value = '';
                renderBotRooms();
                await saveBotConfig();
                showToast('방이 추가되었습니다.');
                logUserAction('카카오봇_방추가', { roomName });
            } finally {
                addBotRoomBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }

    // 관리자 추가 버튼
    const addBotAdminBtn = document.getElementById('addBotAdmin');
    if (addBotAdminBtn) {
        addBotAdminBtn.addEventListener('click', async function() {
            if (!isAuthenticated) return;
            
            const input = document.getElementById('botAdminInput');
            const adminName = input.value.trim();
            
            if (!adminName) {
                alert('관리자 닉네임을 입력해주세요.');
                return;
            }
            
            // 중복 체크
            if (botAdmins.includes(adminName)) {
                alert('이미 존재하는 관리자입니다.');
                return;
            }
            
            addBotAdminBtn.disabled = true;
            const spinner = addBotAdminBtn.querySelector('.spinner-border');
            if (spinner) spinner.classList.remove('d-none');
            
            try {
                botAdmins.push(adminName);
                input.value = '';
                renderBotAdmins();
                await saveBotConfig();
                showToast('관리자가 추가되었습니다.');
                logUserAction('카카오봇_관리자추가', { adminName });
            } finally {
                addBotAdminBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }

    // 통계 새로고침 버튼
    const refreshBotStatsBtn = document.getElementById('refreshBotStats');
    if (refreshBotStatsBtn) {
        refreshBotStatsBtn.addEventListener('click', async function() {
            if (!isAuthenticated) return;
            
            refreshBotStatsBtn.disabled = true;
            const spinner = refreshBotStatsBtn.querySelector('.spinner-border');
            const icon = refreshBotStatsBtn.querySelector('.fa-sync-alt');
            if (spinner) spinner.classList.remove('d-none');
            if (icon) icon.classList.add('d-none');
            
            try {
                await loadBotStats();
            } finally {
                refreshBotStatsBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                if (icon) icon.classList.remove('d-none');
            }
        });
    }

    // ========================================
    // 매일 자동 발송 설정
    // ========================================
    
    // 매일 자동 발송 설정 로드
    async function loadDailyAnnounce() {
        if (!adminToken) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/daily-announce`, {
                headers: { 'X-ADMIN-TOKEN': adminToken }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const enabledCheckbox = document.getElementById('dailyAnnounceEnabled');
                const timeInput = document.getElementById('dailyAnnounceTime');
                const statusBadge = document.getElementById('dailyAnnounceCronStatus');
                
                if (enabledCheckbox) enabledCheckbox.checked = data.enabled;
                if (timeInput) timeInput.value = data.time || '08:30';
                if (statusBadge) {
                    statusBadge.textContent = data.cronActive ? '활성화' : '비활성화';
                    statusBadge.className = `badge ${data.cronActive ? 'bg-success' : 'bg-secondary'}`;
                }
                
                // 시간 입력 활성화/비활성화
                if (timeInput) timeInput.disabled = !data.enabled;
            }
        } catch (error) {
            console.error('매일 자동 발송 설정 로드 오류:', error);
        }
    }
    
    // 매일 자동 발송 설정 저장
    async function saveDailyAnnounce() {
        if (!adminToken) return;
        
        const enabledCheckbox = document.getElementById('dailyAnnounceEnabled');
        const timeInput = document.getElementById('dailyAnnounceTime');
        const saveBtn = document.getElementById('saveDailyAnnounce');
        
        const enabled = enabledCheckbox ? enabledCheckbox.checked : false;
        const time = timeInput ? timeInput.value : '';
        
        if (saveBtn) {
            saveBtn.disabled = true;
            const spinner = saveBtn.querySelector('.spinner-border');
            if (spinner) spinner.classList.remove('d-none');
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/daily-announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-ADMIN-TOKEN': adminToken
                },
                body: JSON.stringify({ enabled, time })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast(data.message);
                loadDailyAnnounce();
                logUserAction('카카오봇_자동발송설정', { enabled, time });
            } else {
                alert('저장 실패: ' + (data.error || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('매일 자동 발송 설정 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                const spinner = saveBtn.querySelector('.spinner-border');
                if (spinner) spinner.classList.add('d-none');
            }
        }
    }
    
    // 매일 자동 발송 테스트
    async function testDailyAnnounce() {
        if (!adminToken) return;
        
        if (!confirm('즉시 테스트 발송하시겠습니까?\n일정알림이 활성화된 모든 방에 메시지가 전송됩니다.')) {
            return;
        }
        
        const testBtn = document.getElementById('testDailyAnnounce');
        if (testBtn) {
            testBtn.disabled = true;
            const spinner = testBtn.querySelector('.spinner-border');
            if (spinner) spinner.classList.remove('d-none');
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/daily-announce/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-ADMIN-TOKEN': adminToken
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast(data.message);
                loadBotStats();
                logUserAction('카카오봇_자동발송테스트', {});
            } else {
                alert('테스트 실패: ' + (data.error || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('매일 자동 발송 테스트 오류:', error);
            alert('테스트 중 오류가 발생했습니다.');
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                const spinner = testBtn.querySelector('.spinner-border');
                if (spinner) spinner.classList.add('d-none');
            }
        }
    }
    
    // 자동 발송 활성화 체크박스 이벤트
    const dailyAnnounceEnabledCheckbox = document.getElementById('dailyAnnounceEnabled');
    if (dailyAnnounceEnabledCheckbox) {
        dailyAnnounceEnabledCheckbox.addEventListener('change', function() {
            const timeInput = document.getElementById('dailyAnnounceTime');
            if (timeInput) timeInput.disabled = !this.checked;
        });
    }
    
    // 자동 발송 저장 버튼 이벤트
    const saveDailyAnnounceBtn = document.getElementById('saveDailyAnnounce');
    if (saveDailyAnnounceBtn) {
        saveDailyAnnounceBtn.addEventListener('click', function() {
            if (!isAuthenticated) return;
            saveDailyAnnounce();
        });
    }
    
    // 자동 발송 테스트 버튼 이벤트
    const testDailyAnnounceBtn = document.getElementById('testDailyAnnounce');
    if (testDailyAnnounceBtn) {
        testDailyAnnounceBtn.addEventListener('click', function() {
            if (!isAuthenticated) return;
            testDailyAnnounce();
        });
    }
    
    // 인증 후 자동 발송 설정도 로드
    const originalPasswordSubmit = document.getElementById('submitPassword');
    if (originalPasswordSubmit) {
        const originalOnClick = originalPasswordSubmit.onclick;
        // loadBotConfig 호출 후 loadDailyAnnounce도 호출되도록 함
        // 이미 loadBotConfig가 호출되는 곳에서 loadDailyAnnounce도 호출
    }
    
    // 페이지 로드 시 인증 상태면 자동 발송 설정도 로드
    if (adminToken) {
        loadDailyAnnounce();
    }
}); 