# SaveGame 통합: UserSettingsSaveGame 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TextSettingsSaveGame + WidgetDismissSaveGame을 UserSettingsSaveGame으로 통합하고, 새로운 StoryPlayMode 설정을 추가한다.

**Architecture:** 기존 2개 SaveGame 클래스를 하나의 UserSettingsSaveGame으로 합치고, EStoryPlayMode enum + 필드를 추가한다. SuperPlatBFL의 래퍼 함수 시그니처는 그대로 유지하여 Blueprint 호환성을 보장한다. 기존 유저 데이터 마이그레이션을 위해 첫 로드 시 구 슬롯에서 데이터를 읽어온다.

**Tech Stack:** Unreal Engine 5 C++ (USaveGame, UGameplayStatics, BlueprintFunctionLibrary)

---

## File Structure

| Action | Path | 역할 |
|--------|------|------|
| **Create** | `Source/SuperPlatM/SaveGame/UserSettingsSaveGame.h` | 통합 SaveGame 클래스 헤더 |
| **Create** | `Source/SuperPlatM/SaveGame/UserSettingsSaveGame.cpp` | 통합 SaveGame 구현 + 마이그레이션 |
| **Modify** | `Source/SuperPlatM/Core/SuperPlatBFL.h` | StoryPlayMode BFL 함수 선언 추가 |
| **Modify** | `Source/SuperPlatM/Core/SuperPlatBFL.cpp` | TextSettings/WidgetDismiss/StoryMode → UserSettings로 전환 |
| **Modify** | `Source/SuperPlatM/UI/ScalableTextWidget.cpp` | include 경로 + 로드 로직 변경 |
| **Modify** | `Source/SuperPlatM/UI/AnimatedTextWidget.cpp` | include 경로 + 로드 로직 변경 |
| **Delete** | `Source/SuperPlatM/SaveGame/TextSettingsSaveGame.h` | 구 클래스 제거 |
| **Delete** | `Source/SuperPlatM/SaveGame/TextSettingsSaveGame.cpp` | 구 클래스 제거 |
| **Delete** | `Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.h` | 구 클래스 제거 |
| **Delete** | `Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.cpp` | 구 클래스 제거 |

---

### Task 1: UserSettingsSaveGame 클래스 생성

**Files:**
- Create: `Source/SuperPlatM/SaveGame/UserSettingsSaveGame.h`
- Create: `Source/SuperPlatM/SaveGame/UserSettingsSaveGame.cpp`

- [ ] **Step 1: UserSettingsSaveGame.h 작성**

```cpp
// Copyright TheCrossingLab, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "UserSettingsSaveGame.generated.h"

/** 텍스트 크기 변경 글로벌 델리게이트 (C++ 바인딩용) */
DECLARE_MULTICAST_DELEGATE_OneParam(FOnTextSizeChangedNative, float);
SUPERPLATM_API extern FOnTextSizeChangedNative GOnTextSizeChanged;

/** 스토리 진행 모드 */
UENUM(BlueprintType)
enum class EStoryPlayMode : uint8
{
    Click   UMETA(DisplayName = "Click Mode"),
    Scroll  UMETA(DisplayName = "Scroll Mode")
};

/**
 * 유저 환경설정을 로컬에 저장하는 통합 SaveGame 클래스
 * - 텍스트 크기 설정
 * - 위젯 다시보지않기 상태
 * - 스토리 진행 모드
 */
UCLASS()
class SUPERPLATM_API UUserSettingsSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UUserSettingsSaveGame();

    // ===== Text Settings =====

    UPROPERTY(VisibleAnywhere, Category = "Text")
    float TextSize;

    // ===== Widget Dismiss =====

    UPROPERTY(VisibleAnywhere, Category = "Dismiss")
    TSet<FString> DismissedWidgetIds;

    UFUNCTION(BlueprintCallable, Category = "WidgetDismiss")
    void DismissWidget(const FString& WidgetId);

    UFUNCTION(BlueprintCallable, Category = "WidgetDismiss")
    bool IsWidgetDismissed(const FString& WidgetId) const;

    UFUNCTION(BlueprintCallable, Category = "WidgetDismiss")
    void RestoreWidget(const FString& WidgetId);

    UFUNCTION(BlueprintCallable, Category = "WidgetDismiss")
    void ClearAllDismissed();

    // ===== Story Play Mode =====

    UPROPERTY(VisibleAnywhere, Category = "Story")
    EStoryPlayMode StoryPlayMode;

    // ===== Migration =====

    /** 구 SaveGame 슬롯에서 데이터를 마이그레이션 (첫 로드 시 1회) */
    void MigrateFromLegacySlots();

    bool IsMigrationCompleted() const { return bMigrationCompleted; }

    static const FString SaveSlotName;

private:
    /** 마이그레이션 완료 플래그 */
    UPROPERTY()
    bool bMigrationCompleted;
};
```

