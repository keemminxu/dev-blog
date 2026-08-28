---
layout: post
title: "게임 모드, 핵, 안티치트는 어떻게 돌아가나 with FC 온라인"
title_en: "How Game Mods, Cheats, and Anti-Cheat Actually Work From an Unreal Developer's Perspective"
excerpt_en: "A plain-language walkthrough of how mods get into a game process (proxy DLLs, script hooks, pak overrides), why pak encryption and signing get bypassed, how cheats moved from user-mode DLL injection to kernel drivers, DMA hardware and external AI aimbots, and what anti-cheat can realistically do."
date: 2026-08-28 10:13:04 +0900
categories: [study]
tags: [game-modding, anti-cheat, dll-injection, ue4ss, pak-encryption, reverse-engineering, game-security]
thumbnail: /assets/images/game-mods-cheats-anticheat/cheat-esp-wallhack-example.png
excerpt: "모드가 게임에 들어가는 방법, pak 암호화가 뚫리는 이유, 핵이 커널·DMA·AI 비전까지 내려간 과정, 안티치트가 실제로 할 수 있는 것"
---

## GTA는 사람들이 스파이더맨 모드도 만들던데 피파 온라인은?

요즘 한창 피파에 빠져있다.. 오랜만에 들어갔는데 무슨 선수 가치가 200경..? 이러길래 뭔가 싶었는데(이번에 화폐개혁 패치가 되긴했음. 1경에서 1억)

리버풀 팬으로써 야무지게 구단을 맞추다 라커룸에서 선수 카드 페이스도 변경되길래, "오 이거 내가 갖고있는 사진으로 등록해야지" 하고 폴더를 까봤다.

![FC 온라인 _cache 폴더에 캐시된 선수 얼굴 PNG 목록 캡처](/assets/images/game-mods-cheats-anticheat/fconline-cache-players.png)

그러다 문득 든 생각. GTA나 마크같은 게임들은 모드를 어떻게 만드는 것일까?

`.big` 안을 열어보려다가 헤더가 난수라는 걸 알았고, 옆에 `BlackCipher` 폴더가 있고, exe엔 `.themida` 섹션이 붙어 있었다. 그렇게 꼬리를 물다 보니 모드 → 핵 → 안티치트까지 한 바퀴를 돌게 됐음. "이게 우리 게임이면 어떻게 되는 거지?"

## 1. 모드는 게임 안에 어떻게 들어가나

### 모드는 3층 구조

GTA V 기준으로 보면 이렇게 생겼다.

```
[3층] 모드 (수만 개)
   ├─ 차량/스킨/맵 모드      → 그냥 파일 (.ytd, .yft)     ← 코드 없음, 압도적 다수
   ├─ 핸들링/무기 수치 모드  → 그냥 xml/meta 파일
   └─ 스크립트 모드/트레이너 → .asi, .dll, .lua            ← 코드 실행 필요

[2층] 프레임워크 (몇 개)
   ├─ OpenIV.asi   → 게임이 원본 대신 mods/ 폴더를 읽게 함
   └─ ScriptHookV  → 게임 내부 함수를 외부 코드에 열어줌

[1층] 로더 (딱 1개)
   └─ dinput8.dll  → 게임이 켜질 때 자동으로 로드되는 가짜 DLL
```

![GTA V 모딩 3층 구조(로더 → 프레임워크 → 모드) 다이어그램](/assets/images/game-mods-cheats-anticheat/mod-stack-layers.png)

"모드 = DLL 주입"이라고 생각하기 쉬운데, 개수로 따지면 대부분은 그냥 파일 교체다. 차량 모드 만드는 사람은 코드를 한 줄도 안 씀

3D 툴에서 만든 파일을 `mods/` 폴더에 넣을 뿐이고 게임이 그 폴더를 읽게 만드는 건 2층이 해준다. DLL 주입은 맨 아래 로더 하나와 소수의 스크립트 모드에만 쓰인다.

### 프록시 DLL

게임이 켜지면 `dinput8.dll`(조이스틱), `dxgi.dll`(그래픽), `version.dll` 같은 윈도우 시스템 DLL을 불러온다. 그런데 윈도우는 DLL을 찾을 때 시스템 폴더보다 exe가 있는 폴더를 **먼저** 뒤진다.

그래서 게임 폴더에 `dinput8.dll`이라는 이름의 DLL을 놓으면 게임은 그걸 진짜인 줄 알고 로드한다. 이 가짜 DLL은

- 조이스틱 일은 진짜 `C:\Windows\System32\dinput8.dll`에 그대로 넘기고
- 넘기는 김에 폴더에 있는 `.asi` 파일들을 전부 프로세스 안으로 데리고 들어간다.

![윈도우 DLL 검색 순서(exe 폴더가 System32보다 먼저)와 프록시 DLL이 진짜 DLL로 호출을 넘기는 개념도](/assets/images/game-mods-cheats-anticheat/dll-search-order.png)

