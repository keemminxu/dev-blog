---
layout: post
title: "언리얼 엔진 5.8 정리 — UE5 마지막 메이저, Claude MCP"
title_en: "Unreal Engine 5.8: The Last Major UE5 Release, MegaLights, Mobile Deferred, and the MCP Plugin"
date: 2026-07-07 11:46:23 +0900
categories: ["unrealengine"]
tags: ["unreal-engine", "ue5-8", "megalights", "lumen", "mcp", "mobile"]
excerpt: "State of Unreal 2026에서 나온 언리얼 5.8 핵심 정리. UE5의 마지막 메이저 릴리스이고, MegaLights가 Production-Ready로, Lumen Lite가 스위치 2 60fps를 노리고, MCP 플러그인으로 Claude를 에디터에 직접 연결할 수 있다. 모든 항목은 공식 출처 기준."
excerpt_en: "A source-checked rundown of Unreal Engine 5.8 — the final planned UE5 release: production-ready MegaLights, Beta Lumen Lite for Switch 2, a deferred mobile renderer, experimental Mesh Terrain, and an experimental MCP plugin that connects LLMs like Claude to the editor."
---

언리얼 엔진 5.8이 State of Unreal 2026에서 공개되고 같은 날 바로 풀렸다. 에픽 게임스 런처, GitHub, Linux 페이지에서 받을 수 있다.[^announce][^forum]

이번 버전은 기능 하나하나보다 **"UE5의 마지막 메이저 릴리스"**라는 위치가 더 큰 뉴스다. 에픽이 공식 공지에 이렇게 못 박았다.

> "UE 5.8 is the last planned major Unreal Engine 5 release on our roadmap as we ramp up work on UE6. We will continue to support UE5 for bug fixes and regressions, and may add another official release if circumstances warrant it."[^announce]

정리하면 계획상 5.x 메이저는 이게 끝이고, 앞으로 UE5는 버그/리그레션 수정 위주로만 간다. 필요하면 5.9를 낼 여지는 남겨뒀다.[^sou] 그러니까 지금 5.x로 굴러가는 프로젝트라면 5.8이 사실상 "정착 버전"이 되는 셈이다.

아직 직접 만져본 건 아니고, 공식 릴리스 노트랑 공지 기준으로 뭐가 바뀌었는지 정리해둔다. **각 기능 옆에 붙인 성숙도 라벨(Experimental / Beta / Production-Ready)이 제일 중요하다** — 프로덕션에 바로 쓸 수 있는지를 가르는 기준이라서. 라벨은 전부 공식 페이지 표기 그대로 옮겼다.

![언리얼 5.8 에디터에서 새 기능을 켜본 화면 캡처](/assets/images/ue5-8-new-features/editor-overview.jpg)

## MCP 플러그인 — 엔진에 LLM을 직접 연결 (Experimental)

개인적으로 제일 눈에 들어온 건 이거다. 5.8에 **MCP(Model Context Protocol) 플러그인**이 Experimental로 들어왔다. 릴리스 노트 표현은 이렇다.

> "MCP Server (Experimental) — With Unreal Engine 5.8, we bring a new experimental MCP (Model Context Protocol) plugin for the Unreal Editor. This plugin enables agentic AI systems to connect to the Unreal Editor."[^relnotes]

핵심은 LLM이 단순히 코드 받아쓰는 도우미가 아니라, 엔진이랑 프로젝트를 **이해하고 직접 조작하는** 쪽으로 간다는 거다. 블루프린트, 애셋, 레벨, 머티리얼, 메시 같은 코어 시스템에 기본으로 노출돼 있고, 직접 확장도 된다.[^announce] 모델은 안 가리고, 에픽이 State of Unreal 정리글에서 대놓고 Claude를 예시로 들었다.

> "Unreal Engine 5.8 introduces a new Experimental Model Context Protocol (MCP) plugin which enables developers to connect models like Claude directly to UE projects... build with Claude, Gemini, or whichever models best fit your needs."[^sou]

평소에 Claude 끼고 작업하는 입장에선, BP가 텍스트가 아니라서 LLM이 못 만지던 게 늘 아쉬웠는데 이쪽으로 길이 뚫린 게 반갑다. 아직 Experimental이라 프로덕션에 바로는 무리지만, 방향성은 확실하다. 참고로 이건 5.8 단발성 기능이 아니라 UE6 파이프라인의 일부로 가는 그림이다(아래 UE6 항목 참고).

