---
layout: post
title: "UE5에서 웹툰 말풍선 시스템 만들기"
title_en: "Building a Webtoon-Style Speech Bubble System in UE5"
excerpt_en: "How I built a dynamic speech bubble widget system in Unreal Engine 5 with SDF materials and viewport-based scroll fade-in"
date: 2026-04-08 17:00:00 +0900
categories: [unreal-engine]
tags: [ue5, umg, slate, sdf, material, scrollbox, webtoon]
excerpt: "에피소드 데이터로 들어오는 dialogues + bubblePositions 배열을 받아 이미지 위에 동적으로 말풍선을 배치하고, 스크롤에 따라 페이드인되는 시스템을 만든 과정 정리."
---

프로젝트를 진행하면서 웹툰처럼 이미지 위에 말풍선이 떠 있는 화면이 필요했다. 기존엔 한 노드당 [이미지 + 나레이션 + 캐릭터 멘트] 세 줄짜리 단순 슬롯이 ScrollBox에 누적되는 구조였는데, 서버에서 여러 개의 말풍선 위치 데이터를 보내주기 시작하면서 새로 만들어야 했다.

데이터는 대략 이런 형태로 들어온다:

```json
{
    "backgroundImage": "https://...",
    "narration": "차가운 가을밤,...",
    "dialogues": [
        { "characterName": "나비", "bubbleType": "THOUGHT", "text": "사진 속 흐릿한 얼굴...", "sizeWeight": 6 },
        { "characterName": "나비", "bubbleType": "SPEECH",  "text": "주인에게 뭘 말하고 싶었던 걸까?",   "sizeWeight": 5 }
    ],
    "bubblePositions": [
        { "dialogueIndex": 0, "x": 67, "y": 28, "tailDirection": "TOP_RIGHT", "bodyOffset": 15 },
        { "dialogueIndex": 1, "x": 67, "y": 38, "tailDirection": "TOP_RIGHT", "bodyOffset": 15 }
    ]
}
```

`x`, `y`는 이미지 영역 기준 백분율이고 **꼬리 끝 위치**다. `tailDirection`은 7가지 (NONE/TOP/BOTTOM/TOP_LEFT/TOP_RIGHT/BOTTOM_LEFT/BOTTOM_RIGHT). `bubbleType`은 4가지 (SPEECH/THOUGHT/SHOUT/WHISPER)고 각각 모양과 폰트가 달라야 한다.

![최종 동작 GIF](/assets/images/webtoon-speech-bubble-widget/final-demo.gif)

## 위젯을 어떻게 쪼갤까

처음엔 한 슬롯 안에서 말풍선 N개를 다 처리할까 싶었는데, 책임 분리가 깔끔하지 않을 것 같아서 두 개로 나눴다.

- **`UW_SpeechBubbleSlot`** — ScrollBox 안에 들어가는 노드 단위. 이미지 다운로드, 말풍선 N개 생성, 좌표 배치, narration/액션버튼 영역 visibility 관리
- **`UW_SpeechBubble`** — 개별 말풍선. 머티리얼 인스턴스, 텍스트 스타일, 자체 페이드 처리

UMG 트리는 이렇게 잡았다:

```
W_SpeechBubbleSlot (UserWidget)
└─ VerticalBox (RootBox)
   ├─ Spacer1
   ├─ NarrationText (ScalableTextWidget)
   ├─ Spacer2
   ├─ Border (ImageBorder)
   │   └─ Overlay
   │       ├─ Image       (BackgroundImage)
   │       └─ CanvasPanel (BubbleLayer)  ← 말풍선들이 여기 들어감
   ├─ Spacer3
   └─ VerticalBox (ActionBox)            ← 선택지/엔딩 위젯이 여기 들어감
```

말풍선들은 `BubbleLayer` 캔버스 패널의 자식으로 동적 생성되고, 좌표는 픽셀 단위로 직접 설정한다. ScrollBox 자체는 호출 측이 이미 만들어놓은 걸 그대로 쓴다.

![UMG](/assets/images/webtoon-speech-bubble-widget/widget-tree.png)

## 좌표 변환

`x`, `y`가 꼬리 끝 위치라는 게 중요하다. 말풍선 본체는 이걸 기준으로 방향에 따라 옮겨야 한다. 예를 들어 `tailDirection`이 `TOP_RIGHT`라면 본체가 꼬리 위쪽으로 `bodyOffset`만큼 떨어져야 한다.

