---
layout: post
title: "UE5 모바일 UMG에 자이로 패럴랙스 추가하기"
title_en: "Adding Gyroscope Parallax to a Mobile UMG in UE5"
excerpt_en: "Using device tilt sensors to add layered parallax depth to UMG in an Unreal Engine 5 mobile app"
date: 2026-04-16 01:30:00 +0900
categories: [unrealengine]
tags: [ue5, umg, gyroscope, parallax, mobile]
excerpt: "앱에서 자이로 센서를 읽어 UMG에 차등 패럴랙스를 줘서 입체감을 만들기"
---

앱에 좀 더 특별한 효과를 주기 위해 UMG와 모바일 자이로 센서로 말풍선에 패럴랙스 효과를 줘봤다.

## 아이디어

폰을 기울이면 배경은 살짝, 말풍선은 크게 움직여서 레이어가 분리된 느낌을 주는 거다. 카드 뉴스 앱이나 인스타그램 3D 사진에서 보던 그 효과인데, 웹툰 말풍선에 적용하면 "떠있는 느낌"이 나지 않을까 싶었다.

레이어 구조는 이렇게 잡았다:

| 레이어 | 강도 | 역할 |
|---|---|---|
| BackgroundImage | 약 (8) | 배경 이미지, 가장 안쪽 |
| NarrationText | 중 (14) | 나레이션, 중간 깊이 |
| Bubbles | 강 (26) | 말풍선, 가장 바깥(카메라 쪽) |

말풍선이 여러 개일 때는 인덱스별로 강도에 약간 차이를 줘서 말풍선끼리도 깊이가 다르게 느껴지도록 했다.

## 센서 값 읽기

UE5에서 모바일 자이로 값을 가져오는 건 `APlayerController::GetInputMotionState`로 간단하다.

```cpp
FVector Tilt, RotRate, Gravity, Accel;
PC->GetInputMotionState(Tilt, RotRate, Gravity, Accel);
```

여기서 `Gravity` 벡터를 썼다. `Tilt`보다 안정적이고, 디바이스가 어느 방향으로 기울어져 있는지 절대값으로 알려주기 때문이다. Portrait 기준으로 `Gravity.X`가 좌우, `Gravity.Y`가 앞뒤 기울기다.

한 가지 주의할 점은, 앱 시작 시점의 기울기를 "중립"으로 잡아줘야 한다는 거다. 안 그러면 사용자가 누워서 폰을 보고 있을 때 말풍선이 한쪽으로 쏠려 있다.

```cpp
if (!bOriginCalibrated && !RawTilt.IsNearlyZero(0.001f))
{
    CalibratedOrigin = RawTilt;
    bOriginCalibrated = true;
}

FVector2D TargetParallax = RawTilt - CalibratedOrigin;
```

## 스무딩

센서 raw 값을 그대로 넣으면 떨림이 심하다. 특히 저가 안드로이드 기기에서. `FMath::Lerp`로 현재값과 목표값 사이를 보간해주면 부드러워진다.

```cpp
const float Alpha = FMath::Clamp(ParallaxSmoothing * DeltaTime, 0.0f, 1.0f);
CurrentParallax = FMath::Lerp(CurrentParallax, TargetParallax, Alpha);
```

`ParallaxSmoothing` 값이 클수록 빠르게 반응하고, 작을수록 뭉글뭉글하게 따라온다. 5~6 정도가 자연스러운 느낌이었다.

## UMG에 적용

핵심은 `SetRenderTranslation`이다. 이건 레이아웃에 영향을 주지 않고 시각적으로만 위젯을 이동시킨다. 그래서 ScrollBox 안에서 써도 스크롤이 깨지지 않는다.

```cpp
// 배경
BackgroundImage->SetRenderTranslation(CurrentParallax * BackgroundParallaxStrength);

// 말풍선 - 인덱스별 깊이 차이
for (int32 i = 0; i < Bubbles.Num(); ++i)
{
    float DepthFactor = 1.0f + (/* 인덱스 기반 variance */);
    Bubbles[i]->SetRenderTranslation(CurrentParallax * BubbleParallaxStrength * DepthFactor);
}
```

![자이로 패럴랙스 언리얼 UE5 Gyro Parallax](/assets/images/ue5-gyro-parallax-umg/parallax-demo.gif)


## 권한 이슈

패키징하기 전에 제일 걱정됐던 건 센서 권한인데, 결론부터 말하면 **추가 권한 설정 없다.** Android에서 가속도/자이로는 권한 시스템 밖에 있고, iOS에서도 Core Motion의 기본 센서는 permission prompt가 안 뜬다. `Config/DefaultInput.ini`에 `bEnableMotionControls=True`만 있으면 된다.