![MCP 플러그인으로 Claude를 붙여서 에디터를 조작해본 데모 GIF](/assets/images/ue5-8-new-features/mcp-claude-demo.gif)

## 렌더링 / 라이팅

- **MegaLights → Production-Ready.** 5.5에서 나왔던 "라이트판 Nanite"가 드디어 프로덕션 레디가 됐다. 동적 그림자 area light를 잔뜩 깔면서 노이즈를 크게 줄였고, **현세대 콘솔에서 60fps 타깃**을 잡는다.[^relnotes][^announce] (2차 매체들은 이 "현세대 콘솔"을 PS5 / Xbox Series X\|S로 읽는다.[^gfs])
- **Lumen Lite (Beta).** Irradiance Field + Probe Occlusion 기반의 중간 품질 GI 모드. **Lumen High Quality 대비 약 2배 빠르다.** 그래서 GI를 아트 목적으로 쓰는 게임도 **닌텐도 스위치 2에서 60fps**를 노릴 수 있고, PC도 지원한다.[^announce] (릴리스 노트의 "60fps on PlayStation 5"는 비교 기준인 Lumen *High Quality* 쪽 얘기다. Lumen Lite 자체가 PS5 전용이란 뜻이 아니다.[^relnotes] 핸드헬드/저사양 PC 타깃이라고 보면 된다.[^forum])
- **Toon Shader (Experimental).** Substrate 프레임워크 위에 올린 NPR(논포토리얼) 셰이딩. 애니/카툰/손그림 스타일 흉내용이고, UE5 타깃 플랫폼 전부 지원한다.[^announce][^relnotes]
- **Fog Screen Space Scattering, FSSS (Experimental).** Volumetric Fog랑 Local Fog Volume에서 다중 산란을 근사해서 짙은 안개·연기·먼지를 더 뿌옇고 씬에 녹아들게 만든다.[^announce][^relnotes]
- **Accumulation Depth of Field.** Movie Render Graph로 여러 조리개 시점을 누적해서 패스 트레이서급 필름 피사계심도를 더 싼 비용에 뽑는다.[^relnotes]

## 모바일 — 이번 버전 숨은 핵심

모바일 클라 작업하는 입장에서 5.8은 렌더러 쪽이 꽤 크게 움직였다. 릴리스 노트 모바일 렌더러 항목이 이렇다.

> "Multi-pass deferred rendering as the default path across mobile platforms (with forward rendering still available as an opt-in). Broader use of GBuffer and depth data. Mobile support for SSAO, SSR, deferred decals, contact shadows, and higher-quality water rendering."[^relnotes]

- **모바일 기본 렌더 패스가 멀티패스 디퍼드로** 바뀌었다(포워드는 opt-in으로 남음). SSAO, SSR, 디퍼드 데칼, 콘택트 섀도, 고품질 물 렌더링이 모바일에서도 열렸다.[^relnotes]
- 타깃 머티리얼/글로벌 셰이더 패스에 **반정밀(FP16) 셰이더**를 도입해서 화질은 유지하면서 성능을 챙겼다.[^relnotes]
- **Android 개발 워크스테이션 셋업이 자동화**됐다(Turnkey 기반). 쿡 타임도 빨라졌다.[^relnotes][^announce]
- **Unreal Engine Remote 앱**으로 실기기에 빌드/배포 안 하고도 에디터에서 터치·제스처 입력을 테스트할 수 있다. Platform Preview도 실기기 출력에 더 가깝게 맞춰졌다.[^announce][^forum]
- **iOS / iPadOS 키보드·마우스 풀 지원**, iOS·Android **제스처 이벤트(Experimental)**, 그리고 **iOS Shader Model 6(Experimental)** — Apple의 Metal Shader Converter를 붙여서 Apple Silicon(A15 이상)에서 고급 GPU 기능을 연다.[^relnotes]

빈 프로젝트 패키징 용량 때문에 모바일에선 UE5가 늘 부담이었는데, 디퍼드가 모바일 기본이 되고 FP16까지 들어온 건 의미가 크다. 이건 직접 벤치 떠봐야 체감이 잡힐 듯.

## 월드빌딩

