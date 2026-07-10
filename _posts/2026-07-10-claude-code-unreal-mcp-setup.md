---
layout: post
title: "언리얼 MCP 서버 Claude Code 연동"
title_en: "Connecting an Unreal Engine MCP Server to Claude Code"
excerpt_en: "How Claude Code discovers MCP servers, why a generated .mcp.json in the wrong directory silently does nothing, and the one-liner that actually registers the server."
date: 2026-07-10 15:05:00 +0900
categories: [unrealengine]
tags: [claude-code, mcp, unreal-engine, model-context-protocol, dev-environment]
excerpt: "언리얼 MCP 플러그인, Claude Code의 MCP 스코프 3종과 claude mcp add 한 줄로 연동한 기록. 덤으로 툴셋 구조 훑어보기와 WBP 생성·레벨 배치 테스트."
---

미루고 미루다 언리얼 에디터를 Claude Code에서 조작해 보려고 MCP 플러그인을 세팅했다. UE 5.8 기준으로 엔진에 `ModelContextProtocol`(표시명 **Unreal MCP**)이라는 Experimental 플러그인이 있다. 기본 비활성이라 플러그인 창에서 켜줘야 한다. 활성화하니 `127.0.0.1:8000` HTTP 엔드포인트를 열어줌

![플러그인 창에서 Unreal MCP(ModelContextProtocol) 플러그인을 활성화하는 화면](/assets/images/claude-code-unreal-mcp-setup/enable-plugin.png)

![에디터 개인설정 창에서 Unreal MCP(ModelContextProtocol) 플러그인을 설정하는 화면](/assets/images/claude-code-unreal-mcp-setup/editor-pref.png)

셋업을 끝내면 지정된 위치에 `.mcp.json` 파일이 생성됨

정확한 위치는 출력로그 보면 나옴

```json
{
    "mcpServers":
    {
        "unreal-mcp":
        {
            "type": "http",
            "url": "http://127.0.0.1:8000/mcp"
        }
    }
}
```

플러그인이 에디터 안에서 로컬 HTTP 서버(포트 8000)를 띄우고, 이 파일이 그 주소를 가리키는 구조

## .mcp.json은 "프로젝트 루트" 파일

Claude Code가 `.mcp.json`을 읽는 조건은

**클로드 코드 세션을 연 폴더(프로젝트 루트)에 그 파일이 있을 것** 

`.mcp.json`이 어디에 생성됐는지는 플러그인/스크립트마다 다르니, 연동이 안 되면 제일 먼저 이 파일이 **어느 폴더에** 있는지부터 확인하면 됨

## Claude Code의 MCP 스코프 3종

파일을 옮기기 전에 알아둘 게 있다. Claude Code에 MCP 서버를 등록하는 방법은 스코프가 3가지다.

| 스코프 | 저장 위치 | 적용 범위 | 특징 |
|---|---|---|---|
| `local` (기본) | `~/.claude.json` (프로젝트별 항목) | 이 프로젝트에서 나만 | 레포에 파일이 안 생김 |
| `project` | 프로젝트 루트 `.mcp.json` | 이 프로젝트의 팀 전체 | 레포에 커밋되는 걸 전제로 함 |
| `user` | `~/.claude.json` (전역) | 모든 프로젝트에서 나만 | 어디서든 사용 가능 |

`.mcp.json`을 프로젝트 루트로 복사하는 건 `project` 스코프를 쓰겠다는 뜻. 팀원 모두에게 공유할 설정이라면 그게 맞지만, 혼자 개발 중인 로컬 서버라면 `local` 스코프로 설정하면 됨

## 해결: claude mcp add 한 줄

프로젝트 폴더에서 이거 한 줄이면 끝난다.

```bash
claude mcp add --transport http unreal-mcp http://127.0.0.1:8000/mcp
```

스코프 옵션을 안 주면 `local`이라서, 설정은 `~/.claude.json`의 해당 프로젝트 항목에 들어간다. 레포는 깨끗하게 유지된다. 모든 프로젝트에서 쓰고 싶으면 `--scope user`를 붙이면 된다.

등록이 됐는지는 바로 확인할 수 있다.

```bash
claude mcp list
```

```
unreal-mcp: http://127.0.0.1:8000/mcp (HTTP) - √ Connected
```

![claude mcp list 출력에서 unreal-mcp가 Connected로 표시된 터미널 캡처](/assets/images/claude-code-unreal-mcp-setup/claude-mcp-list.png)

`claude mcp list`는 등록 확인만 하는 게 아니라 실제로 각 서버에 헬스체크를 날린다. 여기서 Connected가 뜨면 서버까지 살아 있다는 뜻

혹시나 안보인다면 세션을 새로 열자!

