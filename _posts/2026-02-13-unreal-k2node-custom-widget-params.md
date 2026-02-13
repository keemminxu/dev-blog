---
layout: post
title: "언리얼 K2Node로 위젯 파라미터 전달 문제 해결하기"
date: 2026-02-13 00:00:00 +0900
categories: [unreal-engine]
tags: [k2node, blueprint, umg, widget, reflection, editor-module]
excerpt: "UIManager로 위젯을 관리할 때 발생하는 캐스팅 종속성과 초기화 타이밍 문제를 K2Node 커스텀 노드로 해결하는 방법을 다룬다."
---

## 배경: UIManager의 한계

게임에서 UI를 중앙 관리하기 위해 UIManager 패턴을 많이 사용한다. 폴더 경로와 위젯 이름만으로 위젯을 생성하고 표시할 수 있어 편리하다.

```cpp
// UIManager 사용 예시
UUserWidget* Widget = UIManager->ShowWidget("MainHome/UI", "WBP_Popup", 10);
```

![BP에서 사용 예시](/dev-blog/assets/images/unreal-k2node-custom-widget-params/NoParams.png)

![기존 UI 생성 로직](/dev-blog/assets/images/unreal-k2node-custom-widget-params/Default.png)

하지만 실제 프로젝트에서 사용하다 보면 두 가지 문제에 부딪힌다.

### 문제 1: 캐스팅으로 인한 종속성

위젯에 데이터를 전달하려면 반환된 `UUserWidget*`을 실제 위젯 클래스로 캐스팅해야 한다.

```cpp
// 캐스팅이 필요한 기존 방식
UUserWidget* Widget = UIManager->ShowWidget("MainHome/UI", "WBP_Popup");
if (UWBP_Popup* Popup = Cast<UWBP_Popup>(Widget))
{
    Popup->SetTitle(TEXT("알림"));
    Popup->SetMessage(TEXT("저장되었습니다"));
}
```

이 방식의 문제:
- **컴파일 종속성 발생**: 호출하는 쪽에서 `WBP_Popup` 헤더를 include 해야 함
- **Blueprint 위젯은 더 복잡**: C++ 클래스가 아닌 Blueprint 위젯은 캐스팅 자체가 어려움
- **모듈 간 의존성 증가**: UI 모듈과 게임플레이 모듈이 강하게 결합됨

### 문제 2: 초기화 타이밍 문제

위젯의 `NativeConstruct`나 `Construct` 이벤트는 `AddToViewport` 시점에 호출된다. 하지만 파라미터 설정은 그 이후에 일어난다.

```
1. ShowWidget() 호출
2. CreateWidget() - 위젯 인스턴스 생성
3. AddToViewport() - NativeConstruct/Construct 호출 ← 이 시점에 파라미터가 없음!
4. SetTitle(), SetMessage() - 파라미터 설정 ← 너무 늦음
```

위젯이 `Construct`에서 파라미터를 기반으로 초기화 로직을 수행해야 한다면, 이 순서는 문제가 된다. 별도의 `Initialize` 함수를 만들거나, 파라미터 설정 후 수동으로 갱신 함수를 호출해야 한다.

## 해결 방향: K2Node 커스텀 노드

이 문제들을 해결하기 위해 K2Node를 활용한 커스텀 Blueprint 노드를 만들기로 했다. 목표는:

1. **캐스팅 없이 파라미터 전달**: 리플렉션으로 변수명 기반 자동 매칭
2. **동적 파라미터 핀**: 우클릭으로 핀 추가/삭제/타입 변경
3. **종속성 제거**: 위젯 클래스를 몰라도 파라미터 전달 가능

최종 결과물은 이런 형태의 노드다:

```
┌─────────────────────────────────┐
│  Show Widget With Params        │
├─────────────────────────────────┤
│ ▶ Execute          Then ▶      │
│                                 │
│   Folder Path ○────             │
│   Widget Name ○────             │
│   Z Order     ○────             │
│                                 │
│   Title       ○────  (String)   │  ← 동적 파라미터
│   Message     ○────  (String)   │  ← 우클릭으로 추가
│   IconIndex   ○────  (Integer)  │
│                                 │
│              Widget ○────       │
└─────────────────────────────────┘
```

![동적 파라미터 핀](/dev-blog/assets/images/unreal-k2node-custom-widget-params/Type.png)


## K2Node 기본 구조

K2Node는 Blueprint 그래프에서 보이는 노드의 "껍데기"다. 실제 실행 로직은 `ExpandNode`에서 기존 함수 호출 노드들로 변환된다.

### Editor 모듈 생성

K2Node는 에디터 전용 기능이므로 별도의 Editor 모듈이 필요하다.

