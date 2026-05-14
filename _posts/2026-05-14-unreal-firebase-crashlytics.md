---
layout: post
title: "UE5 모바일 게임에 Firebase Crashlytics 깔끔하게 붙이기"
title_en: "Integrating Firebase Crashlytics into a UE5 Mobile Game"
date: 2026-05-14 17:00:00 +0900
categories: ["unrealengine"]
tags: ["ue5", "firebase", "crashlytics", "mobile", "android", "ios", "gameinstance", "delegate"]
excerpt: "Core/Crashlytics 모듈 분리부터 자동 키, MOBILE_LOG 미러링, 옵트인까지 한번에 잡은 통합기"
excerpt_en: "End-to-end integration of Firebase Crashlytics into UE5 mobile: module split, automatic keys, log mirroring, opt-in."
---

UE5 모바일 게임을 운영하다보면 크래시 추적 도구가 진짜 필수다. iOS는 App Store Connect, Android는 Play Console에도 크래시 보고가 오긴 한다. 근데 두 콘솔 따로 봐야하고 custom key/log 기능도 약해서 결국 Firebase Crashlytics를 붙이게 된다.

근데 SDK만 그냥 붙이는 게 아니라 **모듈 분리 + 자동 키 + MOBILE_LOG 미러링 + 옵트인 UI까지** 한 번에 구조 잡았다. 그 결과를 정리한다.

## 왜 Core랑 Crashlytics를 분리했냐

처음엔 그냥 `UMyProjectFirebaseManager` 하나에 다 때려박을까 했는데, Firebase는 어차피 나중에 Analytics, Remote Config, FCM 같은 거 추가할 가능성이 크다. SDK 자체 초기화(`FIRApp.configure()` / `FirebaseApp.initializeApp()`)는 **한 번만 호출하면 되니까** 그걸 Core로 분리해두고, 각 서비스가 그 위에 얹히는 구조가 깔끔하다.

```
Source/MyProject/Firebase/
├── FirebaseCore/                          ← SDK 초기화 1회 (다른 서비스도 재사용)
│   ├── MyProjectFirebaseCore.h
│   └── MyProjectFirebaseCore.cpp
├── Crashlytics/                           ← Crashlytics 매니저
│   ├── MyProjectFirebaseCrashlytics.h
│   ├── MyProjectFirebaseCrashlytics.cpp
│   └── MyProjectFirebaseCrashlyticsTypes.h
├── Android/                               ← JNI 핸들러
├── iOS/                                   ← Obj-C++ 핸들러
└── Firebase_UPL.xml                       ← Gradle/Manifest 주입
```

GameInstance가 두 매니저 다 들고있는 패턴. AdMob, DeepLink랑 동일한 컨벤션이라 익숙하다.

```cpp
// UMyProjectGameInstance.h
private:
    UPROPERTY()
    TObjectPtr<UMyProjectFirebaseCore> FirebaseCore;

    UPROPERTY()
    TObjectPtr<UMyProjectFirebaseCrashlytics> FirebaseCrashlytics;
```

## 자동 키 4종 박아두기

크래시 보고에 매번 따라붙으면 좋은 메타데이터를 Initialize에서 그냥 박아넣는다.

```cpp
void UMyProjectFirebaseCrashlytics::ApplyAutomaticKeys()
{
    if (State != ECrashlyticsState::Active) return;

    SetCustomKey(TEXT("environment"), ResolveEnvironmentTag());           // "d"/"s"/"r"
    SetCustomKey(TEXT("build_version"), FApp::GetBuildVersion());
    SetCustomKey(TEXT("build_configuration"), ResolveBuildConfiguration()); // "Shipping" 등
    SetCustomKey(TEXT("engine_version"), FEngineVersion::Current().ToString());
}

FString UMyProjectFirebaseCrashlytics::ResolveEnvironmentTag() const
{
#if defined(RELEASE_SERVER) && RELEASE_SERVER
    return TEXT("r");
#elif defined(STAGING_SERVER) && STAGING_SERVER
    return TEXT("s");
#else
    return TEXT("d");
#endif
}
```

