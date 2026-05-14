## Stage 0 계획



1. problems  문서에서 소유자 필드 Owner_uid : string 추가
   1. 기존 문항에 일괄로 덕수의 uid를 채워 넣는 마이그레이션 실행 (스크립트)
   2. 모든 CRUD 함수에서 `owner_uid`를 자동 설정하도록 수정
   3. 지금은 `owner_uid`만 추가하고 팀 개념은 필요할 때 추가
2. Firestore Security Rules 강화
   1. 기본 규칙: 인증된 사용자만 자기 문항(`owner_uid == request.auth.uid`)을 읽기/쓰기 가능
   2. 공유 문항에 대한 읽기 허용 규칙 설정 : privite | link | public 으로 시작
   3. subcollection(question_blocks, solution_blocks, 동적 탭 subcollection)에도 부모 문서의 소유권/공유 상태를 기준으로 규칙 적용
3. Mathory 자체의 사용자 프로필 컬렉션 신설
   1. `users/{uid}` 컬렉션 생성
   2. 필드: `displayName`, `email`, `photoURL`, `createdAt`
   3. 최초 로그인 시 자동 생성 (Auth trigger 또는 클라이언트 로직)
   4. 질문 : 현재 Mathory는 개발자 혼자 사용하고 있는데, 다른 사용자가 구글 아이디로 로그인해서 사용할 수 있는가?



### 핵심 설계 결정 사항

| #    | 결정 사항      | 결정                                                  | 권장된 내용에 따른 향후 방향                   |
| ---- | :------------- | ----------------------------------------------------- | ---------------------------------------------- |
| D1   | 공유 단위      | 문항(problem) 단위                                    | 문항 단위로 시작, 폴더 공유는 나중에 추가      |
| D2   | 공유 링크 구조 | `/shared/{shareId}` 별도 페이지, 에디터와 뷰어 분리함 |                                                |
| D3   | 공개 범위 모델 | `private` / `link` / `public` 3단계                   |                                                |
| D4   | 협업 편집 방식 | 제안/승인 모드로 시작                                 | 향후 필요시 실시간 동시편집 기능 도입여부 결정 |
| D5   | 버전 관리 방식 | 자동 저장 이력 + 수동 스냅샷 병행                     |                                                |
| D6   | 댓글 위치 지정 | 블록 단위                                             |                                                |