게임 파일은 하나도 안 건드림. 게임 DLL을 파싱하는 것도 아니다. 그냥 게임이 부르는 이름에 대답만 한 거다. 그 이름 목록(어떤 함수를 export해야 하는지)은 마이크로소프트가 공개 문서로 다 적어놨음

외부 프로그램으로 억지로 밀어 넣는 방식(외부 인젝터)도 있지만, 그건 치트가 주로 쓰는 방식이고 안티치트가 제일 먼저 잡는 패턴!

실제로 FC 온라인 exe도 `dinput8.dll`, `dxgi.dll`, `d3d11.dll`, `version.dll`, `winmm.dll`, `xinput9_1_0.dll`을 로드한다. 전형적인 프록시 후보들이고 여기선 안티치트가 막고 있으니 이론상 그렇다는 얘기

### exe/dll은 암호화돼 있지 않다 (레시피는 없는 요리)

"그럼 게임 코드는 원래 그냥 읽히는 건가? 암호화돼 있지 않아?"

기본적으로 안 돼 있음. exe/dll은 PE(Portable Executable)라는 마이크로소프트 공개 규격. 윈도우 로더가 읽어서 메모리에 올려야 실행되니까 헤더, 섹션 테이블, import/export 테이블은 평문일 수밖에 없음

실제로 FC 온라인 폴더의 파일들을 `xxd`로 열어보면 이렇다.

```
NGMDll64.dll     4d5a 9000 0300 0000 ...  MZ..............
libcef.dll       4d5a 7800 0100 0000 ...  MZx.............
fczf.exe         4d5a 9000 0300 0000 ...  MZ..............
```

전부 `MZ`로 시작한다. `NGMDll64.dll` 안엔 `AVCNGMInstaller`, `AVCHTTPDownloadStrategy` 같은 C++ 클래스 이름까지 그대로 남아 있음.

![PE 파일 구조(MZ 헤더, PE 헤더, 섹션 테이블, .text/.rdata/.data 섹션) 다이어그램](/assets/images/game-mods-cheats-anticheat/pe-structure.png)

비유하자면 **소스코드 = 레시피, exe = 완성된 요리**다. 게임사는 요리만 파는거지 레시피는 안 줌. 하지만 요리는 먹을 수 있게 그대로 있어야 함(컴퓨터가 실행해야 하니까) 대신 레시피가 없으니 한 입씩 먹어보면서 "이건 마늘, 이건 간장…" 하고 거꾸로 추측해야 한다. 이게 역공학이고 IDA나 Ghidra 같은 디스어셈블러가 도구인 것. 되긴 되는데 느리고 어렵다고 함..

### Themida, Denuvo, VMProtect (냉동 밀봉)

그런데 일부 게임은 요리를 냉동 밀봉해서 판다. FC 온라인 PE 섹션 이름을 뽑아보면 이렇게 돼있음.

```
NGMDll64.dll       .text .rdata .data .pdata .rsrc .reloc         ← 평범한 DLL
fczf.exe           .edata .idata .tls .rsrc .themida .boot .reloc ← Themida 보호
BlackCipher64.aes  .text ... .winlice .boot                        ← WinLicense 보호
```

`.themida`, `.boot` 섹션이 Themida(Oreans사 프로텍터)가 씌워져 있다는 뜻이다. 이런 프로텍터는 원래 코드 섹션을 암호화해서 디스크엔 난수처럼 저장하고 `.boot` 스텁이 실행되면 그때 메모리에서 푼다. 핵심 함수는 아예 가상화(x86 명령을 자체 바이트코드로 변환)해서 풀어도 읽기 어렵게 만들고, 디버거가 붙으면 감지해서 꺼버림.

그런데 원리적 한계가 있다. **CPU는 암호화된 명령을 실행할 수 없다.** 실행되는 순간 메모리엔 반드시 평문 코드가 있어야 한다. 냉동식품도 먹으려면 결국 녹여야 하는 것. 그래서 역공학하는 쪽은 디스크 파일 대신 실행 중인 메모리를 체크함. 프로텍터는 "불가능하게" 만드는 게 아니라 "비싸고 오래 걸리게" 만드는 거고 그 시간을 벌려고 가상화, 디버거 탐지, 안티치트가 붙는 것.

### 게임은 원래 "부품 함수 + 미션 스크립트"로 돼 있음

스파이더맨 모드처럼 거미줄 타기, 사람 묶기 애니메이션, 이펙트까지 넣은 모드는 게임 코드를 고친 거 아닌가?

아니다. 스파이더맨 모드도 exe를 안 고침. 그게 가능한 이유는 GTA V 자체가 이렇게 생겼기 때문이다.

