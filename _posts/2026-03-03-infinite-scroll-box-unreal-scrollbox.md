---
layout: post
title: "UE5 ScrollBox로 양방향 무한 스크롤 만들기"
date: 2026-03-04 02:30:00 +0900
categories: [unreal-engine]
tags: [ue5, scrollbox, infinite-scroll, pagination, umg, mobile, slate]
excerpt: "ListView를 쓰지 않고 ScrollBox만으로 양방향 무한 스크롤을 구현했다. BindWidget 함정, 위젯 높이 측정 타이밍, 1프레임 깜빡임까지 — 실전에서 만난 문제와 해결 과정을 정리한다."
---

## 왜 ListView를 안 썼는가

UE5에는 가상화(Virtualization)를 지원하는 `UListView`가 있다. 화면에 보이는 위젯만 생성하고 나머지는 재활용하므로 대량 데이터에 적합하다. 그런데 이번 프로젝트에서는 ListView 대신 ScrollBox를 선택했다.

이유는 세 가지였다:

1. **이미 ScrollBox 기반 UI가 완성되어 있었다.** 메인 홈 화면에 배너, 스페이서, 오버레이 등 고정 요소가 ScrollBox 안에 배치되어 있었고, 그 아래에 동적 콘텐츠가 붙는 구조였다. ListView로 전환하면 이 혼합 레이아웃을 전부 뜯어고쳐야 했다.

2. **각 "아이템"이 단순 행이 아니었다.** 페이지 하나가 API 응답 10건이지만, UI에서는 이걸 섹션 위젯 1개로 묶어서 표시한다. ListView의 "1 데이터 = 1 위젯" 패턴과 맞지 않았다.

3. **Pull-to-Refresh가 이미 구현되어 있었다.** `UPullToRefreshScrollBox`라는 커스텀 ScrollBox가 SScrollBox의 오버스크롤 값을 노출하고 있었고, 이 위에 무한 스크롤을 얹는 게 자연스러웠다.

결론적으로 ListView의 가상화 대신, ScrollBox + 캐시 페이지 상한(MaxCachedPages)으로 메모리를 관리하는 방식을 택했다. 전체 데이터를 들고 있지 않고, 최근 N페이지만 유지하면서 양쪽 끝에서 페이지를 추가/제거하는 구조다.

## 설계

### 클래스 계층

```
UScrollBox
  └─ UPullToRefreshScrollBox   ← 오버스크롤 값 노출, 스크롤 위치 콜백
       └─ UInfiniteScrollBox    ← 양방향 페이징, 캐시 관리, 오프셋 보정
```

Slate 레벨에서는 `SPullToRefreshScrollBox`가 `SScrollBox`를 상속하여 매 Tick마다 세 가지를 감시한다:

- **오버스크롤 양**: 위쪽으로 당기면 pull-to-refresh 또는 이전 페이지
- **하단까지 거리**: 프리페치 거리 이내면 다음 페이지 로드
- **상단까지 거리**: 프리페치 거리 이내면 이전 페이지 로드

### ContentContainer 패턴

메인 홈 화면의 ScrollBox에는 고정 UI(배너, 스페이서)와 동적 콘텐츠가 섞여 있다. 동적 콘텐츠만 따로 관리하기 위해, ScrollBox 안에 `VerticalBox`를 하나 두고 이것을 `ContentContainer`로 지정했다:

```
InfiniteScrollBox
  ├─ Overlay (고정 - 배너)
  ├─ Spacer (고정)
  └─ VerticalBox "ContentContainer"    ← 여기에만 동적 위젯 추가/제거
       ├─ SectionWidget (Page 1)
       ├─ SectionWidget (Page 2)
       └─ SectionWidget (Page 3)
```

이렇게 하면 `ClearDynamicChildren()`이 ContentContainer의 자식만 제거하고, 고정 UI는 건드리지 않는다.

### 캐시 관리

`MaxCachedPages`(기본 3)를 초과하면 스크롤 방향의 반대쪽 페이지를 제거한다:

```
[Page 1][Page 2][Page 3]  ← 3페이지 캐시
         ↓ 아래로 스크롤, Page 4 로드
[Page 1][Page 2][Page 3][Page 4]  ← 4페이지, 초과
         ↓ EvictTopPage()
         [Page 2][Page 3][Page 4]  ← Page 1 제거 + 오프셋 보정
```