- [ ] **Step 2: UserSettingsSaveGame.cpp 작성**

```cpp
// Copyright TheCrossingLab, Inc. All Rights Reserved.

#include "UserSettingsSaveGame.h"
#include "Kismet/GameplayStatics.h"

FOnTextSizeChangedNative GOnTextSizeChanged;

const FString UUserSettingsSaveGame::SaveSlotName = TEXT("UserSettings");

UUserSettingsSaveGame::UUserSettingsSaveGame()
{
    TextSize = 17.0f;
    StoryPlayMode = EStoryPlayMode::Click;
    bMigrationCompleted = false;
}

void UUserSettingsSaveGame::DismissWidget(const FString& WidgetId)
{
    if (!WidgetId.IsEmpty())
    {
        DismissedWidgetIds.Add(WidgetId);
    }
}

bool UUserSettingsSaveGame::IsWidgetDismissed(const FString& WidgetId) const
{
    return DismissedWidgetIds.Contains(WidgetId);
}

void UUserSettingsSaveGame::RestoreWidget(const FString& WidgetId)
{
    DismissedWidgetIds.Remove(WidgetId);
}

void UUserSettingsSaveGame::ClearAllDismissed()
{
    DismissedWidgetIds.Empty();
}

void UUserSettingsSaveGame::MigrateFromLegacySlots()
{
    if (bMigrationCompleted)
    {
        return;
    }

    // 구 TextSettings 슬롯에서 마이그레이션
    const FString OldTextSlot = TEXT("TextSettings");
    if (UGameplayStatics::DoesSaveGameExist(OldTextSlot, 0))
    {
        USaveGame* OldSave = UGameplayStatics::LoadGameFromSlot(OldTextSlot, 0);
        if (OldSave)
        {
            // UTextSettingsSaveGame의 TextSize 필드 읽기 (리플렉션)
            FFloatProperty* TextSizeProp = FindFProperty<FFloatProperty>(OldSave->GetClass(), TEXT("TextSize"));
            if (TextSizeProp)
            {
                TextSize = TextSizeProp->GetPropertyValue_InContainer(OldSave);
                UE_LOG(LogTemp, Log, TEXT("[UserSettings] Migrated TextSize: %.1f from legacy slot"), TextSize);
            }

            UGameplayStatics::DeleteGameInSlot(OldTextSlot, 0);
        }
    }

    // 구 WidgetDismissData 슬롯에서 마이그레이션
    const FString OldDismissSlot = TEXT("WidgetDismissData");
    if (UGameplayStatics::DoesSaveGameExist(OldDismissSlot, 0))
    {
        USaveGame* OldSave = UGameplayStatics::LoadGameFromSlot(OldDismissSlot, 0);
        if (OldSave)
        {
            FSetProperty* DismissProp = FindFProperty<FSetProperty>(OldSave->GetClass(), TEXT("DismissedWidgetIds"));
            if (DismissProp)
            {
                // TSet<FString> 복사
                FScriptSetHelper SetHelper(DismissProp, DismissProp->ContainerPtrToValuePtr<void>(OldSave));
                for (int32 i = 0; i < SetHelper.Num(); ++i)
                {
                    if (SetHelper.IsValidIndex(i))
                    {
                        FString* ValuePtr = (FString*)SetHelper.GetElementPtr(i);
                        if (ValuePtr)
                        {
                            DismissedWidgetIds.Add(*ValuePtr);
                        }
                    }
                }
                UE_LOG(LogTemp, Log, TEXT("[UserSettings] Migrated %d dismissed widgets from legacy slot"), DismissedWidgetIds.Num());
            }

            UGameplayStatics::DeleteGameInSlot(OldDismissSlot, 0);
        }
    }

    bMigrationCompleted = true;
}
```

- [ ] **Step 3: 컴파일 확인**

Unreal Editor 또는 IDE에서 컴파일. 이 시점에서는 아직 참조하는 곳이 없으므로 깨끗하게 빌드되어야 함.

- [ ] **Step 4: 커밋**

```bash
git add Source/SuperPlatM/SaveGame/UserSettingsSaveGame.h Source/SuperPlatM/SaveGame/UserSettingsSaveGame.cpp
git commit -m "[FEAT] UserSettingsSaveGame 통합 SaveGame 클래스 생성"
```

---