```
GTA5.exe (엔진)
 ├─ 네이티브 함수 약 6,000개   ← 부품
 │    밧줄 만들기, 물체에 힘 가하기, 사람 쓰러뜨리기(랙돌),
 │    애니메이션 재생, 파티클 켜기, 모델 불러오기, 중력 바꾸기 ...
 └─ 미션 스크립트 수백 개      ← 조립 설명서
      락스타가 저 부품들을 조합해서 미션을 만듦
```

락스타가 미션을 만들 때도 exe를 고친 게 아니라 부품 함수를 조합한 스크립트를 썼다. 모더는 락스타가 쓰던 똑같은 부품으로 새 조립 설명서를 쓸 뿐이다. 스파이더맨 모드는 사실상 "락스타 직원이 안 만든 미션 하나"다.

| 스파이더맨 능력 | 실제로 부르는 게임 부품 함수 (락스타가 이미 만들어 둔 것) |
|---|---|
| 거미줄 타고 날기 | `PHYSICS::ADD_ROPE` (밧줄 — 원래 견인차용) + `ENTITY::APPLY_FORCE_TO_ENTITY` |
| 벽 타기 | `ENTITY::SET_ENTITY_COORDS` + 회전값 + 중력 끄기 |
| 사람 거미줄로 묶기 | `PED::SET_PED_TO_RAGDOLL` + `ENTITY::ATTACH_ENTITY_TO_ENTITY` (거미줄 모델 붙이기) + `TASK::TASK_PLAY_ANIM` (묶인 자세) |
| 거미줄 이펙트 | `GRAPHICS::START_PARTICLE_FX_LOOPED_ON_ENTITY` (기존 파티클) |
| 스파이더맨 모습 | `STREAMING::REQUEST_MODEL` + `PLAYER::SET_PLAYER_MODEL` |

![GTA V NativeDB에서 ADD_ROPE 같은 네이티브 함수 목록을 보는 화면](/assets/images/game-mods-cheats-anticheat/gta-nativedb--01.png)
![GTA V 스파이더맨 모드 플레이 장면](/assets/images/game-mods-cheats-anticheat/9031ea-20190413181338_1.webp)

ScriptHookV는 게임 메모리를 뒤져서 이 부품 함수들이 어디 있는지 전화번호부를 만든다(시그니처 스캔). 모더는 그 전화번호부를 보고 `invoke(ADD_ROPE, ...)` 하고 부르기만 함. 게임 코드는 그대로 두고 번호만 누르는 셈. 부품 이름 6,000개는 커뮤니티가 락스타 미션 스크립트(`.ysc`)를 디컴파일해서 정리한 NativeDB에 다 있다.

에셋은 더 쉽다. 묶여서 버둥거리는 애니메이션은 인질 미션에 있던 걸 갖다 쓰고, 거미줄 이펙트는 기존 밧줄 파티클을 흰색으로 쓴다. 스파이더맨 슈트만 새로 만들어서 `mods/` 폴더에 넣으면 OpenIV.asi가 게임이 원본 대신 그걸 읽게 해준다.

진짜 게임 코드를 고쳐야 하는 경우는 거의 없다. 있어도 디스크의 exe를 편집하는 게 아니라 실행 중 메모리에서 몇 바이트를 바꾸는 식이고(차량 한도 늘리기 같은 유틸리티 모드), 콘텐츠 모드는 그런 짓을 안 함.

### 엔진마다 "읽기 난이도"가 다르다

| 게임 종류 | 코드 형태 | 읽기 난이도 | 도구 |
|---|---|---|---|
| C++ 네이티브 (GTA, FC 온라인) | 기계어 | 높음 - 함수 이름 없음, 시그니처 스캔으로 찾음 | IDA, Ghidra |
| + Themida/Denuvo | 암호화·가상화 | 매우 높음 - 메모리 덤프 후 VM 해석 | Scylla, x64dbg |
| Unity (Mono) | C# IL 바이트코드 | **매우 낮음** - 변수명까지 살아있는 거의 소스 수준 | dnSpy, ILSpy |
| Unity (IL2CPP) | 네이티브로 변환 | 중간 - 메타데이터로 이름 복원 | Il2CppDumper |
| Unreal | 네이티브 + 리플렉션 | 중간 - 클래스/함수 이름 테이블이 남음 | UE4SS |
| 게임 내장 스크립트 (GTA `.ysc`, Skyrim `.pex`) | 바이트코드 | 낮음 - 디컴파일러 있음 | 커뮤니티 툴 |

Unity 게임 모드가 훨씬 많은 이유. `Assembly-CSharp.dll`을 dnSpy로 열면 `PlayerController.TakeDamage(int amount)`가 그대로 보이니까 BepInEx + Harmony로 "이 함수 앞에 내 코드 끼워 넣기"가 몇 줄로 끝남

