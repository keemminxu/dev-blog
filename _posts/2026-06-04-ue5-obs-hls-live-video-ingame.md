---
layout: post
title: "라이브 영상을 언리얼 인게임 송출 방법 (m3u8 - HLS)"
title_en: "Playing a Live OBS Stream Inside Unreal Engine 5 (HLS)"
excerpt_en: "How to pipe a live OBS broadcast into an Unreal Engine 5 in-game screen using HLS via MediaMTX and the Electra player, with the gotchas that actually made it work."
date: 2026-06-04 00:00:00 +0900
categories: [unrealengine]
tags: [ue5, hls, obs, mediamtx, electra, live-streaming, streaming, live]
excerpt: "OBS로 송출한 라이브 영상을 UE5 인게임 메시에 재생하는 전체 파이프라인과, 실제로 되게 만든 삽질 포인트 정리."
---

## 배경

콘서트홀 같은 공간에서 라이브 공연 영상을 인게임 화면(메시)에 띄워야 했다. OBS로 쏘는 영상이 언리얼 안에서 제대로 나오게 하는 게 목표였는데, "URL 하나 물리면 되겠지" 했다가 생각보다 막히는 데가 많았다. 되게 만든 과정을 정리해둔다.

## 큰 그림부터

먼저 알아야 할 것 하나. **OBS는 HLS를 직접 안 만든다.** OBS가 하는 건 캡처 + 인코딩 + 송출(RTMP/SRT)까지고, 이걸 `.m3u8` + `.ts` 세그먼트로 잘라주는 놈이 따로 필요하다. 그 역할을 MediaMTX한테 맡겼다. exe 하나면 끝이라 로컬 테스트엔 이게 제일 편하다.

전체 흐름은 이렇다.

```
OBS ──RTMP──▶ MediaMTX ──HLS(m3u8)──▶ UE5 Electra ──▶ MediaTexture ──▶ Material ──▶ Mesh
(캡처/인코딩)  (HLS로 변환)             (재생)
```

언리얼 입장에선 결국 **m3u8 URL 하나** 받아서 재생하는 거다. 그게 로컬 MediaMTX든 나중에 Bunny/Cloudflare든 똑같다.

샘플로 빅뱅 콘서트 2시간짜리 영상을 유튜브에서 mp4로 변환하여 테스트해봤음.

기본적으로 송출과정에서 Delay가 어느정도 있다. 정확히 측정은 안했는데 본 영상과 비교하면 체감상 한 40초..?

근데 그렇다고 싱크나 사운드가 밀리는게 아니라 송수신 과정에서 밀리는거라 동시성이 아주 중요한게 아니라면 아무 문제 없긴함.

만약 레이턴시가 엄청나게 중요하다? 하면 이 방식이 아니라 **웹 RTC** 방식을 택해야됨.

어쨌든 OBS를 활용하면 라이브 영상부터 웹캠, 인게임 화면 등 여러가지 형태로 사용가능할 것 같음.

![OBS HLS UE5 live video stream](/assets/images/ue5-obs-hls-live-video-ingame/final-demo.gif)

## 1. OBS → MediaMTX로 m3u8 뽑기

MediaMTX 설치하고 실행한다.

```
winget install bluenviron.mediamtx
mediamtx.exe
```

RTMP 1935, HLS 8888 포트가 열린다.

OBS는 설정 → 방송 → 서비스 `Custom`으로 잡는다.

- 서버: `rtmp://localhost:1935/mystream`
- **스트림 키: 비움** ← 이거 안 비우면 경로가 `/mystream/<키>/...`로 꼬여서 한참 헤맨다

![OBS 방송 설정 화면 (Custom 서버 URL + 스트림 키 비움)](/assets/images/ue5-obs-hls-live-video-ingame/obs-stream-settings.png)

방송 시작하면 재생 URL은 이거다.

```
http://localhost:8888/mystream/index.m3u8
```

언리얼로 넘어가기 전에 브라우저나 VLC로 먼저 열어서 영상 나오는지 확인하고 가는 게 좋음

## 2. 언리얼에서 메시에 재생

재생 쪽은 `UMediaPlayer` + `UMediaTexture` 조합이다. m3u8는 `UStreamMediaSource`로 열면 된다. 머티리얼엔 `MediaTexture` 텍스처 파라미터 하나 만들어두고, 런타임에 다이나믹 인스턴스로 그 텍스처를 꽂아준다.