```cpp
// SuperPlatMEditor.Build.cs
public class SuperPlatMEditor : ModuleRules
{
    public SuperPlatMEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] {
            "Core",
            "CoreUObject",
            "Engine",
            "SuperPlatM"  // 런타임 모듈 참조
        });

        PrivateDependencyModuleNames.AddRange(new string[] {
            "UnrealEd",
            "BlueprintGraph",
            "KismetCompiler",
            "Slate",
            "SlateCore",
            "GraphEditor",
            "ToolMenus"
        });
    }
}
```

`.uproject` 파일에도 Editor 모듈을 등록한다:

```json
{
    "Modules": [
        {
            "Name": "SuperPlatM",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        },
        {
            "Name": "SuperPlatMEditor",
            "Type": "Editor",
            "LoadingPhase": "PostEngineInit"
        }
    ]
}
```

### K2Node 클래스 선언

```cpp
// K2Node_ShowWidgetWithParams.h
USTRUCT()
struct FWidgetParameterInfo
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere)
    FName ParameterName;

    UPROPERTY(EditAnywhere)
    FEdGraphPinType ParameterType;
};

UCLASS()
class UK2Node_ShowWidgetWithParams : public UK2Node
{
    GENERATED_BODY()

public:
    // 기본 핀 생성
    virtual void AllocateDefaultPins() override;

    // 노드 → 실제 함수 호출로 변환
    virtual void ExpandNode(FKismetCompilerContext& CompilerContext,
                            UEdGraph* SourceGraph) override;

    // 우클릭 메뉴
    virtual void GetNodeContextMenuActions(UToolMenu* Menu,
                                           UGraphNodeContextMenuContext* Context) const override;

    // 파라미터 목록
    UPROPERTY()
    TArray<FWidgetParameterInfo> Parameters;

    void AddParameterPin();
    void RemoveParameterPin(UEdGraphPin* Pin);
    void ChangeParameterPinType(UEdGraphPin* Pin, FName NewCategory);
    void RenameParameterPin(UEdGraphPin* Pin, FString NewName);
};
```

### 핀 생성: AllocateDefaultPins

`AllocateDefaultPins`에서 노드에 표시될 핀들을 생성한다.

```cpp
void UK2Node_ShowWidgetWithParams::AllocateDefaultPins()
{
    // 실행 핀
    CreatePin(EGPD_Input, UEdGraphSchema_K2::PC_Exec, PN_Execute);
    CreatePin(EGPD_Output, UEdGraphSchema_K2::PC_Exec, PN_Then);

    // WorldContext (숨김 - 자동 연결)
    UEdGraphPin* WorldContextPin = CreatePin(EGPD_Input,
        UEdGraphSchema_K2::PC_Object, UObject::StaticClass(), PN_WorldContext);
    WorldContextPin->bHidden = true;

    // 입력 핀
    CreatePin(EGPD_Input, UEdGraphSchema_K2::PC_String, PN_FolderPath);
    CreatePin(EGPD_Input, UEdGraphSchema_K2::PC_String, PN_WidgetName);

    UEdGraphPin* ZOrderPin = CreatePin(EGPD_Input, UEdGraphSchema_K2::PC_Int, PN_ZOrder);
    ZOrderPin->DefaultValue = TEXT("0");

    // 출력 핀
    CreatePin(EGPD_Output, UEdGraphSchema_K2::PC_Object,
              UUserWidget::StaticClass(), PN_ReturnWidget);

    // 동적 파라미터 핀
    for (int32 i = 0; i < Parameters.Num(); ++i)
    {
        const FWidgetParameterInfo& Param = Parameters[i];
        UEdGraphPin* ParamPin = CreatePin(EGPD_Input, Param.ParameterType, Param.ParameterName);
        ParamPin->PinFriendlyName = FText::FromName(Param.ParameterName);
    }
}
```

## 핵심: ExpandNode 구현

`ExpandNode`는 K2Node의 핵심이다. 커스텀 노드를 실제 실행 가능한 함수 호출 체인으로 변환한다.

