---
layout: post
title: "UnrealEngine 리플렉션에 대하여"
title_en: "UnrealEngine what is Reflection"
date: 2026-04-17 16:44:50 +0900
categories: ["study"]
tags: ["ue5", "unrealengine", "reflection", "cpp", "c++"]
excerpt: "UnrealEngine 리플렉션에 대하여"
excerpt_en: "UnrealEngine what is Reflection"
---

## 리플렉션(Reflection)

**프로그램이 런타임에 자기 자신의 구조를 들여다보고 조작하는 능력**

C++는 일반적으로 컴파일되면 타입/이름/함수 정보가 전부 날아가고 메모리 주소만 남음.

근데 리플렉션을 붙이면 해당 정보들이 날아가지 않고 런타임에 조회가 가능하다!

C++: 컴파일하면 걍 바이너리 덩어리.
리플렉션 있는 언어(C#, Java, Python..): 이름표, 타입표, 함수 목록까지 다 붙여서 실행 (런타임 조회 가능)

결국 C++는 기본적으로 리플렉션이 없기 때문에 **Unreal Engine은 자체 리플렉션 시스템을 따로 만들었음.**



## 사용법

1. `UCLASS()` `UPROPERTY()` `UFUNCTION` 으로 헤더를 작성하면
2. 빌드 전 단계에서 `UHT(Unreal Header Tool)`가 헤더를 파싱하고 "아 이 클래스엔 이런 프로퍼티/함수가 있구나~"
3. `.generated.h/.gen.cpp`를 자동 생성해준다.
4. 그럼 런타임에서 `UClass*`, `UFunction*` ,`FProperty*` 등의 메타데이터 객체가 메모리에 상주하게 됨.

```cpp
  UCLASS()
  class UMyWidget : public UUserWidget
  {
      GENERATED_BODY()

      UPROPERTY(EditAnywhere)
      int32 Count;

      UFUNCTION(BlueprintCallable)
      void DoStuff();
  };
```



## 이게 뭘 가능케하냐

1. 이름(문자열)로 프로퍼티/함수 찾기
2. Dynamic 델리게이트 작동***(UFUNCTION 매크로 없으면 FindFunction 결과가 nullptr로 반환)*** -> 그래서 얘는 필수임.
3. 에디터에서 Details 패널 설정
4. 직렬화(Serialization): 리플렉션으로 프로퍼티 목록 읽어서 각 필드를 순서대로 파일에 쓰고 읽음. 없으면 저장 안됨.
5. GC(Garbage Collection): GC는 어떤 객체가 어떤 UObject 포인터를 갖고있냐를 리플렉션으로 스캔. 없으면 댕글링 포인터 위험
6. BP에서 C++ 함수 호출하기
7. 머티리얼 파라미터 `MI->SetScalarParameterValue(TEXT("Param"), 1.0f)` 같은거 할 때



## 왜 중요한가?

위에 내용이랑 비슷하지만

1. Unreal Engine의 거의 모든 ***편의성***이 리플렉션 위에서 돌아감
2. BP 시각화
3. 네트워크 복제
4. GC 자동화
5. 델리게이트 바인딩
6. 에디터에서 프로퍼티 편집
7. 콘솔 커맨드



## 단점

**메모리에 올리는 만큼 비용이 있다.**

UHT가 헤더 파싱해서 코드 생성하기때문에 컴파일 단계가 추가됨 -> 빌드 시간 증가

바이너리 크기 증가, 메모리 증가

그리고 호출 오버헤드가 있다고 하는데 이건 `BP에서 호출`, `ProcessEvent`, `델리게이트 BroadCast` 할 때 살짝 느리다고함



## 결론

***필요할때만 리플렉션 매크로를 붙이고, 내부 구현 디테일엔 안붙이는 로직이 깔끔쓰!***



## 추가 궁금증.. 근데 이게 매크로인가??

맞음. 근데 특별함.

엔진 `ObjectMacros.h`를 보면:

```cpp
#define UPROPERTY(...)
#define UFUNCTION(...)
#define USTRUCT(...)
#define UMETA(...)
#define UPARAM(...)
#define UENUM(...)
#define UDELEGATE(...)
#define RIGVM_METHOD(...)
```

실제론 비어있다. C++ 컴파일러 입장에선 그냥 지워지는 코드.

그럼 어떻게 동작? → UHT가 C++ 컴파일 전에 헤더를 따로 스캔해서 메타데이터 코드를 다른 파일에 생성해버림.

즉 매크로는 "여기 UHT가 읽어야 할 표식이 있다"는 마커 역할이고, 실제 수행은 UHT가 함.