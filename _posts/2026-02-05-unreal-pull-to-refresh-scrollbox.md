---
layout: post
title: "UE5 Pull-to-Refresh 구현: SScrollBox의 Overscroll 값 접근하기"
date: 2026-02-05 00:00:00 +0900
categories: [unreal-engine]
tags: [ue5, scrollbox, overscroll, pull-to-refresh, slate, umg, delegate]
excerpt: "UScrollBox에서 오버스크롤 값을 가져오려면 protected 멤버에 접근해야 한다. 커스텀 Slate 위젯을 만들어 Pull-to-Refresh를 구현하는 방법을 정리한다."
---

## 배경

모바일 앱에서 흔히 볼 수 있는 Pull-to-Refresh 기능을 UMG ScrollBox에 구현하려고 했다. 사용자가 스크롤 최상단에서 아래로 당기면 새로고침을 트리거하는 방식이다.

문제는 UScrollBox가 오버스크롤 값을 외부에 노출하지 않는다는 점이다. `GetScrollOffset()`은 항상 0 이상의 값만 반환하고, 최상단을 넘어 당겼을 때의 음수 오프셋은 얻을 수 없다.

## 원인 분석

SScrollBox 내부를 살펴보면 `FOverscroll Overscroll` 멤버가 있다. 이 객체가 오버스크롤 상태를 관리하며, `GetOverscroll(FGeometry)` 메서드로 현재 오버스크롤 양을 얻을 수 있다.

```cpp
// SScrollBox.h (엔진 코드)
protected:
    FOverscroll Overscroll;
```

하지만 이 멤버는 **protected**다. UScrollBox에서 바로 접근할 방법이 없다.

## 해결 방법

### 1. 커스텀 Slate 위젯 생성

SScrollBox를 상속받아 protected 멤버에 접근할 수 있는 커스텀 위젯을 만든다.

```cpp
// PullToRefreshScrollBox.h

class SPullToRefreshScrollBox : public SScrollBox
{
public:
    /** 현재 오버스크롤 값 반환 (음수 = 위로 당김, 양수 = 아래로 당김) */
    float GetCurrentOverscroll() const
    {
        return Overscroll.GetOverscroll(CachedGeometry);
    }
};
```

상속받은 클래스에서는 부모의 protected 멤버에 자연스럽게 접근할 수 있다. `CachedGeometry`는 SWidget에서 상속받은 멤버로, 현재 위젯의 지오메트리 정보를 담고 있다.

### 2. UMG 위젯 래퍼 생성

Blueprint에서 사용할 수 있도록 UScrollBox를 상속받는 UMG 위젯을 만든다.

```cpp
// PullToRefreshScrollBox.h

UCLASS()
class SUPERPLATM_API UPullToRefreshScrollBox : public UScrollBox
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category = "Pull To Refresh")
    float GetOverscrollAmount() const;

protected:
    virtual TSharedRef<SWidget> RebuildWidget() override;

private:
    TSharedPtr<SPullToRefreshScrollBox> MyScrollBox;
};
```

핵심은 `RebuildWidget()`을 오버라이드하여 기본 SScrollBox 대신 커스텀 SPullToRefreshScrollBox를 생성하는 것이다.

```cpp
// PullToRefreshScrollBox.cpp

float UPullToRefreshScrollBox::GetOverscrollAmount() const
{
    if (MyScrollBox.IsValid())
    {
        return MyScrollBox->GetCurrentOverscroll();
    }
    return 0.0f;
}

TSharedRef<SWidget> UPullToRefreshScrollBox::RebuildWidget()
{
    MyScrollBox = SNew(SPullToRefreshScrollBox)
        .Style(&GetWidgetStyle())
        .ScrollBarStyle(&GetWidgetBarStyle())
        .Orientation(GetOrientation())
        // ... 기타 설정
        .OnUserScrolled_UObject(this, &UPullToRefreshScrollBox::SlateHandleUserScrolled);

    for (UPanelSlot* PanelSlot : Slots)
    {
        if (UScrollBoxSlot* TypedSlot = Cast<UScrollBoxSlot>(PanelSlot))
        {
            TypedSlot->Parent = this;
            TypedSlot->BuildSlot(MyScrollBox.ToSharedRef());
        }
    }

    return MyScrollBox.ToSharedRef();
}
```

### 3. 오버스크롤 이벤트 델리게이트

