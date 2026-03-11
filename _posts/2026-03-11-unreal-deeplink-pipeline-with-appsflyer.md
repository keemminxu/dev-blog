---
layout: post
title: "언리얼 엔진에서 딥링크 연동하기 — AppsFlyer OneLink 파이프라인 전체 정리"
date: 2026-03-11 18:00:00 +0900
categories: [unreal-engine]
tags: [deep-link, appsflyer, onelink, mobile, cpp, blueprint]
excerpt: "AppsFlyer OneLink를 활용해 언리얼 엔진 모바일 앱에 딥링크를 연동하는 전체 파이프라인을 정리한다. URL이 생성되는 순간부터 앱 안에서 특정 화면이 열리기까지, 그 사이에 무슨 일이 벌어지는지 한눈에 볼 수 있다."
---

딥링크라는 게 개념은 단순하다. 링크를 누르면 앱의 특정 화면이 열리는 것. 그런데 막상 구현하려고 보면 "이 URL이 어디서 만들어져서, 어떻게 앱까지 도달하고, 앱 안에서 누가 받아서 처리하는 거지?"라는 의문이 꼬리를 문다.

이 글에서는 AppsFlyer의 OneLink를 사용해서 언리얼 엔진 모바일 앱에 딥링크를 연동하는 **전체 파이프라인**을 처음부터 끝까지 정리한다.

---

## 큰 그림부터 보자

딥링크의 여정을 한 줄로 요약하면 이렇다:

```
웹에서 공유 URL 생성 → 사용자 클릭 → 앱 실행 → URL 수신 → 파싱 → 화면 이동
```

좀 더 구체적으로 펼치면:

```
[OneLink URL]
  https://myapp.onelink.me/AbCd/share?deep_link_value=myapp://episode/abc-123
         ↓
[AppsFlyer SDK]  ←  앱에 설치된 SDK가 URL을 받아서
         ↓
[플랫폼 핸들러]  ←  iOS / Android 각각의 네이티브 코드가 중계
         ↓
[C++ DeepLinkManager]  ←  URL을 파싱하고 타입/ID를 분류
         ↓
[Delegate 브로드캐스트]  ←  "이런 딥링크 왔어요" 이벤트 발행
         ↓
[Blueprint]  ←  실제 화면 전환, API 호출 등 처리
```

각 단계를 하나씩 뜯어보자.

---

## 1단계: OneLink URL — 딥링크의 출발점

웹이나 다른 앱에서 공유 버튼을 누르면 이런 URL이 만들어진다:

```
https://myapp.onelink.me/SpvA/release?deep_link_value=myapp%3A%2F%2Fepisode%2Fabc-123
```

URL 디코딩하면 핵심이 보인다:

| 부분 | 의미 |
|------|------|
| `myapp.onelink.me` | AppsFlyer OneLink 도메인 |
| `/SpvA/release` | OneLink 템플릿 + 캠페인 |
| `deep_link_value` | **실제 딥링크 값** |

결국 앱이 최종적으로 받는 건 `deep_link_value` 안에 담긴 `myapp://episode/abc-123`이다. 나머지는 AppsFlyer가 어트리뷰션 추적용으로 쓰는 포장지 같은 것.

---

## 2단계: 앱 진입 — Direct vs Deferred

사용자가 링크를 클릭했을 때, 앱이 이미 설치되어 있느냐 아니냐에 따라 경로가 갈린다.

### Direct Deep Link (앱 설치됨)

```
링크 클릭 → 앱 바로 실행 → AppsFlyer가 OnAppOpenAttribution 콜백 호출
```

앱이 있으니까 바로 열린다. 심플.

### Deferred Deep Link (앱 미설치)

```
링크 클릭 → 스토어로 이동 → 설치 → 첫 실행 → AppsFlyer가 OnConversionDataReceived 콜백 호출
```

앱이 없어서 스토어를 거친다. AppsFlyer가 "이 사람이 원래 어떤 링크를 눌렀었는지" 기억해뒀다가, 설치 후 첫 실행 때 전달해준다. 꽤 마법 같은 기능이다.

**중요한 차이**: Direct는 즉시 실행하고, Deferred는 **저장만 해뒀다가 로그인 후에 실행**한다. 처음 설치한 사용자는 로그인부터 해야 하니까.

---

## 3단계: AppsFlyer SDK 초기화

앱이 시작될 때 AppsFlyer SDK를 초기화하고 콜백을 바인딩한다.

