---
layout: post
title: "Visual Studio 중괄호 쌍 색 지정으로 괄호 지옥 탈출하기"
title_en: "Enable Bracket Pair Colorization in Visual Studio"
excerpt_en: "Built-in bracket pair colorization in Visual Studio 17.6+ — no extension needed."
date: 2026-03-25 10:00:00 +0900
categories: [etc]
tags: [visual-studio, ide, productivity]
excerpt: "조건문 중첩이 깊어지면 괄호 찾느라 시간 날린다. VS 17.6부터 기본 내장된 중괄호 쌍 색 지정 기능으로 해결."
---

## 문제

VS에서 조건문을 열심히 쓰다 보면 어느 순간 괄호 쌍 찾는 것만으로 시간을 소비하게 된다. 특히 중첩이 3단계 이상 들어가면 눈으로 따라가기가 힘들다.

## 해결

Visual Studio 17.6 버전부터 **중괄호 쌍 색 지정** 기능이 기본 내장되어 있다. 확장 프로그램 설치 없이 설정만 켜면 된다.

**도구** → **옵션** → **텍스트 편집기** → **일반** → **중괄호 쌍 색 지정 사용** 체크

![VS 옵션에서 중괄호 쌍 색 지정 설정](/assets/images/visual-studio-bracket-pair-colorization/1.png)

이렇게 하면 중첩된 괄호마다 다른 색상이 적용되어 어떤 괄호가 어떤 괄호와 쌍인지 한눈에 보인다.

![적용 후 중괄호 쌍이 색상으로 구분되는 모습](/assets/images/visual-studio-bracket-pair-colorization/2.png)

## 정리

- VS 17.6 이상이면 바로 사용 가능
- 확장 프로그램 설치 필요 없음
- 설정 한 번이면 끝