각 페이지의 위젯 수를 `TArray<int32> PageItemCounts`에 기록해두면, 제거할 때 정확히 몇 개를 `RemoveChildAt`해야 하는지 알 수 있다.

### 2단계 Pull-to-Refresh

처음에는 오버스크롤이 임계값을 넘는 즉시 새로고침을 트리거했다. 모바일에서 실제로 써보니 문제가 있었다 — 위로 당기다가 마음이 바뀌어 놓아도 이미 새로고침이 시작된 후였다.

모바일 앱의 표준 동작은 "당겼다가 놓았을 때" 실행이다. 그래서 2단계로 바꿨다:

```cpp
void UInfiniteScrollBox::HandleInfiniteOverscroll(float OverscrollAmount)
{
    if (bIsLoading) return;
    const float AbsOverscroll = FMath::Abs(OverscrollAmount);

    // Phase 1: 임계값 초과 → 준비 상태
    if (OverscrollAmount < 0.0f && AbsOverscroll >= OverscrollThreshold)
    {
        if (!bOverscrollTriggered)
            bOverscrollTriggered = true;
        return;
    }

    // Phase 2: 손을 떼서 오버스크롤이 해소되면 실행
    if (bOverscrollTriggered && AbsOverscroll < OverscrollThreshold * 0.5f)
    {
        bOverscrollTriggered = false;
        bIsLoading = true;

        if (FirstLoadedPage <= 1)
            OnRequestRefresh.Broadcast();
        else
            OnRequestNextPage.Broadcast(FirstLoadedPage - 1);
    }
}
```

임계값의 50% 이하로 돌아올 때 실행하는 이유는, 오버스크롤이 정확히 0이 되는 순간을 잡기가 어렵기 때문이다. 약간의 여유를 두는 게 안정적이다.

## 구현에서 만난 문제들

### 1. UScrollBox에는 NativeConstruct가 없다

처음에 `NativeConstruct()` / `NativeDestruct()`를 override하여 이벤트를 바인딩하려 했다:

```cpp
virtual void NativeConstruct() override;   // C3668 컴파일 에러
```

`NativeConstruct`는 `UUserWidget` 전용이다. `UScrollBox`는 `UPanelWidget → UWidget` 계열이라 이 함수가 존재하지 않는다. `RebuildWidget()`과 `ReleaseSlateResources()`가 대응하는 lifecycle 함수다:

```cpp
TSharedRef<SWidget> UInfiniteScrollBox::RebuildWidget()
{
    TSharedRef<SWidget> Widget = Super::RebuildWidget();
    OnOverscrollChanged.AddUniqueDynamic(this, &UInfiniteScrollBox::HandleInfiniteOverscroll);

    if (MyPullToRefreshScrollBox.IsValid())
    {
        MyPullToRefreshScrollBox->SetOnNearEnd([this](float Dist) { HandleNearEnd(Dist); });
        MyPullToRefreshScrollBox->SetOnNearStart([this](float Dist) { HandleNearStart(Dist); });
    }
    return Widget;
}
```

### 2. BindWidget이 작동하지 않는다

ContentContainer를 자동으로 바인딩하기 위해 `meta = (BindWidget)`을 붙여봤다:

```cpp
UPROPERTY(meta = (BindWidget))
UPanelWidget* ContentContainer;
```

컴파일은 되지만 런타임에서 항상 `nullptr`이었다. 원인: **BindWidget은 `UUserWidget` 전용 메커니즘이다.** `UScrollBox` 서브클래스에서는 동작하지 않는다. 에러도 경고도 없이 조용히 실패한다.

해결: `RebuildWidget()`에서 자식 위젯의 FName으로 직접 탐색하도록 변경했다:

```cpp
if (!ContentContainer)
{
    for (int32 i = 0; i < GetChildrenCount(); i++)
    {
        if (UWidget* Child = GetChildAt(i))
        {
            if (Child->GetFName().ToString().Contains(TEXT("ContentContainer")))
            {
                ContentContainer = Cast<UPanelWidget>(Child);
                break;
            }
        }
    }
}
```

UMG 디자이너에서 VerticalBox의 이름에 "ContentContainer"를 포함시키면 자동으로 잡힌다.

### 3. API 응답 수 ≠ 위젯 수

