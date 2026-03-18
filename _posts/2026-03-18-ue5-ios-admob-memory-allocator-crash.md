---
layout: post
title: "UE5 iOS에서 AdMob SDK가 크래시를 일으키는 이유와 해결 과정"
date: 2026-03-18 11:00:00 +0900
categories: [unreal-engine]
tags: [ue5, ios, admob, memory-allocator, fmallocbinned, crash, strip]
excerpt: "UE5 iOS Shipping 빌드에서 Google AdMob SDK가 앱 시작 직후 SIGABRT 크래시를 일으켰다. 원인은 UE5의 커스텀 메모리 할당자와 SDK 간의 충돌이었고, 여러 시행착오 끝에 엔진 소스 수정으로 근본 해결했다."
---

## 배경

UE5(5.4)로 개발 중인 모바일 게임에 Google AdMob 보상형 광고를 연동하고 있었다. Android에서는 정상적으로 동작했지만, iOS Shipping 빌드에서 앱 시작 약 1.8초 후 100% 확률로 크래시가 발생했다.

```
Exception Type:  EXC_CRASH (SIGABRT)
___BUG_IN_CLIENT_OF_LIBMALLOC_POINTER_BEING_FREED_WAS_NOT_ALLOCATED
std::__1::basic_string::~basic_string()
GADOnDeviceFeaturesManager → GADPersistentStateMonitor → GADPostNotificationFromMainQueue
```

핵심 에러 메시지는 `POINTER_BEING_FREED_WAS_NOT_ALLOCATED`. 시스템의 `free()`가 자신이 할당하지 않은 포인터를 해제하려다 실패한 것이다.

## 원인: UE5 메모리 할당자 충돌

### UE5의 전역 operator new/delete 오버라이드

UE5는 `ModuleBoilerplate.h`에서 전역 `operator new`와 `operator delete`를 자체 메모리 할당자(`FMallocBinned2` 또는 `FMallocBinned3`)로 오버라이드한다.

```cpp
// ModuleBoilerplate.h (간략화)
#define REPLACEMENT_OPERATOR_NEW_AND_DELETE \
    void* operator new(size_t Size) { return FMemory::Malloc(Size); } \
    void operator delete(void* Ptr) { FMemory::Free(Ptr); }
```

일반적인 iOS 앱에서는 문제가 없다. 하지만 UE5처럼 전역 할당자를 교체한 환경에서 **정적 라이브러리**(AdMob SDK의 `GoogleMobileAds.xcframework`)를 같은 바이너리에 링크하면 상황이 달라진다.

### 충돌 메커니즘

1. AdMob SDK 내부에서 Objective-C/CoreFoundation을 통해 **시스템 malloc**으로 메모리 할당
2. SDK의 C++ 코드(`std::string` 등)가 소멸될 때 `operator delete` 호출
3. 이 `operator delete`는 UE5가 오버라이드한 버전 → `FMallocBinned::Free()` 실행
4. FMallocBinned는 자신이 할당하지 않은 포인터를 받아 **SIGABRT**

정리하면, **할당은 시스템 malloc으로, 해제는 UE5의 FMallocBinned로** 가는 불일치(mismatch)가 크래시의 근본 원인이다.

### 왜 iOS에서만 발생하는가

- iOS Shipping 빌드에서 `FMallocBinned`가 기본 할당자로 사용된다
- Windows/Mac Editor에서는 `FMallocTBB` 또는 ANSI 할당자를 사용하므로 문제가 드러나지 않는다
- Android에서도 동일한 문제가 잠재적으로 존재하지만, AdMob Android SDK는 Java/JNI 기반이라 C++ 할당자 충돌이 발생하지 않는다

## 첫 번째 해결: FORCE_ANSI_ALLOCATOR

원인을 확인하기 위해 UE5의 커스텀 할당자를 비활성화하고 시스템 malloc을 사용하도록 설정했다.