```cpp
void UDeepLinkManager::Initialize(UGameInstance* InGameInstance)
{
    // AppsFlyer 설정
    UAppsFlyerSDKBlueprint::configure();

    // 콜백 바인딩 후 시작 (약간의 딜레이를 줘서 안정적으로)
    FTimerHandle Timer;
    World->GetTimerManager().SetTimer(Timer, [this]()
    {
        BindAppsFlyerCallbacks();
        UAppsFlyerSDKBlueprint::start();
    }, 0.1f, false);
}
```

콜백 바인딩에서는 AppsFlyer가 제공하는 4가지 이벤트를 연결한다:

```cpp
void UDeepLinkManager::BindAppsFlyerCallbacks()
{
    // AppsFlyerSDKCallbacks 오브젝트를 찾아서
    for (TObjectIterator<UAppsFlyerSDKCallbacks> Itr; Itr; ++Itr)
    {
        UAppsFlyerSDKCallbacks* Callbacks = *Itr;

        // 기존 바인딩 정리 후 C++로 재바인딩
        Callbacks->OnAppOpenAttribution.Clear();
        Callbacks->OnConversionDataReceived.Clear();

        Callbacks->OnAppOpenAttribution.AddDynamic(this, &UDeepLinkManager::OnDirectDeepLinkReceived);
        Callbacks->OnConversionDataReceived.AddDynamic(this, &UDeepLinkManager::OnDeferredDeepLinkReceived);
    }
}
```

여기서 `.Clear()`를 호출하는 이유가 있다. Blueprint 쪽에서도 같은 콜백을 바인딩할 수 있는데, C++에서 일괄 관리하기 위해 기존 바인딩을 날리고 C++로 통일하는 것이다.

---

## 4단계: 플랫폼별 네이티브 핸들러

AppsFlyer SDK 콜백만으로는 모든 케이스를 커버하지 못한다. Custom URL Scheme이나 Universal Link / App Link로 직접 들어오는 경우도 처리해야 한다.

### iOS — Method Swizzling

iOS에서는 Objective-C의 Method Swizzling으로 `openURL`과 `continueUserActivity`를 후킹한다.

```
Custom Scheme:     myapp://episode/abc-123        → openURL 후킹
Universal Link:    https://myapp.world/episode/... → continueUserActivity 후킹
```

**Cold Start 대응**이 핵심이다. 앱이 완전히 종료된 상태에서 딥링크로 실행되면, 언리얼 엔진 초기화가 끝나기 전에 URL이 도착할 수 있다. 그래서 URL을 `NSString`으로 임시 저장해뒀다가, C++ 콜백이 설정되면 그때 전달한다.

### Android — JNI

Android에서는 Java의 Intent에서 딥링크 URL을 추출하고, JNI를 통해 C++로 전달한다.

```
Java: onNewIntent() → nativeOnDeepLinkReceived(url)
  → JNI → C++ GameThread에서 콜백 실행
```

iOS와 마찬가지로 Cold Start 시 URL을 임시 저장하는 로직이 필요하다.

---

## 5단계: URL 파싱 — 의미 있는 데이터로 변환

여러 경로로 들어온 URL이 결국 하나의 함수에 모인다:

```cpp
void UDeepLinkManager::OnDeepLinkReceived(const FString Deeplink)
{
    // "myapp://episode/abc-123" → "episode/abc-123"
    FString Path = ExtractDeepLinkPath(Deeplink);

    // "episode/abc-123" → Type: Episode, ID: "abc-123"
    ParseDeepLinkPath(Path, DeepLinkData.Type, DeepLinkData.ID);

    if (bLoggedIn)
        ExecuteDeepLink();       // 즉시 실행
    else
        Delegate.Broadcast();    // 로그인 후 실행되도록 저장
}
```

파싱 함수는 단순하다. URL 경로의 첫 세그먼트로 타입을 구분하고, 나머지를 ID로 쓴다:

```cpp
bool ParseDeepLinkPath(const FString& Path, EDeepLinkType& OutType, FString& OutID)
{
    if (Path.StartsWith(TEXT("character/")))
    {
        OutType = EDeepLinkType::Character;
        OutID = Path.Replace(TEXT("character/"), TEXT(""));
        return true;
    }
    else if (Path.StartsWith(TEXT("episode/")))
    {
        OutType = EDeepLinkType::Episode;
        OutID = Path.Replace(TEXT("episode/"), TEXT(""));
        return true;
    }
    return false;
}
```

새로운 딥링크 타입을 추가할 때는 여기에 `else if` 분기 하나만 추가하면 된다.

---

## 6단계: 실행 — Blueprint로 위임

`ExecuteDeepLink()`에서 타입별로 분기한다. 여기서 중요한 설계 판단이 있다.