### Task 2: SuperPlatBFL 수정 — TextSettings + WidgetDismiss → UserSettings 전환

**Files:**
- Modify: `Source/SuperPlatM/Core/SuperPlatBFL.h` (StoryPlayMode 함수 선언 추가)
- Modify: `Source/SuperPlatM/Core/SuperPlatBFL.cpp` (include 교체, 캐시 교체, 함수 내부 교체)

- [ ] **Step 1: SuperPlatBFL.h — StoryPlayMode 함수 선언 추가**

`SuperPlatBFL.h`에 `UserSettingsSaveGame.h` forward 선언은 불필요 (BFL은 static 함수만 사용).
`ClearAllDismissedWidgets` 선언 뒤에 StoryPlayMode 함수 3개 추가:

```cpp
    // 기존 WidgetDismiss 선언들 아래에 추가:

    /** 스토리 진행 모드 저장 */
    UFUNCTION(BlueprintCallable, Category = "SuperPlatM|Story")
    static void SetStoryPlayMode(EStoryPlayMode Mode);

    /** 저장된 스토리 진행 모드 가져오기 */
    UFUNCTION(BlueprintPure, Category = "SuperPlatM|Story")
    static EStoryPlayMode GetStoryPlayMode();

    /** 스토리 진행 모드가 스크롤인지 확인 */
    UFUNCTION(BlueprintPure, Category = "SuperPlatM|Story")
    static bool IsStoryScrollMode();
```

헤더 상단에 EStoryPlayMode forward 선언 또는 include 필요:
```cpp
#include "../SaveGame/UserSettingsSaveGame.h"  // EStoryPlayMode enum
```

- [ ] **Step 2: SuperPlatBFL.cpp — include 교체**

```cpp
// 제거:
#include "../SaveGame/TextSettingsSaveGame.h"
#include "../SaveGame/WidgetDismissSaveGame.h"

// 추가:
#include "../SaveGame/UserSettingsSaveGame.h"
```

- [ ] **Step 3: SuperPlatBFL.cpp — 캐시 + GetOrCreate 함수 통합**

기존 `CachedDismissSaveGame` + `GetOrCreateDismissSaveGame()` 블록 (line 2653-2675)을 제거하고,
기존 TextSettings의 직접 로드 패턴도 제거 후, 하나의 통합 캐시로 교체:

```cpp
// ===== User Settings =====

static TWeakObjectPtr<UUserSettingsSaveGame> CachedUserSettings = nullptr;

static UUserSettingsSaveGame* GetOrCreateUserSettings()
{
    if (!CachedUserSettings.IsValid())
    {
        if (UGameplayStatics::DoesSaveGameExist(UUserSettingsSaveGame::SaveSlotName, 0))
        {
            CachedUserSettings = Cast<UUserSettingsSaveGame>(
                UGameplayStatics::LoadGameFromSlot(UUserSettingsSaveGame::SaveSlotName, 0)
            );
        }

        if (!CachedUserSettings.IsValid())
        {
            CachedUserSettings = Cast<UUserSettingsSaveGame>(
                UGameplayStatics::CreateSaveGameObject(UUserSettingsSaveGame::StaticClass())
            );
        }

        // 구 슬롯 마이그레이션 (첫 로드 시 1회, 마이그레이션 실행된 경우만 저장)
        if (CachedUserSettings.IsValid() && !CachedUserSettings->IsMigrationCompleted())
        {
            CachedUserSettings->MigrateFromLegacySlots();
            UGameplayStatics::SaveGameToSlot(CachedUserSettings.Get(), UUserSettingsSaveGame::SaveSlotName, 0);
        }
    }

    return CachedUserSettings.Get();
}

static void SaveUserSettingsToDisk()
{
    if (CachedUserSettings.IsValid())
    {
        UGameplayStatics::SaveGameToSlot(CachedUserSettings.Get(), UUserSettingsSaveGame::SaveSlotName, 0);
    }
}
```

- [ ] **Step 4: SuperPlatBFL.cpp — WidgetDismiss 함수들 전환**

`DismissWidget`, `IsWidgetDismissed`, `RestoreWidget`, `ClearAllDismissedWidgets` 함수 내부를 교체:

