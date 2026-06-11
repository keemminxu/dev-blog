---
layout: post
title: "Unity를 써보자!"
title_en: "An Unreal Developer's First Unity Prototype: Engine Choice, Pitfalls, and a Vibe-Coding Workflow"
excerpt_en: "Why an Unreal developer picked Unity 6.3 LTS for a mobile puzzle prototype — with a Unity cheat sheet for Unreal devs, a pure-C# core testing workflow, and balance bugs caught on day one."
date: 2026-06-11 10:34:00 +0900
categories: [unity]
tags: [unity, unreal-engine, prototyping, vibe-coding, claude-code, game-balance]
excerpt: "모바일 퍼즐 게임 프로토타입을 Unity로 만들기로 했다. 엔진 선택 이유부터 설치 함정, 언리얼↔Unity 개념 매핑, 순수 C# 코어 분리 워크플로, 첫 플레이테스트에서 터진 밸런스 구멍까지."
---

언리얼을 전문으로 사용하다 이번에 개인 프로젝트로 모바일 퍼즐 게임을 만들기 시작했음. 결론부터 말하면 엔진은 Unity로 갈아탔고, 프로토타입이 돌아가기까지 생각보다 빨리나와 좋았다.

## 왜 Unity를 골랐나

1. **모바일 캐주얼에 UE5는 오버스펙이다.** 이 게임에서 Nanite, Lumen, 월드 스트리밍을 쓸 일이 0%다. 강점은 하나도 못 쓰면서 약점(패키징 용량)만 떠안게됨. 빈 프로젝트 APK 기준으로 UE5는 수십~수백 MB에서 시작하는데, Unity는 IL2CPP + 코드 스트리핑으로 한 자릿수 MB까지 깎인다. 다운로드 전환율이 중요한 캐주얼에서 이 차이가 크다고 느낌
2. **AI 협업(바이브 코딩) 친화도가 다르다.** 개발의 상당 부분을 Claude와 함께 진행하는데, LLM 입장에서 C#/Unity는 학습 자료가 압도적으로 많고, C++은 빌드 루프가 느리며, BP는 텍스트가 아니라서 아예 못 만짐
3. **엔진 숙련도보다 프로젝트 제약이 우선이다.** 언리얼 경험은 3D 좌표계나 렌더링 개념 이해로 어차피 이전된다. 익숙한 도구가 아니라 맞는 도구를 골라야 한다고 생각함

## 설치

### Unity는 엔진 소스를 빌드하지 않음

언리얼은 GitHub에서 엔진 풀 소스를 받아 직접 빌드할 수 있어서, Unity도 비슷한 게 있나 찾아봤다. 없다. GitHub의 `UnityCsReference`는 읽기 전용 참조 코드일 뿐 빌드가 안 된다. Unity Hub로 설치하면 끝이고, 엔진 빌드에 반나절 쓸 일이 없다는 건 오히려 장점이라 생각함

### LTS

Unity Hub를 처음 켜면 최신 릴리스를 자동으로 설치해 줌. 여기에 함정이 있는데, 6.4 같은 '업데이트 릴리스'는 다음 릴리스가 나오는 순간 지원이 끝난다. 반면 6.3 LTS는 2년 지원임. 6.4 신기능 목록(DirectStorage, XR 관련)을 봐도 모바일 퍼즐에 필요한 게 하나도 없었다. 프로젝트를 한 버전으로 끝까지 가져가려면 LTS가 맞다고 한다.

![Unity Hub 에디터 설치 화면 — 6.3 LTS와 6.4가 같이 보이는 버전 목록](/assets/images/unreal-dev-unity-prototype/unity-hub-versions.jpg)

**한 가지 주의!!!: 프로젝트를 한번 상위 버전으로 열면 다운그레이드가 안 된다. 첫 생성부터 LTS로 만들어야 한다.**

설치 옵션도 최소로 갔다. Visual Studio Community 체크 해제(VS Code면 충분하다), 플랫폼 빌드 모듈도 전부 해제. 프로토타입은 에디터 Play 모드로만 돌리니 Android 모듈은 실기기 테스트 단계에서 추가하면 된다. 모듈은 나중에 Hub에서 언제든 더할 수 있음

### Active Input Handling

Unity 6 템플릿으로 프로젝트를 만들면 입력이 `Input System Package (New)` 전용으로 잡힌다. 이 상태에서 구버전 `Input.mousePosition` 같은 API를 쓰면 런타임에 `InvalidOperationException`이 터진다. 프로토타입은 레거시 Input이 간편해서 `Edit → Project Settings → Player → Active Input Handling`을 `Both`로 바꿔서 해결했다. 언리얼로 치면 Enhanced Input만 켜진 프로젝트에서 구 입력 API를 부른 셈

## 간단한 언리얼 Unity 최소 치트시트