```cpp
MediaPlayer = NewObject<UMediaPlayer>(this);
MediaTexture = NewObject<UMediaTexture>(this);
MediaTexture->SetMediaPlayer(MediaPlayer);
MediaTexture->UpdateResource();

// 머티리얼에 라이브 텍스처 주입
DynMat = UMaterialInstanceDynamic::Create(SurfaceMaterial, this);
DynMat->SetTextureParameterValue(TEXT("MediaTexture"), MediaTexture);
Mesh->SetMaterial(0, DynMat);

// m3u8 열기
UStreamMediaSource* Stream = NewObject<UStreamMediaSource>(this);
Stream->StreamUrl = TEXT("http://localhost:8888/mystream/index.m3u8");
MediaPlayer->OpenSource(Stream);
```

소리도 같이 내려면 `UMediaSoundComponent`를 같은 MediaPlayer에 물려주면 된다.

```cpp
MediaSound->SetMediaPlayer(MediaPlayer);
```

여기까지가 "정상 경로"

## 3. 중요 포인트

### "byte stream format unsupported" — Electra를 써야 한다

처음엔 영상이 아예 안 열리고 로그에 `byte stream format unsupported`가 떴다. 원인은 UE가 기본으로 WmfMedia로 m3u8를 열려다 실패하는 거였다. **HLS는 ElectraPlayer 플러그인을 켜야** 된다. 플러그인 켜고 에디터 재시작하면 `.m3u8`엔 Electra가 자동으로 붙는다. URL 끝에 `.m3u8` 확장자는 꼭 남겨두는 게 안전하다(없으면 서버가 주는 Content-Type으로 판별하느라 꼬일 수 있다).

!["byte stream format unsupported" 에러 로그 + ElectraPlayer 플러그인 활성화 화면](/assets/images/ue5-obs-hls-live-video-ingame/electra-plugin.png)

### LL-HLS는 끄는 게 낫다

MediaMTX 기본값이 `hlsVariant: lowLatency`(LL-HLS)인데, **UE Electra는 LL-HLS의 partial segment를 지원 안 한다.** 켜봤자 저지연 이득은 0이고 플레이리스트만 복잡해져서 오히려 이상하게 논다. 그냥 표준으로 둔다.

```yaml
hlsVariant: mpegts     # 안 되면 fmp4
```

### 첫 접속에 file not found — hlsAlwaysRemux

처음 UE에서 열었더니 m3u8가 없다고 실패했다. MediaMTX는 기본적으로 **누가 한 번 요청해야 그때 m3u8를 만든다**(`hlsAlwaysRemux: false`). UE 첫 `OpenSource`가 그 타이밍에 걸려서 실패하는 거다. 그냥 항상 만들어두게 바꾼다.

```yaml
hlsAlwaysRemux: true
```

### 영상이 멈췄다 갑자기 재생됨 (리버퍼링)

잘 나오다가도 한참 보고 있으면 뚝 멈췄다가 몇 초 뒤에 다시 가는 일이 생겼다. 버퍼 언더런이다 — 플레이어가 다음 세그먼트 받기 전에 버퍼가 바닥나는 것. localhost면 네트워크 문제가 아니니 원인은 둘 중 하나다.

하나, **세그먼트가 너무 빡빡한 경우.** 짧고 적으면 버퍼 여유가 없다. 길이를 늘리고 개수도 넉넉히 잡는다.

```yaml
hlsSegmentDuration: 2s
hlsSegmentCount: 7
```

둘, **OBS 인코더 과부하.** OBS 통계(Stats) 독에서 `Encoding overloaded`나 드롭 프레임이 뜨면 인코더가 못 따라가는 거다. NVENC로 바꾸거나 해상도/fps를 낮춘다.

그리고 OBS 키프레임 간격(Keyframe Interval)을 **세그먼트 길이에 맞춰 고정**(예: 2초)하는 게 중요하다. `0/Auto`로 두면 키프레임이 불규칙해서 세그먼트가 깔끔하게 안 잘리고 끊긴다.

원인 가르는 팁 하나. **VLC로 같은 m3u8를 열어본다.** VLC도 끊기면 서버/인코더 쪽이고, VLC는 멀쩡한데 UE만 끊기면 Electra 버퍼 쪽이다.

## 정리

- OBS는 HLS 안 만든다 → MediaMTX 같은 서버로 m3u8 변환
- UE에서 HLS는 **Electra** (WmfMedia 아님). `.m3u8` 확장자 유지
- `hlsVariant: mpegts` (LL-HLS는 UE에서 이득 없음)
- `hlsAlwaysRemux: true` (첫 접속 실패 방지)
- 끊기면 → 세그먼트 키우기 + 키프레임 정렬 + 인코더 과부하 확인
- OBS 스트림 키는 비우기
- 다른 기기에서 볼 땐 `localhost` 대신 LAN IP, 방화벽 1935/8888 열기