```cpp
void USuperPlatBFL::DismissWidget(const FString& WidgetId)
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (!SaveGame || !IsValid(SaveGame))
    {
        return;
    }

    SaveGame->DismissWidget(WidgetId);
    SaveUserSettingsToDisk();
}

bool USuperPlatBFL::IsWidgetDismissed(const FString& WidgetId)
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (!SaveGame || !IsValid(SaveGame))
    {
        return false;
    }

    return SaveGame->IsWidgetDismissed(WidgetId);
}

void USuperPlatBFL::RestoreWidget(const FString& WidgetId)
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (!SaveGame || !IsValid(SaveGame))
    {
        return;
    }

    SaveGame->RestoreWidget(WidgetId);
    SaveUserSettingsToDisk();
}

void USuperPlatBFL::ClearAllDismissedWidgets()
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (!SaveGame || !IsValid(SaveGame))
    {
        return;
    }

    SaveGame->ClearAllDismissed();
    SaveUserSettingsToDisk();
}
```

- [ ] **Step 5: SuperPlatBFL.cpp — TextSettings 함수들 전환**

`SaveTextSize`, `GetSavedTextSize` 교체:

```cpp
void USuperPlatBFL::SaveTextSize(float Size)
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (SaveGame && IsValid(SaveGame))
    {
        SaveGame->TextSize = Size;
        SaveUserSettingsToDisk();
    }

    GOnTextSizeChanged.Broadcast(Size);
    MOBILE_LOG(TEXT("SaveTextSize: %.1f"), Size);
}

float USuperPlatBFL::GetSavedTextSize()
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (SaveGame && IsValid(SaveGame))
    {
        return SaveGame->TextSize;
    }

    return 17.0f;
}
```

- [ ] **Step 6: SuperPlatBFL.cpp — StoryPlayMode 함수 구현 추가**

TextSettings 함수 뒤에 추가:

```cpp
// ===== Story Play Mode =====

void USuperPlatBFL::SetStoryPlayMode(EStoryPlayMode Mode)
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (SaveGame && IsValid(SaveGame))
    {
        SaveGame->StoryPlayMode = Mode;
        SaveUserSettingsToDisk();
        UE_LOG(LogTemp, Log, TEXT("StoryPlayMode set to: %s"),
            Mode == EStoryPlayMode::Scroll ? TEXT("Scroll") : TEXT("Click"));
    }
}

EStoryPlayMode USuperPlatBFL::GetStoryPlayMode()
{
    UUserSettingsSaveGame* SaveGame = GetOrCreateUserSettings();
    if (SaveGame && IsValid(SaveGame))
    {
        return SaveGame->StoryPlayMode;
    }

    return EStoryPlayMode::Click;
}

bool USuperPlatBFL::IsStoryScrollMode()
{
    return GetStoryPlayMode() == EStoryPlayMode::Scroll;
}
```

- [ ] **Step 7: 커밋**

```bash
git add Source/SuperPlatM/Core/SuperPlatBFL.h Source/SuperPlatM/Core/SuperPlatBFL.cpp
git commit -m "[REFACTOR] SuperPlatBFL: TextSettings+WidgetDismiss→UserSettings 통합 + StoryPlayMode 추가"
```

---

### Task 3: UI 위젯 include 및 로드 로직 변경

**Files:**
- Modify: `Source/SuperPlatM/UI/ScalableTextWidget.cpp:4,73-74`
- Modify: `Source/SuperPlatM/UI/AnimatedTextWidget.cpp:4,153-154`

- [ ] **Step 1: ScalableTextWidget.cpp 수정**

```cpp
// line 4 — include 교체
// 변경 전: #include "../SaveGame/TextSettingsSaveGame.h"
// 변경 후:
#include "../SaveGame/UserSettingsSaveGame.h"

// line 73-78 — 로드 로직 교체
// 변경 전:
//   UTextSettingsSaveGame* SaveGame = Cast<UTextSettingsSaveGame>(
//       UGameplayStatics::LoadGameFromSlot(UTextSettingsSaveGame::SaveSlotName, 0));
//   if (SaveGame) { Size = SaveGame->TextSize; }
// 변경 후:
    UUserSettingsSaveGame* SaveGame = Cast<UUserSettingsSaveGame>(
        UGameplayStatics::LoadGameFromSlot(UUserSettingsSaveGame::SaveSlotName, 0));
    if (SaveGame)
    {
        Size = SaveGame->TextSize;
    }
```

- [ ] **Step 2: AnimatedTextWidget.cpp 수정**

```cpp
// line 4 — include 교체
// 변경 전: #include "../SaveGame/TextSettingsSaveGame.h"
// 변경 후:
#include "../SaveGame/UserSettingsSaveGame.h"

// line 153-162 — 로드 로직 교체
// 변경 전:
//   UTextSettingsSaveGame* SaveGame = Cast<UTextSettingsSaveGame>(
//       UGameplayStatics::LoadGameFromSlot(UTextSettingsSaveGame::SaveSlotName, 0));
// 변경 후:
        UUserSettingsSaveGame* SaveGame = Cast<UUserSettingsSaveGame>(
            UGameplayStatics::LoadGameFromSlot(UUserSettingsSaveGame::SaveSlotName, 0));
```

