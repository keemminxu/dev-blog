---
layout: post
title: "Android 16KB 페이지 크기 대응 - UE5 커스텀 엔진에서 Swappy 업데이트하기"
date: 2026-03-24 01:00:00 +0900
categories: [mobile]
tags: [android, 16kb-page-size, unreal-engine, swappy, google-play, googlegamesdk]
excerpt: "Google Play에서 16KB 메모리 페이지 크기 미지원 경고가 뜰 때, UE5 커스텀 엔진에서 원인을 찾고 GoogleGameSDK를 업데이트하여 해결하는 과정을 정리한다."
---

## 배경

Android 15부터 16KB 메모리 페이지 크기를 사용하는 기기가 등장했다. Google Play에 앱을 올리면 다음과 같은 경고가 표시된다:

> 16KB를 지원하지 않는 새로운 App Bundle이 있습니다.

무시하고 출시할 수도 있지만, 16KB 기기에서 앱 설치 실패나 크래시가 발생할 수 있다. 2025년 11월부터는 API 35 이상을 타겟팅하는 앱에 대해 필수 요구사항이 될 예정이므로, 미리 대응해두는 것이 좋다.

## 원인 파악

Google Play Console에서 구체적으로 어떤 라이브러리가 문제인지 알려준다:

```
16KB를 지원하지 않는 라이브러리:
base/lib/arm64-v8a/libswappy.so
```

`libswappy.so`는 Google의 **Frame Pacing 라이브러리**(Swappy)다. Android에서 화면 새로고침 타이밍과 게임 렌더링 타이밍을 동기화하여 테어링과 프레임 끊김을 방지하는 역할을 한다. UE 5.2부터 기본 활성화되어 있다.

문제는 엔진에 포함된 Swappy 바이너리가 **4KB 정렬**로 빌드되어 있어서 16KB 페이지 크기 기기와 호환되지 않는다는 점이다.

## 시도한 방법들과 결과

### 1차: 링커 플래그만 변경 — 실패

`AndroidToolChain.cs`에서 `max-page-size`를 변경했다:

```csharp
// 기존
Result += " -z max-page-size=65536";
// 변경
Result += " -z max-page-size=16384";
```

이 설정은 프로젝트 코드를 컴파일할 때 적용되지만, **프리빌트 .so 파일**에는 영향을 주지 않는다. `libswappy.so`는 이미 빌드된 바이너리이므로 그대로 APK에 포함된다.

### 2차: .so 파일만 교체 — 크래시

Google의 games-frame-pacing 2.1.3 AAR에서 16KB 정렬된 `libswappy.so`를 추출하여 엔진의 기존 파일을 교체했다.

```
# AAR 다운로드 URL
https://dl.google.com/dl/android/maven2/androidx/games/games-frame-pacing/2.1.3/games-frame-pacing-2.1.3.aar
```

AAR은 zip 파일이므로 확장자를 `.zip`으로 바꿔 해제하면 `prefab/modules/swappy/libs/` 아래에 .so 파일이 있다.

그러나 앱 실행 시 **SIGSEGV 크래시**가 발생했다. 엔진의 Swappy 연동 코드(`libUnreal.so`에 정적 링크됨)가 이전 버전 API를 기대하고 있어서, 새 .so의 함수 시그니처와 맞지 않기 때문이다.

### 3차: 헤더 + .a + .so 전체 교체 후 엔진 리빌드 — 크래시

AAR에는 헤더 파일과 정적 라이브러리(.a)도 포함되어 있다:

```
prefab/modules/swappy/include/swappy/*.h        # 헤더
prefab/modules/swappy_static/libs/*/libswappy_static.a  # 정적 라이브러리
prefab/modules/swappy/libs/*/libswappy.so               # 공유 라이브러리
```

전부 교체하고 엔진을 리빌드했지만 여전히 크래시. Google Maven의 AAR과 Epic의 Swappy 연동 코드 사이에 API 호환성 문제가 있었다.

### 4차: Swappy 비활성화 — 부분 해결

`Config/DeviceProfiles.ini`를 생성하여 Swappy를 런타임에서 비활성화했다:

