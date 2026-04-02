---
layout: post
title: "UE5 개발자가 Godot 처음 만져본 후기 - 에디터부터 GDScript까지"
title_en: "UE5 Developer's First Godot Experience - From Editor to GDScript Basics"
excerpt_en: "A practical comparison of Godot 4.4 and Unreal Engine 5 from the perspective of a 4-5 year UE5 C++ developer, covering editor layout, scene system, scripting, and workflow differences."
date: 2026-04-02 23:00:00 +0900
categories: [godot]
tags: [godot, ue5, unreal-engine, gdscript, game-dev, beginner, comparison]
excerpt: "4-5년차 UE5 C++ 개발자가 Godot 4.4를 처음 만져보고 느낀 점. 에디터 구조, 씬 시스템, GDScript 기초를 UE5와 1:1 비교하면서 정리했다."
---

UE5로 4-5년 정도 일하다가 사이드 프로젝트로 Godot을 처음 써봤다. 2D 캐주얼 게임을 하나 만들어보려고 했는데, 처음에는 진짜 뭐가 뭔지 모르겠더라. Visual Studio는 어디 있고, 빌드는 어떻게 하고, 블루프린트 같은 건 없나?

결론부터 말하면, Godot은 UE5와 완전히 다른 철학이다. 근데 익숙해지면 오히려 가벼워서 좋다.

## 에디터 레이아웃

Godot 에디터를 처음 열면 이런 구조다.

![Godot 에디터 레이아웃](/assets/images/2026-04-02-ue5-dev-godot-starter/godot-editor.png)

UE5랑 1:1로 대응시키면 이렇다.

| Godot | UE5 | 역할 |
|-------|-----|------|
| **Scene** (좌상단) | Outliner | 현재 씬의 노드 트리 |
| **Inspector** (우측) | Details Panel | 선택한 노드의 프로퍼티 |
| **FileSystem** (좌하단) | Content Browser | 프로젝트 파일 탐색 |
| **Viewport** (중앙) | Viewport | 2D/3D 뷰 |
| **Output** (하단) | Output Log | `print()` 출력, 에러 로그 |

UE5의 Outliner에 해당하는 게 Scene 패널인데, 여기서 보이는 건 "현재 열려있는 씬"의 노드 트리다. UE5처럼 레벨에 있는 모든 액터가 보이는 게 아니라, 열어놓은 씬 파일 하나의 구조만 보인다. 이게 처음에 좀 헷갈렸다.

## .tscn과 .gd — UE5의 뭐에 해당하나

Godot 프로젝트를 열면 파일이 크게 두 종류다.

### .tscn = 블루프린트 + 레벨

`.tscn`은 "씬 파일"이다. UE5로 치면 **블루프린트 클래스**이자 **레벨**이기도 하다.

UE5에서는 레벨(.umap)과 블루프린트(.uasset)가 별개지만, Godot에서는 모든 게 씬이다. 캐릭터도 씬, 총알도 씬, 레벨도 씬. 씬 안에 씬을 넣을 수 있다.

```
# UE5 식으로 생각하면
player.tscn  = BP_Player 블루프린트
game.tscn    = 메인 레벨 + 레벨 블루프린트
obstacle.tscn = BP_Obstacle 블루프린트
```

씬 안에서 다른 씬을 인스턴스하는 건 UE5에서 블루프린트를 레벨에 배치하는 것과 같다. `game.tscn` 안에 `player.tscn`을 자식 노드로 넣으면 된다.

### .gd = .h + .cpp (근데 훨씬 간단함)

`.gd`는 GDScript 파일이다. UE5의 `.h` + `.cpp`에 해당하는데, 파일 하나에 다 들어간다. 헤더/소스 분리 없음.

```gdscript
# player.gd — UE5의 APlayerCharacter.h + .cpp 에 해당
extends CharacterBody2D    # UE5: class APlayerCharacter : public ACharacter

@export var speed: float = 300.0    # UE5: UPROPERTY(EditAnywhere) float Speed = 300.f;

signal player_died    # UE5: DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPlayerDied);

func _ready() -> void:    # UE5: BeginPlay()
    pass

func _process(delta: float) -> void:    # UE5: Tick(float DeltaTime)
    pass

func _physics_process(delta: float) -> void:    # UE5: 물리 Tick (서브스텝)
    var input_dir := Vector2.ZERO
    input_dir.x = Input.get_axis("move_left", "move_right")
    input_dir.y = Input.get_axis("move_up", "move_down")
    velocity = input_dir.normalized() * speed
    move_and_slide()    # UE5: AddMovementInput() 비슷
```

UE5 C++이랑 비교하면 보일러플레이트가 거의 없다. `UCLASS()`, `GENERATED_BODY()`, `#include` 지옥 같은 게 없으니까.

### 노드 = 컴포넌트

UE5에서 액터에 컴포넌트를 붙이듯이, Godot에서는 노드에 자식 노드를 붙인다.

