# Typing Arena MVP 기능정의서

- 작성일: 2026-03-19
- 문서 버전: 0.2
- 문서 목적: 클로즈드 베타 개발 착수용 기능정의
- 대상: PM, FE, BE, Infra, QA

## 1. 문서 요약

Typing Arena는 `글로벌 웹 브라우저 기반`, `영어 단일 입력 체계`, `1v1 실시간 순수 레이스`를 핵심으로 하는 경쟁형 타자 게임이다.
MVP는 `게스트 연습`, `회원가입 후 랭크전`, `비공개 초대방`, `전적/리더보드/기본 시즌 구조`까지 포함한 `Competitive Platform MVP`를 목표로 한다.

이 문서는 다음을 바로 개발 가능한 수준으로 고정한다.
- 제품 범위와 제외 범위
- 화면 목록과 사용자 플로우
- 경기 규칙, 판정식, 랭크 정책
- 실시간 매치 상태 전이
- REST/WebSocket API 초안
- 데이터 모델 초안
- 비기능 요구사항과 운영 최소선
- 단계별 개발 순서와 병렬 작업 단위

## 2. 고정 의사결정

| 항목 | 결정 |
|---|---|
| 타깃 시장 | 글로벌 |
| 1차 플랫폼 | 데스크톱 웹 브라우저 |
| 입력 체계 | 영어만 지원 |
| 코어 모드 | 동일 문장을 동시에 입력하는 1v1 실시간 순수 레이스 |
| 접근 정책 | 게스트는 연습 가능, 회원가입 후 랭크전 가능 |
| 멀티플레이 범위 | 자동 랭크 매칭 + 비공개 초대방 |
| 출시 수준 | 클로즈드 베타 |
| 제품 포지셔닝 | 타자 연습 툴이 아니라 경쟁형 게임 |
| 인증 기본안 | 게스트 세션 + Google OAuth 기반 회원가입/로그인 |
| 베타 통제 | 계정 생성 시 초대코드 기능 플래그 지원, 기본값 ON |
| 랭크 구조 | Elo 스타일 RS + 티어 표시 |
| 시즌 구조 | Season 0부터 시작, 수동 시즌 전환 |

## 3. 목표와 비목표

### 3.1 목표

- 첫 방문 사용자가 3분 이내 첫 타자 세션을 시작할 수 있다.
- 가입 사용자가 10초 내외로 랭크 매칭 또는 명확한 대기 상태를 경험한다.
- 같은 문장, 같은 시작 시점, 같은 입력 규칙을 기반으로 공정한 1v1 대결을 제공한다.
- 친구 초대 링크만으로 빠르게 비공개 1v1 경기를 시작할 수 있다.
- 결과 화면에서 승패, WPM, 정확도, RS 변동을 즉시 이해할 수 있다.
- 운영자가 경기 로그와 계정 상태를 추적할 수 있다.

### 3.2 비목표

- 다국어 입력 지원
- 공개 방 브라우징
- 스킬, 아이템, 방해 요소
- 토너먼트, 클랜, 친구 시스템, 채팅
- 고급 훈련 기능(약점 키 분석, 레슨, 연습 커리큘럼)
- 결제, 광고, 상점, 코스메틱
- 풀 애니메이션 리플레이 뷰어
- 모바일 브라우저 최적화

## 4. 사용자 유형과 권한

| 사용자 | 가능한 행동 | 제한 |
|---|---|---|
| Guest | 홈 진입, 솔로 연습, 비공개 방 참가, 임시 닉네임 설정 | 랭크전 불가, RS/전적 저장 불가, 방 생성 불가 |
| Registered Player | 비공개 방 생성, 비공개 방 참가, 전적/리더보드 조회 | 베타 승인 전에는 랭크전 불가 |
| Ranked-Eligible Player | 랭크전, 비공개 방 생성, 비공개 방 참가, 전적/리더보드 조회 | 비공개 방도 랭크 반영 불가 |
| Admin | 유저 조회, 경기 조회, 방 상태 조회, 프롬프트 비활성화, 베타 플래그 조정 | 게임 플레이 주체 아님 |

추가 규칙:
- 랭크전 진입 조건은 `로그인 완료 + 계정 활성 상태 + 베타 접근 허용`이다.
- 베타 초대 기능 플래그가 OFF면 로그인만으로 랭크전 진입이 가능하다.
- 한 사용자는 동시에 하나의 랭크 큐 또는 하나의 방에만 속할 수 있다.
- 랭크 큐 대기 중에는 비공개 방 참여가 불가능하다.
- 경기 중 새 랭크 큐 진입은 불가능하다.

## 5. 핵심 게임 규칙

