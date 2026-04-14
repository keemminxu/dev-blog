---
layout: post
title: "UE5 모바일 햅틱 - PlayDynamicForceFeedback 말고 네이티브 API로 iOS/Android 진동 넣기"
title_en: "UE5 Mobile Haptic Feedback - Native Vibration API for iOS and Android"
excerpt_en: "How to implement cross-platform haptic feedback in UE5 mobile games using Android Vibrator JNI and iOS AudioToolbox instead of the unreliable PlayDynamicForceFeedback."
date: 2026-03-31 02:00:00 +0900
categories: [unrealengine]
tags: [ue5, haptic, vibration, mobile, android, ios, jni, taptic-engine]
excerpt: "UE5의 PlayDynamicForceFeedback은 Android에서만 동작하고 iOS에서는 안 된다. 네이티브 API를 직접 호출하면 양쪽 다 확실하게 진동이 동작한다."
---

UE5에서 모바일 진동을 넣고 싶으면 보통 `PlayDynamicForceFeedback`을 먼저 시도한다. PlayerController에서 호출하면 Android에서는 진동이 오긴 온다. 근데 iOS에서는 아무 반응이 없다.

이유는 간단하다. `PlayDynamicForceFeedback`은 원래 게임패드/컨트롤러용 포스피드백 시스템이다. Android는 우연히 디바이스 진동기로 연결되지만, iOS는 그 경로가 없다. 엔진의 포스피드백 시스템이 iOS Taptic Engine까지 연결되지 않는 거다.

해결 방법은 엔진 시스템을 거치지 않고 **OS 네이티브 API를 직접 호출**하는 것이다.

## 구조

BlueprintFunctionLibrary 하나로 끝난다. 복잡한 매니저 패턴이 필요 없다.

```
Source/Haptic/
├── HapticService.h      # UENUM + 정적 함수 선언
└── HapticService.cpp    # Android JNI + iOS AudioToolbox
```

어디서든 한 줄로 호출:
```cpp
UHapticService::Trigger(EHapticType::Tap);
```

## 헤더

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HapticService.generated.h"

UENUM(BlueprintType)
enum class EHapticType : uint8
{
    Light,   // 아주 가벼운 피드백
    Tap,     // 버튼 탭 정도
    Medium,  // 중간
    Heavy    // 강한 진동
};

UCLASS()
class UHapticService : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "Haptic")
    static void Trigger(EHapticType Type = EHapticType::Light);
};
```

4단계로 나눈 이유는 Light가 너무 약하고 Medium은 좀 센 경우가 있어서다. Tap을 추가해서 일반적인 UI 탭 피드백에 쓰도록 했다.

## Android - JNI로 Vibrator API 호출

Android는 `android.os.Vibrator` 서비스를 JNI로 직접 호출한다.

```cpp
#if PLATFORM_ANDROID
#include "Android/AndroidJNI.h"
#include "Android/AndroidApplication.h"
#endif

// Android 구현부
if (JNIEnv* Env = FAndroidApplication::GetJavaEnv())
{
    int32 Duration, Amplitude;
    switch (Type)
    {
    case EHapticType::Light:  Duration = 20; Amplitude = 40;  break;
    case EHapticType::Tap:    Duration = 30; Amplitude = 80;  break;
    case EHapticType::Medium: Duration = 40; Amplitude = 120; break;
    case EHapticType::Heavy:  Duration = 60; Amplitude = 255; break;
    }

    // Context.getSystemService("vibrator")
    jclass ContextClass = Env->FindClass("android/content/Context");
    jmethodID GetSystemService = Env->GetMethodID(
        ContextClass, "getSystemService", "(Ljava/lang/String;)Ljava/lang/Object;");
    jobject Activity = FAndroidApplication::GetGameActivityThis();
    jstring ServiceName = Env->NewStringUTF("vibrator");
    jobject Vibrator = Env->CallObjectMethod(Activity, GetSystemService, ServiceName);

    // API 26+ (Android 8.0): VibrationEffect로 Amplitude 제어
    // API 25 이하: 레거시 vibrate(long) - Duration만 사용
    if (SdkInt >= 26)
    {
        // VibrationEffect.createOneShot(duration, amplitude)
        jclass VibrationEffectClass = Env->FindClass("android/os/VibrationEffect");
        jmethodID CreateOneShot = Env->GetStaticMethodID(
            VibrationEffectClass, "createOneShot", "(JI)Landroid/os/VibrationEffect;");
        jobject Effect = Env->CallStaticObjectMethod(
            VibrationEffectClass, CreateOneShot, (jlong)Duration, Amplitude);
        // vibrator.vibrate(effect)
        ...
    }
    else
    {
        // vibrator.vibrate(duration)
        ...
    }
}
```

API 26(Android 8.0) 이상이면 `VibrationEffect.createOneShot(duration, amplitude)`로 진동 강도까지 제어할 수 있다. 그 이하는 시간만 조절 가능하다.

Duration과 Amplitude 값은 실제 기기에서 테스트하면서 조정하면 된다. 위 값은 꽤 자연스럽게 느껴지는 수치다.

**중요**: `AndroidManifest.xml`에 VIBRATE 권한이 필요하다. UPL에 추가:

```xml
<androidManifestUpdates>
    <addPermission android:name="android.permission.VIBRATE" />
