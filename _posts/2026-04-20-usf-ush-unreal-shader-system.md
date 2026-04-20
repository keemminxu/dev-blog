---
layout: post
title: "usf / ush - 언리얼 셰이더 시스템"
title_en: "usf-ush-unreal-shader-system"
date: 2026-04-20 14:21:23 +0900
categories: ["study"]
tags: ["ue5", "shader", "usf", "ush"]
excerpt: "usf / ush - 언리얼 셰이더 시스템에 대해서 알아보자"
excerpt_en: "What is usf / ush? Unreal Shader System"
---

## usf와 ush?

- `usf`: Unreal Shader File - 셰이더 진입점 (ex .cpp)
- `ush`: Unreal Shader Header - 함수/매크로 정의, #include로 가져옴 (ex .h)

둘 다 내용은 `HLSL`(DirectX 기반 셰이더 언어) + 거기에 언리얼이 자체 매크로/전처리기 확장을 올린 형태.

`Vulkan`/`Metal`/`OpenGL` - 엔진의 셰이더 컴파일러가 크로스 컴파일해줌.

플랫폼 별 크로스컴파일 흐름.

`.usf/.ush (HLSL) → ShaderCompileWorker → 플랫폼별 바이너리 (DXIL/SPIR-V/Metal) → DDC 캐시 → 런타임 RHI`

셰이더만 고쳤는데 왜 결과 안바뀌지? 할땐 `recomplieshaderschanged` 콘솔 입력!


## 왜 자체 확장자를 쓸까?

HLSL은 원래 부동소수점 타입을 가지고 있음. 
1. `float` - 32bit 정밀도
2. `half` - 16bit 정밀도 빠르지만 부정확
3. `fixed` - 모바일 전용, 아주 낮은 정밀도 거의 안씀

만약 같은 셰이더 코드를 PC와 모바일에서 둘 다 사용하고 싶다면??
- PC GPU: float를 써도 성능 여유 충분
- 모바일 GPU: float를 쓰기엔 여유가 부족

순수 HLSL로 한다면, ***모바일과 PC*** 즉 같은 코드 두 개를 유지보수해야함ㅠㅠ

그래서 언리얼에선 추상화 매크로로 플랫폼별로 다르게 정의된 매크로가 들어가있음.

```cpp
#if MOBILE_PROFILE
  #define MaterialFloat3 half3
#else
  #define MaterialFloat3 float3
#endif
```
이때 셰이더 작성자는 그냥 이렇게 씀
```
MaterialFloat3 BaseColor =
GetMaterialBaseColor(Parameters);
```

***결국 하나의 코드가 플랫폼에 맞는 타입으로 자동 컴파일(***추상화!***)를 위한 아이디어다.***

---

그리고 `c++`과 `셰이더 uniform`을 연결하기 위한 장치임.

순수 HLSL 방식은
``` hlsl
// MyShader.hlsl
cbuffer MyParams
{
  float4 Color;
  float  Intensity;
};
```
c++에선 문자열 이름과 오프셋으로 수동 바인딩을 함.
```cpp
// 순수 DirectX 수도 코드
auto Loc = shader.GetUniformLocation("Color");
shader.SetUniform4f(Loc, r, g, b, a);
shader.SetUniform1f(IntensityLoc, 0.5f);
// 문자열로 찾고, 바이트 단위로 세팅
```
자 여기서 문제가 발생한다.
- Color를 오타내면? > 조용히 런타임 실패
- 셰이더는 float4인데 c++에서 float3으로 보내면? > 메모리 깨짐
- 파라미터 하나 추가/제거할 때마다 두 파일 동기화 해줘야함

아주 불편...

그래서 언리얼에서는 매크로로 한번만 선언해주는거다.

```cpp
// MyShader.h
BEGIN_SHADER_PARAMETER_STRUCT(FMyShaderParams, )
  SHADER_PARAMETER(FVector4f, Color)
  SHADER_PARAMETER(float,     Intensity)
  SHADER_PARAMETER_TEXTURE(Texture2D, SceneTexture)
END_SHADER_PARAMETER_STRUCT()
```
이렇게 선언하면 c++ 구조체의 필드가 그대로 보임.

엔진이 자동으로:
1. 타입 일치 검증
2. 메모리 레이아웃 계산
3. uniform 바인딩
4. 문자열 조회 없이 오프셋 직결

c++에서 `UPROPERTY` 한 번 선언하면 BP가 자동으로 인식하는 것과 같은 맥락.

***선언 한번으로 양쪽에서 사용***

---

마지막으론 머티리얼 에디터를 위함.

1. 머티리얼 에디터에서 노드를 짠다.
2. 엔진이 그걸 HLSL 코드 조각으로 변환

***즉 머티리얼은 ush 템플릿 안의 빈 자리에 주입되는 비주얼 스크립트***


![머티리얼 노드가 HLSL 코드로 변환되는 과정](/assets/images/usf-ush-unreal-shader-system/37cba895-0691-4162-9c97-cc6a08888e35.png)

위 사진은 간단한 머테리얼 노드가 어떻게 HLSL로 변환되어 나타나지는가를 보여줌. 

창 -> 셰이더 코드 -> HLSL 선택하면 나옴.

모바일 용으로도 디버깅 할 수 있다.

---

## 결론

셰이더 쪽은 항상 어렵다..

계속해서 공부해야 할 부분