며칠 만져보고 정리한 개념 매핑이다. 이것만 알면 일단 굴러간다.

| 언리얼 | Unity | 메모 |
|---|---|---|
| `AActor` | `GameObject` | Unity 쪽은 상속 계층 없는 깡통. 전부 컴포넌트로 조립 |
| `UActorComponent` | `MonoBehaviour` | 로직은 여기에 쓴다 |
| `PostInitializeComponents` | `Awake` | 모든 Awake가 끝난 뒤에야 Start가 돈다 |
| `BeginPlay` | `Start` | 첫 프레임 직전. 사실 BeginPlay에 더 가까운 건 이쪽 |
| `Tick` | `Update` | 물리는 `FixedUpdate`, 카메라 후처리는 `LateUpdate` |
| `UPROPERTY(EditAnywhere)` | `public` 필드 / `[SerializeField]` | 매크로 없이 그냥 노출된다 |
| Blueprint 클래스 | Prefab | 중첩·변형(variant)도 된다 |
| `UDataAsset` | `ScriptableObject` | 데이터 테이블 용도 |
| GameMode / PlayerController | **없음** | 게임 프레임워크가 없어서 엔트리 포인트를 직접 만든다 |

관례 하나: 자기 초기화는 `Awake`, 다른 객체 참조는 `Start`. 실행 순서가 보장되기 때문

그 외 체감 차이:

- **헤더 파일이 없다.** C#은 선언=정의라 .h/.cpp 왕복이 없고, UHT/GENERATED_BODY 같은 코드젠도 없음. 에디터로 포커스만 옮기면 몇 초 만에 리컴파일됨. 언리얼 C++ 빌드 루프에 익숙하면 체감이 꽤 큼
- **`.meta` 파일은 전부 커밋해야 함** 에디터가 모든 에셋/폴더 옆에 자동 생성하는 사이드카인데, 안에 든 GUID가 에셋 참조의 식별자다. 이걸 .gitignore로 막거나 파일 탐색기에서 에셋만 옮기면 참조가 다 깨진다. 파일 이동은 에디터 안에서 하는 게 안전
- **Play 모드 중 수정은 전부 롤백** 플레이 중에 인스펙터 값을 바꾸고 "오 좋네" 했다가 정지하는 순간 다 날아간다고 함

## 바이브 코딩 워크플로: 순수 C# 코어 분리

이번 프로토타입에서 제일 잘한 결정. 코드를 두 층으로 나눴다.

```
Assets/Scripts/
  Core/    ← UnityEngine을 전혀 모르는 순수 C# (게임 규칙, 정산, 뽑기)
  Unity/   ← MonoBehaviour 레이어 (렌더링, 입력, HUD)
```

언리얼로 치면 엔진 비종속 모듈과 게임플레이 모듈을 .Build.cs로 나누는 발상이다. 이렇게 하면 두 가지가 가능해진다.

**첫째, Unity 없이 게임 로직을 테스트할 수 있다.** Core는 평범한 C#이라 dotnet CLI만으로 컴파일하고 돌릴 수 있음. 점수 계산이 결정론적 순수 함수라서, 기획서의 예시 수치를 그대로 검증할 수 있었음

```csharp
// Unity 없이 dotnet run으로 도는 검증 코드
var grid = new GridModel();
grid.Place(2, 1, PieceId.Bee);
grid.Place(2, 2, PieceId.Sunflower);
var result = ScoringEngine.Evaluate(grid);
Check("칩 합계", result.TotalChips, 37);   // 기획서 수치와 일치해야 통과
```

![dotnet 스모크 테스트 콘솔 출력 — PASS 줄들과 ALL PASS가 보이는 터미널](/assets/images/unreal-dev-unity-prototype/smoke-test-output.jpg)

**둘째, AI가 만질 수 있는 영역이 극대화된다.** 씬 작업을 0으로 만들었다. 그리드, 카메라, 라이트, HUD 전부 코드에서 생성하고, 씬에는 빈 GameObject에 부트스트랩 컴포넌트 하나만 붙임. 씬/프리팹은 YAML이라 AI가 다루기 까다롭지만 .cs 파일은 그냥 텍스트다. 결과적으로 AI가 코드를 쓰고, 사람은 Play 눌러서 손맛만 판단하는 분업이 가능

![프로토타입 플레이 — 3택1 캡슐 선택, 그리드 클릭 배치, 정산 점수 카운트업까지 한 사이클](/assets/images/unreal-dev-unity-prototype/proto-gameplay.jpg)

## 결론

엔진은 숙련도가 아니라 프로젝트 제약으로 골라야 할듯. 모바일 캐주얼 + AI 협업이면 언리얼 개발자라도 Unity가 맞는거 같음.

진짜 야무지게 한번 만들어보자!