## 2. 언리얼 게임이라면 어떻게 되나?

언리얼 개발자라 이게 제일 궁금했었음. 언리얼로 만든 FPS가 있고, 모드로 원래 없던 바주카포를 쓸 수 있게 하려면? 모델링 파일도 있어야 하고, 쏘는 함수도 있어야 하고, 시작할 때 고르는 UMG도 있어야 한다. 이걸 어떻게 심나?

### 언리얼 모딩 스택 (리플렉션 이용)

```
Game.exe  (엔진 + 게임 C++ 코드, 모노리식)
 │  ※ Shipping 빌드에도 리플렉션(GUObjectArray, FNamePool, UFunction)이 살아 있음
 │     GC·직렬화·BP 호출에 엔진이 필요로 하니까 못 뺌
 │
 ├─ [1층] dwmapi.dll (프록시)          ← 문 열기
 │    └─ [2층] UE4SS.dll                ← 시그니처 스캔으로 GUObjectArray / FNamePool /
 │         │                               ProcessEvent / StaticConstructObject 주소 확보
 │         │                               → 모든 UObject·UClass·UFunction을 "이름으로" 접근
 │         └─ [3층] 모드                 ← Lua 스크립트 / C++ DLL / BP ModActor
 │
 └─ Content/Paks/
      ├─ pakchunk0-Windows.pak           ← 게임 원본 에셋
      └─ BazookaMod_P.pak               ← 모드 에셋. 엔진이 _P 접미사를 보고 우선순위 높게 마운트
```

![UE4SS 라이브 오브젝트 뷰어/구조 캡처, 또는 FModel로 언리얼 pak을 열어 에셋 목록을 보는 화면](/assets/images/game-mods-cheats-anticheat/ue4ss-architecture.png)

GTA와 결정적으로 다른 점이 있음. GTA는 함수 6,000개 이름을 커뮤니티가 몇 년 걸려 붙였는데, 언리얼은 Shipping 빌드에도 `AWeaponBase::Fire` 같은 이름이 FName으로 그대로 남아 있다. UE4SS가 그걸 읽어서 에디터의 generated header와 거의 같은 SDK 헤더를 덤프해 준다. 그래서 언리얼 모딩은 GTA보다 훨씬 쉽다.

### 바주카포를 끝까지 따라가 보면

게임이 이렇게 생겼다고 치자.

- `AWeaponBase` (C++) → `BP_Rifle`, `BP_Shotgun` (BP 자식)
- `UInventoryComponent::GetAvailableWeapons()` → `TArray<TSubclassOf<AWeaponBase>>`
- `WBP_WeaponSelect` (UMG) — 시작 시 무기 고르는 화면

**① 모델 - `.pak`으로 넣는다**

모더는 같은 엔진 버전의 별도 언리얼 프로젝트를 만든다. 거기서 `SM_Bazooka`, 머티리얼, 텍스처, 애니메이션, 사운드를 만들고 쿡 → UnrealPak으로 `BazookaMod_P.pak`을 뽑아 `Content/Paks/`에 넣는다.

엔진은 시작할 때 `Paks/` 폴더의 pak을 전부 마운트하는데, `_P` 접미사가 붙은 건 우선순위를 +100 올려서 마운트한다(`IPlatformFilePak.cpp`의 마운트 로직). 에픽이 DLC·패치용으로 만든 공식 메커니즘이고 모더는 그걸 그대로 쓴다. 마운트되면 `/Game/Mods/Bazooka/SM_Bazooka` 경로로 원본 에셋과 똑같이 로드된다. DLL에 컴파일되는 게 아니다. **우리가 DLC 만드는 경로 그대로** 들어가는 거다.

**② 쏘는 함수 - 두 가지 방법**

첫번째 방법은 Blueprint 바이트코드다. 모더 프로젝트에서 `BP_Bazooka`를 만들고 발사 로직을 BP로 짠다. 쿡하면 BP 바이트코드가 pak에 들어가고 게임의 BP VM이 돌린다. 코드 0줄. GTA의 `.ysc` 미션 스크립트와 같은 역할이다.

문제는 `BP_Bazooka`가 `AWeaponBase`를 상속하려면 모더 프로젝트에 그 클래스가 있어야 한다는 것. 세가지 방법이 있음.

- 게임이 모드 킷을 배포한다 (ARK DevKit, Satisfactory SML처럼 게임 클래스가 든 프로젝트 스텁)
- UE4SS가 덤프한 헤더로 같은 이름·경로의 더미 C++ 클래스를 만든다. 쿡된 에셋은 `/Script/MyGame.WeaponBase`라는 경로 문자열로만 참조하니까 런타임엔 진짜 게임 클래스로 resolve된다
- 의존을 끊고 엔진 `AActor`만 상속한 뒤 로직은 두번째 방법으로..

