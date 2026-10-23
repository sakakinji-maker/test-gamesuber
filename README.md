# 정회성 | 게임 기획 · 제작 · QA 포트폴리오

> 플레이 경험을 규칙과 성장 구조로 설계하고, 플레이에서 발견한 문제를 개선 요구로 연결합니다.

**[게임 플레이](https://onecard-game.onrender.com)** · **[노션 포트폴리오](https://app.notion.com/p/401137cf520a818e95ecd37332cfd544)** · **[프로젝트 상세](docs/portfolio.md)** · **[QA 사례](docs/qa/README.md)**

## About

게임 기획을 지망하는 정회성입니다. 튜토리얼, 전투 규칙, 성장·수집 구조와 스토리를 기획하고, 플레이 피드백을 기능 요구와 QA 문서로 정리합니다.

이 저장소는 **GAME LAB 웹게임 6종의 구현 코드**와 **기획·QA 산출물**을 모은 공간입니다. 웹게임은 기능 요구와 플레이 피드백을 바탕으로 Codex와 협업하여 제작했습니다. 개인 역할은 기획 방향·요구사항·플레이 피드백을 중심으로 설명합니다.

## Selected Projects

| 프로젝트 | 기획 포인트 | 확인할 결과물 |
| --- | --- | --- |
| **한 수씩 배우는 쇼기** | 4개 난이도별 3문제, 총 12개 튜토리얼 → 전략 수업 → 대국 | [플레이](https://onecard-game.onrender.com/shogi/) · [규칙·소스](public/shogi/) |
| **한 수씩 배우는 바둑** | 12개 입문 문제와 9·13·19줄 연습, 사석 합의 흐름 | [플레이](https://onecard-game.onrender.com/baduk/) · [설계·소스](public/baduk/) |
| **10년 뒤에 나를 찾아줘** | 대화·기억·문서를 연결하는 15챕터 미스터리 | [플레이](https://onecard-game.onrender.com/unfinished/) · [기획서](docs/05_아직_끝나지_않은_문장_기획서.md) |
| **원카드** | 2–4인 대전, 차례와 카드 효과를 이해하기 쉬운 UI | [플레이](https://onecard-game.onrender.com/onecard/) · [QA 사례](docs/qa/web-games-qa.md) |
| **핵전쟁 서바이벌** | 위험 회피·전투·생존 기록의 짧은 반복 | [플레이](https://onecard-game.onrender.com/survival/) · [소스](public/survival/) |
| **대한민국 생태계교란종 잡기** | 탐험 → 약화 → 포획 → 도감으로 이어지는 교육형 RPG | [플레이](https://onecard-game.onrender.com/ecodex/) · [소스](public/ecodex/) |

게임 링크는 배포 경로입니다. 현재 서버 가동 여부와 실제 이용자 성과는 별도로 확인해야 합니다.

## QA Portfolio

| 구분 | 작업 내용 | 상세 자료 |
| --- | --- | --- |
| **웹게임 QA** | 원카드 규칙·UI 개선 기록, 쇼기·바둑·서사 게임 테스트 자료 | [웹게임 QA](docs/qa/web-games-qa.md) |
| **메이플스토리 월드 QA** | 콘테스트 준비 프로젝트의 전투·입력·성장·UI 관찰 40개 | [40개 이슈 보고서](docs/qa/maple-worlds-qa.md) · [콘테스트 준비 노션](https://app.notion.com/p/ad782c4386db82aaa1a0010f4f44ed59) |

메이플 월드 QA는 별도 프로젝트의 작업입니다. 53개 메모에서 중복 13개를 제거했으며, 상태는 모두 **재검증 필요**로 관리합니다. 관찰·기대 동작·검증 계획을 나누고, 수정 완료나 테스트 통과로 추정하지 않았습니다.

## Planning Archive

- **낚시 소녀:** 낚시·수집·판매·강화의 반복 구조와 지역별 성장 설계 — [기획·레벨 디자인](https://app.notion.com/p/401137cf520a81c2ae72dce2589516f8)
- **스토리·캐릭터·콘셉트 기획:** 최후의 소환, 나혼자만 알바생, 설정 UI 기반 던전 콘셉트 — [기획 모음](https://app.notion.com/p/401137cf520a815290f5f32b23d8008c)
- **학습·연구:** 이전 제작 이력과 확률 알고리즘 연구 계획 — [아카이브](https://app.notion.com/p/401137cf520a81dbace2e926de1520f8)

위 항목은 외부 기획 자료입니다. 이 저장소에 해당 게임의 실행 코드가 모두 포함되어 있다는 뜻은 아닙니다. 노션 자료는 페이지별 공유 권한에 따라 열람 범위가 다를 수 있습니다.

## 작업 방식

1. **목표 정의:** 플레이어가 무엇을 배우고, 선택하고, 반복할지 정리합니다.
2. **규칙 구체화:** 튜토리얼·보상·전투·화면 흐름을 기능 요구로 작성합니다.
3. **제작과 피드백:** AI와 협업해 구현하고 플레이하며 개선점을 기록합니다.
4. **검증 기록:** 관찰 현상과 기대 결과를 비교하고 재현 조건과 후속 확인을 남깁니다.

## 실행 안내

Node.js **22.5.0 이상**에서 저장소를 내려받은 후 실행합니다.

```bash
npm ci
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다. 포트 변경은 `PORT` 환경 변수로 설정합니다.

```bash
npm test
```

테스트 명령은 저장소의 자동화 테스트를 실행합니다. 실제 서비스 전체나 메이플 월드 게임의 QA 결과를 대신하지 않습니다.

| 경로 | 내용 |
| --- | --- |
| [public/](public/) | 게임별 화면·클라이언트·규칙 구현 |
| [server.js](server.js) | 웹 서버와 실시간 연결 |
| [gameEngine.js](gameEngine.js) | 원카드 게임 규칙 |
| [shogiMultiplayer.js](shogiMultiplayer.js) · [badukMultiplayer.js](badukMultiplayer.js) | 온라인 대국 처리 |
| [docs/](docs/) | 기획서·대본·QA 문서 |
| [tests/](tests/) | 규칙·화면·멀티플레이 자동화 테스트 |

기술: JavaScript · HTML/CSS · Canvas · Node.js · Socket.IO