초기 구현에서는 Blueprint가 `NotifyPageLoaded(PageNo, ItemCount, bIsLastPage)`를 호출할 때 `ItemCount`를 그대로 `PageItemCounts`에 저장했다. 문제는 API가 10개의 에피소드를 반환하지만, UI에서는 이것을 1개의 섹션 위젯으로 묶어서 표시한다는 것이다.

`PageItemCounts`에 10이 저장되어 있는데 실제 위젯은 1개. `EvictTopPage()`가 10개를 제거하려고 하면 존재하는 위젯 3~4개가 한꺼번에 전부 삭제된다.

해결: `ItemCount` 파라미터를 무시하고, ContentContainer의 실제 자식 수 변화량을 자동 계산하도록 변경했다:

```cpp
void UInfiniteScrollBox::NotifyPageLoaded(int32 PageNo, int32 ItemCount, bool bIsLastPage)
{
    UPanelWidget* Panel = GetContentPanel();
    const int32 CurrentDynamicChildren = Panel->GetChildrenCount() - GetDynamicChildStartIndex();

    int32 ExpectedDynamicChildren = 0;
    for (const int32 Count : PageItemCounts)
        ExpectedDynamicChildren += Count;

    const int32 ActualItemsAdded = CurrentDynamicChildren - ExpectedDynamicChildren;

    // ActualItemsAdded (1)을 사용, ItemCount (10)은 무시
    PageItemCounts.Add(ActualItemsAdded);
    // ...
}
```

이렇게 하면 BP가 넘겨주는 `ItemCount`와 무관하게, ContentContainer에 실제로 몇 개의 위젯이 추가되었는지를 기준으로 관리한다. `ItemCount` 파라미터는 로깅용으로만 남겨뒀다.

**중요한 전제**: 이 자동 계산이 작동하려면 **BP가 위젯을 ContentContainer에 추가한 뒤에 NotifyPageLoaded를 호출해야 한다.** 순서가 반대면 `ActualItemsAdded`가 0이 되어 페이지가 등록되지 않는다. 이 순서 실수로 인한 버그를 두 번이나 겪었다:

- AddChild → NotifyPageLoaded ✅
- NotifyPageLoaded → AddChild ❌ (ActualWidgets=0, 페이지 등록 실패)

### 4. InsertChildAt의 대상을 잘못 지정

위쪽에 이전 페이지를 삽입할 때, Blueprint에서 `InsertChildAt(0)`의 Panel을 ScrollBox 자체에 연결했더니 위젯이 ContentContainer가 아닌 ScrollBox에 직접 들어갔다.

`NotifyPageLoaded`는 ContentContainer의 자식 수를 기준으로 계산하므로, ContentContainer에 변화가 없으니 `ActualItemsAdded = 0`. 무한 반복 요청이 발생했다.

```
Branch: PageNo < ScrollBox.FirstLoadedPage
  True  → InsertChildAt(0, Panel: ContentContainer)  ← 여기가 핵심
  False → AddChild(ContentContainer)
```

양쪽 다 **ContentContainer**에 위젯을 추가해야 한다.

### 5. GetDesiredSize()가 0을 반환한다

이전 페이지 삽입 시 오프셋 보정을 위해 삽입된 위젯의 높이를 측정해야 한다. 처음에는 `GetDesiredSize().Y`를 바로 호출했는데 0이 반환됐다.

원인: `InsertChildAt(0)` 직후에는 레이아웃 패스가 아직 안 돌아서 위젯의 DesiredSize가 계산되지 않은 상태다. 해결은 `ForceLayoutPrepass()`:

```cpp
if (bIsPrevPage)
{
    FirstLoadedPage = PageNo;
    PageItemCounts.Insert(ActualItemsAdded, 0);

    // 레이아웃 강제 갱신 → GetDesiredSize()가 실제 값을 반환
    ForceLayoutPrepass();

    float HeightAdded = MeasureChildrenHeight(Panel, StartIndex, ActualItemsAdded);
    const float CurrentOffset = GetScrollOffsetFixed();
    SetScrollOffsetFixed(CurrentOffset + HeightAdded);
}
```

`ForceLayoutPrepass()`는 Slate 위젯 트리 전체의 `SlatePrepass`를 강제로 실행하여 DesiredSize를 즉시 계산한다.

### 6. 1프레임 깜빡임