처음엔 대각 방향이라고 X도 같이 옮길까 했는데, 모바일 세로 화면에서는 가로 폭이 좁아서 본체가 화면 밖으로 삐져나가기 쉽다. 그래서 **본체 중심 X는 항상 꼬리 끝 X와 동일**하게 두고, Y만 방향에 따라 옮기는 걸로 정했다. LEFT/RIGHT 같은 가로 성분은 꼬리 모양만 결정하고 본체 위치엔 영향 안 준다.

```cpp
// 1) 꼬리 끝 픽셀 좌표
const FVector2D TailTipPx(
    ImageSize.X * (Position.x / 100.f),
    ImageSize.Y * (Position.y / 100.f));

// 2) 본체 중심 (방향별 Y 오프셋)
const float OffsetPx = ImageSize.Y * (Position.bodyOffset / 100.f);
float BodyCenterY = TailTipPx.Y;

switch (Bubble->GetTailDirection())
{
    case EBubbleTailDirection::Top:
    case EBubbleTailDirection::TopLeft:
    case EBubbleTailDirection::TopRight:
        BodyCenterY = TailTipPx.Y - OffsetPx - BodySize.Y * 0.5f;
        break;
    case EBubbleTailDirection::Bottom:
    case EBubbleTailDirection::BottomLeft:
    case EBubbleTailDirection::BottomRight:
        BodyCenterY = TailTipPx.Y + OffsetPx + BodySize.Y * 0.5f;
        break;
    default:
        BodyCenterY = TailTipPx.Y;
        break;
}

const float BodyCenterX = TailTipPx.X;

// 3) 본체가 이미지 밖으로 나가지 않도록 클램핑
const float HalfW = BodySize.X * 0.5f;
const float ClampedX = FMath::Clamp(BodyCenterX, HalfW, ImageSize.X - HalfW);
const float ClampedY = FMath::Clamp(BodyCenterY, BodySize.Y * 0.5f, ImageSize.Y - BodySize.Y * 0.5f);
```

본체가 클램핑되면 꼬리 끝 (TailTipPx)과 본체 중심이 어긋난다. 이걸 머티리얼에 알려줘서 꼬리가 그쪽으로 휘게 그리도록 했다 (TailOffsetPx 파라미터).



### 본체 크기 측정 타이밍

UMG는 위젯이 처음 만들어진 시점엔 `DesiredSize`가 0이다. layout prepass가 한 번 돌아야 측정이 끝난다. 그래서 슬롯이 말풍선들을 만들고 바로 좌표 배치하면 본체 크기가 0이라 클램핑이 망가진다.

해결은 단순하게 `bNeedsLayoutBubbles = true` 플래그를 두고 다음 NativeTick에서 한 번만 좌표 배치하는 거. 본체 크기가 여전히 0이면 최대 3프레임까지 재시도하고 포기.

## 머티리얼: SDF로 4가지 모양

웹툰 말풍선은 종류별로 모양이 달라야 한다 (실선 둥근 박스, 구름/타원, 뾰족한 외침, 흐릿한 속삭임). 텍스처 4세트 만들기보다 머티리얼 한 개에 SDF로 처리하는 게 깔끔할 것 같았다. 꼬리 방향도 7가지인데 각각 텍스처 만들면 28장이라 실용성이 없다.

**Custom HLSL Node** 한 개에 SDF 함수 다 넣고, 머티리얼 그래프는 파라미터 노드들 + Custom 노드 + ComponentMask 정도로 끝.

머티리얼 설정:
- Material Domain: User Interface
- Blend Mode: Translucent
- Shading Model: Unlit

C++에서 받는 파라미터:
- `BodySizePx` (vec2) — 본체 픽셀 크기
- `BubbleTypeId` (scalar 0~3) — 모양 분기
- `TailDirId` (scalar 0~6) — 꼬리 방향
- `TailOffsetPx` (vec2) — 본체 중심 → 꼬리 끝 오프셋 (클램핑된 결과 반영)

SDF 함수 핵심:

```hlsl
float2 P = (UV - 0.5f) * BodySizePx;
float2 HalfBox = BodySizePx * 0.5f - 24.0f;
float CornerR = 16.0f;

// SPEECH (기본): rounded box
float2 Q = abs(P) - HalfBox;
float BodyDist = length(max(Q, 0.0f)) + min(max(Q.x, Q.y), 0.0f) - CornerR;

// THOUGHT: ellipse SDF (iq method, gradient corrected)
if (BubbleTypeId > 0.5f && BubbleTypeId < 1.5f)
{
    float2 EllipseAxes = HalfBox + CornerR;
    float k1 = length(P / EllipseAxes);
    float k2 = length(P / (EllipseAxes * EllipseAxes));
    BodyDist = k1 * (k1 - 1.0f) / max(k2, 1e-5f);
}

// SHOUT: 별 모양 (각도별 sin 변조)
if (BubbleTypeId > 1.5f && BubbleTypeId < 2.5f)
{
    float Angle = atan2(P.y, P.x);
    float Spike = 1.0f + 0.18f * sin(Angle * 14.0f);
    float2 Scaled = P / Spike;
    float2 Q3 = abs(Scaled) - HalfBox;
    BodyDist = (length(max(Q3, 0.0f)) + min(max(Q3.x, Q3.y), 0.0f) - 4.0f) * Spike;
}
```