### 5.1 프롬프트 규칙

| 항목 | 규칙 |
|---|---|
| 언어 | 영어만 허용 |
| 소스 | 운영자가 등록한 검수 완료 프롬프트만 사용 |
| 길이 | 35-55 단어, 180-260자 권장 |
| 문자 범위 | 영문 대소문자, 공백, 일반 구두점(`. , ! ? ' \" : ; -`)만 허용 |
| 금지 | 이모지, 줄바꿈, 탭, 특수기호 다량 포함 문장, 숫자 중심 문장 |
| 정규화 | 공백은 단일 스페이스로 정규화, 양끝 공백 제거 |
| 난이도 | MVP에서는 단일 표준 난이도 풀만 랭크전에 사용 |
| 공정성 | 동일 경기의 두 플레이어는 같은 `prompt_id`와 `checksum`을 받는다 |

### 5.2 입력/판정 규칙

- 게임은 `정확히 다음에 와야 할 문자`를 기준으로 판정한다.
- 대소문자, 공백, 구두점까지 `표시된 프롬프트와 정확히 일치`해야 한다.
- 플레이어 입력은 로컬에서 즉시 반영하되, 최종 진척도와 결과는 서버가 확정한다.
- 잘못된 문자를 입력하면 현재 위치가 `mistake` 상태가 되며, 올바르게 수정되기 전까지 진척도는 증가하지 않는다.
- `Backspace`는 가장 최근의 미확정 오입력을 제거한다.
- 붙여넣기(`paste`)는 랭크전과 비공개 방 모두 차단한다.
- 허용 입력 장치는 `데스크톱 브라우저의 물리 키보드`다.
- IME/composition 입력, 가상 키보드, 모바일 자동수정, dead key 기반 조합 입력은 지원하지 않는다.
- 브라우저 자동완성, 커서 이동, 드래그 선택, 중간 삽입 입력은 지원하지 않는다.

### 5.3 경기 시작/종료 규칙

- 경기 성립 조건은 다음 두 가지를 모두 만족해야 한다.
  - 두 플레이어가 모두 `match.loaded`를 보낸다.
  - 서버가 `countdown.start`와 공식 시작 시각을 발급한다.
- 카운트다운은 3초이며, 시작 시각 전 입력은 무시한다.
- 경기 공식 시작 시각은 서버 시간 기준이다.
- 승자는 `서버 기준으로 전체 프롬프트를 먼저 정확히 완료한 플레이어`다.
- 동시 완료 판정은 허용하지 않는다. 서버 확정 완료 시각이 더 빠른 쪽이 승리한다.
- 최대 경기 시간은 120초다.
- 120초 내 미완료 시 우선순위는 다음과 같다.
  - 더 높은 `progress`
  - 같은 progress이면 더 높은 `accuracy`
  - 같은 accuracy이면 더 짧은 `elapsed_ms`
  - 모두 같으면 무승부
- 경기 시작 후 종료하지 않고 이탈하면 패배 처리한다.
- 경기 시작 전 상대가 이탈하거나 로딩 실패하면 `no result`다.
- 경기 시작 후 연결이 끊기면 10초 재연결 유예를 제공하고, 복구 실패 시 패배 처리한다.
- 경기 시작 후 30초 동안 `올바른 문자 1개 이상`을 입력하지 못하면 inactivity forfeit 처리한다.

### 5.4 지표 계산식

```text
accuracy = correct_keypresses / (correct_keypresses + incorrect_keypresses) * 100
wpm = (correct_chars / 5) / (elapsed_seconds / 60)
progress = correct_chars / total_prompt_chars
```

규칙:
- `correct_chars`는 서버가 승인한 정확한 문자 수다.
- `incorrect_keypresses`는 잘못 입력된 키 수다.
- 결과 화면의 WPM은 `correct_chars` 기반으로 계산한 값만 노출한다.
- 승패는 WPM이 아니라 `공식 완료 순서` 또는 `timeout tie-breaker`로 결정한다.

## 6. 랭크 정책

### 6.1 RS 정책

- 랭크전 전용 점수는 `RS(Rank Score)`다.
- 신규 가입 사용자는 `1000 RS`로 시작한다.
- 첫 10경기는 provisional 상태다.
- 결과 화면과 프로필에 `Placement X/10` 형태로 provisional 진행률을 표시한다.
- provisional 동안에도 현재 RS와 티어는 표시한다.
- 연습, 비공개 방은 RS에 영향을 주지 않는다.
- 경기 시작 후 이탈/연결 끊김 종료는 패배다.
- 경기 시작 전 취소/로딩 실패는 RS 변동이 없다.

### 6.2 RS 계산식

