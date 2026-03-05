---
layout: post
title: "UE5 Android 빌드를 Jenkins로 자동화하며 만난 21가지 함정"
date: 2026-03-05 17:30:00 +0900
categories: [devops]
tags: [unreal-engine, jenkins, gradle, android, cicd, troubleshooting]
excerpt: "UE5 모바일 게임의 Jenkins CI/CD 파이프라인을 구축하면서 마주친 21개 이슈와 해결 과정. Java File 클래스의 user.dir 캐싱, SYSTEM 서비스 계정의 함정, Gradle init script 활용법까지."
---

UE5로 개발 중인 모바일 게임을 Jenkins에서 자동 빌드하고 Google Play Store에 배포하는 파이프라인을 구축했다. "PowerShell 스크립트 하나 감싸면 되겠지"라고 생각했는데, 64개 커밋과 21개 이슈를 거쳐서야 첫 성공 빌드를 볼 수 있었다.

개발 PC에서 잘 되던 빌드가 빌드 전용 PC에서는 안 되는 이유는 딱 하나다. **환경이 다르다.** 그리고 그 차이는 예상보다 훨씬 깊은 곳에 숨어 있다.

## 전체 구조

파이프라인의 흐름은 단순하다.

```
Jenkins (Windows SYSTEM 서비스)
  └─ Jenkinsfile
       ├─ Checkout → D:\SuperPlatM
       ├─ Setup: Config.json 생성, Credentials, bundle install
       └─ BuildAndroid.ps1 -Environment <track>
            ├─ PatchEngine.ps1 (엔진 소스 패치)
            ├─ Gradle init script 설치 (GooglePAD 경로 수정)
            ├─ RunUAT BuildCookRun (빌드/쿠킹/패키징)
            ├─ fastlane deploy → Google Play Store
            └─ Slack 알림
```

핵심 제약 사항이 세 가지 있다.

- Jenkins가 **SYSTEM 서비스**로 실행된다. USERPROFILE이 `C:\Windows\system32\config\systemprofile`이다.
- UE5가 Windows 경로 길이 제한을 우회하려고 `subst Z:` 가상 드라이브를 만든다.
- 앱 용량이 ~400MB라서 GooglePAD(Play Asset Delivery)가 필수다. Play Store의 AAB 200MB 제한 때문이다.

이 세 가지가 결합되면서 온갖 문제가 터졌다.

## 1부: Jenkins 환경 — SYSTEM 계정의 함정

Jenkins를 Windows 서비스로 설치하면 `NT AUTHORITY\SYSTEM` 계정으로 실행된다. 이게 생각보다 많은 것을 바꾼다.

**Git 인증 실패 (403)**. SYSTEM 계정에는 사용자의 Git credential이 없다. `git fetch`를 직접 호출하면 403이 뜬다. Jenkins 내장 `checkout scm`을 써야 Jenkins가 관리하는 credential로 인증한다.

**safe.directory 오류**. Git 2.35.2부터 디렉토리 소유자가 다르면 거부한다. SYSTEM 계정의 gitconfig 위치가 일반 사용자와 다르기 때문에, 시스템 레벨 gitconfig에 설정해야 한다.

**고정 워크스페이스**. Jenkins 기본 workspace 대신 `D:\SuperPlatM`을 `ws()` 블록으로 고정했다. UE5가 Intermediate 디렉토리에 의존하는데, 경로가 바뀌면 처음부터 다시 쿠킹해야 하기 때문이다.

## 2부: 엔진 소스 패치 — 7번 시도한 디렉토리 문제