```cpp
void UK2Node_ShowWidgetWithParams::ExpandNode(
    FKismetCompilerContext& CompilerContext,
    UEdGraph* SourceGraph)
{
    Super::ExpandNode(CompilerContext, SourceGraph);

    // 1. UIManager::Get() 호출 노드 생성
    UK2Node_CallFunction* GetUIManagerNode =
        CompilerContext.SpawnIntermediateNode<UK2Node_CallFunction>(this, SourceGraph);
    GetUIManagerNode->FunctionReference.SetExternalMember(
        GET_FUNCTION_NAME_CHECKED(UUIManager, Get),
        UUIManager::StaticClass());
    GetUIManagerNode->AllocateDefaultPins();

    // 2. ShowWidget() 호출 노드 생성
    UK2Node_CallFunction* ShowWidgetNode =
        CompilerContext.SpawnIntermediateNode<UK2Node_CallFunction>(this, SourceGraph);
    ShowWidgetNode->FunctionReference.SetExternalMember(
        GET_FUNCTION_NAME_CHECKED(UUIManager, ShowWidget),
        UUIManager::StaticClass());
    ShowWidgetNode->AllocateDefaultPins();

    // 3. 핀 연결
    // UIManager::Get의 반환값 → ShowWidget의 Self 핀
    GetUIManagerNode->GetReturnValuePin()->MakeLinkTo(
        ShowWidgetNode->FindPinChecked(UEdGraphSchema_K2::PN_Self));

    // WorldContext를 두 노드에 연결 (Copy 후 Move)
    CompilerContext.CopyPinLinksToIntermediate(*WorldContextPin, *ShowWidgetWorldContextPin);
    CompilerContext.MovePinLinksToIntermediate(*WorldContextPin, *GetUIManagerWorldContextPin);

    // 실행 핀, 입력 핀 연결
    CompilerContext.MovePinLinksToIntermediate(*ExecPin, *ShowWidgetNode->GetExecPin());
    CompilerContext.MovePinLinksToIntermediate(*FolderPathPin, *ShowWidgetFolderPathPin);
    // ... 나머지 핀들도 동일하게 연결
}
```

### 핀 연결 시 주의점

두 입력 핀을 직접 연결하면 "Direction mismatch" 오류가 발생한다.

```cpp
// ❌ 잘못된 방법: 두 입력 핀 직접 연결
InputPinA->MakeLinkTo(InputPinB);  // Direction mismatch 오류!

// ✅ 올바른 방법: 원본 연결을 복사/이동
CompilerContext.CopyPinLinksToIntermediate(*OriginalPin, *TargetPinA);
CompilerContext.MovePinLinksToIntermediate(*OriginalPin, *TargetPinB);
```

`CopyPinLinksToIntermediate`는 원본 핀의 연결을 대상 핀에 복사하고, `MovePinLinksToIntermediate`는 이동(원본 연결 제거)한다.

## 리플렉션 기반 파라미터 설정

위젯 클래스를 모른 채로 파라미터를 설정하려면 리플렉션을 사용한다. UIManager에 헬퍼 함수들을 추가한다.

```cpp
// UIManager.h
UFUNCTION(BlueprintCallable)
static bool SetWidgetStringParam(UUserWidget* Widget, FName PropertyName, const FString& Value);

UFUNCTION(BlueprintCallable)
static bool SetWidgetIntParam(UUserWidget* Widget, FName PropertyName, int32 Value);

// ... Bool, Float, Text, Object 등

// UIManager.cpp
bool UUIManager::SetWidgetStringParam(UUserWidget* Widget, FName PropertyName, const FString& Value)
{
    if (!Widget || PropertyName.IsNone())
        return false;

    // 리플렉션으로 프로퍼티 찾기
    FStrProperty* Property = FindFProperty<FStrProperty>(Widget->GetClass(), PropertyName);
    if (!Property)
        return false;  // 프로퍼티가 없으면 조용히 실패 (종속성 없음!)

    Property->SetPropertyValue_InContainer(Widget, Value);
    return true;
}
```

`ExpandNode`에서 파라미터 타입에 따라 적절한 Setter를 호출한다:

```cpp
// 파라미터별로 SetWidgetXXXParam 호출 노드 생성
for (const FWidgetParameterInfo& Param : Parameters)
{
    FName SetterName;
    if (Param.ParameterType.PinCategory == UEdGraphSchema_K2::PC_String)
        SetterName = GET_FUNCTION_NAME_CHECKED(UUIManager, SetWidgetStringParam);
    else if (Param.ParameterType.PinCategory == UEdGraphSchema_K2::PC_Int)
        SetterName = GET_FUNCTION_NAME_CHECKED(UUIManager, SetWidgetIntParam);
    // ... 타입별 분기

    UK2Node_CallFunction* SetterNode =
        CompilerContext.SpawnIntermediateNode<UK2Node_CallFunction>(this, SourceGraph);
    SetterNode->FunctionReference.SetExternalMember(SetterName, UUIManager::StaticClass());
    SetterNode->AllocateDefaultPins();

    // Widget, PropertyName, Value 핀 연결
    ShowWidgetReturnPin->MakeLinkTo(SetterNode->FindPin(TEXT("Widget")));
    SetterNode->FindPin(TEXT("PropertyName"))->DefaultValue = Param.ParameterName.ToString();
    CompilerContext.MovePinLinksToIntermediate(*ParamPin, *SetterNode->FindPin(TEXT("Value")));

    // 실행 체인 연결
    LastThenPin->MakeLinkTo(SetterNode->GetExecPin());
    LastThenPin = SetterNode->GetThenPin();
}
```

