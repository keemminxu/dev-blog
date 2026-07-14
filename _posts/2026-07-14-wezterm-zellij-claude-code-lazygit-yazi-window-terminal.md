---
layout: post
title: "윈도우 클로드 코드 터미널 세팅!!"
title_en: "Windows Terminal Dev Environment with WezTerm, Zellij, Claude Code, lazygit and yazi"
date: 2026-07-14 18:23:51 +0900
categories: ["etc"]
tags: ["wezterm", "zellij", "claude-code", "lazygit", "yazi", "terminal"]
excerpt: "WezTerm + Zellij + Claude Code + lazygit + yazi로 윈도우 터미널 개발환경을 세팅한 기록. Shift+Enter 줄바꿈이 안 되는 문제는 WezTerm SendString 한 줄로 해결했다."
excerpt_en: "Building a Windows-native terminal workspace with WezTerm and Zellij, and fixing Shift+Enter newline in Claude Code behind a multiplexer with a one-line SendString keybinding."
---

# 쓰레드에서 이런 글을 봄


![터미널 세팅](/assets/images/wezterm-zellij-claude-code-lazygit-yazi-window-terminal/9c739663-bb79-46d1-bbd4-6f5dd65cba23.png)


따라하고 싶어서 따라해봤다.

이건 윈도우 설정

- **WezTerm** — GPU 가속 터미널. 설정을 lua 파일 하나로 관리
- **Zellij** — 터미널 멀티플렉서(tmux 계열). 페인 분할이랑 레이아웃 담당
- **Claude Code** — 메인 작업 공간
- **lazygit** — git TUI
- **yazi** — 파일 매니저 TUI


![현재 윈도우 클로드 코드 터미널](/assets/images/wezterm-zellij-claude-code-lazygit-yazi-window-terminal/26ba1d1d-d3e2-4124-a24a-46ce2325fcd6.png)


한 탭에 Claude Code / lazygit / yazi가 항상 떠 있는 구조다. Claude Code로 작업하다가 커밋할 때는 lazygit 페인으로 넘어가고, 파일 구조는 yazi에서 확인한다. 마우스로 창 전환할 일이 거의 없어짐.

## 설치

lazygit이랑 yazi는 winget으로 설치했다.

```powershell
winget install JesseDuffield.lazygit
winget install sxyazi.yazi
```

WezTerm은 공식 인스톨러로 설치. Zellij는 원래 리눅스/맥 전용이었는데 윈도우 네이티브 빌드가 나와서 그걸 받음.

## WezTerm 설정

`~/.wezterm.lua` 전체다. 이게 설정의 전부라 관리할 게 파일 하나뿐이다.

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- 기본 셸: Windows PowerShell
config.default_prog = { 'powershell.exe', '-NoLogo' }

config.font_size = 10.5
config.color_scheme = 'Catppuccin Mocha'

-- 탭/멀티플렉싱은 zellij이 담당하므로 WezTerm 탭바는 숨김
config.hide_tab_bar_if_only_one_tab = true
config.window_decorations = 'TITLE|RESIZE'
config.initial_cols = 160
config.initial_rows = 42

-- Ctrl+Shift+D: dev 워크스페이스(zellij 레이아웃)를 새 탭으로 실행
config.keys = {
  {
    key = 'd',
    mods = 'CTRL|SHIFT',
    action = wezterm.action.SpawnCommandInNewTab { args = { 'zellij', '--layout', 'dev' } },
  },
}

-- 런처 메뉴(우클릭 새 탭 버튼)에서도 선택 가능
config.launch_menu = {
  { label = 'dev workspace (zellij)', args = { 'zellij', '--layout', 'dev' } },
  { label = 'PowerShell', args = { 'powershell.exe', '-NoLogo' } },
}