UE5 소스 빌드 엔진을 사용하는데, `UEDeployAndroid.cs`의 `MakeApk` 함수에 버그가 있다. `Intermediate\Android\arm64\gradle\`에는 파일을 잘 생성하면서, `Intermediate\Android\gradle\`에도 접근하는데 이 디렉토리는 만들지 않는다. 개발 PC에서는 에디터가 미리 생성해둬서 문제없지만, 클린 빌드 환경에서는 `DirectoryNotFoundException`이 터진다.

이걸 해결하려고 7가지를 시도했다.

| # | 접근 방식 | 실패 이유 |
|---|----------|----------|
| 1 | 디렉토리 사전 생성 | cook/stage가 Intermediate 전체를 삭제 |
| 2 | 2단계 빌드 분리 | 두 단계 모두에서 MakeApk 호출 |
| 3 | Background watcher (200ms 폴링) | Jenkins Process Tree Killer가 종료 |
| 4 | System.Threading.Timer | PowerShell runspace에서 크래시 |
| 5 | C# compiled class | Race condition |
| 6 | JENKINS_NODE_COOKIE='dontKillMe' | 여전히 불안정 |
| **7** | **엔진 소스 패치** | **성공** |

결국 근본적으로 해결했다. `PatchEngine.ps1`이 `WriteAllText` 호출 전에 디렉토리 생성 코드를 삽입하고, RunUAT가 자동으로 리빌드한다.

### dotnet 3중 캐시 문제

엔진 소스를 패치해도 바이너리에 반영이 안 되는 문제가 또 있었다. dotnet이 3곳에 캐시를 유지하기 때문이다.

1. `Engine\Binaries\DotNET\` — published output
2. `Engine\Saved\CsTools\` — RunUAT restore 캐시
3. `Engine\Source\Programs\{tool}\bin\`, `obj\` — MSBuild 캐시

세 곳을 모두 삭제해야 패치가 반영된다. 단, `Ionic.Zip.Reduced`나 `EpicGames.Perforce.Native` 같은 서드파티 DLL은 소스 빌드가 불가능하므로 선별 삭제해야 한다.

또 하나의 함정은 SDK 버전 불일치다. 시스템에 설치된 dotnet 9.0으로 UBT를 빌드해도, RunUAT가 번들 SDK 8.0으로 다시 빌드하면서 패치된 바이너리를 덮어쓴다. 직접 빌드하지 말고, 빌드 출력만 삭제해서 RunUAT에게 빌드를 위임하는 것이 정답이다.

## 3부: Gradle 경로 문제 — 하나의 원인, 여섯 개의 증상

이 파이프라인에서 가장 까다로운 문제였다. 근본 원인은 하나인데, 증상이 여섯 가지로 나타났다.

### 근본 원인: Java `File` 클래스의 `user.dir` 캐싱

Java의 `File` 클래스는 JVM 시작 시 `user.dir`을 `WinNTFileSystem.userDir` 필드에 캐시한다. 이 값은 **불변**이다. `System.setProperty("user.dir", ...)`로 시스템 프로퍼티를 바꿔도 `new File("relative").getAbsolutePath()`의 결과는 바뀌지 않는다.

```
개발 PC:   user.dir = Gradle 프로젝트 루트 = settingsDir   → 일치 ✓
빌드 PC:   user.dir = Gradle daemon 레지스트리              → 불일치 ✗
               (C:\Windows\System32\config\systemprofile\.gradle\daemon\8.7\)