```text
expected = 1 / (1 + 10 ^ ((opponent_rs - my_rs) / 400))
k = 48 if ranked_games < 10 else 32
delta = round(k * (actual - expected))
```

- 승리 `actual = 1`
- 패배 `actual = 0`
- 무승부 `actual = 0.5`

### 6.3 티어 구간

| 티어 | RS 범위 |
|---|---|
| Bronze | 0-899 |
| Silver | 900-1099 |
| Gold | 1100-1299 |
| Platinum | 1300-1499 |
| Diamond | 1500+ |

### 6.4 매치메이킹 정책

- 기본 큐는 `지역 우선`, `유사 RS 우선`이다.
- 탐색 범위는 다음 순서로 확장한다.
  - 0-5초: 같은 지역, RS 차이 ±100
  - 5-15초: 같은 지역, RS 차이 ±200
  - 15-30초: 같은 지역, RS 차이 ±300
  - 30초 이후: 인접 지역 확장 가능, 단 예측 RTT 180ms 이하이고 양측 RTT 차이 80ms 이하일 때만 허용
- 60초를 초과하면 큐 timeout 상태로 전환하고 사용자에게 `재시도`, `연습`, `비공개 방 이용` 옵션을 보여준다.
- 랭크전은 명백히 불공정한 cross-region 매칭을 허용하지 않는다.

### 6.5 시즌 정책

- MVP는 `Season 0`로 시작한다.
- 현재 시즌 리더보드만 노출한다.
- 시즌 리셋은 자동화하지 않고 관리자 수동 전환으로 처리한다.
- 시즌 전환 시 이력 보존 방식은 차기 버전에서 별도 정의한다.

## 7. MVP 기능 범위

### 7.1 포함 기능

- 홈 화면과 모드 진입점
- 게스트 세션 발급
- Google OAuth 로그인/회원가입
- 베타 초대코드 검증 기능 플래그
- 솔로 연습 경기
- 랭크전 자동 매칭
- 비공개 초대방 생성/참가/준비/시작/재대결
- 실시간 레이스 HUD
- 결과 화면
- 프로필의 기본 전적 요약
- 현재 시즌 리더보드
- 최근 경기 내역
- 경기 상세 페이지(프롬프트, 스탯, 진행 타임라인)
- 최소 운영용 관리자 조회 기능

### 7.2 제외 기능

- 공개 커스텀 방 목록
- 관전 모드
- 채팅, 신고 고도화, 친구 추가
- 사용자 제작 프롬프트
- 멀티 인원전(FFA)
- 키보드 테마, 스킨, 배지, 업적
- 멀티 언어 큐 분리
- 모바일 UI

## 8. 화면 정의

### 8.1 화면 목록

| 화면 ID | 화면명 | 주요 사용자 | 목적 |
|---|---|---|---|
| SCR-01 | Home / Mode Select | Guest, Registered | Practice, Ranked, Create Room, Join Room 진입 |
| SCR-02 | Auth + Beta Access | Guest, Registered | Google 로그인, display name, 초대코드 입력 |
| SCR-03 | Ranked Queue | Ranked-Eligible | 랭크 대기 상태 표시, 취소 |
| SCR-04 | Private Room Lobby | Guest, Registered | 방 코드 공유, 슬롯 상태, Ready, Start |
| SCR-05 | Race Screen | Guest, Registered | 카운트다운, 실시간 입력, 상대 진행률 표시 |
| SCR-06 | Results Screen | Guest, Registered | 승패, WPM, 정확도, RS 변화, 재도전 CTA |
| SCR-07 | Profile / Match History | Registered | 현재 RS, 시즌 요약, 최근 경기 목록 |
| SCR-08 | Match Detail | Registered | 프롬프트, 결과, 진행 타임라인 |
| SCR-09 | Leaderboard | Registered | 현재 시즌 상위 랭커 조회 |

### 8.2 화면별 필수 요소

#### SCR-01 Home / Mode Select
- 버튼: `Practice as Guest`, `Ranked`, `Create Private Room`, `Join by Code/Link`
- Registered 사용자에게 현재 티어와 RS 표시
- 클로즈드 베타 상태 문구 표시
- Guest가 Ranked 선택 시 SCR-02로 이동
- 로그인했지만 베타 승인 전이면 Ranked 버튼은 잠겨 있고 승인 필요 상태를 표시한다.

#### SCR-02 Auth + Beta Access
- Google 로그인 버튼
- display name 입력 또는 최초 로그인 시 display name 설정 단계
- 베타 초대코드 입력 필드
- 약관 동의 체크박스
- 실패 상태: 만료 코드, 사용 불가 코드, 베타 수용량 초과
- MVP는 다중 로그인 수단 UI를 제공하지 않는다.