- **Mesh Terrain (Experimental).** 전통적인 2.5D 하이트필드가 아니라 **진짜 3D 메시 기반 지형 시스템**이다. 오버행, 떠있는 섬, 동굴·터널처럼 하이트맵으론 못 만들던 형상을 짠다. 에디터에서 직접 만들거나 외부 메시/하이트맵을 임포트할 수 있고, World Partition·OFPA·PCG랑 물려서 거리 기반 스트리밍이랑 협업 워크플로를 그대로 받는다.[^announce][^relnotes]
- **PCG 프레임워크 업데이트.** 절차적 생성물 위에 **수동 편집을 얹어도 절차성이 안 깨진다.** 배열·구조체·셋·맵 같은 복잡한 어트리뷰트 타입이 추가돼서 건물·도시 도로 같은 것도 뽑을 수 있다.[^announce][^relnotes]
- **Procedural Vegetation Editor, PVE (Experimental).** 엔진 안에서 생물학적으로 그럴듯한 Nanite-ready 식생을 키운다. 나무들이 빛 경쟁하면서 군집을 이루고, 외부 메시 주변으로도 자란다. 2D 스케치·사진을 입력으로 넣을 수도 있다.[^announce][^relnotes]
- **Fast Geometry Streaming (Experimental).** 작년 State of Unreal의 위쳐 4 테크 데모에 쓰였던 그 플러그인. 대규모 심리스 오픈월드용 정적 애셋 고속 로딩이고, 5.6 대비 속도·안정성·케이스 지원이 개선됐다.[^announce][^relnotes]

![Mesh Terrain으로 오버행/터널 지형을 만든 에디터 화면 캡처](/assets/images/ue5-8-new-features/mesh-terrain.gif)

## 캐릭터 / 애니메이션 / 메타휴먼

- **MetaHuman 군중 (Experimental).** 공식 공지는 "MetaHuman Collections"라는 새 애셋 타입으로, 릴리스 노트는 "MetaHuman Crowd" 섹션으로 부른다(같은 기능, 표기만 다름). 모바일에서 수백, 고사양에서 수천 단위 군중을 깐다. 카메라 거리에 따라 고품질 액터 ↔ 저품질 Instanced Skinned Mesh로 자동 전환된다.[^announce][^relnotes]
- **Mesh to MetaHuman 풀바디.** 기존엔 머리만 되던 게 **이제 바디까지** 컨폼된다. 아무 토폴로지의 휴먼 메시를 한 워크플로로 풀리깅된 메타휴먼으로 바꾼다.[^announce]
- **MetaHuman Animator 마커리스 캡처.** 목캡 리그·헬멧캠·마커 없이 **웹캠 한 대 오프액터 카메라로 얼굴·바디·전신**을 잡는다. 별도 Markerless Motion Capture 플러그인이고 Windows용으로 Fab에서 받는다.[^announce]
- **Control Rig Physics → Beta**, 그리고 **Control Rig Dynamics(신규)** — 런타임용 파티클 기반 솔버로, 기존 솔버보다 **5배 빠르게** 평가된다(정확도 ↔ 실시간 성능 트레이드오프).[^announce][^relnotes]
- **Direct Mesh Controls, DMC (Experimental).** 컨트롤 릭 컨트롤을 스켈레탈 메시 표면에 직접 얹어서, 캐릭터 표면을 만지듯 리깅한다. 페이셜에 특히 유용하다.[^announce][^relnotes]
- **OpenRigLogic / MetaHuman Devkit.** RigLogic이랑 DNA를 **MIT 라이선스 오픈소스**로 GitHub에 풀었다. 언리얼 밖의 다른 플랫폼/앱에도 메타휴먼 캐릭터 기술을 가져다 쓸 수 있게 하는 MetaHuman Devkit의 시작점이다.[^announce][^sou]

## Production-Ready로 승격된 것들

성숙도만 올라온(=이제 프로덕션에 써도 된다고 에픽이 보증한) 기능 모음:

| 기능 | 한줄 요약 | 출처 |
|---|---|---|
| Movie Render Graph | 그래프 기반 시네마틱 렌더, nDisplay 지원 | [^relnotes] |
| Live Link Hub | 목캡 데이터·디바이스 IP 제어·멀티캠 모니터링 단일 인터페이스 | [^announce] |
| Iris | 차세대 리플리케이션 시스템 (라이선시 대상 프로덕션 레디) | [^relnotes] |
| Mutable | 런타임 캐릭터 커스터마이징, 안정성·성능 개선 | [^relnotes] |
| Audio Insights | 라우드니스·시그널 플로우·라이브 이벤트 진단 툴 | [^relnotes] |
| Dataflow | 물리 기반 애셋 절차 생성 노드 시스템 (Chaos Destruction 연동) | [^announce][^sou] |
| Chaos Cloth | 새 Dataflow 기반 Cloth Panel Editor로 파이프라인 이전 | [^announce] |

