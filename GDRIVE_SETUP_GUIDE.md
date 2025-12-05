# Google Drive Service Account 설정 가이드

## 1단계: Google Cloud Console에서 Service Account 확인

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com 접속
   - 프로젝트 선택 (예: `github-drive-sync-462215`)

2. **Service Account 확인**
   - 왼쪽 메뉴: `IAM 및 관리자` → `서비스 계정`
   - 기존 Service Account가 있는지 확인
   - 이메일 주소 확인 (예: `github-drive-bot@github-drive-sync-462215.iam.gserviceaccount.com`)

3. **Service Account가 없다면 생성**
   - `서비스 계정 만들기` 클릭
   - 서비스 계정 이름: `github-drive-bot` (또는 원하는 이름)
   - `만들기 및 계속` 클릭
   - 역할은 일단 건너뛰고 `완료` 클릭

## 2단계: Service Account 키 생성

1. **Service Account 선택**
   - 서비스 계정 목록에서 해당 계정 클릭
   - 또는 이메일 주소 클릭

2. **키 생성**
   - 상단 탭에서 `키` 클릭
   - `키 추가` → `새 키 만들기` 클릭
   - 키 유형: **JSON** 선택
   - `만들기` 클릭
   - **JSON 파일이 자동으로 다운로드됩니다** (예: `github-drive-sync-462215-xxxxx.json`)

## 3단계: JSON 파일 내용 확인

1. **다운로드한 JSON 파일 열기**
   - 다운로드 폴더에서 JSON 파일 찾기
   - 텍스트 에디터로 열기 (메모장, VS Code 등)

2. **JSON 형식 확인**
   - 다음과 같은 구조여야 합니다:
   ```json
   {
     "type": "service_account",
     "project_id": "github-drive-sync-462215",
     "private_key_id": "xxxxxxxxxxxxx",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "github-drive-bot@github-drive-sync-462215.iam.gserviceaccount.com",
     "client_id": "xxxxxxxxxxxxx",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
   }
   ```

3. **중요 확인 사항**
   - ✅ `"type": "service_account"` 포함
   - ✅ `"client_email"` 필드 존재
   - ✅ `"private_key"` 필드 존재 (-----BEGIN PRIVATE KEY----- 로 시작)
   - ✅ 중괄호 `{ }` 로 시작하고 끝남
   - ❌ 따옴표로 감싸지 않음
   - ❌ 앞뒤에 불필요한 텍스트 없음

## 4단계: GitHub Secrets에 JSON 저장

1. **GitHub 저장소 접속**
   - https://github.com/Kminer2053/Myteamdashboard 접속
   - 또는 해당 저장소로 이동

2. **Secrets 설정 페이지 이동**
   - 저장소 메뉴: `Settings` (설정)
   - 왼쪽 사이드바: `Secrets and variables` → `Actions`
   - 또는 직접 URL: `https://github.com/Kminer2053/Myteamdashboard/settings/secrets/actions`

3. **기존 GDRIVE_CREDENTIALS 삭제 (있다면)**
   - `GDRIVE_CREDENTIALS` 찾기
   - 오른쪽 `...` 메뉴 → `Delete` 클릭
   - 확인

4. **새 Secret 생성**
   - `New repository secret` 버튼 클릭
   - Name: `GDRIVE_CREDENTIALS` (정확히 이 이름)
   - Secret: JSON 파일의 **전체 내용** 붙여넣기

5. **JSON 붙여넣기 방법**
   - JSON 파일을 텍스트 에디터로 열기
   - 전체 선택 (Ctrl+A 또는 Cmd+A)
   - 복사 (Ctrl+C 또는 Cmd+C)
   - GitHub의 Secret 입력란에 붙여넣기 (Ctrl+V 또는 Cmd+V)
   - **주의**: 따옴표로 감싸지 말 것!

6. **저장**
   - `Add secret` 버튼 클릭

## 5단계: 폴더 ID 확인 및 설정

1. **Google Drive에서 폴더 열기**
   - https://drive.google.com 접속
   - `Github_Log` 폴더 찾기

2. **폴더 ID 확인**
   - 폴더를 열기 (더블클릭)
   - 브라우저 주소창 확인
   - URL 예시: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
   - `/folders/` 뒤의 문자열이 폴더 ID입니다: `1a2b3c4d5e6f7g8h9i0j`

3. **GitHub Secrets에 폴더 ID 저장**
   - GitHub Secrets 페이지로 돌아가기
   - `New repository secret` 클릭
   - Name: `GDRIVE_FOLDER_ID`
   - Secret: 폴더 ID만 입력 (예: `1a2b3c4d5e6f7g8h9i0j`)
   - `Add secret` 클릭

## 6단계: 폴더 공유 설정 확인

1. **Google Drive에서 폴더 공유**
   - `Github_Log` 폴더 우클릭 → `공유` 클릭
   - 또는 폴더 열기 → 상단 `공유` 버튼 클릭

2. **Service Account 추가**
   - `사용자, 그룹, 스페이스, 캘린더 일정 추가` 입력란 클릭
   - Service Account 이메일 입력:
     - 예: `github-drive-bot@github-drive-sync-462215.iam.gserviceaccount.com`
   - 권한: `편집자` 선택
   - `전송` 클릭

3. **확인**
   - 공유 목록에 Service Account가 `편집자` 권한으로 표시되는지 확인

## 7단계: 테스트

1. **GitHub Actions 실행**
   - 저장소 페이지로 이동
   - `Actions` 탭 클릭
   - 왼쪽 사이드바에서 `Push Summary to Google Drive` 워크플로우 선택
   - `Run workflow` 버튼 클릭
   - `Run workflow` 확인

2. **로그 확인**
   - 실행 중인 워크플로우 클릭
   - 각 단계의 로그 확인
   - 오류가 있다면 에러 메시지 확인

## 문제 해결

### "invalid character 'g' looking for beginning of value" 오류
- **원인**: JSON이 문자열로 감싸져 있거나 잘못된 형식
- **해결**: JSON 파일 전체를 다시 복사하여 GitHub Secrets에 붙여넣기
- **확인**: JSON 파일이 `{` 로 시작하고 `}` 로 끝나는지 확인

### "Service Accounts do not have storage quota" 오류
- **원인**: 폴더가 Service Account와 공유되지 않음
- **해결**: 6단계 다시 확인 - Service Account를 폴더 공유자로 추가

### "Failed to copy" 오류
- **원인**: 폴더 ID가 잘못되었거나 접근 권한 없음
- **해결**: 
  1. 폴더 ID 다시 확인 (5단계)
  2. 폴더 공유 설정 확인 (6단계)


