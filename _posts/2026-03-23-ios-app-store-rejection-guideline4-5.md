---
layout: post
title: "iOS 앱스토어 리젝 대응 - 인앱 브라우저와 계정 삭제 정책"
date: 2026-03-23 15:00:00 +0900
categories: [mobile]
tags: [ios, app-store-review, sfsafariviewcontroller, account-deletion, unreal-engine, apple-guidelines]
excerpt: "iOS 앱스토어 심사에서 Guideline 4(외부 브라우저 로그인)와 Guideline 5.1.1(v)(계정 삭제 미구현)로 리젝당한 경험과 해결 방법을 정리한다."
---

## 배경

Android는 한 번에 심사를 통과했지만, iOS는 두 가지 사유로 리젝당했다. 앱스토어 심사 가이드라인 중 놓치기 쉬운 두 항목에 대한 대응 과정을 기록한다.

## 리젝 사유 1: 외부 브라우저로 로그인 (Guideline 4 - Design)

### 문제

회원가입 시 `openURL`로 Safari 앱을 열어 외부 브라우저로 이동시키고 있었다. Apple은 **앱 밖으로 나가는 인증 플로우**를 좋지 않은 사용자 경험으로 판단한다.

```objc
// 기존 방식 - 외부 Safari로 이동 (리젝 원인)
[[UIApplication sharedApplication] openURL:url
                                   options:@{}
                         completionHandler:nil];
```

### 해결: SFSafariViewController

Apple이 명시적으로 권장하는 `SFSafariViewController`를 사용하면 된다. 앱 안에서 Safari가 오버레이로 표시되며, 닫으면 바로 앱으로 복귀한다.

| 방식 | 동작 | Apple 판단 |
|---|---|---|
| `openURL` | 앱을 떠나 Safari 앱으로 이동 | 리젝 |
| `SFSafariViewController` | 앱 안에서 브라우저 오버레이 | 권장 |
| `WKWebView` (WebBrowser 플러그인) | 앱 안에서 커스텀 웹뷰 | 허용 |

#### UE5에서 SFSafariViewController 구현

UE5에는 SFSafariViewController가 기본 제공되지 않으므로, BFL(Blueprint Function Library)에 직접 구현한다. iOS 네이티브 코드를 `#if PLATFORM_IOS` 가드로 감싸는 기존 패턴을 따르면 된다.

```cpp
// SuperPlatBFL.h
UFUNCTION(BlueprintCallable, Category = "SuperPlatM|Platform")
static void OpenInAppBrowser(const FString& URL);
```

```cpp
// SuperPlatBFL.cpp
#if PLATFORM_IOS
#import <SafariServices/SafariServices.h>
#endif

void USuperPlatBFL::OpenInAppBrowser(const FString& URL)
{
    if (URL.IsEmpty()) return;

#if PLATFORM_IOS
    FString URLCopy = URL; // 로컬 복사 필수
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString* URLString = URLCopy.GetNSString();
        NSURL* OpenURL = [NSURL URLWithString:URLString];
        if (!OpenURL) return;

        SFSafariViewController* SafariVC =
            [[SFSafariViewController alloc] initWithURL:OpenURL];

        UIViewController* RootVC =
            [UIApplication sharedApplication].keyWindow.rootViewController;
        while (RootVC.presentedViewController) {
            RootVC = RootVC.presentedViewController;
        }

        [RootVC presentViewController:SafariVC animated:YES completion:nil];
    });
#else
    FPlatformProcess::LaunchURL(*URL, nullptr, nullptr);
#endif
}
```

`Build.cs`에 `SafariServices` 프레임워크가 추가되어 있어야 한다:

```csharp
PublicFrameworks.Add("SafariServices");
```

### 주의: dispatch_async와 댕글링 참조

위 코드에서 `FString URLCopy = URL;` 부분이 핵심이다. 함수 파라미터가 `const FString&`(참조)인데, `dispatch_async` 블록은 나중에 실행된다. 블록 실행 시점에 원본 FString이 이미 해제되어 있으면 **EXC_BAD_ACCESS 크래시**가 발생한다.

```cpp
// 잘못된 방식 - 크래시 발생
void OpenInAppBrowser(const FString& URL)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString* str = URL.GetNSString(); // 이 시점에 URL은 이미 해제됨
    });
}

// 올바른 방식 - 로컬 복사본 캡처
void OpenInAppBrowser(const FString& URL)
{
    FString URLCopy = URL; // 블록이 이 복사본을 캡처
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString* str = URLCopy.GetNSString(); // 안전
    });
}
```

실제로 이 실수로 인해 TestFlight에서 인앱 브라우저를 열 때마다 앱이 크래시되었다. crash log에서 `__CFStringCreateImmutableFunnel3` → `_platform_memmove`로 이어지는 스택 트레이스가 보인다면 이 패턴을 의심해볼 수 있다.

## 리젝 사유 2: 계정 삭제 기능 없음 (Guideline 5.1.1(v))

### Apple 정책 요약

계정 생성 기능이 있는 앱은 **반드시** 계정 삭제 기능을 제공해야 한다. 이 정책은 2022년 6월부터 시행되었으며, 요구사항이 꽤 구체적이다:

- **일시 비활성화(deactivate)만으로는 불충분** — 완전 삭제여야 한다
- **앱 내에서 삭제 플로우가 완결**되어야 한다 (웹으로 마무리해야 하면 직접 링크 제공)
- **전화/이메일로 삭제 요청하도록 유도 불가** (고도로 규제된 산업 제외)
- 재심사 시 **계정 삭제 과정 화면 녹화**를 첨부해야 한다

### 구현 시 필요한 작업

계정 삭제는 앱 단독으로 해결되지 않는다. 서버 API, UI 디자인, 기획(약관/문구)이 모두 필요하다:

1. **서버**: 회원탈퇴 API 구현 및 데이터 처리 범위 정의
2. **UI**: 설정 화면 내 탈퇴 버튼 → 안내 화면 → 최종 확인 팝업 플로우
3. **기획**: 탈퇴 안내 문구, 삭제 범위 고지 (포인트 소멸, 게시물 처리 등)

### 탈퇴 플로우 예시

```
설정 화면
  └─ [회원 탈퇴] 버튼
       └─ 탈퇴 안내 화면
            - 삭제되는 항목 목록
            - 되돌릴 수 없음 안내
            └─ [탈퇴하기] 버튼
                 └─ 최종 확인 팝업
                      "정말 탈퇴하시겠습니까?"
                      [취소] [확인]
                           └─ 탈퇴 API 호출 → 로그아웃
```

## 정리

- **외부 브라우저 로그인은 리젝 사유**다. `SFSafariViewController` 또는 `WKWebView`로 앱 안에서 처리해야 한다.
- **계정 삭제 기능은 필수**다. 계정 생성이 있으면 반드시 삭제도 있어야 한다.
- UE5에서 iOS 네이티브 기능 호출 시 `dispatch_async` 블록에서 **FString 참조를 캡처하면 크래시**가 발생한다. 반드시 로컬 복사본을 만들어야 한다.
- Android는 동일 빌드로 심사 통과했지만 iOS는 리젝된 케이스로, **플랫폼별 심사 기준 차이**를 인지하고 있어야 한다.
- 이런 정책 관련 리젝은 코드 수정만으로 끝나지 않고, 서버/기획/디자인 등 **다른 팀과의 협업이 필수**적이다. 심사 제출 전에 가이드라인을 미리 체크하는 것이 가장 효율적이다.
