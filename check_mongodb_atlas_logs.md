# MongoDB Atlas에서 삭제 이력 확인 방법

## 1. MongoDB Atlas Activity Feed 확인
- MongoDB Atlas 웹 콘솔에 로그인
- 클러스터 선택 → **Activity Feed** 탭
- 최근 작업 이력 확인 (삭제, 업데이트 등)

## 2. MongoDB Atlas Logs 확인
- 클러스터 → **Logs** 탭
- **MongoDB Logs** 또는 **Real-Time Performance Panel** 확인
- 삭제 작업 관련 로그 검색

## 3. MongoDB Oplog 확인 (Replica Set인 경우)
- Replica Set이 활성화되어 있으면 oplog에서 모든 작업 이력을 확인 가능
- 하지만 Atlas 무료 티어는 Replica Set이 없을 수 있음

## 4. MongoDB Metrics 확인
- 클러스터 → **Metrics** 탭
- **Operations** 그래프에서 삭제 작업 추세 확인
- **Database Size** 그래프에서 데이터 크기 변화 확인

## 5. 코드를 통한 간접 확인
- UserActionLog 모델 확인 (관리자 작업 로그)
- 데이터베이스 통계를 통한 추정