두번째 방법은 UE4SS로 게임 함수를 직접 부르는 거다. 리플렉션이 살아 있어서 이런 게 됨.

```lua
-- 게임의 발사 입력 함수에 후킹 (ProcessEvent 가로채기)
RegisterHook("/Script/MyGame.PlayerCharacter:OnFirePressed", function(self)
    if equippedIsBazooka then
        local proj = SpawnActor(BazookaProjectileClass, muzzleLoc, muzzleRot)
        -- UGameplayStatics::ApplyRadialDamage 를 BP에서 부르듯 그대로 호출 가능
    end
end)
```

`RegisterHook`은 `UFunction::ProcessEvent`에 pre/post 콜백을 다는 거라 개념적으로 BlueprintImplementableEvent를 밖에서 오버라이드하는 것과 같다. 게임 코드는 안 바뀌고 호출 앞뒤에 모더 코드가 끼어든다.

**③ UMG - pak으로 넣고 코드로 띄운다**

모더 프로젝트에서 `WBP_BazookaSelect`를 만들어 pak에 넣고, 진입점에서 이렇게 띄운다.

```lua
RegisterHook("/Script/Engine.PlayerController:ClientRestart", function(pc)
    local cls = StaticFindObject("/Game/Mods/Bazooka/WBP_BazookaSelect.WBP_BazookaSelect_C")
    local w = CreateWidget(cls, pc)   -- 내부적으로 UWidgetBlueprintLibrary::Create 호출
    w:AddToViewport()
end)
```

우리가 C++에서 `CreateWidget<>()` → `AddToViewport()` 하는 것과 완전히 같은 엔진 함수를 이름으로 부르는 것. 기존 `WBP_WeaponSelect`를 같은 경로로 `_P.pak`에 넣어 덮어쓸 수도 있는데, 위젯 클래스·바인딩 이름을 맞춰야 해서 잘 깨짐

**④ 진입점 - 게임이 바주카포를 어떻게 아나**

자동이 아니다. 모더 코드가 등록한다.

```lua
-- GetAvailableWeapons 가 리턴한 뒤에 끼어들어 배열에 추가
RegisterHook("/Script/MyGame.InventoryComponent:GetAvailableWeapons",
    function(self) end,                            -- pre
    function(self, ret) ret:Add(BazookaClass) end)  -- post
```

BP만 쓰는 경우엔 UE4SS의 `BPModLoader`가 `/Game/Mods/*/ModActor` BP를 찾아 스폰하고 `PreBeginPlay`/`PostBeginPlay`를 불러준다. 그 ModActor의 BeginPlay가 진입점이 됨

### GTA ↔ 언리얼 대응표

| GTA V | 언리얼 | 역할 |
|---|---|---|
| `dinput8.dll` ASI Loader | `dwmapi.dll` 프록시 | 문 열기 |
| ScriptHookV (네이티브 테이블 스캔) | UE4SS (GUObjectArray/FNamePool/ProcessEvent 스캔) | 게임 함수 전화번호부 |
| 네이티브 6,000개 (NativeDB) | UFunction 리플렉션 (이름이 빌드에 남음) | 부품 함수 |
| `.ysc` 미션 스크립트 | Blueprint 바이트코드 | 로직 |
| OpenIV `mods/` 리다이렉트 | `_P.pak` 우선순위 마운트 (에픽 공식) | 에셋 추가/교체 |
| `.ydd/.ytd` | `.uasset/.uexp` | 에셋 파일 |
| `.asi` / C# 스크립트 | Lua / C++ / BP ModActor | 모드 본체 |

### pak 암호화하고 서명해도 뚫리는 이유

선임한테 "pak 서명하고 암호화해도 뚫린다"는 얘기를 들었다. 사실 맞음. 언리얼 구현이 허술해서가 아니라 원리적으로 못 막음

한 줄로 하면 **열쇠와 검사관이 둘 다 공격자 손에 있기 때문**이다. HTTPS가 안전한 건 개인키가 서버에 있고 클라이언트엔 없어서다. 그런데 게임 클라이언트는 공격자 PC에 통째로 깔린다. exe, pak, 키, 검증 코드 전부. 게임이 에셋을 읽으려면 스스로 복호화해야 하고 그러려면 키가 클라 안에 있어야 한다. 게임이 할 수 있는 건 그 PC 주인도 할 수 있다.

**암호화**: Project Settings → Crypto에서 만든 AES 키는 `Game.exe` 안에 바이트 배열로 들어간다(`FCoreDelegates::GetPakEncryptionKeyDelegate`가 넘겨준다). 키가 exe 안 상수인 셈이다. 바이너리에서 키 패턴을 찾는 툴이 이미 있고 FModel 같은 에셋 뷰어는 키만 넣으면 pak을 그대로 연다. 키를 아무리 숨겨도 복호화 함수가 도는 순간 메모리엔 조립된 키와 평문 에셋이 있다. 덤으로 기본 설정은 **인덱스만 암호화**라서 파일 내용은 평문인 경우가 많다.