```
# UE5
BP_Player
├── CapsuleComponent (Root)
├── SkeletalMeshComponent
├── SpringArmComponent
└── CameraComponent

# Godot
Player (CharacterBody2D)
├── CollisionShape2D        # UE5의 CapsuleComponent
├── Sprite2D                # UE5의 SkeletalMeshComponent
└── Camera2D                # UE5의 SpringArm + Camera
```

차이점은 UE5 컴포넌트는 액터에 종속되지만, Godot 노드는 그 자체로 독립적인 존재라는 것이다. 어떤 노드든 씬의 루트가 될 수 있다.

## 빌드가 없다

이게 가장 충격적이었다. UE5에서는 C++ 수정하면 `Ctrl+Alt+F11`로 Live Coding을 하거나, 에디터를 닫고 전체 빌드를 돌려야 한다. 빌드만 5-10분 걸리는 경우도 있고.

Godot은 빌드가 없다. GDScript는 인터프리터 언어라서 **파일 저장하면 끝**이다. Godot 에디터가 자동으로 감지해서 바로 반영한다.

| | UE5 | Godot |
|---|---|---|
| **코드 수정** | VS에서 C++ 편집 | Godot 내장 에디터 (또는 VSCode) |
| **반영** | `Ctrl+Alt+F11` (Live Coding) | `Ctrl+S` (저장하면 끝) |
| **실행** | `Alt+P` (PIE) | `F5` |
| **현재 레벨만 실행** | PIE가 현재 레벨 로드 | `F6` (현재 씬만) |
| **중지** | `Esc` | `F8` |
| **전체 빌드** | 5-10분 | 없음 |

처음에 "빌드 버튼이 어디 있지?" 하면서 한참 찾았는데, 그런 건 없었다.

## 외부 IDE가 필요 없다

UE5는 Visual Studio 없이는 C++ 개발이 불가능하다. Godot은 에디터 안에 스크립트 에디터가 내장되어 있어서, 코드 작성부터 실행까지 Godot 에디터 하나로 다 된다.

물론 VSCode를 외부 에디터로 연결할 수도 있다. `Editor > Editor Settings > Text Editor > External`에서 설정하면 된다. 근데 솔직히 내장 에디터만 써도 충분하다.

## Input 매핑

UE5에서 Enhanced Input System으로 액션 매핑하는 거랑 비슷한 게 있다.

`Project > Project Settings > Input Map`에서 액션을 정의한다.

```
# UE5: Input Action + Input Mapping Context
# Godot: Input Map에서 직접 정의

# project.godot에 이렇게 저장됨
move_right → Arrow Right
move_left  → Arrow Left
move_up    → Arrow Up
move_down  → Arrow Down
```

코드에서 쓸 때도 비슷하다.

```gdscript
# Godot
var dir_x = Input.get_axis("move_left", "move_right")

# UE5 C++ (대략적 대응)
# float DirX = EnhancedInputComponent->GetAxisValue("MoveRight");
```

## Autoload = GameInstance

UE5에서 게임 전체에 걸쳐 데이터를 유지하려면 `GameInstance`를 쓴다. Godot에서는 **Autoload**가 그 역할이다.

`Project > Project Settings > Autoload`에서 스크립트를 등록하면 모든 씬에서 접근 가능한 싱글톤이 된다.

```gdscript
# scripts/autoload/game_data.gd
extends Node

var player_nickname: String = ""
```

등록 후 어디서든 `GameData.player_nickname`으로 접근한다. UE5의 `GetGameInstance<UMyGameInstance>()`와 같은 맥락이다.

주의할 점: autoload로 등록한 스크립트에 `class_name`을 선언하면 이름이 충돌한다. autoload 이름 자체가 전역 이름이 되기 때문에 `class_name`은 빼야 한다.

## 정리

| 개념 | UE5 | Godot |
|------|-----|-------|
| 프로젝트 파일 | .uproject | project.godot |
| 레벨/씬 | .umap | .tscn |
| 코드 | .h + .cpp | .gd |
| 컴포넌트 | UActorComponent | 자식 Node |
| 블루프린트 | .uasset (BP) | .tscn (씬 = BP) |
| 싱글톤 | GameInstance | Autoload |
| 에디터 프로퍼티 | UPROPERTY(EditAnywhere) | @export |
| 이벤트/델리게이트 | DECLARE_DELEGATE | signal |
| BeginPlay | BeginPlay() | _ready() |
| Tick | Tick(DeltaTime) | _process(delta) |
| 빌드 | 필요 (Live Coding) | 없음 (저장 즉시) |

UE5에서 오면 처음에 "이렇게 간단해도 되나?" 싶은 느낌이 든다. 근데 2D 캐주얼 게임을 만드는 데는 이 정도면 충분하다. 엔진이 해주는 게 적은 대신 배울 것도 적고, 이터레이션이 빠르다.