`environment`는 dev/staging/release를 한 글자로 박아둔다. `Build.cs`의 `RELEASE_SERVER`/`STAGING_SERVER` define을 그대로 활용. 이거 박아두면 Crashlytics 대시보드에서 환경별로 필터링이 된다. d 빌드 크래시랑 r 빌드 크래시를 따로 보는 게 가능해진다.

수동 키는 두 개만 잡았다:
- `user_id`: 로그인 후 응답에서 받는 **내부 멤버 ID** (이메일/닉네임 절대 X — PII)
- `current_level`: 레벨 진입 시 자동 후킹

![Crashlytics Keys for UE5](/assets/images/unreal-firebase-crashlytics/crashlytics-keys.png)


## PostLoadMapWithWorld 함정

`current_level`을 자동 후킹하려고 `FCoreUObjectDelegates::PostLoadMapWithWorld`에 바인딩만 해두면 될 줄 알았다.

```cpp
PostLoadMapHandle = FCoreUObjectDelegates::PostLoadMapWithWorld.AddUObject(
    this, &ThisClass::OnPostLoadMap);
```

근데 PIE에서 테스트해보니 `LV_MainHome`에 들어와있는데도 `OnPostLoadMap`이 **안 불린다**.

원인은 단순했다. GameInstance::Init()이 호출되는 시점이 이미 첫 맵 로딩 이후라서, 우리가 바인딩한 시점엔 이미 broadcast가 끝난 뒤다. 그리고 이 프로젝트는 웹툰 플랫폼이라 `LV_MainHome`에서 다른 레벨로 거의 안 가서 평생 다시 안 불릴 가능성이 컸다.

해결은 단순. 등록 직후 현재 월드 있으면 한 번 수동 호출:

```cpp
PostLoadMapHandle = FCoreUObjectDelegates::PostLoadMapWithWorld.AddUObject(
    this, &ThisClass::OnPostLoadMap);

// 등록 시점에 이미 월드가 로드돼있으면 즉시 한 번 적용
if (UWorld* CurrentWorld = GetWorld())
{
    OnPostLoadMap(CurrentWorld);
}
```

이거 빼먹으면 `current_level` 키가 영원히 비어있는 채로 크래시 보고 날아간다. 비슷한 패턴 쓰는 시스템 많이 봤는데 이 한 줄 빼먹는 경우 꽤 있다.

## MOBILE_LOG 미러링 (이게 진짜 꿀이다)

프로젝트에 이미 Shipping에서도 동작하는 `MOBILE_LOG` 매크로가 있다. 글로벌 multicast delegate(`GOnMobileLog`)로 broadcast하는 구조.

크래시 진단할 때 가장 도움 되는 게 **"직전에 뭘 했는지" 컨텍스트**다. 그래서 MOBILE_LOG가 호출되는 모든 곳이 Crashlytics 로그에도 자동으로 미러링되게 했다.

```cpp
// Crashlytics::Initialize 끝부분
if (State == ECrashlyticsState::Active)
{
    MobileLogHandle = GOnMobileLog.AddUObject(this, &ThisClass::OnMobileLogReceived);
    FlushMobileLogBuffer();  // Initialize 이전에 쌓인 버퍼도 흘려보냄
}
```

```cpp
void UMyProjectFirebaseCrashlytics::OnMobileLogReceived(const FString& Timestamp, const FString& Message)
{
    Log(FString::Printf(TEXT("[%s] %s"), *Timestamp, *Message));
}
```

이러면 **기존 코드 한 줄도 안 바꾸고** 모든 MOBILE_LOG가 Crashlytics 로그 버퍼에 자동으로 쌓인다.