- [ ] **Step 3: 커밋**

```bash
git add Source/SuperPlatM/UI/ScalableTextWidget.cpp Source/SuperPlatM/UI/AnimatedTextWidget.cpp
git commit -m "[REFACTOR] UI 위젯: TextSettingsSaveGame→UserSettingsSaveGame 전환"
```

---

### Task 4: 구 SaveGame 파일 삭제 + 컴파일 검증

**Files:**
- Delete: `Source/SuperPlatM/SaveGame/TextSettingsSaveGame.h`
- Delete: `Source/SuperPlatM/SaveGame/TextSettingsSaveGame.cpp`
- Delete: `Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.h`
- Delete: `Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.cpp`

- [ ] **Step 1: 잔여 참조 확인**

```bash
grep -r "TextSettingsSaveGame\|WidgetDismissSaveGame" Source/ --include="*.h" --include="*.cpp"
```

UserSettingsSaveGame 내부의 마이그레이션 코드에서는 리플렉션으로 접근하므로 직접 include가 없어야 정상.
출력에 SuperPlatBFL.cpp이나 UI 위젯이 나오면 아직 교체 안 된 것 → 수정 필요.

- [ ] **Step 2: 구 파일 삭제**

```bash
git rm Source/SuperPlatM/SaveGame/TextSettingsSaveGame.h
git rm Source/SuperPlatM/SaveGame/TextSettingsSaveGame.cpp
git rm Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.h
git rm Source/SuperPlatM/SaveGame/WidgetDismissSaveGame.cpp
```

- [ ] **Step 3: 전체 컴파일 확인**

Unreal Editor에서 컴파일 또는 빌드. 에러가 없어야 함.

- [ ] **Step 4: 커밋**

```bash
git add -A Source/SuperPlatM/SaveGame/
git commit -m "[REFACTOR] 구 TextSettingsSaveGame, WidgetDismissSaveGame 파일 제거"
```

---

### Task 5: 마이그레이션 검증 (수동 테스트)

- [ ] **Step 1: 기존 데이터 있는 상태에서 테스트**

1. 구 빌드에서 텍스트 크기를 20으로 변경하고, 위젯 하나를 "다시 보지 않기" 처리
2. 새 빌드로 업데이트
3. `GetSavedTextSize()` → 20.0f 반환 확인
4. `IsWidgetDismissed("해당ID")` → true 반환 확인
5. `GetStoryPlayMode()` → Click (기본값) 반환 확인

- [ ] **Step 2: 마이그레이션 후 구 슬롯 삭제 확인**

```
UGameplayStatics::DoesSaveGameExist("TextSettings", 0) → false
UGameplayStatics::DoesSaveGameExist("WidgetDismissData", 0) → false
UGameplayStatics::DoesSaveGameExist("UserSettings", 0) → true
```

- [ ] **Step 3: 신규 설치 테스트**

1. 깨끗한 환경에서 앱 설치
2. `GetSavedTextSize()` → 17.0f (기본값)
3. `GetStoryPlayMode()` → Click (기본값)
4. `SetStoryPlayMode(EStoryPlayMode::Scroll)` → 저장 확인
5. 앱 재시작 후 `GetStoryPlayMode()` → Scroll 확인

---

## 최종 SaveGame 구조

| SaveGame | 슬롯명 | 용도 |
|----------|--------|------|
| `LoginSaveGame` | `"LoginData"` | 로그인 자격증명 (AES 암호화) — 변경 없음 |
| `RecentSearchSaveGame` | `"RecentSearchData"` | 최근 검색어 — 변경 없음 |
| `UserSettingsSaveGame` | `"UserSettings"` | 텍스트 크기 + 위젯 Dismiss + 스토리 모드 (통합) |

## 주의사항

- **Blueprint 호환성**: BFL 함수 시그니처(`SaveTextSize`, `DismissWidget` 등)가 그대로이므로 기존 Blueprint는 수정 불필요
- **GOnTextSizeChanged 델리게이트**: `TextSettingsSaveGame.h`에서 `UserSettingsSaveGame.h`로 이동. ScalableTextWidget/AnimatedTextWidget에서 바인딩하는 코드는 include만 바꾸면 됨
- **마이그레이션은 1회성**: `bMigrationCompleted` 플래그로 중복 실행 방지. 구 슬롯 삭제 후 재실행 시 아무 일도 안 함
