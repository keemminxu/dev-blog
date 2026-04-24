---
layout: post
title: "언리얼 플러그인 만들어서 Fab에 출시하기"
title_en: "From Rejection to Fab Release"
date: 2026-04-24 09:46:30 +0900
categories: ["unrealengine"]
tags: ["ue5", "plugin", "fab", "blueprintanalyzer", "marketplace", "출시기", "blueprint", "llm", "ai"]
excerpt: "작은 아이디어로 시작한 블루프린트 분석 플러그인을 드디어 Fab에 올렸음"
excerpt_en: "Released Blueprint Analyzer on Fab after one rejection and a long break. A short note on the journey."
---

작년에 기획만하고 끝났던 언리얼 플러그인 **Blueprint Analyzer**를 드디어 Fab에 올렸음!!

![](/assets/images/unreal-plugin-fab/a69e0565-c367-4a39-bb4c-e33a130601fc.png)


언리얼 블루프린트(`.uasset`)를 **LLM이 읽기 좋은 텍스트**로 변환해주는 에디터 플러그인이다.

당시 동료 언리얼 개발자가 uasset은 바이너리 형태이기때문에 LLM이 분석하기 어렵다라는 이야기를 듣고 기획해봤다. (작년 25년 중순엔 클로드 코드가 흔치 않았음)

이번 문서에서는 어떻게 만들었는지 코드보단 *코드는 어차피 깃에 오픈 소스로 공개해놓음!* 이 fab에 출시하는 과정을 아카이빙 해볼까한다.

## fab 판매자 계정

판매자 계정 만드는건 간단함.

[Fab 링크](https://fab.com)

위 링크 들어가서 퍼블리싱 누르고 이것저것 정보 입력하면 끝.

![](/assets/images/unreal-plugin-fab/ee075836-8f19-4fed-9ba4-b5aba936ee60.png)


그리고 신기하게도 구글이나 애플처럼 뭐 하나 신청하면 오래걸리지도 않고 거의 몇시간안에? 처리된다!!

~~실제로 이 블로그 구글 애드센스 할때마다 너무 오래걸림.. 두번 리젝당했습니다ㅠ~~


## 첫번째 리젝

처음 만든 건 작년 7-8월쯤이었다.
당시엔 `Generate Optimized C++` 같은 야심찬(?) 기능도 넣어놨었고, 검수용 `.uplugin`까지 만들어서 마켓플레이스에 올렸음

**리젝**

![](/assets/images/unreal-plugin-fab/f44e120e-1f48-489b-8776-1b60e032d01d.png)

![](/assets/images/unreal-plugin-fab/1f386640-82e2-47c8-916d-1caf61173e61.png)

저 빨간 Failed들이 보이나.

뭐 어쩔 수 없지, 싶어서 그냥 묵혀뒀다.
그 사이에 회사 일이 바빠지기도 했고, 솔직히 말하면 다시 손대기 싫었던 것도 있었다.

## 8개월 후

시간이 좀 흐르고 나니까 오히려 객관적으로 보이더라.
과하게 욕심부린 기능은 덜어내고, **진짜 필요한 것**만 남기기로 했음.

그리고 이번엔 **디자인**도 신경 썼다. 피그마로 썸네일 4장 만들고, `LICENSE`랑 `THIRD_PARTY_NOTICES.md`도 제대로 붙였다.

`FilterPlugin.ini`로 배포 패키지에서 제외할 파일 따로 명시 이슈로 한번 리젝을 먹긴 했으나 바로 해결했다!

#### 미리 준비하면 좋을것들
1. 영문 사용법, ReadMe md파일
2. 썸네일
3. 플러그인 .zip 파일
4. .zip 파일 올릴 드라이브 경로 (저는 깃허브 릴리즈 사용했어요)

## Fab 등록

패키징 자체는 엔진 빌드 한 번씩 돌리면 끝이라 크게 어렵지 않았다.

에픽 런처에서 런처버전 UE 5.5 / 5.6 / 5.7 을 다운받아서 세 버전 zip을 각각 빌드해놨다.

그리고 등록하면 늦으면 8시간..? 빠르면 1~2시간 안에 결과가 나온다 (아주 빨라서 좋아)

## 이후

출시하고 며칠 지나서 GitHub 저장소를 들여다봤는데,
**외국 개발자 몇 명이 star랑 fork를 눌러줬다ㅠ**

혼자 조용히 올린 건데 누가 봐주고 쓰려고 들여다봐준 것만으로도 감사했다. 이슈나 PR로 의견 남겨준다면 더 좋고, 안 그래도 만들길 잘했다는 생각이 드는 정도.

## 마무리

플러그인 배포하는거? 전혀 어렵지 않다!

아이디어만 있다면 누구나 다 할 수 있다. 다음엔 더 필요하고 고급진 기능들로 가격 달고 올려봐야겠다..

근데 웃긴게 8개월 쉬는 동안 비슷한 기능의 플러그인 2~3개가 올라왔다..(하지만 유료임) 역시 사람 생각은 다 비슷한가보다.

---

- **Fab**: [Blueprint Analyzer on Fab](https://fab.com/s/926b85b74bed)
- **GitHub**: [keemminxu/blueprint-analyzer](https://github.com/keemminxu/blueprint-analyzer.git)
- **지원 엔진 버전**: UE 5.5 / 5.6 / 5.7