위쪽 삽입 + 오프셋 보정을 해도 1프레임 깜빡임이 남았다. `SScrollBox::SetScrollOffset()`은 `DesiredScrollOffset`만 설정하고, 실제 스크롤 위치(`ScrollOffset`) 반영은 **다음 Tick**에서 일어나기 때문이다:

```
Frame N: InsertChildAt(0) + SetScrollOffset(보정값)
Frame N: 렌더 → 위젯은 삽입됐지만 스크롤 위치는 아직 미반영 → 깜빡임
Frame N+1: SScrollBox::Tick에서 ScrollOffset 갱신 → 정상 표시
```

해결: `SPullToRefreshScrollBox`에 강제 Tick 메서드를 추가했다:

```cpp
// SPullToRefreshScrollBox
void ForceApplyScrollOffset()
{
    SScrollBox::Tick(CachedGeometry, 0.0, 0.0f);
}
```

`NotifyPageLoaded`에서 오프셋 설정 직후 호출:

```cpp
SetScrollOffsetFixed(CurrentOffset + HeightAdded);
if (MyPullToRefreshScrollBox.IsValid())
    MyPullToRefreshScrollBox->ForceApplyScrollOffset();
```

delta time을 0으로 넘기면 오버스크롤 감쇠나 스크롤 애니메이션 같은 부작용 없이 오프셋만 즉시 적용된다. `bIsLoading`을 함수 끝에서 해제하도록 이동하여, 강제 Tick 중 HandleNearStart가 재진입하는 것도 방지했다.

완전히 제거되진 않고 아주 약간의 깜빡임이 남아있다. 게임 스레드와 렌더 스레드의 동기화 차이에서 오는 한계로, 실사용에는 문제 없는 수준이다.

## Blueprint 사용 흐름

최종적인 BP 사용 패턴:

**초기 로드:**
```
BeginPlay → InfiniteScrollBox.RequestInitialLoad()
```

**OnRequestNextPage(PageNo) 이벤트:**
```
API 호출 → 응답 콜백:
  Branch: PageNo < ScrollBox.FirstLoadedPage?
    True  → InsertChildAt(0, ContentContainer) → NotifyPageLoaded(PageNo, Count, IsLast)
    False → AddChild(ContentContainer)         → NotifyPageLoaded(PageNo, Count, IsLast)
  실패 시: NotifyLoadFailed()
```

**OnRequestRefresh 이벤트:**
```
ClearDynamicChildren → API(PageNo=1) → AddChild(ContentContainer) → NotifyRefreshComplete(Count, IsLast)
```

캐시 초과 감지, 페이지 제거, 오프셋 보정, 프리페치는 모두 C++ 내부에서 자동 처리된다. BP에서는 "위젯 추가 → Notify 호출" 순서만 지키면 된다.



![](/dev-blog/assets/images/infinite-scroll-box-unreal-scrollbox/InfiniteScroll.gif)

스크롤을 올릴때 가상화 처리 이슈가 있다. 높이를 기준으로 스크롤 박스의 offset을 재계산하기 때문
하지만 뿌듯하다ㅋ 


## 정리

- **ListView vs ScrollBox**: 가상화가 필요 없고, 고정 UI와 동적 콘텐츠가 혼합된 레이아웃이라면 ScrollBox + 캐시 페이지 상한이 더 실용적이다.
- **BindWidget은 UUserWidget 전용이다.** UScrollBox 서브클래스에서는 조용히 실패한다. FName 기반 자동 탐색으로 대체해야 한다.
- **위젯 수 자동 계산**: API 응답 수와 실제 위젯 수가 다를 수 있다. ContentContainer의 자식 변화량을 기준으로 관리하는 게 안전하다.
- **호출 순서가 핵심**: AddChild/InsertChildAt → NotifyPageLoaded. 반대면 ActualItemsAdded가 0이 되어 모든 게 깨진다.
- **ForceLayoutPrepass()**: 위젯 삽입 직후 높이를 측정해야 하면 필수. 없으면 GetDesiredSize()가 0을 반환한다.
- **SScrollBox의 오프셋은 다음 Tick에 적용된다.** 즉시 적용하려면 Tick을 수동으로 호출해야 하고, 이때 재진입 방지를 위해 bIsLoading 해제 타이밍에 주의해야 한다.