여기서 중요한 건 Crashlytics 로그의 작동 모델:
- **정상 종료**: 버퍼 폐기, 서버 전송 X (트래픽 0)
- **크래시 발생**: 다음 실행 시 마지막 64KB가 stack trace랑 같이 1회 업로드

즉 비용은 거의 0인데 크래시 났을 때 직전 행동이 그대로 보인다. 진짜 미러링 안 할 이유가 없다.


## AppsFlyer 이후에 초기화해야 한다

Crashlytics는 자기 signal handler를 등록한다. AppsFlyer도 비슷한 짓을 한다. 둘이 같은 SIGSEGV에 대해 충돌하면 한쪽이 묻힐 수 있어서, **Firebase가 AppsFlyer 이후에 초기화되어야** 신호 처리 우선권을 갖는다.

DeepLinkManager가 내부에서 AppsFlyer `configure`를 호출하니 그것보다 뒤에 둔다:

```cpp
// GameInstance::Init()
Super::Init();

// 1) DeepLink + AppsFlyer 먼저
DeepLinkManager->Initialize(this);

// 2) Firebase는 그 뒤에
FirebaseCore = NewObject<UMyProjectFirebaseCore>(this);
if (FirebaseCore) FirebaseCore->Initialize(this);

FirebaseCrashlytics = NewObject<UMyProjectFirebaseCrashlytics>(this);
if (FirebaseCrashlytics) FirebaseCrashlytics->Initialize(this);
```

순서 바꿔도 당장은 빌드되고 동작하는 것처럼 보이는데, 실제 크래시 났을 때 둘 중 한쪽 보고가 누락될 수 있다. 디버깅하다가 미치는 종류.

## 옵트인 UI

GDPR 같은 거 생각하면 사용자가 끌 수 있어야 한다. `GGameUserSettingsIni`에 영구 저장:

```cpp
bool UMyProjectGameInstance::GetCrashReportingConsent() const
{
    bool bConsent = true;  // 기본값 ON
    GConfig->GetBool(TEXT("Privacy"), TEXT("CrashReportingEnabled"), bConsent, GGameUserSettingsIni);
    return bConsent;
}

void UMyProjectGameInstance::SetCrashReportingConsent(bool bConsent)
{
    GConfig->SetBool(TEXT("Privacy"), TEXT("CrashReportingEnabled"), bConsent, GGameUserSettingsIni);
    GConfig->Flush(false, GGameUserSettingsIni);

    if (FirebaseCrashlytics)
        FirebaseCrashlytics->SetCollectionEnabled(bConsent);
}
```

설정 화면 UMG에 CheckBox 추가하고 `OnInitialized`에서 `GetCrashReportingConsent`로 초기값, `OnCheckStateChanged`에서 `SetCrashReportingConsent` 호출하면 끝.

Init() 마지막에 저장된 consent 적용도 잊지 말기:
```cpp
if (FirebaseCrashlytics)
    FirebaseCrashlytics->SetCollectionEnabled(GetCrashReportingConsent());
```

![UE5 Crash Report 전송](/assets/images/unreal-firebase-crashlytics/option-toggle.jpg)

## Editor에서도 검증되게

처음엔 Editor/Win64에서 Crashlytics를 그냥 no-op으로 처리했다. 근데 그러면 PIE에서 자동 키, MOBILE_LOG 미러링이 잘 도는지 검증을 못한다. 매번 디바이스 패키지 빌드 올려야 확인이 됨. 너무 비효율.

해결: **Editor에서도 State=Active로 두고 모든 API가 UE_LOG로만 흐르게**.

```cpp
// Crashlytics::Initialize 내부
#if PLATFORM_ANDROID
    if (AndroidFirebaseCrashlyticsHandler::Initialize())
        State = ECrashlyticsState::Active;
    else
        State = ECrashlyticsState::Disabled;
#elif PLATFORM_IOS
    if (IOSFirebaseCrashlyticsHandler::Initialize())
        State = ECrashlyticsState::Active;
    else
        State = ECrashlyticsState::Disabled;
#else
    // Editor/Win64: native SDK 없음. State=Active로 두고 UE_LOG만 흐르게.
    State = ECrashlyticsState::Active;
#endif
```