#### SCR-03 Ranked Queue
- 현재 티어, RS, 예상 대기시간, 선택 지역/핑 표시
- `Cancel Queue` 버튼
- 매칭 성공 시 자동으로 SCR-05 진입
- 큐 timeout 시 `Retry Queue`, `Practice`, `Create Private Room` CTA 제공
- 로딩 실패 시 이유와 재시도 안내

#### SCR-04 Private Room Lobby
- 6자리 초대 코드, 공유 링크 표시
- 2개 슬롯의 닉네임/연결 상태/Ready 상태 표시
- Host만 `Start` 가능
- `Start`는 두 플레이어가 모두 Ready일 때만 활성화된다.
- Guest도 참여 가능하나 방 생성은 Registered만 가능
- 결과 화면 이후 같은 방에서 `Rematch` 가능
- Host가 방을 떠나면 방은 종료되며 host reassignment는 MVP 범위에서 지원하지 않는다.

#### SCR-05 Race Screen
- 상단: 카운트다운 또는 연결 상태
- 중앙: 공용 프롬프트 텍스트
- 하단: 현재 입력 상태, caret 위치, mistake 표시
- 우측 또는 상단: 내 진행률, 상대 진행률, live WPM, live accuracy
- 시스템 배너: reconnecting, opponent disconnected, forfeit countdown

#### SCR-06 Results Screen
- 결과 배너: Win / Loss / Draw / Forfeit / No Result
- 표시값: finish time, WPM, accuracy, RS delta(랭크전만), provisional 진행률(해당 시)
- 액션: `Requeue`(랭크), `Rematch`(비공개 방), `Retry`(연습), `Home`
- Guest 대상 `Sign up for Ranked` CTA
- 소켓 단절로 결과 이벤트를 놓친 경우 `GET /v1/matches/{matchId}`를 통해 결과를 복구한다.

#### SCR-07 Profile / Match History
- 현재 시즌 RS, 티어, 경기 수, 승률
- provisional 상태라면 `Placement X/10` 표시
- 최근 20경기 목록
- 각 경기 클릭 시 Match Detail로 이동

#### SCR-08 Match Detail
- 사용 프롬프트 전문
- 최종 결과, 내/상대 스탯 비교
- 초 단위 진행률 타임라인 또는 누적 정확 타수 그래프
- 풀 애니메이션 리플레이는 제공하지 않음

#### SCR-09 Leaderboard
- 현재 시즌 Top 100
- 필드: 순위, 닉네임, RS, 경기 수, 승률
- 본인 순위는 범위 밖이어도 별도 노출 가능

## 9. 핵심 사용자 플로우

### 9.1 게스트 연습

`Home -> Practice as Guest -> Guest 세션 생성 -> Race Screen -> Results -> Retry 또는 Home`

세부 규칙:
- 첫 연습 진입은 최대 2클릭 이내여야 한다.
- 연습은 멀티플레이와 동일한 프롬프트 렌더링/입력 판정 규칙을 사용한다.
- 연습 결과는 저장하지 않아도 되지만, localStorage 기반 설정은 유지할 수 있다.

### 9.2 첫 랭크전 진입

`Home -> Ranked -> Auth + Beta Access -> Ranked Queue -> Match Assigned -> Race -> Results -> Requeue 또는 Home`

세부 규칙:
- Guest가 Ranked를 누르면 인증 플로우로 이동한다.
- 로그인 완료 후 원래 의도한 랭크 진입 흐름으로 복귀한다.
- 베타 초대코드 기능 플래그가 ON이면 계정 생성 시 반드시 검증한다.
- 로그인은 되었지만 베타 승인 전인 계정은 Queue로 진입하지 못하고 대기/초대코드 입력 상태를 본다.

### 9.3 비공개 방 생성/참가

Host:
`Home -> Create Private Room -> Lobby -> 링크/코드 공유 -> 상대 참가 -> 양측 Ready -> Host Start -> Race -> Results -> Rematch 또는 Leave`

Guest/Invitee:
`Home 또는 공유 링크 -> Join Room -> Guest 닉네임 입력 또는 로그인 -> Lobby -> Ready -> Race -> Results -> Rematch 또는 Exit`

세부 규칙:
- 방 코드는 6자리 영대문자+숫자 조합이다.
- 방 최대 인원은 2명이다.
- 관전자 슬롯은 없다.
- Host가 방을 의도적으로 나가면 방은 종료된다.
- 30분 무활동 시 방은 만료된다.

## 10. 예외/오류 상태 정의