```ini
[Android_Default DeviceProfile]
+CVars=a.UseSwappyForFramePacing=0
```

앱은 정상 동작하지만, 빌드 시스템이 여전히 `libswappy.so`를 APK에 포함시키므로 **Google Play 경고는 그대로** 남아있다. CVar는 런타임 설정이지 빌드 타임 설정이 아니기 때문이다.

.so 파일을 삭제하면 빌드 시스템이 파일을 복사하려다 `FileNotFoundException`으로 실패한다.

### 5차: Epic 공식 커밋 체리픽 — 성공

UE 5.7.4의 커밋 내역에서 정확한 해결책을 찾았다:

> Update swappy to support 16kb ELF alignment, added missing GoogleGameSDK buildSrc folder

이 커밋은 세 가지를 변경한다:

1. **`Commit.gitdeps.xml`** — 새로운 16KB 정렬 바이너리의 해시와 다운로드 경로
2. **`CMakeLists.txt`** — Swappy 빌드 시 링커 옵션 추가
3. **`buildSrc/.editorconfig`** — 빌드 설정 파일

핵심은 `Commit.gitdeps.xml`이다. UE5는 바이너리 파일을 Git에 직접 포함하지 않고, **GitDependencies** 시스템으로 Epic CDN에서 다운로드한다. 이 xml이 새 버전 바이너리를 가리키도록 업데이트된 것이다.

## 최종 해결 과정

### 1. Commit.gitdeps.xml 수정

5.5.4 엔진의 xml 파일에서 GoogleGameSDK 관련 항목을 찾아 5.7.4의 해시로 교체한다. 변경 대상은 8개 라이브러리 파일:

- `libs/debug/arm64-v8a/libswappy.so` 및 `libswappy_static.a`
- `libs/debug/x86_64/libswappy.so` 및 `libswappy_static.a`
- `libs/release/arm64-v8a/libswappy.so` 및 `libswappy_static.a`
- `libs/release/x86_64/libswappy.so` 및 `libswappy_static.a`

File 해시뿐 아니라 해당 **Blob 항목과 Pack 항목**도 추가해야 한다. Pack의 `RemotePath`가 `UnrealEngine-40681379`(해당 CL 번호)로 되어 있는 것들이 새로 추가할 항목이다.

### 2. CMakeLists.txt 수정

```cmake
# Engine/Source/ThirdParty/GoogleGameSDK/gamesdk/games-frame-pacing/CMakeLists.txt
# target_link_libraries 블록 아래에 추가:

# Enable support for non-4k virtual page sizes
target_link_options(swappy PRIVATE -z max-page-size=16384)
```

### 3. GitDependencies 실행

```bash
cd D:\SPUnrealEngine
.\Engine\Binaries\DotNET\GitDependencies\win-x64\GitDependencies.exe
```

xml에 명시된 새 해시의 바이너리를 Epic CDN에서 다운로드한다. 변경된 파일만 받으므로 전체 다운로드보다 빠르다.

### 4. 엔진 리빌드

GitDependencies가 완료되면 엔진을 리빌드한다. 새 `libswappy_static.a`가 `libUnreal.so`에 링크되고, 새 `libswappy.so`가 APK에 포함된다.

## 정리

- Google Play의 16KB 경고에서 **어떤 .so가 문제인지** 정확히 알려주므로, 그것부터 확인한다.
- **링커 플래그 변경**은 직접 컴파일하는 코드에만 적용된다. 프리빌트 바이너리는 교체해야 한다.
- **Google Maven의 AAR**과 **Epic이 빌드한 바이너리**는 API가 다를 수 있다. 엔진과의 호환성을 위해 반드시 Epic 경로로 업데이트해야 한다.
- 커스텀 엔진에서는 상위 버전의 **GitDeps 변경사항만 체리픽**하는 것이 가장 안전한 방법이다.
- `libswappy_static.a`(정적 라이브러리)는 링커 플래그로 커버되지만, `libswappy.so`(공유 라이브러리)는 프리빌트 그대로 APK에 들어가므로 반드시 교체해야 한다.
- **Swappy 비활성화**는 임시 방편일 뿐이다. .so가 APK에 남아있으면 Google Play 경고는 사라지지 않는다.