각 API 메서드 안에서도 native 호출만 PLATFORM 가드로 막고, UE_LOG는 무조건 흐르게:

```cpp
void UMyProjectFirebaseCrashlytics::SetCustomKey(const FString& Key, const FString& Value)
{
    if (State != ECrashlyticsState::Active) return;
    UE_LOG(LogFirebase, Verbose, TEXT("[Crashlytics] SetCustomKey(%s=%s)"), *Key, *Value);
#if PLATFORM_ANDROID
    AndroidFirebaseCrashlyticsHandler::SetCustomKey(Key, Value);
#elif PLATFORM_IOS
    IOSFirebaseCrashlyticsHandler::SetCustomKey(Key, Value);
#endif
}
```

이러면 Editor에서 BP로 호출 → Output Log에서 호출 흐름 검증 가능. 실기기에선 native까지 가서 진짜 동작. 두 마리 다 잡는다.

## ForceTestCrash 안전장치

수동으로 크래시 일으키는 테스트용 API. 라이브 빌드에 노출되면 누군가 실수로 누를 수도 있어서 이중 가드:

```cpp
UFUNCTION(BlueprintCallable, Category = "Firebase|Crashlytics", meta = (DevelopmentOnly))
void ForceTestCrash();

void UMyProjectFirebaseCrashlytics::ForceTestCrash()
{
#if UE_BUILD_SHIPPING || WITH_EDITOR
    UE_LOG(LogFirebase, Warning, TEXT("[Crashlytics] ForceTestCrash ignored (Shipping/Editor)"));
#else
    *(volatile int*)0 = 0;  // 의도적 SIGSEGV
#endif
}
```

`meta = (DevelopmentOnly)`로 BP 노드도 Development 빌드에서만 노출. 검증할 때만 가드 일시 풀고 빌드, 끝나면 복구.

## 결과

크래시 일으키면 Crashlytics 대시보드에 stack trace가 UE C++ 함수명까지 deobfuscated 되어 들어온다.

![Crashlytics Stack Trace for UE5](/assets/images/unreal-firebase-crashlytics/stacktrace.png)

`UMyProjectFirebaseCrashlytics::ForceTestCrash` → `UFunction::Invoke` → `UObject::CallFunction` → ... → `UButton::SlateHandleClicked` 까지 호출 chain이 그대로 보인다. 어떤 버튼이 트리거했는지까지 추적 가능.

단, 이게 보이려면 **iOS dSYM, Android NDK native symbol 업로드 자동화**가 빌드 스크립트에 같이 들어가있어야 한다. 이건 다음에 기회가 된다면..

## 정리

- **Core + Service 모듈 분리**: 다음에 Analytics/Remote Config 추가해도 깔끔
- **자동 키 4종**: environment, build_version, build_configuration, engine_version
- **수동 키 2종만**: user_id (로그인 시), current_level (PostLoadMap 자동 후킹 + 초기 1회 수동 호출)
- **MOBILE_LOG 미러링**: 기존 로그 코드 안 건드리고 크래시 컨텍스트 풍부하게
- **AppsFlyer 이후 초기화**: signal handler 우선권
- **Editor도 동작**: PLATFORM 가드는 native 호출만, UE_LOG는 무조건 흐르게
- **옵트인 영구 저장**: `GGameUserSettingsIni`의 `[Privacy] CrashReportingEnabled`

PII는 코드 강제가 아니라 정책으로만 잡았다. 코드 리뷰에서 user_id 자리에 이메일/닉네임 안 넣게 보는 정도. 진짜 강제하려면 wrapper에서 정규식 검사하는 방법도 있는데 그건 좀 과한 것 같았다.