```

UE5가 자동 생성하는 gradle 파일들은 Gradle의 `file()` 메서드와 Java의 `new File()`을 혼용한다. 개발 PC에서는 둘 다 같은 경로를 가리키니까 문제없다. 하지만 Jenkins SYSTEM 서비스에서는 완전히 다른 디렉토리를 참조한다.

### 증상 1 → 6 타임라인

**증상 1: AAB 200MB 초과.** 처음에는 GooglePAD 대신 `bPackageDataInsideApk=True`로 우회하려 했다. 당연히 200MB 제한에 걸렸다. GooglePAD를 정면으로 해결해야 했다.

**증상 2: asset pack build.gradle 미생성.** UE5의 settings.gradle이 `file()`로 디렉토리를 만들고 `new File()`로 파일을 쓴다. 디렉토리는 settingsDir(`Z:\`)에 생기고, 파일은 daemon 디렉토리에 써진다. Gradle init script로 해결을 시도했는데, `settingsEvaluated` 콜백은 settings.gradle 파싱이 끝난 후에 실행되므로 이미 늦었다. init script의 톱레벨 코드에서 처리해야 한다.

**증상 3: `main.obb.png` FileNotFoundException.** 같은 원인이다. `new File()`이 daemon 디렉토리에서 OBB 파일을 찾으니 당연히 없다.

**증상 4: `packElements` configuration not declared.** settings.gradle가 `new File()`로 build.gradle을 daemon 디렉토리에 작성했으니, settingsDir 기준으로 프로젝트를 찾는 Gradle은 빈 프로젝트만 본다. `com.android.asset-pack` 플러그인이 적용되지 않아서 `packElements` configuration이 없다는 에러가 나온다.

여기서 `System.setProperty("user.dir", ...)`을 시도했지만 위에서 설명한 대로 Java File 클래스에 영향을 주지 않는다. 이 사실을 확인하기까지 진단 로그를 3번 추가했다.

**최종 해결:** init script에서 settings.gradle **파싱 전에** 텍스트 치환.

```groovy
// Gradle init script (톱레벨 — settings.gradle보다 먼저 실행)
def content = settingsFile.text
def patched = content.replaceAll(
    /new\s+File\(\s*"(assetpacks\/)/,
    'file("$1'
)
settingsFile.text = patched
```

**증상 5: AFS 프로젝트 빌드 실패.** UE5는 메인 빌드 후 AFS(App File System) 프로젝트를 별도 Gradle daemon으로 실행한다. `AFSProject/app/buildAdditions.gradle`도 `new File("assetpacks/...")`를 쓰고 있었다. init script 스캔 범위를 `app/` 하위까지 확장해서 해결했다.

**증상 6: AAB가 50MB.** 빌드는 성공하는데 400MB여야 할 AAB가 50MB다. 앱을 열면 "Failed to open descriptor file" 에러. `app/buildAdditions.gradle`에서 `new File()`을 `file()`로 바꿨는데, build.gradle 컨텍스트의 `file()`은 **모듈 디렉토리** 기준이다. `Z:\app\assetpacks\...`를 찾으니 당연히 없고, assetPackSet이 빈 배열이 된다.

```groovy
// settings.gradle (루트): file() → settingsDir 기준 ✓
file("assetpacks/install-time")  // → Z:\assetpacks\install-time\

// app/build.gradle: file() → module projectDir 기준 ✗
file("assetpacks/install-time")  // → Z:\app\assetpacks\install-time\ (없음!)

// app/build.gradle: rootProject.file() → root 기준 ✓
rootProject.file("assetpacks/install-time")  // → Z:\assetpacks\install-time\
```

최종 init script는 위치에 따라 다른 치환을 적용한다.

```groovy
// 루트 gradle 파일: new File() → file()
projectDir.eachFile { f ->
    // file()은 settingsDir 기준으로 해석
    patch(f, 'file("$1')
}

// app/ gradle 파일: new File() → rootProject.file()
appDir.eachFile { f ->
    // rootProject.file()은 root project 기준으로 해석
    patch(f, 'rootProject.file("$1')
}
```

## 4부: Ruby와 PowerShell의 사소하지만 치명적인 차이들

### Ruby 3.4 호환성

Ruby 3.4에서 `abbrev`와 `fiddle`이 기본 gem에서 제거됐다. Gemfile에 명시적으로 추가해야 한다. 또한 Ruby는 백슬래시를 이스케이프 문자로 해석하므로, Windows 경로를 포워드 슬래시로 변환해야 fastlane의 `json_key_file`이 깨지지 않는다.

### stderr = 예외?

PowerShell의 `$ErrorActionPreference = 'Stop'` 환경에서 Ruby가 stderr로 경고를 출력하면, PowerShell이 이를 terminating error로 처리한다. fastlane은 정상 동작했는데 PowerShell이 예외를 던진다. fastlane 실행 구간에서만 `Continue`로 전환하면 된다.

같은 원인으로 Google Play Store의 version code 조회도 깨졌다. Ruby deprecation 경고가 stdout에 섞여서 숫자 파싱이 실패하고, version code가 항상 1로 설정됐다.

### PowerShell 5.1 vs 7.x

Jenkins 서비스는 시스템의 기본 PowerShell(5.1)을 사용한다.

```powershell
# PS 5.1에서 3개 인자 미지원
Join-Path $a $b $c  # ✗

# 체이닝 필요
Join-Path (Join-Path $a $b) $c  # ✓
```

```powershell
# PS 5.1의 Set-Content -Encoding UTF8은 BOM을 포함한다
Set-Content -Encoding UTF8  # ✗ Gradle 파싱 실패

# BOM 없이 작성
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)  # ✓
```

```powershell
# 배열 splatting은 named parameter로 전달되지 않는다
$params = @('-Environment', 'internal')
& script.ps1 @params  # $Environment = '-Environment' (!)

# 해시테이블 splatting이 정답
$params = @{ Environment = 'internal' }
& script.ps1 @params  # $Environment = 'internal' ✓
```

## 정리

### 환경 차이 비교표

| 항목 | 개발 PC | 빌드 PC (Jenkins) |
|------|---------|------------------|
| 실행 계정 | 사용자 | SYSTEM |
| USERPROFILE | `C:\Users\username` | `C:\Windows\system32\config\systemprofile` |
| Gradle user.dir | 프로젝트 루트 | Daemon 레지스트리 디렉토리 |
| PowerShell | 7.x | 5.1 |
| 프로젝트 경로 | `E:\Project\superplat_m` | `D:\SuperPlatM` |

### 핵심 포인트

- **Java `File` 클래스의 `user.dir`은 JVM 시작 시 캐시되며 불변이다.** `System.setProperty`로 변경해도 `new File()` 경로 해석에 영향 없다. Gradle에서는 반드시 `file()` 또는 `rootProject.file()`을 사용해야 한다.
- **Gradle `file()`의 기준 디렉토리는 컨텍스트에 따라 다르다.** settings.gradle에서는 settingsDir, build.gradle에서는 module projectDir. 서브모듈에서 루트 경로를 참조하려면 `rootProject.file()`을 써야 한다.
- **Gradle init script는 settings.gradle보다 먼저 실행된다.** 이 타이밍을 이용하면 UE5 같은 코드 제너레이터가 생성한 gradle 파일을 파싱 전에 수정할 수 있다.
- **Jenkins SYSTEM 서비스 환경을 과소평가하지 말자.** 로그인 세션에서 성공하는 것과 SYSTEM 서비스에서 성공하는 것은 다른 문제다.
- **진단 로그가 가설 기반 수정보다 빠르다.** 이 프로젝트에서 "이러면 될 것 같은데"로 시도한 커밋보다, 진단 로그를 추가해서 실제 상태를 파악한 후 수정한 커밋이 성공률이 훨씬 높았다.