Tick에서 매 프레임 값을 폴링하는 대신, 오버스크롤 값이 변할 때만 이벤트를 발생시키는 것이 효율적이다.

```cpp
// PullToRefreshScrollBox.h

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOverscrollChanged, float, OverscrollAmount);

class SPullToRefreshScrollBox : public SScrollBox
{
public:
    float GetCurrentOverscroll() const
    {
        return Overscroll.GetOverscroll(CachedGeometry);
    }

    void SetOnOverscrollChanged(TFunction<void(float)> InCallback)
    {
        OnOverscrollChangedCallback = InCallback;
    }

    virtual void Tick(const FGeometry& AllottedGeometry,
                      const double InCurrentTime,
                      const float InDeltaTime) override
    {
        SScrollBox::Tick(AllottedGeometry, InCurrentTime, InDeltaTime);

        const float CurrentOverscroll = Overscroll.GetOverscroll(AllottedGeometry);

        // 0.1 이상 변화가 있을 때만 콜백 호출
        if (!FMath::IsNearlyEqual(CurrentOverscroll, LastOverscrollValue, 0.1f))
        {
            LastOverscrollValue = CurrentOverscroll;
            if (OnOverscrollChangedCallback)
            {
                OnOverscrollChangedCallback(CurrentOverscroll);
            }
        }
    }

private:
    float LastOverscrollValue = 0.0f;
    TFunction<void(float)> OnOverscrollChangedCallback;
};
```

UMG 위젯에서 이 콜백을 델리게이트와 연결한다:

```cpp
// UPullToRefreshScrollBox 클래스에 추가
UPROPERTY(BlueprintAssignable, Category = "Pull To Refresh")
FOnOverscrollChanged OnOverscrollChanged;

// RebuildWidget()에서 콜백 연결
MyScrollBox->SetOnOverscrollChanged([this](float OverscrollAmount)
{
    OnOverscrollChanged.Broadcast(OverscrollAmount);
});
```

Blueprint에서는 `On Overscroll Changed` 이벤트에 바인딩하면 된다.

### 4. 스크롤바 Collapsed 영역 문제 해결

ScrollBar Visibility를 Collapsed로 설정해도 스크롤바 영역이 공간을 차지하는 문제가 있다. 원인은 두 가지다:

1. **타입 불일치**: UScrollBox는 `ESlateVisibility`를, SScrollBox는 `EVisibility`를 사용한다
2. **두께 유지**: Visibility가 Collapsed여도 ScrollBarThickness가 적용된다

```cpp
namespace
{
    EVisibility ConvertScrollBarVisibility(ESlateVisibility SlateVisibility)
    {
        switch (SlateVisibility)
        {
        case ESlateVisibility::Visible:
            return EVisibility::Visible;
        case ESlateVisibility::Collapsed:
            return EVisibility::Collapsed;
        case ESlateVisibility::Hidden:
            return EVisibility::Hidden;
        default:
            return EVisibility::Visible;
        }
    }
}

TSharedRef<SWidget> UPullToRefreshScrollBox::RebuildWidget()
{
    const EVisibility ScrollBarVis = ConvertScrollBarVisibility(GetScrollBarVisibility());

    // Collapsed일 때 두께를 0으로 설정
    const FVector2D ScrollBarThickness = (ScrollBarVis == EVisibility::Collapsed)
        ? FVector2D::ZeroVector
        : FVector2D(9.0f, 9.0f);

    MyScrollBox = SNew(SPullToRefreshScrollBox)
        .ScrollBarVisibility(ScrollBarVis)
        .ScrollBarThickness(ScrollBarThickness)
        // ... 기타 설정
}
```

![Overscroll 값 반환!](/dev-blog/assets/images/unreal-pull-to-refresh-scrollbox/scrollbox.png)  

## 정리

- **오버스크롤 접근**: SScrollBox를 상속받아 protected `Overscroll` 멤버에 접근
- **Blueprint 노출**: `GetOverscrollAmount()` 함수와 `OnOverscrollChanged` 델리게이트 제공
- **효율적 이벤트**: Tick 폴링 대신 값 변화 시에만 델리게이트 브로드캐스트
- **스크롤바 숨김**: `ESlateVisibility` → `EVisibility` 변환 + 두께 0 설정

Pull-to-Refresh 구현 시 반환값의 의미:
- **음수**: 위로 당김 (최상단 초과) → 새로고침 트리거 조건
- **양수**: 아래로 당김 (최하단 초과)
- **0**: 정상 스크롤 범위 내
