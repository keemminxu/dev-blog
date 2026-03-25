---
layout: post
title: "UE5 PIE 종료 후 메세지 로그 창 안 뜨게 하기"
title_en: "Disable Auto-Opening Message Log After PIE in UE5"
excerpt_en: "Quick engine source fix to prevent the Message Log window from auto-opening after stopping PIE in Unreal Editor."
date: 2026-03-25 11:00:00 +0900
categories: [tips]
tags: [unreal-engine, ue5, editor, pie, productivity]
excerpt: "에디터에서 플레이하고 종료할 때마다 뜨는 메세지 로그 창. 엔진 소스 한 줄 주석처리로 없앨 수 있다."
---

## 문제

언리얼 에디터에서 PIE(Play In Editor)를 종료할 때마다 메세지 로그 창이 자동으로 뜬다. 경고나 에러가 있을 때 보여주는 건데, 개발하면서 반복적으로 플레이/종료를 하다 보면 매번 닫아야 해서 귀찮다.

개발자 입장에선 Output Log로 충분히 디버깅 가능하기 때문에 이 창이 굳이 필요 없다.

![PIE 종료 시 자동으로 뜨는 메세지 로그 창](/dev-blog/assets/images/ue5-disable-pie-message-log/1.png)

## 해결

엔진 소스를 직접 수정해서 메세지 로그 창이 자동으로 열리지 않게 만들면 된다.

파일 경로:

```
Engine/Source/Runtime/Core/Private/Logging/MessageLog.cpp
```

`FMessageLog::Open` 함수에서 `MessageLog->Open()` 호출을 주석처리한다:

```cpp
void FMessageLog::Open( EMessageSeverity::Type InSeverityFilter, bool bOpenEvenIfEmpty )
{
    LLM_SCOPE_BYTAG(EngineMisc_MessageLog);

    Flush();
    if(bOpenEvenIfEmpty)
    {
        //MessageLog->Open();
    }
    else if(MessageLog->NumMessages(InSeverityFilter) > 0)
    {
        //MessageLog->Open();
    }
}
```

두 군데 `MessageLog->Open()`을 주석처리하면 끝이다.

## 정리

- 커스텀 엔진을 사용하는 경우에만 가능 (소스 빌드 필요)
- 메세지 로그 자체가 사라지는 건 아님 — 수동으로 열어서 확인은 가능
- PIE 종료 시 자동으로 튀어나오는 것만 막는 것