기타 잡다하지만 알아두면 좋은 변경:

- **WASAPI가 Windows 기본 오디오 백엔드**가 됐다(XAudio2에서 교체, Xbox도 동일).[^relnotes]
- **에디터 기즈모 시스템 신규.** 레거시/커스텀 기즈모를 하나로 통합해서 일관성·정밀도를 올렸다.[^relnotes][^announce]
- 셰이더 컴파일 최적화 + 중복 제거로 **포트나이트 셰이더 수를 68% 줄였다.**[^sou]
- **Steam Frame 지원(Experimental).** 밸브의 차세대 XR 플랫폼 실험 지원.[^relnotes]

## UE6 로드맵 — 같이 알아둘 것

5.8이 마지막 UE5 메이저인 만큼, 같은 자리에서 UE6 방향도 공개됐다. 핵심 세 가지다.[^sou]

1. **게임플레이 프로그래밍을 Verse로** 이전 — C++를 트랜잭션화해서 접근성을 올리고, 수천 명이 기여하는 대규모 라이브 경험을 만들 수 있게.
2. **콘텐츠·코드·경제를 게임/생태계/엔진 간에 이식·상호운용** 가능하게 (오픈 표준 기반).
3. **MCP 같은 개발 파이프라인 기능**을 생산성 배율기로 — Claude, Gemini 등 통합.

얼리 액세스는 **2027년 말** 목표.[^sou] 그리고 차세대 오픈소스 버전 관리 시스템 **Lore**도 같은 날 무료로 풀렸다. 소스코드랑 바이너리 애셋을 한 번에 다루도록 설계된 VCS다.[^sou]

## 정리

- 5.8은 **계획상 UE5의 마지막 메이저.** 5.x 프로젝트는 이게 정착 버전이라고 보고 마이그레이션 계획을 잡으면 된다.
- 바로 프로덕션에 쓸 수 있는 건 **MegaLights, Movie Render Graph, Live Link Hub, Iris, Mutable, Audio Insights, Dataflow, Chaos Cloth** (전부 Production-Ready).
- **Mesh Terrain, Toon Shader, FSSS, MetaHuman 군중, DMC, MCP 플러그인**은 아직 **Experimental** — 실험·프로토타입엔 좋지만 프로덕션 의존은 보류.
- **Lumen Lite, Control Rig Physics**는 **Beta.**
- 모바일은 **디퍼드 기본화 + FP16 + Android 셋업 자동화**가 핵심. 모바일 타깃이면 따로 파볼 가치 있다.
- Claude 끼고 작업하는 사람한텐 **MCP 플러그인**이 제일 큰 떡밥. UE6 파이프라인의 일부라 5.8은 그 첫 발이다.

## 참고 이미지·영상 (공식 출처)

**기능 전반 이미지/영상** (Mesh Terrain, PVE, MegaLights, Lumen, FSSS, Toon Shader, MetaHuman, MCP 등 각 항목별 캡션 미디어): 공식 공지 페이지 [Unreal Engine 5.8 is now available][^announce]

**State of Unreal / UE6 / Lore 관련 이미지**: [State of Unreal 2026: Top news from the show][^sou]

**CG 아티스트 관점 5대 기능 + 데모 영상**(Mesh Terrain, MetaHuman Crowd, DMC, Control Rig Dynamics, MegaLights): [CG Channel 정리글][^cg]

## 출처

[^announce]: Epic Games, "Unreal Engine 5.8 is now available" (공식 공지) — <https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available>

[^relnotes]: Epic Games, "Unreal Engine 5.8 Release Notes" (공식 릴리스 노트) — <https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes>

[^sou]: Epic Games, "State of Unreal 2026: Top news from the show" — <https://www.unrealengine.com/news/state-of-unreal-2026-top-news-from-the-show>

[^forum]: Epic Developer Community Forums, "Unreal Engine 5.8 Released" — <https://forums.unrealengine.com/t/unreal-engine-5-8-released/2729274>

[^cg]: CG Channel, "Unreal Engine 5.8 is here: see its 5 key features for CG artists" (2차) — <https://www.cgchannel.com/2026/06/see-5-key-features-for-cg-artists-in-unreal-engine-5-8/>

[^gfs]: GameFromScratch, "Unreal Engine 5.8 Released" (2차) — <https://gamefromscratch.com/unreal-engine-5-8-released/>
