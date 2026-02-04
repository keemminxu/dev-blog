---
layout: post
title: "UE5 UMG에서 외부 텍스처를 Fill + Rounded Corner 처리하는 머티리얼 만들기"
date: 2026-02-04 00:00:00 +0900
categories: [unreal-engine]
tags: [ue5, material, hlsl, umg, rounded-corner, custom-node]
excerpt: "외부에서 받은 다양한 크기의 텍스처를 UMG에서 비율 유지하며 채우고, 동시에 라운드 처리하는 UI Material을 Custom HLSL 노드로 구현하는 방법."
---

## 문제 상황

외부 서버에서 다운로드한 이미지를 UMG에 표시할 때, 텍스처 크기가 제각각이라 고정 크기 위젯에 넣으면 찌부되는 문제가 있다. 이를 해결하기 위해 ScaleBox(Fill 모드)로 감싸는 건 흔한 접근인데, 여기에 라운드 처리까지 해야 하면 문제가 복잡해진다.

일반적으로 떠올리는 구조는 이렇다:

```
RetainerBox (라운드 처리 Material 적용)
  └─ InvalidationBox
       └─ ScaleBox (Fill)
            └─ Image (다운로드 텍스처)
```

이 구조에서 **스크롤 뷰 안에 넣으면** 문제가 발생한다. RetainerBox는 자식 위젯을 RenderTarget에 그리는 방식인데, 스크롤로 visible 영역이 줄어들면 RenderTarget 크기도 같이 변한다. 그 결과 UV가 꼬이면서 텍스처가 검은색으로 말려 올라가는 현상이 생긴다.

![InvalidationBox 사용 시 — 스크롤하면 텍스처가 검은색으로 말려 올라간다](/dev-blog/assets/images/ue5-umg-material-fill-rounded-corner/Before.gif)

## 해결 방법

ScaleBox, RetainerBox, InvalidationBox를 전부 걷어내고, **Material 하나에서 Fill 스케일링과 Rounded Corner를 동시에 처리**한다. Image 위젯에 이 Material Instance를 직접 넣으면 래핑 없이 깔끔하게 동작하고, 스크롤 시 RenderTarget 크기 변동 문제도 원천 차단된다.

![Material 방식 적용 후 — 스크롤해도 정상 렌더링된다](/dev-blog/assets/images/ue5-umg-material-fill-rounded-corner/After.gif)

### 머티리얼 기본 설정

- **Material Domain**: User Interface
- **Blend Mode**: Translucent
- **Shading Model**: Unlit

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `Texture` | Texture2D | 다운로드 받은 텍스처 |
| `TextureAspectRatio` | Scalar | 텍스처의 가로/세로 비율 (Width / Height) |
| `WidgetAspectRatio` | Scalar | 위젯의 가로/세로 비율 (Width / Height) |
| `CornerRadius` | Scalar | 라운드 반지름 (0 ~ 0.5, UV 공간 기준) |

`TextureAspectRatio`는 텍스처 다운로드 완료 시점에 `GetSizeX() / GetSizeY()`로 계산해서 넘기면 된다.

### Custom 노드 1: FillUV

CSS의 `object-fit: cover`와 동일한 로직이다. 텍스처 비율과 위젯 비율을 비교해서 UV를 재계산한다. 짧은 쪽에 맞추고 긴 쪽은 크롭한다.

**Name**: `FillUV` / **Return Type**: float2

**Inputs**:
- `UV` (float2) — TexCoord[0]
- `TexAspect` (float) — TextureAspectRatio 파라미터
- `WidgetAspect` (float) — WidgetAspectRatio 파라미터

```hlsl
float2 Scale;
if (TexAspect > WidgetAspect)
{
    // 텍스처가 더 넓음 → 좌우 크롭
    Scale = float2(WidgetAspect / TexAspect, 1.0);
}
else
{
    // 텍스처가 더 높음 → 상하 크롭
    Scale = float2(1.0, TexAspect / WidgetAspect);
}

// 중심 기준으로 스케일 적용
return (UV - 0.5) * Scale + 0.5;
```

### Custom 노드 2: RoundedRect

UV 공간에서 Rounded Rectangle의 SDF(Signed Distance Field)를 계산해서 마스크를 만든다. `fwidth` 기반 안티앨리어싱으로 가장자리가 부드럽게 처리된다.

**Name**: `RoundedRect` / **Return Type**: float

**Inputs**:
- `UV` (float2) — TexCoord[0]
- `Radius` (float) — CornerRadius 파라미터

```hlsl
// UV를 중심 기준 좌표로 변환 (0~1 → -1~1 → abs로 1사분면)
float2 Pos = abs(UV - 0.5) * 2.0;

// 라운드 SDF 계산
float2 Q = Pos - (1.0 - Radius);
float Dist = length(max(Q, 0.0)) - Radius;

// 안티앨리어싱 (fwidth로 픽셀 크기 기반 부드러운 경계)
float AA = fwidth(Dist) * 1.5;
return 1.0 - smoothstep(-AA, AA, Dist);
```

### 노드 연결

```
[TexCoord] ──┬──→ [FillUV] ──→ UVs ──→ [TextureSample] ──→ Final Color
             │
[TexAspect] ─┤
[WidgetAspect]┘

[TexCoord] ──→ [RoundedRect] ──→ Opacity
[CornerRadius]─┘
```

`FillUV`의 출력은 TextureSample의 UV 입력에 연결하고, `RoundedRect`의 출력은 Opacity에 연결한다. TexCoord는 두 Custom 노드에 각각 연결해야 한다.

## 정리

- ScaleBox + RetainerBox 래핑은 스크롤 환경에서 RenderTarget 크기 변동 문제를 일으킨다
- Material 자체에서 Fill + Round를 처리하면 래핑이 필요 없고 스크롤 문제도 없다
- Fill UV 계산은 텍스처와 위젯의 비율을 비교해서 짧은 축 기준으로 스케일하는 것이 핵심
- Rounded Corner는 SDF 기반으로 구현하면 해상도와 무관하게 깔끔한 결과를 얻을 수 있다
- `CornerRadius`는 0.05 ~ 0.15 정도가 자연스럽다