![언리얼 Project Settings > Crypto의 pak 암호화 키·서명 키 설정 화면](/assets/images/game-mods-cheats-anticheat/uepak.png)

**서명**: RSA 개인키로 pak 청크 해시에 서명해서 `.sig`를 만든다. 공개키는 exe에 들어가고, 런타임에 `FPakPlatformFile`이 대조한다. 개념은 맞는데 검증하는 코드가 exe 안에 있다. 검사관도 공격자 집에 사는 셈. 서명 검사 함수를 "항상 통과"로 바꾸거나(디스크 패치 또는 프록시 DLL로 들어가서 메모리 몇 바이트 변경), exe 안 공개키를 자기 공개키로 바꾸고 자기 개인키로 서명하면 끝남

맹점이 하나 더 있음. UE4SS 같은 후킹 모드는 pak을 아예 안 건드린다. 리플렉션으로 메모리 안 함수를 부르는 거라 pak 보호가 완벽해도 로직 모드엔 영향이 없다

| 수단 | 실제 효과 | 뚫리는 비용 |
|---|---|---|
| pak 암호화 | 에셋 뷰어로 바로 여는 걸 막음 | 키 추출 툴 — 몇 분 |
| pak 서명 | 캐주얼한 파일 교체 방지 | exe/메모리 패치 — 몇 시간 |
| UE5 IoStore (`.utoc/.ucas`) | 포맷이 달라 구툴 무력화 | 커뮤니티 툴이 이미 따라옴 |
| Themida/Denuvo | exe 정적 분석·패치를 어렵게 | 며칠~몇 달, 결국 뚫림 |
| **안티치트 (EAC/BattlEye)** | **주입된 DLL·패치된 exe·메모리 변조를 런타임 탐지** | 계속되는 군비경쟁 |
| **서버 권위** | **클라를 뭘 어떻게 하든 결과에 영향 없음** | 서버를 뚫어야 함 = 사실상 불가 |

위 네 줄은 시간 끌기고 아래 두 줄이 실제로 온라인 게임을 지킨다. 그래서 실무 방어선은 안티치트 + 서버 권위로 감

## 3. 핵은 모드와 뭐가 다른가

서든어택이나 배그는 핵이 계속 생긴다.  핵은 결국 실행 중인 게임 메모리를 읽거나 쓴다. 그 방법이 지난 15년간 안티치트에 밀려 계속 아래 층으로 내려갔음

### 핵이 하는 일은 딱 세 가지

| 종류 | 하는 일 | 메모리 접근 | 서버로 막히는지 |
|---|---|---|---|
| **정보 핵** (월핵/ESP) | 적 좌표·체력을 읽어 화면에 오버레이 | **읽기만** | ✗ 못 막음 |
| **조준 핵** (에임봇) | 적 좌표 읽기 + 마우스 입력 흉내 | 읽기 + 입력 주입 | ✗ 못 막음 |
| **조작 핵** (스피드핵, 무반동, 텔레포트) | 게임 변수를 직접 바꿈 | **쓰기** | ✓ 막힘 |

![벽 너머의 적을 박스/스켈레톤으로 표시하는 ESP·월핵 예시 이미지](/assets/images/game-mods-cheats-anticheat/wallhack.jpg)
![벽 너머의 적을 박스/스켈레톤으로 표시하는 ESP·월핵 예시 이미지](/assets/images/game-mods-cheats-anticheat/cheat-esp-wallhack-example.png)

월핵과 에임봇은 서버 auth로 못 막는다. 게임은 벽 뒤의 적을 렌더링해야 하니까 그 좌표를 클라에 보내야 하고 클라 메모리에 있는 걸 읽기만 하는 건 게임 결과를 변조하는 게 아니다. 서버 입장에선 정상 플레이어가 정확히 조준한 것과 구분이 안 됨

서든어택은 옛날 클라이언트 권위 구조라 조작 핵(순간이동, 관통)까지 성행했고, 배그는 서버 권위가 있어서 핵이 대부분 ESP + 에임봇이다. "서버 권위를 잘 해도 배그에 핵이 안 사라지는" 이유

### 접근 층이 계속 내려감

```
Ring 3   유저모드 ─── 1세대: DLL 주입 / 외부 프로세스 메모리 읽기
Ring 0   커널 ────── 2세대: 커널 드라이버 (안티치트가 커널로 가니 핵도 커널로)
Ring -1  하이퍼바이저 ─ 3세대: OS 자체를 VM 안에 넣고 밖에서 관찰
하드웨어 ──────────── 4세대: DMA 카드 (CPU 개입 없이 RAM을 다른 PC로 전송)
게임 PC 밖 ─────────── 5세대: 화면 캡처 + AI 객체 탐지 + 마우스 에뮬 장치
```