반드시 UI로 표현해야 하는 상태:
- Guest가 Ranked 선택
- 로그인했지만 베타 접근이 승인되지 않음
- 잘못된/만료된 초대코드
- 초대방이 이미 경기 중이거나 꽉 참
- 베타 초대코드 만료 또는 사용 제한 초과
- 큐 대기 시간 초과
- 상대가 경기 시작 전 이탈
- 경기 중 상대 disconnect
- 내 연결 끊김 및 재연결 시도 중
- 프롬프트 로드 실패
- 결과 조회 실패
- IME/composition 활성화 상태 또는 지원하지 않는 입력 방식 감지

오류 UX 원칙:
- 사용자가 재시도 가능한지 즉시 이해할 수 있어야 한다.
- `no result`와 `forfeit loss`를 UI에서 명확히 구분한다.
- 경기 중 연결 문제는 별도 토스트가 아니라 고정 배너로 노출한다.
- 결과 전송은 서버가 수행한다. 클라이언트는 결과를 제출하지 않고, 필요 시 결과를 재조회한다.

## 11. 시스템 아키텍처 개요

| 계층 | MVP 기본안 | 설명 |
|---|---|---|
| Frontend | 브라우저 SPA | 홈, 인증, 큐, 방, 경기 HUD, 결과, 프로필 |
| Backend | REST + WebSocket를 함께 제공하는 modular monolith | auth, prompts, rooms, matchmaking, live match, rating, results 모듈 포함 |
| Realtime State | 서버 메모리 + Redis | 큐, 방 스냅샷, 경기 상태, reconnect token 관리 |
| DB | Postgres | 유저, 프롬프트, 경기 결과, RS, 신고, 관리자 조회 데이터 |
| Worker | 비동기 작업 전용 프로세스 | 리더보드 갱신, 오래된 방 정리, 분석 이벤트 적재 |
| Static Delivery | CDN/Edge | 정적 자산 전송 |

원칙:
- 경기 결과의 최종 권한은 서버에 있다.
- 클라이언트는 즉시성 확보를 위해 optimistic render를 사용하지만 결과 결정권은 없다.
- MVP에서는 서비스 분리를 하지 않고 모듈 분리만 한다.
- 추후 멀티 인스턴스 대응을 위해 큐와 라이브 매치 상태는 Redis 친화적으로 설계한다.

## 12. 실시간 권한 모델과 매치 상태 전이

### 12.1 권한 모델

- 클라이언트는 키 입력을 즉시 화면에 반영한다.
- 클라이언트는 각 입력을 `seq`가 있는 이벤트로 서버에 전송한다.
- 서버는 프롬프트와 이전 상태를 기준으로 입력을 재계산해 공식 progress를 갱신한다.
- 서버가 보낸 progress가 클라이언트 로컬 상태와 다르면 클라이언트는 즉시 보정한다.
- 상대 플레이어에게는 서버 승인 progress만 보여준다.
- 종료 순서, timeout, forfeit, RS 반영은 모두 서버가 확정한다.

### 12.2 상태 전이

| 상태 | 설명 | 주요 전이 |
|---|---|---|
| `room_open` | 비공개 방 생성 완료, 참가 대기 | 둘 다 입장 후 `loading` |
| `queueing` | 랭크 매칭 대기 | 매칭 성공 시 `loading` |
| `loading` | 매치 생성 후 양측 클라이언트 attach 대기 | 양측 ready 시 `countdown`, 실패 시 `aborted` |
| `countdown` | 서버 기준 3초 카운트다운 | 시작 시각 도달 시 `racing` |
| `racing` | 실시간 경기 진행 | 1명 완료 시 `finish_wait`, 중도 이탈 시 `forfeit` |
| `finish_wait` | 한 명 완료 후 상대 종료 또는 timeout 대기 | 종료 또는 120초 도달 시 `completed` |
| `completed` | 결과 확정 및 저장 완료 | 결과 화면 진입 |
| `aborted` | 경기 성립 전 취소 | RS 반영 없음 |
| `forfeit` | 경기 성립 후 이탈/무응답 종료 | 패배 처리 |

### 12.3 상태별 disconnect/leave 규칙

| 구간 | 발생 이벤트 | 결과 |
|---|---|---|
| Room Lobby | Host leave | 방 종료 |
| Room Lobby | Guest leave | 방 유지, Guest 슬롯 비움 |
| Loading | 한 명 로드 실패/이탈 | `aborted`, no result |
| Countdown | 한 명 이탈 | `aborted`, no result |
| Racing | 한 명 disconnect | 10초 reconnect grace 후 실패 시 해당 플레이어 forfeit |
| Finish Wait | 미완료 플레이어 disconnect | 10초 grace 후 실패 시 forfeit, 완료 플레이어 승리 확정 |
| Completed 이후 | 클라이언트 disconnect | 결과는 이미 저장되어 재조회 가능 |