```csharp
// SuperPlatM.Target.cs
if (Target.Platform == UnrealTargetPlatform.IOS)
{
    GlobalDefinitions.Add("FORCE_ANSI_ALLOCATOR=1");
}
```

이 한 줄로 크래시가 사라졌다. 모든 코드가 동일한 시스템 malloc/free를 사용하게 되면서 할당자 불일치가 해소된 것이다.

이 방식은 다른 서드파티 라이브러리(whisper.cpp 등)에서도 동일한 문제의 공식 해결법으로 제시되고 있다. UE 5.6 이상에서는 아예 정식 API가 추가되었다:

```csharp
// UE 5.6+
bOverrideBuildEnvironment = true;
StaticAllocator = StaticAllocatorType.Ansi;
```

### FORCE_ANSI_ALLOCATOR의 단점

- UE5의 최적화된 `FMallocBinned`를 포기하고 시스템 malloc을 사용
- 이론적으로 메모리 할당 속도 저하, 단편화 증가
- iOS 전체 빌드에 영향 (Android는 해당 없음)

실제로 2D 모바일 게임 수준에서는 체감 차이가 거의 없었지만, 근본적인 해결은 아니었다.

## 실패한 시도: Dynamic Framework 래퍼

`FORCE_ANSI_ALLOCATOR=1`의 성능 영향을 피하기 위해 AdMob SDK를 동적 프레임워크로 감싸는 방법을 시도했다.

**이론**: 동적 라이브러리는 자체 심볼 공간을 가지므로, 내부에서 사용하는 `operator new/delete`가 UE5의 오버라이드 버전이 아닌 시스템 기본 버전을 사용하게 된다.

**구현**: `AdMobBridge.framework`라는 동적 프레임워크를 만들어 GoogleMobileAds SDK를 정적 링크하고, Objective-C 인터페이스만 외부에 노출했다.

```bash
# clang으로 동적 프레임워크 빌드
clang -arch arm64 -dynamiclib -all_load \
    -framework GoogleMobileAds \
    -fvisibility=hidden \
    AdMobBridge.o -o AdMobBridge.framework/AdMobBridge
```

**결과**: 실패. 여러 문제가 연쇄적으로 발생했다.

1. **UE5가 `.m` 파일을 자동 컴파일** — Bridge 소스가 UE5 빌드에 포함되면서 `-stdlib=libc++` 플래그 충돌
2. **`@import` 구문 비호환** — UE5는 C++ modules를 비활성화하므로 `@import Foundation` 사용 불가
3. **심볼 미노출** — `-fvisibility=hidden`이 ObjC 클래스 심볼까지 숨김
4. **UE5 빌드 시스템의 동적 프레임워크 미지원** — `PublicAdditionalFrameworks`가 정적 프레임워크 전제로 설계되어 `-F`(framework search path) 플래그가 제대로 생성되지 않음

결국 UE5의 iOS 빌드 파이프라인이 커스텀 동적 프레임워크를 제대로 지원하지 않는다는 결론에 도달했다.

## 근본 해결: 엔진 소스 수정

이후 조사 과정에서 UE5 커뮤니티의 두 가지 분석 문서를 발견했다. 두 문서 모두 동일한 근본 원인을 지적하고 있었다.

### 진짜 원인: strip이 operator new/delete 심볼을 제거한다

iOS Shipping 빌드 과정에서 UE5의 빌드 툴이 바이너리를 strip하는데, 이때 `operator new/delete`의 전역 심볼이 제거된다.

```csharp
// IOSToolChain.cs (line 1112)
string StripArguments = BinaryLinkEnvironment.bIsBuildingDLL ? "-x" : "";
// DLL이 아닌 경우 → 빈 문자열 → 모든 심볼 strip
```

심볼이 제거되면:
- 게임 바이너리 내부 코드 → UE5의 커스텀 할당자 사용
- 바이너리 외부 코드(libc++의 `std::string` 등) → 심볼을 찾지 못해 시스템 기본 할당자로 fallback
- **할당자 불일치 발생 → 크래시**