등록 후에 세션을 새로 열어야 도구가 잡힌다. 새 세션에서 `/mcp`를 치면 연결 상태와 도구 목록이 보이고, 도구들은 `mcp__unreal-mcp__*` 같은 이름으로 등록됨

## 서버가 살아 있는지 직접 확인하는 법

연동 전에 서버 자체가 떠 있는지 궁금하면 그냥 브라우저나 curl로 찔러보면 되는데, 여기서 헷갈리기 쉬운 게 하나 있다.

```
curl http://127.0.0.1:8000/mcp
→ 405 Method Not Allowed
```

**405가 정상** MCP의 streamable HTTP 전송은 POST 전용 엔드포인트라서 GET을 거부. 405가 떴다는 건 "서버가 살아서 요청을 거부할 정신은 있다"는 뜻이고, 진짜 문제일 때는 connection refused가 뜸

## 툴이 3개뿐?

연동하고 나서 tools/list를 까보면 도구가 딱 3개다

```
list_toolsets    :: 사용 가능한 툴셋 목록
describe_toolset :: 툴셋 하나의 도구·스키마 상세
call_tool        :: 툴셋 안의 도구를 이름으로 호출
```

처음엔 "이게 다야?" 싶었는데, `list_toolsets`를 호출해 보면 실제 기능이 많음. 내 환경 기준 툴셋이 50개가 넘는다. 대충 훑어보면:

- **씬/레벨**: 액터 배치·제거, 레벨 로드, 뷰포트 카메라, 아웃라이너 정리 (SceneTools, ActorTools)
- **애셋**: 콘텐츠 브라우저 탐색, 애셋 조회·수정, 하이브리드(벡터+BM25) 시맨틱 애셋 검색
- **블루프린트/오브젝트**: BP 편집, UObject 프로퍼티 조회·수정, 클래스 탐색 (ObjectTools)
- **UMG**: 위젯 블루프린트 생성과 위젯 트리 조작
- **머티리얼/메시/텍스처**: 머티리얼·머티리얼 인스턴스 생성 편집, 스태틱/스켈레탈 메시 검사
- **나이아가라**: 시스템·이미터·모듈 편집까지 툴셋 5개로 세분화
- **시퀀서**: 시퀀스 생성, 키프레이밍, 컨트롤릭 애니메이션까지 툴셋 8개
- **에디터 제어**: 콘솔 변수, PIE 세션 제어, 출력 로그 읽기, 자동화 테스트 실행, 슬레이트 UI 자동화(에디터 UI를 Playwright처럼 조작)

평소엔 메타 도구 3개만 노출하고, 필요할 때 `describe_toolset`으로 스키마를 받아 `call_tool`로 호출하는 지연 로딩 구조를 택한 것. 직접 MCP 서버를 만들 일이 있다면 참고할 만한 설계

## 직접 해본 것: WBP 생성과 레벨 오브젝트 배치

가볍게 두 가지를 시켜봤다. 하나는 위젯 블루프린트(WBP)를 만들어 위젯 트리를 구성하는 것, 하나는 열려 있는 레벨에 오브젝트를 배치하는 것

![프롬프트 위젯 생성](/assets/images/claude-code-unreal-mcp-setup/umg-widget-test2.png)

![Claude Code 프롬프트로 위젯 블루프린트를 생성·편집한 결과 — UMG 디자이너에 열린 위젯 트리와 사용한 프롬프트](/assets/images/claude-code-unreal-mcp-setup/umg-widget-test1.png)

UMG 툴셋에서 재밌는 디테일 하나

툴 설명 자체에 이런 워크플로가 박혀 있다 — "위젯 프로퍼티 이름은 클래스마다 달라 추측이 불가능하니, 반드시 `list_properties`로 정확한 이름을 확인한 뒤 `set_properties`를 호출할 것. 건너뛰면 조용히 실패함"

AI가 프로퍼티 이름을 지어내다 망하는 패턴을 스키마 차원에서 막아둔 건데, 사람 팀원한테 주는 온보딩 문서 같은 게 도구 설명에 들어가 있는 셈

![프롬프트](/assets/images/claude-code-unreal-mcp-setup/scene-actor-placement2.png)

![레벨 뷰포트에 프롬프트로 오브젝트가 배치](/assets/images/claude-code-unreal-mcp-setup/scene-actor-placement1.png)

레벨 배치는 SceneTools 담당이다. 액터 스폰·제거·트랜스폼 조정에 아웃라이너 폴더 정리까지 이 툴셋으로 돌아간다. "어디에 뭘 놔줘" 수준의 지시가 뷰포트에 바로 보이는 결과로 돌아오니 체감이 확실

## 운영하면서 알아둘 것

토큰만 넉넉하면 괜찮게 쓸거같기도..?


다만 아직은 에셋 하나 생성하는데 시간이 생각보다 오래 걸린다