Character나 Group처럼 C++에서 직접 위젯을 생성하고 API를 호출하는 방식도 가능하지만, **이미 Blueprint에 화면 로직이 구현되어 있다면 delegate로 넘기는 게 훨씬 깔끔하다**:

```cpp
void UDeepLinkManager::ExecuteDeepLink()
{
    if (DeepLinkData.Type == EDeepLinkType::Episode)
    {
        // BP로 위임 — delegate 브로드캐스트만 하고 끝
        OnDeepLinkReceivedDelegate.Broadcast(DeepLinkData);
        ResetDeepLink();
        bDeepLinkExecuting = false;
    }
}
```

Blueprint 쪽에서는 GameInstance의 delegate를 바인딩해서 처리한다:

```
GameInstance.OnDeepLinkReceivedDelegate
  → DeepLinkData.Type == Episode?
  → Yes → RequestGet_EpisodeDetail(DeepLinkData.ID)
  → 에피소드 상세 화면 열기
```

GameInstance에서 delegate를 중계하는 구조 덕분에, 레벨이 바뀌어도 딥링크 이벤트를 놓치지 않는다.

---

## 7단계: Deferred의 마지막 퍼즐 — 로그인 대기

Deferred 딥링크는 앱 첫 설치 후 들어오기 때문에, 사용자가 아직 로그인하지 않은 상태다. 이때는 데이터만 저장해두고, 로그인 완료 이벤트를 기다린다:

```cpp
void UDeepLinkManager::OnLoginComplete(...)
{
    if (DeepLinkData.Type == EDeepLinkType::None) return;

    // 레벨 전환이 완료될 때까지 잠시 대기
    FTimerHandle Timer;
    World->GetTimerManager().SetTimer(Timer, [this]()
    {
        ExecuteDeepLink();
    }, 1.5f, false);
}
```

1.5초 딜레이를 주는 이유는, 로그인 직후 메인 레벨로 전환되는 시간이 필요하기 때문이다. 전환이 끝나기 전에 delegate를 쏘면 받을 BP가 아직 로드되지 않았을 수 있다.

---

## 전체 흐름 한눈에 보기

```
                    [OneLink URL 클릭]
                          │
              ┌───────────┴───────────┐
              │                       │
        [앱 설치됨]              [앱 미설치]
              │                       │
         앱 바로 실행            스토어 → 설치 → 실행
              │                       │
      OnAppOpenAttribution    OnConversionDataReceived
         (Direct)                (Deferred)
              │                       │
              │                  데이터 저장만
              │                       │
              └───────┬───────────────┘
                      │
           OnDeepLinkReceived()
                      │
              URL 파싱 (Type + ID)
                      │
              ┌───────┴───────┐
              │               │
          [로그인 O]      [로그인 X]
              │               │
        ExecuteDeepLink()   로그인 대기
              │               │
         Delegate 발행    로그인 완료 후
              │          ExecuteDeepLink()
              │               │
              └───────┬───────┘
                      │
           Blueprint에서 처리
           (API 호출 → 화면 이동)
```

---

## 새 딥링크 타입을 추가할 때 체크리스트

나중에 `character/`, `group/`, `episode/` 외에 새 타입을 추가하고 싶다면:

1. **Enum 추가**: `EDeepLinkType`에 새 타입 추가
2. **파싱 추가**: `ParseDeepLinkPath()`에 `else if` 분기 추가
3. **실행 분기**: `ExecuteDeepLink()`에서 해당 타입 처리
4. **BP 처리**: delegate에서 새 타입 분기 → API 호출 → 화면 이동

C++ 쪽은 1~3번까지 각 5줄 내외의 수정이고, 실제 화면 로직은 Blueprint에서 처리하면 된다.

---

## 마무리

딥링크 파이프라인은 겉보기엔 복잡해 보이지만, 결국 **URL을 만들고 → 받고 → 파싱하고 → 실행하는** 네 단계다. AppsFlyer OneLink가 "만들고 받는" 부분을 처리해주고, 우리는 "파싱하고 실행하는" 부분에 집중하면 된다.

핵심 포인트를 정리하면:

- **OneLink URL**은 `deep_link_value` 파라미터에 실제 딥링크를 담는 포장지다
- **Direct vs Deferred**의 차이는 "즉시 실행" vs "저장 후 로그인 대기"
- **플랫폼 핸들러**(iOS Swizzling, Android JNI)는 Cold Start를 대비해 URL을 임시 저장하는 로직이 필수
- **C++에서 파싱, Blueprint에서 실행**하는 구조가 유지보수하기 편하다
- 새 타입 추가는 enum + 파싱 + 실행 분기 3곳만 건드리면 된다