### 12.4 로딩/재연결 규칙

- `loading` 상태에서 각 클라이언트는 10초 내 `match.loaded`를 보내야 한다.
- 한 플레이어가 기한 내 로드하지 못하면 `aborted` 처리한다.
- `racing` 상태에서 연결이 끊기면 10초 grace timer를 시작한다.
- reconnect 성공 시 서버 공식 상태로 복구한다.
- reconnect 실패 시 끊긴 플레이어를 `forfeit` 처리한다.

## 13. API 초안

### 13.1 REST API

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/v1/guest-sessions` | 게스트 세션 생성 |
| `GET` | `/v1/auth/google/start` | Google OAuth 시작 |
| `GET` | `/v1/auth/google/callback` | Google OAuth 콜백 |
| `POST` | `/v1/auth/logout` | 로그아웃 |
| `GET` | `/v1/me` | 내 프로필/권한 조회 |
| `PATCH` | `/v1/me/profile` | display name 등 기본 프로필 수정 |
| `POST` | `/v1/practice-matches` | 솔로 연습 경기 생성 |
| `POST` | `/v1/matchmaking/ranked/join` | 랭크 큐 진입 |
| `DELETE` | `/v1/matchmaking/ranked/join` | 랭크 큐 이탈 |
| `POST` | `/v1/rooms` | 비공개 방 생성 |
| `GET` | `/v1/rooms/{inviteCode}` | 방 상태 조회 |
| `POST` | `/v1/rooms/{inviteCode}/join` | 방 참가 |
| `POST` | `/v1/rooms/{inviteCode}/ready` | Ready 상태 변경 |
| `POST` | `/v1/rooms/{inviteCode}/start` | Host 시작 요청 |
| `POST` | `/v1/rooms/{inviteCode}/leave` | 방 이탈 |
| `POST` | `/v1/rooms/{inviteCode}/rematch` | 재대결 요청 |
| `GET` | `/v1/me/matches` | 최근 경기 목록 |
| `GET` | `/v1/matches/{matchId}` | 경기 상세 조회 |
| `GET` | `/v1/leaderboard/current` | 현재 시즌 리더보드 |
| `POST` | `/v1/matches/{matchId}/report` | 부정행위/오류 신고 |

### 13.2 WebSocket 이벤트

이벤트 envelope 기본형:

```json
{
  "type": "race.input",
  "requestId": "optional-client-id",
  "ts": 1773888000000,
  "payload": {}
}
```

#### Client -> Server

| Event | 주요 payload | 설명 |
|---|---|---|
| `session.auth` | session cookie 기반 식별 또는 guest token | WS 세션 인증 |
| `queue.join` | mode, regionPreference | 랭크 큐 진입 |
| `queue.leave` | reason | 랭크 큐 이탈 |
| `room.subscribe` | inviteCode | 방 구독 |
| `room.ready` | ready: boolean | 방 준비 상태 변경 |
| `room.start` | inviteCode | Host 경기 시작 요청 |
| `match.loaded` | matchId | 경기 화면 로드 완료 |
| `race.input` | matchId, seq, kind(`type`/`backspace`), value? | 입력 이벤트 |
| `race.leave` | matchId, reason | 경기 중 이탈 |
| `ping` | clientTs | heartbeat |

#### Server -> Client

| Event | 주요 payload | 설명 |
|---|---|---|
| `session.ok` | user/guest info, capabilities | 인증 완료 |
| `queue.status` | state, estimatedWait, region | 큐 상태 |
| `queue.matched` | matchId, opponent, region | 매칭 완료 |
| `room.snapshot` | room state, participants, ready states | 방 상태 |
| `match.assigned` | matchId, promptId, checksum | 경기 할당 |
| `match.state` | authoritative state | 상태 전이 알림 |
| `countdown.start` | serverStartAt | 공식 시작 시각 |
| `race.progress` | selfProgress, opponentProgress, stats | 공식 진행도 업데이트 |
| `opponent.presence` | connected/reconnecting/forfeited | 상대 연결 상태 |
| `race.result` | outcome, finishMs, accuracy, wpm, ratingDelta, persistedAt | 경기 결과 |
| `error` | code, message, retryable | 에러 응답 |

이벤트 설계 원칙:
- `seq`는 경기 단위로 단조 증가해야 한다.
- 중복/역순 이벤트는 서버가 무시하거나 재정렬하지 않고 폐기한다.
- `race.input`는 한 번에 하나의 문자 입력 또는 하나의 backspace만 허용한다.
- 결과는 서버가 DB 저장을 완료한 후 `race.result`를 내려야 한다.
- 결과 이벤트를 놓친 클라이언트는 `GET /v1/matches/{matchId}`로 회복한다.

## 14. 데이터 모델 초안

| 엔티티 | 저장소 | 핵심 필드 |
|---|---|---|
| `user_account` | Postgres | `id`, `google_sub`, `display_name`, `status`, `created_at` |
| `guest_session` | Postgres/Redis | `id`, `nickname`, `expires_at`, `fingerprint_hash` |
| `beta_invite` | Postgres | `code`, `status`, `max_uses`, `used_count`, `expires_at` |
| `prompt_catalog` | Postgres | `id`, `language`, `text`, `normalized_text`, `checksum`, `difficulty`, `active` |
| `private_room` | Postgres | `id`, `invite_code`, `status`, `host_user_id`, `created_at`, `expires_at` |
| `room_participant` | Postgres | `room_id`, `participant_type`, `participant_id`, `slot`, `ready_state`, `joined_at` |
| `queue_ticket` | Redis | `ticket_id`, `user_id`, `rating_snapshot`, `region`, `created_at` |
| `match` | Postgres | `id`, `mode`, `region`, `prompt_id`, `state`, `server_start_at`, `started_at`, `ended_at`, `winner_participant_id`, `outcome_type` |
| `match_participant` | Postgres | `match_id`, `participant_type`, `participant_id`, `slot`, `finish_ms`, `correct_chars`, `accuracy`, `wpm`, `rating_before`, `rating_after`, `forfeit_reason` |
| `match_event_log` | Postgres(JSONB) 또는 Object Storage | `match_id`, `timeline`, `rejected_inputs`, `created_at` |
| `season_rating` | Postgres | `season_id`, `user_id`, `rs`, `ranked_games`, `wins`, `losses`, `draws`, `provisional` |
| `abuse_report` | Postgres | `match_id`, `reporter_id`, `reason`, `created_at` |

저장 정책:
- 경기 결과와 RS는 Postgres에 영속 저장한다.
- 큐와 실시간 경기 상태는 Redis 우선이다.
- `match_event_log`는 MVP에서 7일 보관을 기본으로 하며, 장기 보관은 차기 버전 과제다.

## 15. 비기능 요구사항

### 15.1 지원 환경

- 지원: 데스크톱 Chrome/Edge 최신 2개 버전, Firefox 최신 2개 버전, Safari 최신 버전
- 미지원: 모바일 브라우저, 태블릿 터치 키보드, IME 기반 입력, 가상 키보드
- 하드웨어 키보드 사용을 전제로 한다.

### 15.2 성능/지연

| 항목 | 목표 |
|---|---|
| 첫 화면 상호작용 가능 시점 | 2.5초 이내 권장 |
| 로컬 키 입력 반응 | 즉시(프레임 단위) |
| 같은 지역 내 공식 progress 반영 | p95 150ms 이하 목표 |
| 카운트다운 표시 오차 | 100ms 이하 목표 |
| 큐 진입/이탈 API 응답 | p95 500ms 이하 |

### 15.3 공정성/안티치트 최소선

- 서버는 입력 순서와 프롬프트를 기반으로 공식 progress를 재계산해야 한다.
- 붙여넣기, 비선형 커서 이동, composition 입력을 차단해야 한다.
- 비정상 고속 입력, 낮은 분산의 반복 입력, 과도한 rejected input 비율은 로그로 남긴다.
- MVP에서는 자동 밴보다 `flag + 관리자 검토`를 우선한다.
- 경기 결과 저장은 idempotent 해야 한다. 동일 match에 중복 결과 반영이 일어나면 안 된다.

### 15.4 보안/운영

- 모든 네트워크 통신은 HTTPS/WSS를 사용한다.
- 브라우저 인증은 Secure, HttpOnly 세션 쿠키를 기본으로 한다.
- IP/계정 기준 rate limit이 필요하다.
- 초대방 코드는 예측하기 어렵게 생성한다.
- 구조화 로그에 `match_id`, `room_id`, `user_id`를 포함한다.
- 필수 메트릭: queue wait, match completion rate, disconnect rate, abort rate, input reject rate, result write failure count

### 15.5 관리자 최소 기능

- 유저 검색
- 특정 match 상세 조회
- 현재 열린 방 목록 조회
- stuck match/room 강제 종료
- 프롬프트 비활성화
- 베타 초대코드 발급/비활성화

## 16. 기능별 수용 기준

### 16.1 Home / Mode Entry
- 첫 화면에서 Practice, Ranked, Create Room, Join Room에 접근 가능해야 한다.
- Guest는 Ranked 선택 시 인증 화면으로 이동해야 한다.
- 베타 미승인 계정은 랭크 잠금 상태와 해제 방법을 확인할 수 있어야 한다.
- Registered는 현재 RS와 티어를 홈에서 확인할 수 있어야 한다.

### 16.2 Practice
- Guest는 2클릭 이내로 첫 연습을 시작할 수 있어야 한다.
- 연습은 멀티플레이와 동일한 입력 판정 로직을 사용해야 한다.
- 결과 화면에 WPM, 정확도, 소요 시간이 보여야 한다.

### 16.3 Ranked Queue
- Ranked-Eligible 사용자는 랭크 큐 진입/취소가 가능해야 한다.
- 매칭 성공 시 두 플레이어는 같은 프롬프트를 받아야 한다.
- 경기 성립 전 취소는 RS에 영향을 주지 않아야 한다.
- 60초 timeout 시 대체 행동 CTA가 제공되어야 한다.

### 16.4 Private Room
- Registered는 방을 생성할 수 있어야 한다.
- Guest도 링크 또는 코드로 방에 입장할 수 있어야 한다.
- 방 로비에서 두 플레이어의 presence와 ready 상태가 보여야 한다.
- Host는 두 명 모두 Ready일 때만 Start할 수 있어야 한다.
- 비공개 방 결과는 RS에 영향을 주지 않아야 한다.

### 16.5 Live Match
- HUD에 프롬프트, 입력 상태, 내 진행률, 상대 진행률, WPM, 정확도가 보여야 한다.
- 잘못된 입력은 진척도를 증가시키면 안 된다.
- 서버 공식 결과와 클라이언트 결과가 충돌하면 서버 결과가 우선해야 한다.
- reconnect 실패 시 패배 처리되어야 한다.

### 16.6 Results / History / Leaderboard
- 결과 화면은 Win/Loss/Draw/Forfeit/No Result를 구분해야 한다.
- 랭크전은 RS delta와 업데이트된 티어를 보여야 한다.
- provisional 경기 중이면 Placement 진행률이 표시되어야 한다.
- 프로필에서 최근 경기 내역을 확인할 수 있어야 한다.
- 리더보드는 현재 시즌 기준으로 계산되어야 한다.
- 결과 이벤트를 놓쳐도 경기 상세 재조회로 복구 가능해야 한다.

## 17. 권장 개발 순서

### Phase 1: Foundation
- 프로젝트 초기 구조
- 게스트 세션
- Google OAuth 로그인
- 프롬프트 카탈로그/정규화
- Home/Auth 기본 화면
- Practice 경기 생성과 솔로 Race Screen

### Phase 2: Realtime Core
- WebSocket 세션 관리
- 입력 이벤트 처리와 서버 공식 progress 계산
- Race Screen 실시간 HUD
- Results Screen
- match_event_log 기록

### Phase 3: Private Room
- 방 생성/참가/Ready/Start/Rematch
- 로비 상태 동기화
- reconnect/forfeit 처리

### Phase 4: Ranked
- 큐 진입/이탈
- 매칭 로직
- RS 계산
- 시즌 리더보드
- Profile / Match History / Match Detail

### Phase 5: Closed Beta Hardening
- 관리자 최소 기능
- 메트릭/로그/대시보드
- 초대코드 운영
- 오류 상태 UX 정리
- abuse report 수집

## 18. 병렬 개발 권장 분할

### Workstream A: Frontend UX
- SCR-01 ~ SCR-06 구현
- 경기 HUD와 결과 화면
- reconnect/에러 상태 UI

### Workstream B: Auth / Profile / Admin API
- guest session, Google OAuth, beta invite
- 프로필, 경기 이력, 리더보드 조회 API
- 관리자 조회 API

### Workstream C: Realtime Match Engine
- 방, 큐, 경기 상태 전이
- 입력 이벤트 처리
- 서버 공식 progress/finish 판정
- reconnect/forfeit/idempotent result 처리

### Workstream D: Data / Ops
- Postgres schema
- Redis state layout
- 로그/메트릭/알림
- prompt catalog 운영 도구

병렬 작업 원칙:
- Workstream C가 경기 도메인 계약을 먼저 고정한다.
- Workstream A는 WebSocket event contract mock으로 병행 개발한다.
- Workstream B와 D는 C와 겹치지 않는 범위에서 독립 진행 가능하다.

## 19. 차기 버전 후보

- 다국어 분리 큐
- 관전/스트리머 모드
- 공개 커스텀 방
- 풀 리플레이 뷰어
- 시즌 리셋 자동화
- 코스메틱/서포터 과금
- 팀전/토너먼트