여기서 한 가지 삽질한 게 ellipse SDF다. 처음엔 단순히 `(length(P / Axes) - 1) * MinAxis` 같은 근사를 썼는데, 가로로 긴 ellipse에서는 거리장이 균일하지 않아서 외곽선이 위쪽엔 안쪽으로 들어가고 아래쪽엔 바깥으로 나가는 식으로 어긋났다. iq의 gradient corrected 방식 (`k1 * (k1 - 1) / k2`)으로 바꾸니까 외곽선이 ellipse 가장자리에 정확히 붙는다.

<!-- IMAGE: 4가지 말풍선 모양 비교 (SPEECH/THOUGHT/SHOUT/WHISPER) | 경로: /assets/images/webtoon-speech-bubble-widget/bubble-types.png -->

머티리얼 인스턴스는 C++에서 MID로 만들어서 매번 위 파라미터들을 갱신한다:

```cpp
void UW_SpeechBubble::EnsureMaterialInstance()
{
    if (BubbleMID) return;

    UMaterialInterface* SourceMaterial = BubbleMaterial.LoadSynchronous();
    if (!SourceMaterial) return;

    BubbleMID = UMaterialInstanceDynamic::Create(SourceMaterial, this);
    if (BubbleBody && BubbleMID)
    {
        BubbleBody->SetBrushFromMaterial(BubbleMID);
    }
}
```

## 스크롤 페이드인: 가장 많이 삽질한 부분

처음엔 단순하게 생각했다. "슬롯이 ScrollBox 안에 들어가니까 슬롯 단위로 위치 잡고 페이드 처리하면 되겠지." 근데 이게 진짜 함정이었다.

### 시도 1: 슬롯의 ScrollBox 상대 위치 사용 → 실패

슬롯이 부모 ScrollBox를 자동 탐색한 다음, 슬롯의 absolute Y에서 ScrollBox의 absolute Y를 빼면 ScrollBox viewport 안 상대 위치가 나올 거라고 생각했다.

```cpp
const FGeometry& ScrollGeo = CachedParentScrollBox->GetCachedGeometry();
const float ScrollAbsY = ScrollGeo.GetAbsolutePosition().Y;
const float SlotAbsY = MyGeometry.GetAbsolutePosition().Y;
const float RelY = SlotAbsY - ScrollAbsY;
```

근데 디버그 로그를 찍어보니 ScrollBox의 absolute Y가 `-989` 같은 음수가 나왔다. 슬롯의 absolute Y는 화면에서 보이는 위치와 일치했는데, ScrollBox geometry만 이상한 좌표 공간에 있는 거였다. 아마 cached geometry가 layout pass와 비동기여서 그런 듯한데, 어쨌든 이 두 값을 직접 빼서 쓰면 안 됐다.

### 시도 2: 슬롯 단위 페이드 → 또 실패

좌표 문제를 해결한다 쳐도 더 근본적인 문제가 있었다. **슬롯 자체가 가변 높이**라는 것. narration이 있으면 슬롯이 길어지고 없으면 짧아진다. 이미지 영역도 가변. 슬롯 단위로 페이드 진행도를 계산하면 슬롯 안의 말풍선들이 슬롯 위치 하나로만 결정돼서, 같은 슬롯 안 말풍선이 화면 위쪽에 있든 아래쪽에 있든 똑같이 페이드된다.

스크롤로 슬롯이 화면을 통과할 때 말풍선들이 같이 반응하는 게 아니라 한꺼번에 사라지는 식으로 부자연스러웠다.

### 시도 3: 각 말풍선이 자체 페이드 → 정답

결론은 슬롯이 페이드 책임을 버리고, **각 말풍선이 자기 NativeTick에서 자기 위치를 보고 페이드를 결정**하는 거였다. 슬롯은 그냥 좌표 배치만 하고, 페이드 로직은 `UW_SpeechBubble`에 들어간다.