## 우클릭 컨텍스트 메뉴

`GetNodeContextMenuActions`를 오버라이드하여 파라미터 관리 메뉴를 추가한다.

```cpp
void UK2Node_ShowWidgetWithParams::GetNodeContextMenuActions(
    UToolMenu* Menu,
    UGraphNodeContextMenuContext* Context) const
{
    Super::GetNodeContextMenuActions(Menu, Context);

    FToolMenuSection& Section = Menu->AddSection("Parameters");

    // Add Parameter
    Section.AddMenuEntry(
        "AddParameter",
        LOCTEXT("AddParameter", "Add Parameter"),
        LOCTEXT("AddParameterTooltip", "Add a new parameter pin"),
        FSlateIcon(),
        FUIAction(FExecuteAction::CreateUObject(
            const_cast<UK2Node_ShowWidgetWithParams*>(this),
            &UK2Node_ShowWidgetWithParams::AddParameterPin))
    );

    // 파라미터 핀이 선택된 경우 추가 메뉴
    if (Context->Pin && IsParameterPin(Context->Pin))
    {
        // Change Type 서브메뉴
        Section.AddSubMenu(
            "ChangeType",
            LOCTEXT("ChangeType", "Change Type"),
            FText::GetEmpty(),
            FNewToolMenuDelegate::CreateLambda([this, Pin = Context->Pin](UToolMenu* SubMenu)
            {
                // Boolean, Integer, Float, String, Text, Object 타입 옵션
                AddTypeMenuItem(SubMenu, "Boolean", UEdGraphSchema_K2::PC_Boolean);
                AddTypeMenuItem(SubMenu, "Integer", UEdGraphSchema_K2::PC_Int);
                AddTypeMenuItem(SubMenu, "Float", UEdGraphSchema_K2::PC_Real);
                AddTypeMenuItem(SubMenu, "String", UEdGraphSchema_K2::PC_String);
                // ...
            })
        );

        // Rename Parameter
        Section.AddMenuEntry("RenameParameter", ...);

        // Remove Parameter
        Section.AddMenuEntry("RemoveParameter", ...);
    }
}
```
![변수명 변경](/dev-blog/assets/images/unreal-k2node-custom-widget-params/ChangeName.png)
![변수명 커스텀](/dev-blog/assets/images/unreal-k2node-custom-widget-params/Rename.png)


![파라미터값 변경](/dev-blog/assets/images/unreal-k2node-custom-widget-params/ChangeParam.png)


## 정리

### 해결된 문제들

| 문제 | 기존 방식 | K2Node 방식 |
|------|----------|-------------|
| 캐스팅 종속성 | 위젯 클래스 include 필요 | 리플렉션으로 변수명만 알면 됨 |
| Blueprint 위젯 | 캐스팅 어려움 | 동일하게 작동 |
| 파라미터 추가 | 코드 수정 필요 | 우클릭으로 동적 추가 |
| 타입 안전성 | 컴파일 타임 | 런타임 (변수 없으면 조용히 무시) |
| 패키징 or 청크 시스템 | 레퍼런스 잡힘 | 레퍼런스 안잡힘(패키징 이슈 해결) |

![UI Manager](/dev-blog/assets/images/unreal-k2node-custom-widget-params/WithParams.png)
![레퍼런스 뷰어](/dev-blog/assets/images/unreal-k2node-custom-widget-params/RefView.png)

### 핵심 포인트

1. **K2Node는 껍데기**: 실제 로직은 `ExpandNode`에서 기존 함수 노드들로 변환
2. **Editor 모듈 분리**: K2Node는 에디터 전용, 런타임 모듈과 분리 필요
3. **핀 연결 방향 주의**: 입력-입력 직접 연결 불가, `Copy/MovePinLinksToIntermediate` 사용
4. **리플렉션 활용**: `FindFProperty`로 런타임에 프로퍼티 찾아서 설정
5. **실패 처리**: 프로퍼티가 없으면 에러 대신 무시 → 종속성 완전 제거

### 주의사항

- K2Node 변경 후에는 **에디터 재시작**이 필요한 경우가 많음
- `ReconstructNode()` 호출 시 기존 연결이 끊어질 수 있으므로 `ReallocatePinsDuringReconstruction` 구현 권장
- 리플렉션 기반이라 **오타에 주의** (런타임에 에러없이 실패)