**1세대 유저모드** "DLL 주입" 외부 인젝터로 게임 프로세스에 DLL을 넣거나, 주입 없이 별도 프로세스에서 `ReadProcessMemory`로 메모리를 읽는다. 게임 켜진 뒤 붙는 방식. 지금은 안티치트가 제일 쉽게 잡는 부류라 유료 핵은 거의 안 씀

**2세대 커널 드라이버** 안티치트가 유저모드를 다 잡으니 커널로 내려감. 커널(Ring 0)에선 어떤 프로세스 메모리든 읽을 수 있고 유저모드 안티치트는 손을 못 댄다. 그래서 EAC, BattlEye, Vanguard도 전부 커널 드라이버가 됐고 핵도 커널 드라이버가 됨. 윈도우는 서명된 드라이버만 로드하니까 핵 제작자는 훔친 인증서를 쓰거나 취약점 있는 정품 서명 드라이버를 토대로 함. 지금 유료 핵의 주류

**3세대 하이퍼바이저** 안티치트 커널 드라이버보다 더 아래. 윈도우 전체를 얇은 VM 위에 올리고 그 밖에서 메모리를 봄. 안티치트는 자기가 VM 안에 있다는 걸 알아채려 하고(타이밍 검사 등), 핵은 그걸 숨김

**4세대 DMA 하드웨어** PCIe 슬롯에 카드를 꽂으면 카드가 CPU를 거치지 않고 RAM을 직접 읽어 케이블로 두 번째 PC에 보냄. 게임 PC엔 소프트웨어가 하나도 안 깔림. 두 번째 PC가 좌표를 해석해서 별도 모니터에 ESP를 띄우거나 마우스 에뮬 장치로 조준 신호를 보낸다. 소프트웨어 안티치트로는 이걸 볼 수가 없음. 기껏해야 PCIe 장치 목록을 보는데, 카드 펌웨어가 정품 네트워크 카드 ID를 흉내 낸다.

**5세대 외부 AI 비전** 메모리를 아예 안 읽음. 캡처카드로 화면을 뽑아 두 번째 PC에서 YOLO 같은 객체 탐지로 적을 찾고, 하드웨어 마우스 에뮬레이터로 조준함. 게임 PC 입장에선 진짜 마우스가 움직인 거다. 콘솔에서도 됨. 최근 2~3년 사이 가장 빠르게 늘고 있는 추세

![캡처카드 → 객체 탐지(YOLO) PC → 하드웨어 마우스 에뮬레이터로 이어지는 외부 AI 에임봇 파이프라인 다이어그램](/assets/images/game-mods-cheats-anticheat/aimbot.png)
![캡처카드 → 객체 탐지(YOLO) PC → 하드웨어 마우스 에뮬레이터로 이어지는 외부 AI 에임봇 파이프라인 다이어그램](/assets/images/game-mods-cheats-anticheat/aimbot2.png)
![캡처카드 → 객체 탐지(YOLO) PC → 하드웨어 마우스 에뮬레이터로 이어지는 외부 AI 에임봇 파이프라인 다이어그램](/assets/images/game-mods-cheats-anticheat/aimbot3.png)
![캡처카드 → 객체 탐지(YOLO) PC → 하드웨어 마우스 에뮬레이터로 이어지는 외부 AI 에임봇 파이프라인 다이어그램](/assets/images/game-mods-cheats-anticheat/aimbot4.png)

### 왜 안 끝날까

- **정보 핵은 원리적 한계** 클라가 알아야 그릴 수 있다. 줄일 수는 있어도 0으로 못 만듦
- **접근 층이 안티치트보다 아래면 안 보임** 커널 vs 커널은 대등한 싸움이고, DMA/외부 비전은 아예 관찰 범위 밖
- **경제** 배그 같은 게임은 핵 한 달 구독이 몇만 원인데 무료 계정이라 밴당해도 손실이 0이다. 억제력이 없으니 공급이 유지
- **탐지 vs 오탐** 안티치트를 세게 하면 정상 유저의 오버레이·매크로·드라이버까지 잡혀서 오탐 민원이 터진다. 항상 "얼마나 세게 잡냐"의 트레이드오프

## 4. 안티치트는 그래서 뭘 하나

