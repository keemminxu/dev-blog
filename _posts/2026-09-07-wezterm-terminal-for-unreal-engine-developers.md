---
layout: post
title: "WezTerm 터미널 언리얼 개발자용 업그레이드 완료"
title_en: "Upgrade WezTerm Terminal For Unreal Engine Developers"
date: 2026-09-07 10:51:55 +0900
categories: ["unrealengine"]
tags: ["ue5", "wezterm", "terminal", "interface", "cli", "claude", "claudecode", "unrealengine"]
---

# 업그레이드 이유

저번에 WezTerm로 맥따라하기 터미널을 세팅해 본 후 느낀 점.

솔직히 yazi(폴더 트리 TUI)는 잘 안쓰게 됨.. 그냥 윈도우 기본 기능으로 보는게 훨씬 직관적이고 편함.

그래서 언리얼 개발자에게 편한 구조가 뭘까? 생각하다 이번에 살짝 업그레이드를 했음.


![wezterm for ue5 developer](/assets/images/wezterm-terminal-for-unreal-engine-developers/ccd29ae6-ffa1-4df6-af34-613ad00f4a77.png)


왼쪽 상단과 오른쪽 상단은 기존에 사용했던 `Claude Code`와 `LazyGit`. 이 두개는 아주 잘 쓰고있음 ㅎ

대신 왼쪽 하단에는 `UBT 컴파일을 돌릴 수 있는 batch 파일` 터미널을 띄워놨고.

오른쪽 하단에는 `라이브 테일링 기능을 포함한 UE 에디터 로그`를 띄워놨다.


+++
추가로 Horde 서버를 이용해 `UBA-UnrealBuildAccelerator`를 사용중이라 빌드도 잘되고 아주 빠름. (CPU 나눠서 빌드하는것)

![Horde Unreal Build Accelerator](/assets/images/wezterm-terminal-for-unreal-engine-developers/3f640474-df11-4cf4-87bf-303a56ff3f34.png)


---

요즘 직접 코딩도 안하고 검토만 하는데 이렇게 구성하면 그 무거운 Visual Studio도 안켜도 빌드할 수 있지 않을까 ㅎ