</androidManifestUpdates>
```

## iOS - AudioToolbox로 Taptic Engine 호출

iOS에서 진동을 넣으려면 보통 `UIImpactFeedbackGenerator`를 쓰는데, 이건 Objective-C API라서 `.mm` 파일이 필요하다. 문제는 UE5에서 `.mm` 파일을 쓰면 빌드 이슈가 생길 수 있다는 것이다. Android 빌드에서 `.mm` 파일이 컴파일 대상에 잡히면서 "Objective-C was disabled in PCH file" 에러가 난다.

그래서 `.mm` 파일 없이 C API인 `AudioServicesPlaySystemSound`를 쓴다:

```cpp
#if PLATFORM_IOS
#include <AudioToolbox/AudioServices.h>
#endif

// iOS 구현부
switch (Type)
{
case EHapticType::Light:
case EHapticType::Tap:
    AudioServicesPlaySystemSound(1519);  // Peek - 가벼운 탭
    break;
case EHapticType::Medium:
    AudioServicesPlaySystemSound(1520);  // Pop - 중간
    break;
case EHapticType::Heavy:
    AudioServicesPlaySystemSound(1521);  // Nope - 강한
    break;
}
```

이름이 "SystemSound"라서 소리가 날 것 같지만, 1519/1520/1521은 **소리 없이 Taptic Engine 진동만 트리거**하는 특수 ID다. iPhone 7 이상의 Taptic Engine이 있는 기기에서 동작하고, 없는 기기에서는 아무 일도 안 일어난다.

iOS는 3단계(Peek/Pop/Nope)뿐이라 Light와 Tap이 같은 진동이다. Android에서만 Light/Tap 차이가 체감된다.

## .mm 파일 빌드 이슈

처음에는 `UIImpactFeedbackGenerator`를 쓰려고 `IOSHapticHandler.mm` 파일을 만들었는데 두 가지 문제가 생겼다:

1. **Android 빌드**: `.mm` 파일이 Android arm64 빌드에서도 컴파일 시도 → "Objective-C was disabled in PCH" 에러
2. **iOS 빌드**: `extern void IOSHapticTrigger(int32)` 선언에 `extern "C"` 가 빠져서 C++ name mangling으로 링커가 심볼을 못 찾음

`.mm` 파일을 아예 없애고 C API(`AudioToolbox`)로 바꾸니 양쪽 다 깔끔하게 해결됐다. UE5에서 iOS 네이티브 코드를 쓸 때 `.mm` 파일이 빌드 문제를 일으키면, C API로 대체할 수 있는지 먼저 확인해보는 게 좋다.

## 강도 참고표

| 타입 | Android Duration | Android Amplitude | iOS Sound ID | 용도 |
|------|:---:|:---:|:---:|------|
| Light | 20ms | 40 | 1519 (Peek) | 미세한 피드백 |
| Tap | 30ms | 80 | 1519 (Peek) | 버튼 탭 |
| Medium | 40ms | 120 | 1520 (Pop) | 확인/전환 |
| Heavy | 60ms | 255 | 1521 (Nope) | 경고/에러 |

## 정리

- `PlayDynamicForceFeedback`은 게임패드용이다. 모바일 디바이스 진동에 쓰면 Android만 동작하고 iOS는 안 된다.
- 네이티브 API를 직접 호출하면 양쪽 다 확실하게 동작한다. Android는 JNI, iOS는 AudioToolbox.
- BlueprintFunctionLibrary의 정적 함수로 만들면 기존 코드에 한 줄 추가로 진동을 넣을 수 있다. 기존 버튼 클래스를 수정할 필요가 없다.
- UE5에서 `.mm` 파일은 크로스 플랫폼 빌드 이슈를 일으킬 수 있다. C API 대안이 있으면 그쪽이 낫다.
- `VIBRATE` 권한(Android)은 필수, iOS는 별도 권한 불필요.