| 대응 | 뭘 잡나 | 한계 |
|---|---|---|
| 커널 안티치트 (EAC/BattlEye/Vanguard) | 1·2세대 — 주입, 드라이버, 메모리 접근 | 3세대 이하 못 봄, 오탐·프라이버시 논란 |
| 부팅 시 상주 + Secure Boot/TPM 요구 (Vanguard) | 부팅 전에 올라오는 드라이버·하이퍼바이저 | 유저 반발, DMA는 여전히 못 봄 |
| **서버측 정보 최소화** (발로란트 Fog of War) | 안 보이는 적 좌표를 아예 안 보냄 → 월핵 가치 급감 | FPS는 발소리·코너 예측 때문에 완전히는 못 줄임, 서버 비용 |
| **서버측 행동 통계 / ML** | 반응 속도·조준 궤적·헤드샷 비율의 통계적 이상 → DMA·AI 비전도 잡힘 | 확률적, 밴까지 시간 걸림 |
| 리플레이 + 신고 검토 | 위와 같음, 사람이 판단 | 비용 |
| HWID 밴, 폰 인증, 계정 신뢰도 | 재가입 비용 올리기 | 스푸퍼로 우회 |

![커널 안티치트 드라이버(Ring 0)가 유저모드 게임 프로세스를 감시하고 주입·핸들 접근을 막는 구조 다이어그램](/assets/images/game-mods-cheats-anticheat/kernel-anticheat-architecture.png)

![발로란트 Fog of War — 서버가 시야 밖 적 좌표를 클라이언트에 보내지 않는 개념도](/assets/images/game-mods-cheats-anticheat/valanticheat-6.png)
![발로란트 Fog of War — 서버가 시야 밖 적 좌표를 클라이언트에 보내지 않는 개념도](/assets/images/game-mods-cheats-anticheat/valanticheat-7.png)

발로란트도 언리얼에서 월핵을 잡기위해 전장의 안개(Fog of War) 개념을 도입했다. 쉽게 말하면 **월핵이 훔쳐 볼 데이터를 클라이언트에 아예 안 보내는 것!**

서버가 스타크래프트의 그 안개처럼 동작하는 것. 자세한 내용은 [https://www.riotgames.com/en/news/demolishing-wallhacks-valorants-fog-war](https://www.riotgames.com/en/news/demolishing-wallhacks-valorants-fog-war) 에 작성돼있음

현실은 이걸 전부 겹쳐 쓰고 그래도 100%는 못 잡는다. 목표가 박멸이 아니라 일반 매치에서 만날 확률 낮추기

### FC 온라인은 어떻게 돼 있나

처음 질문으로 돌아가면, 이 게임엔 위의 것들이 한꺼번에 겹쳐 있음

- `.big` 아카이브 암호화 - 에셋을 바로 뽑아 가는 걸 막는 방지턱. 원래 EA `.big`은 `BIGF` 시그니처로 시작하고 피파 시절엔 커뮤니티 툴로 쉽게 열렸는데, 넥슨이 한 겹 더 씌움
- `fczf.exe`에 Themida - exe 정적 분석·패치를 어렵게
- `BlackCipher` - 넥슨 안티치트(커널 드라이버 포함). 로그가 매일 갱신됨 프록시 DLL 로드, 메모리 접근을 런타임에 잡음
- 서버 authority - 선수 능력치, 로스터, 강화 상태는 전부 서버에 존재. `.big`이 뚫려도 내 화면만 바뀌고 경기 결과엔 영향이 없음

그러니까 FC 온라인 클라이언트 모딩은 기술적으로 거의 불가능하고, 된다 해도 약관 위반이라 계정 제재 대상

## 5. 만약 게임을 개발하면서

**싱글플레이면** 암호화+서명은 에셋을 드래그해서 바로 뽑아 가는 것 정도만 막는다고 보면 된다. 대부분 그걸로 감안하고 많은 스튜디오는 오히려 모딩을 열어서 수명을 늘림. 리플렉션은 어차피 남고 `_P.pak` 마운트도 기본 동작이라 사실상 이미 열려 있다. 모드 킷이나 에픽의 SimpleUGC 플러그인만 얹으면 공식 모딩이 됨

**멀티플레이면**

1. 게임플레이 판정(피해, 위치, 인벤토리)은 전부 서버로. 클라는 입력만 보내고 판정은 서버가. 이걸로 조작 핵은 사라질 수 있음
2. 관심 관리(Interest Management)를 적극적으로. 시야·거리·오클루전 기준으로 리플리케이션 자체를 끊으면 월핵이 볼 게 줄어든다. UE5의 Replication Graph / Iris로 커스텀 가능하고 서버측 오클루전 컬링을 얹는 게 발로란트 방식
3. 안티치트 통합. EOS EAC는 무료다. 1·2세대를 걸러주는 것만으로 체감이 크다
4. 서버 로그를 처음부터 통계 분석 가능하게. 조준 각속도, 타겟 획득 시간, 벽 너머 프리에임 빈도 같은 지표를 남기면 DMA·AI 비전처럼 클라에 흔적 없는 핵도 나중에 잡을 수 있음
5. 계정 비용. 밴이 아파야 억제력이 생김. 무료 게임이면 폰 인증, 플레이 시간 기반 신뢰 매치메이킹 같은 장치가 필요함