return config
```

포인트 몇 개:

- WezTerm에는 JetBrains Mono와 Nerd Font 심볼 폴백이 내장돼 있다. 그래서 Nerd Font를 따로 설치하지 않아도 yazi/zellij 아이콘이 제대로 나온다. 이게 은근히 편하다.
- 탭이랑 페인 분할은 zellij 몫이라 WezTerm 탭바는 숨겼다. 역할이 겹치면 헷갈리기만 한다.
- `Ctrl+Shift+D` 한 방에 dev 워크스페이스가 새 탭으로 뜬다.

<!-- ![Ctrl+Shift+D를 눌러 zellij dev 워크스페이스가 한 번에 뜨는 동작 GIF](/assets/images/wezterm-zellij-dev-terminal/spawn-dev-workspace.gif) -->

## Zellij 레이아웃

`%APPDATA%\zellij\config\layouts\dev.kdl`:

```kdl
// dev 워크스페이스: 좌상 Claude Code / 우상 lazygit / 하단 yazi
// 사용: 프로젝트 폴더에서 `zellij --layout dev`
layout {
    default_tab_template {
        pane size=1 borderless=true {
            plugin location="zellij:tab-bar"
        }
        children
        pane size=2 borderless=true {
            plugin location="zellij:status-bar"
        }
    }
    tab name="dev" focus=true {
        pane split_direction="horizontal" {
            pane split_direction="vertical" size="60%" {
                pane name="Claude Code" size="55%" command="powershell" {
                    args "-NoLogo" "-Command" "claude"
                }
                pane name="lazygit" command="lazygit"
            }
            pane name="yazi" command="yazi"
        }
    }
}
```

위쪽 60%를 세로로 갈라 Claude Code(55%)와 lazygit을 놓고, 아래에 yazi를 깔았다. `config.kdl`은 `default_shell "powershell"` 한 줄이 전부

프로젝트 폴더에서 `zellij --layout dev`를 치면 이 배치 그대로 뜨고, 각 페인이 그 폴더 기준으로 실행된다. 페인 이동은 zellij 기본 키인 `Alt+h,j,k,l` 또는 `Alt+화살표`. 상태바에 키가 다 떠 있어서 굳이 외울 필요 없음

## Shift+Enter 줄바꿈이 안 되는 문제

세팅하자마자 걸린 문제. Claude Code 입력창에서 Shift+Enter로 줄바꿈을 하려는데 그냥 Enter로 인식돼서 메시지가 전송돼버림

원인은 터미널의 동작 방식에 있다.

- 터미널에서 Enter는 CR(`0x0D`) 바이트 하나다. Shift를 누르든 말든 앱에는 똑같은 바이트가 도착하니 구분 자체가 불가능하다.
- 요즘 터미널은 kitty keyboard protocol 같은 확장으로 modifier 정보까지 보낼 수 있긴 하다. 문제는 중간에 낀 zellij다. zellij가 키 입력을 한 번 받아 처리한 뒤 페인에 다시 흘려보내는 구조라, 이 확장 프로토콜이 Claude Code까지 온전히 전달되지 않는다.

그래서 프로토콜에 기대지 말고 WezTerm 단에서 Shift+Enter를 아예 다른 바이트로 바꿔 보내면 됨. Claude Code는 `ESC` + `Enter`(Alt+Enter와 같은 시퀀스)를 줄바꿈으로 인식하니까, 그 바이트(`\x1b\r`)를 직접 쏘는 거다.

`.wezterm.lua`의 `config.keys`에 한 줄만 추가:

```lua
config.keys = {
  -- Shift+Enter → ESC+CR: zellij를 그대로 통과해 Claude Code가 줄바꿈으로 인식
  { key = 'Enter', mods = 'SHIFT', action = wezterm.action.SendString '\x1b\r' },
  {
    key = 'd',
    mods = 'CTRL|SHIFT',
    action = wezterm.action.SpawnCommandInNewTab { args = { 'zellij', '--layout', 'dev' } },
  },
}
```

`SendString`은 그냥 바이트를 흘려보내는 거라 zellij가 건드리지 않고 그대로 통과시킨다. 중간에 멀티플렉서가 몇 겹 껴 있든 동작한다는 게 이 방식의 핵심


참고로 설정 없이 되는 방법도 있다. Claude Code 입력창에서 `\`를 치고 Enter를 누르면 줄바꿈이 된다. 급할 때는 이걸로 버틸 수 있는데, 손에 익질 않아서 결국 키바인딩을 잡는 쪽이 나음