여기서 또 한 가지 함정이 있었다. UMG의 `MyGeometry.GetAbsolutePosition()`은 OS 데스크톱 절대 좌표라서, **PIE 창을 옮기면 값이 바뀐다.** ViewportSize와 단위도 달라서 직접 비교하면 안 된다.

해결은 `USlateBlueprintLibrary::AbsoluteToViewport`로 viewport 픽셀 좌표로 변환하는 것:

```cpp
float UW_SpeechBubble::CalculateProgress(const FGeometry& MyGeometry) const
{
    UObject* WorldContext = const_cast<UW_SpeechBubble*>(this);

    const FVector2D ViewportSize = UWidgetLayoutLibrary::GetViewportSize(WorldContext);
    if (ViewportSize.Y <= 1.f) return 0.f;

    const float ViewportH = ViewportSize.Y;

    // OS 좌표 → viewport 픽셀 좌표 변환 (PIE 창 위치와 무관)
    FVector2D PixelPos, ViewportPos;
    USlateBlueprintLibrary::AbsoluteToViewport(
        WorldContext, MyGeometry.GetAbsolutePosition(), PixelPos, ViewportPos);

    const float BubbleTopVpY = PixelPos.Y;

    // FadeStartRatio / FullRevealRatio는 viewport bottom에서 위로 올라온 비율
    // 0.2 = bottom에서 20% 위로 올라온 시점부터 페이드 시작
    // 0.7 = bottom에서 70% 위로 올라온 시점에 alpha 1
    const float StartPos = ViewportH * (1.f - FMath::Min(FadeStartRatio, FullRevealRatio - 0.01f));
    const float EndPos   = ViewportH * (1.f - FullRevealRatio);

    if (BubbleTopVpY >= StartPos) return 0.f;
    if (BubbleTopVpY <= EndPos)   return 1.f;

    const float Span = FMath::Max(StartPos - EndPos, 1.f);
    return (StartPos - BubbleTopVpY) / Span;
}

void UW_SpeechBubble::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    SetRenderOpacity(CalculateProgress(MyGeometry));
}
```

이러면 각 말풍선이 viewport 안 자기 위치만 보고 알파 결정. 슬롯 가변 높이와 무관하고, 사용자가 스크롤로 손가락을 위/아래로 움직이면 거기에 정확히 비례해서 페이드인/페이드아웃이 양방향으로 동작한다.

`FadeStartRatio`와 `FullRevealRatio`는 UPROPERTY로 빼서 디자이너가 조정할 수 있게 했다. 기본값은 0.2 / 0.7인데, 말풍선이 화면 아래에서 20% 올라온 지점부터 페이드 시작해서 70% 지점에 완전히 보이게 한다는 뜻.

<!-- IMAGE: 스크롤 페이드인 동작 GIF (스크롤 내릴 때 말풍선이 점진적으로 페이드인되는 모습) | 경로: /assets/images/webtoon-speech-bubble-widget/scroll-fade.gif -->

## 정리

- **위젯은 책임 단위로 분리.** 슬롯은 컨테이너, 말풍선은 자기 자신만 책임. 페이드를 슬롯이 분배하지 않고 말풍선 각자가 결정하게 했더니 가변 레이아웃에도 자연스럽게 동작했다
- **머티리얼 SDF + Custom HLSL Node**는 텍스처 폭발을 막는 좋은 방법이다. 단 ellipse 같은 비균일 SDF는 단순 근사로는 외곽선이 어긋나니 iq의 gradient corrected 방식을 써야 한다
- **`MyGeometry.GetAbsolutePosition()`은 OS 좌표**다. PIE 창을 옮기면 값이 바뀌고 ViewportSize와 단위가 다르다. `USlateBlueprintLibrary::AbsoluteToViewport`로 변환해야 한다. 이거 모르면 한참 헤맨다
- **ScrollBox의 `GetCachedGeometry()`는 신뢰하기 어렵다.** layout pass 타이밍이랑 어긋나서 absolute Y가 음수로 나오는 경우가 있었다. 슬롯이 ScrollBox 안에 있더라도 ScrollBox와의 상대 위치를 직접 빼는 건 피하고, viewport 절대 위치 기반으로 가는 게 안전하다
- **UMG `DesiredSize`는 첫 프레임엔 0**이다. 동적으로 만든 위젯의 측정값이 필요하면 NativeTick에서 한 번 더 읽거나 재시도 로직을 둬야 한다

전체 코드는 4개 파일 (Slot 헤더/cpp, Bubble 헤더/cpp) + 머티리얼 1개 + WBP 2개 정도 분량. 페이드 부분만 몇 번씩 갈아엎었는데 결국 가장 단순한 방식 (각자 자기 위치 보기) 이 정답이었다.