문서에서는 3가지 mismatch 유형을 정리하고 있었다:

1. **파라미터 mismatch** — C++17/20에서 추가된 operator 서명이 누락
2. **최적화 mismatch** — 컴파일러가 미사용으로 판단하여 operator를 삭제
3. **strip mismatch** — 패키징 시 전역 심볼이 제거됨

### 수정 1: strip 파라미터 변경

```csharp
// IOSToolChain.cs (수정 후)
string StripArguments = "-x"; // 전역 심볼(operator new/delete) 보존
```

`-x` 옵션은 로컬/디버그 심볼만 제거하고, 전역 공개 심볼은 보존한다.

### 수정 2: operator new/delete에 visibility 속성 추가

```cpp
// ModuleBoilerplate.h에 추가
#if PLATFORM_ANDROID || PLATFORM_IOS
#define MEMORY_P __attribute__((used, visibility("default")))
#else
#define MEMORY_P
#endif
```

`MEMORY_P`를 모든 operator new/delete 선언에 적용:

```cpp
#define REPLACEMENT_OPERATOR_NEW_AND_DELETE \
    OPERATOR_NEW_MSVC_PRAGMA MEMORY_P void* operator new(size_t Size) ... \
    MEMORY_P void operator delete(void* Ptr) ...
```

- `used`: 컴파일러가 미사용으로 판단하여 최적화 삭제하는 것을 방지
- `visibility("default")`: strip 시 전역 심볼로 보존

### 검증 방법

수정 후 빌드된 바이너리에서 operator delete 심볼이 살아있는지 확인:

```bash
nm -gU SuperPlatM-IOS-Shipping | c++filt | grep 'operator delete'
```

심볼이 출력되면 성공이다.

## 정리

| 해결 방법 | 방식 | 성능 | 난이도 |
|-----------|------|------|--------|
| `FORCE_ANSI_ALLOCATOR=1` | UE5 할당자 비활성화 | 시스템 malloc (느림) | Target.cs 1줄 |
| Dynamic Framework 래퍼 | SDK를 동적 라이브러리로 격리 | 영향 없음 | UE5 빌드 시스템 미지원으로 실패 |
| **엔진 소스 수정** | strip/visibility 수정 | FMallocBinned 유지 (최적) | 엔진 파일 2개 수정 |

### 핵심 포인트

- UE5는 전역 `operator new/delete`를 자체 할당자로 오버라이드하지만, iOS Shipping 빌드의 strip 과정에서 이 심볼이 제거되어 서드파티 정적 라이브러리와 할당자 불일치가 발생한다
- `FORCE_ANSI_ALLOCATOR=1`은 빠른 우회책이지만 최적화된 할당자를 포기해야 한다
- UE 5.6 이상에서는 `StaticAllocator = StaticAllocatorType.Ansi` API가 추가되었다
- 근본 해결은 `IOSToolChain.cs`의 strip 파라미터를 `-x`로 변경하고, `ModuleBoilerplate.h`에서 operator에 `__attribute__((used, visibility("default")))`를 적용하는 것이다
- 이 문제는 AdMob뿐 아니라 C++ 코드를 포함하는 모든 iOS 정적 라이브러리(Firebase, whisper.cpp 등)에서 동일하게 발생할 수 있다

## 참고 자료

- [Cesium Unreal - iOS App Store crash issue](https://github.com/CesiumGS/cesium-unreal/issues/1609)
- [Cesium Community - \[Solved\] iOS apps distributed to the App Store crash](https://community.cesium.com/t/solved-ios-apps-distributed-to-the-app-store-crash/29401/6?u=kevin_ring)
- [Unreal 内存分配 operator new/delete 的史诗级灾难问题](https://zhuanlan.zhihu.com/p/1889829631009485501)
