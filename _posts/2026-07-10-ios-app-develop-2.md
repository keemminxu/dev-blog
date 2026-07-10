---
layout: post
title: "iOS 앱 개발 일지 (2)"
title_en: "ios app develop"
date: 2026-07-10 15:02:03 +0900
categories: ["etc"]
tags: ["ios", "app", "develop", "apple", "jenkins", "mobile", "application"]
---

## 현재 진행 상황

인프라를 어느정도 구축해놨음.

원래는 google의 cloud run을 이용하여 인프라를 단축시키려 했으나, 신규 계정이라 그런지 알수없는 404 오류로 구글에 문의했으나 내가 해결할 수 있는건 하나도 없었다ㅠ..


![google cloud email service](/assets/images/ios-app-develop-2/0dab4541-227c-4ca4-baf0-ec06f56289e0.png)

결국 fly.io 에 cloud를 구축하기로 했다. 도쿄서버라서 아무래도 조금 레이턴시가 있지만 감안할 수 있는 정도인것 같음.


## 경제적 굿 아이디어

하지만 아주 큰 소득이 하나 있었다!

처음 구글 계정으로 가입하면 약 300달러, 한화로 46만원 상당의 크레딧을 지급해 주는데 정규 도큐먼트 상 이 크레딧으로는 구글 AI Studio의 API를 직접 호출할 순 없다. 하지만 편법아닌 편법이 있었으니..

바로 ai studio의 직접 호출이 아닌 vertex ai를 이용해서 이미지 생성을 호출하는 것!

이러면 크레딧을 사용한다 크하하


![google credit](/assets/images/ios-app-develop-2/9b581760-f74b-47bd-aa06-96d4f4900d9e.png)

