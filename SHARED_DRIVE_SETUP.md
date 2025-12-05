# Shared Drive 설정 가이드 (Service Account 업로드 문제 해결)

## 문제 원인

Google의 정책상 **Service Account는 개인 Google Drive에 직접 파일을 업로드할 수 없습니다**.
- 공유 폴더에 공유자로 추가되어 있어도 업로드 불가
- 오류: `403: Service Accounts do not have storage quota`

**해결책: Shared Drive (Team Drive) 사용**

## 방법 1: Shared Drive 사용 (권장)

### 전제 조건
- Google Workspace 계정 필요 (개인 Gmail 계정으로는 불가능)
- Google Workspace 관리자 권한 또는 Shared Drive 생성 권한

### 1단계: Shared Drive 생성

1. **Google Drive 접속**
   - https://drive.google.com 접속
   - Google Workspace 계정으로 로그인

2. **Shared Drive 생성**
   - 왼쪽 사이드바에서 `공유 드라이브` 클릭
   - 또는 `새로 만들기` → `공유 드라이브` 클릭
   - Shared Drive 이름 입력 (예: `GitHub Logs`)
   - `만들기` 클릭

### 2단계: Service Account를 Shared Drive 멤버로 추가

1. **Shared Drive 열기**
   - 생성한 Shared Drive 클릭

2. **멤버 추가**
   - 상단 `멤버 추가` 또는 `공유` 버튼 클릭
   - Service Account 이메일 입력:
     - 예: `github-drive-bot@github-drive-sync-462215.iam.gserviceaccount.com`
   - 권한: `콘텐츠 관리자` 또는 `편집자` 선택
   - `전송` 클릭

### 3단계: Shared Drive ID 확인

1. **Shared Drive 열기**
   - Shared Drive를 열어서 URL 확인
   - URL 예시: `https://drive.google.com/drive/folders/0AKxxxxxxxxxxxxx`
   - 또는 `https://drive.google.com/drive/u/0/folders/0AKxxxxxxxxxxxxx`

2. **Drive ID 추출**
   - URL에서 `/folders/` 뒤의 문자열이 Drive ID입니다
   - 예: `0AKxxxxxxxxxxxxx`
   - **주의**: 일반 폴더 ID와 다릅니다 (보통 `0AK`로 시작)

3. **rclone으로 확인 (선택사항)**
   ```bash
   rclone backend drives gdrive:
   ```
   - 출력에서 Shared Drive 목록과 ID 확인 가능

### 4단계: GitHub Secrets 설정

1. **GitHub Secrets에 추가**
   - 저장소 → Settings → Secrets and variables → Actions
   - `New repository secret` 클릭
   - Name: `GDRIVE_TEAM_DRIVE_ID`
   - Secret: Shared Drive ID 입력 (예: `0AKxxxxxxxxxxxxx`)
   - `Add secret` 클릭

2. **폴더 ID 설정 (선택사항)**
   - Shared Drive 내의 특정 폴더에 업로드하려면:
   - 해당 폴더 URL에서 폴더 ID 확인
   - `GDRIVE_FOLDER_ID`에 폴더 ID 설정
   - 폴더 ID를 설정하지 않으면 Shared Drive 루트에 업로드

### 5단계: 테스트

1. **워크플로우 실행**
   - GitHub Actions에서 워크플로우 실행
   - 이제 정상적으로 업로드되어야 합니다

## 방법 2: OAuth Delegation 사용 (개인 계정)

Google Workspace가 없는 경우, OAuth 2.0을 사용하여 개인 계정의 권한을 사용할 수 있습니다.

### 단점
- 더 복잡한 설정 필요
- 사용자 인증 필요
- GitHub Actions에서 자동화하기 어려움

### 설정 방법

1. **OAuth 2.0 클라이언트 ID 생성**
   - Google Cloud Console → API 및 서비스 → 사용자 인증 정보
   - `사용자 인증 정보 만들기` → `OAuth 클라이언트 ID`
   - 애플리케이션 유형: `데스크톱 앱`

2. **rclone OAuth 설정**
   ```bash
   rclone config create gdrive drive
   ```
   - 대화형으로 OAuth 인증 진행

3. **GitHub Actions에서 사용**
   - OAuth 토큰을 GitHub Secrets에 저장
   - 자동 갱신 필요 (복잡함)

## 추천 방법

**Google Workspace가 있다면**: 방법 1 (Shared Drive) 사용
- 가장 간단하고 안정적
- 자동화에 적합

**Google Workspace가 없다면**: 
- Google Workspace 구독 고려
- 또는 다른 클라우드 스토리지 사용 (예: AWS S3, Azure Blob)

## 문제 해결

### "Shared Drive를 찾을 수 없습니다" 오류
- Shared Drive ID가 올바른지 확인
- Service Account가 Shared Drive 멤버로 추가되었는지 확인

### "권한이 없습니다" 오류
- Service Account의 권한이 `편집자` 이상인지 확인
- Shared Drive 관리자에게 문의

### 여전히 403 오류 발생
- `GDRIVE_TEAM_DRIVE_ID`가 올바르게 설정되었는지 확인
- 워크플로우에서 `team_drive` 옵션이 사용되는지 확인


