---
layout: post
title: "AI(나노바나나), Aseprite 통합 실제 픽셀아트 만들어보기"
title_en: "Building a Real Pixel Art Pipeline with Gemini Nano Banana and Aseprite"
excerpt_en: "A hands-on walkthrough: building Aseprite from source on Windows, then wiring Pyxelate and rembg into a pipeline that turns AI-generated images into real limited-palette pixel art."
date: 2026-04-09 15:30:00 +0900
categories: [pixel-art]
tags: [aseprite, pyxelate, rembg, pixel-art, gemini, nano-banana, python, cmake, windows-build]
excerpt: "Aseprite 소스 빌드 및 NanoBanana로 뽑은 이미지를 Pyxelate + rembg 파이프라인으로 진짜 픽셀아트로 변환하는 워크플로우"
---

요즘 고도엔진을 통해 게임을 만들면서 픽셀아트에 대한 니즈가 커졌음.
허나 나는 개발자.. 픽셀아트는 도트긴해도 아트다..

1인 개발을 할라니 직접 에셋들을 구매하거나 찾아야하는데 그럴 돈과 시간이 어디있나 만들어야지!
지금부터 처남사진을 샘플로 계속 보여줄것임.
나노바나나를 이용해 픽셀을 뽑아달라하면 이렇게 뽑아줌.

![나노바나나로 만든 몽구](/assets/images/ai-gemini-aseprite-pixelart-pipeline/monggu01.png)

**하지만 여기서 주의 사항!!! 이건 실제 픽셀아트가 아님!**

실제 픽셀아트(PIXEL ART STYLE)는 진짜 도트에서 찍히는 그림을 말하는거다.

물론 제미나이가 뽑아준 이 png도 픽셀(2048x2048ㅋㅋ)이지만 (+안티엘리어싱도 섞여있음) 우리가 원하는 그 픽셀아트 ex) 128x128, 64x64 가 아니다.
진짜 도트게임을 만들려면 이 가짜는 사용하지 못함..

어떻게 하면 이 png를 다운스케일링시켜서 임포트할까???

AI가 뽑아준 이미지를 정제해서 진짜 픽셀아트로 바꿔주는 도구를 붙이면 되지 않을까. Aseprite를 직접 빌드해서 CLI로 쓰고, Python 파이프라인으로 앞단을 만드는 식으로 한 번 붙여봤다. 결과물도 괜찮고 워크플로우도 생각보다 재밌어서 정리해둔다.

![비교샷](/assets/images/ai-gemini-aseprite-pixelart-pipeline/monggu02.png)

## Part 1. Aseprite를 소스부터 빌드하기

Aseprite는 유료 배포판이 있긴 한데 소스코드는 공개되어 있어서 개인 용도로는 직접 빌드해서 쓸 수 있다. CLI와 Lua 스크립팅 API를 통째로 쓸 수 있다는 게 이 글에선 더 중요하다. 파이프라인에서 `.aseprite` 파일로 직접 저장하고 싶었기 때문

### 빌드환경

- Windows 11 + Visual Studio 2022 Community (Desktop C++ 워크로드 + Windows SDK)
- CMake, Ninja (VS 2022에 번들로 들어있음)
- 사전 빌드된 Skia `aseprite-m124` 브랜치 ZIP
- Aseprite v1.3.17 소스

여기서 **Skia 버전이 핵심**이다. 공식 INSTALL.md에 `aseprite-m124` 브랜치라고 명시돼 있는데 이걸 대충 넘기면 나중에 깨진다.

처음에 m102 버전이었음. configure는 그럭저럭 돌아가다가 빌드 중간에 에러 발생 ㅠㅠ

```
fatal error C1083: 'modules/skcms/src/skcms_public.h': No such file or directory
fatal error C1083: 'include/gpu/ganesh/SkSurfaceGanesh.h': No such file or directory
fatal error C1083: 'include/gpu/ganesh/SkImageGanesh.h': No such file or directory
```

m124에서 추가된 헤더들이 없는 것이다. 확인해보니 Skia는 m117 근처에서 GPU 관련 헤더를 `include/gpu/` → `include/gpu/ganesh/`로 재구성했다. m102는 `gpu/ganesh/` 디렉토리 자체가 없다. 무슨 패치로 때울 수 있는 수준이 아니라 라이브러리를 통째로 바꿔야 한다.

버전 확인은 이거 한 줄이면 된다.

```bash
grep "SK_MILESTONE" deps/skia/include/core/SkMilestone.h
# #define SK_MILESTONE 124   ← 이게 124여야 한다
```

올바른 m124 ZIP을 받으니 `third_party/externals/icu/flutter/icudtl.dat`, `third_party/externals/libjpeg-turbo/` 같은 자잘하게 빠져있던 파일들까지 다 같이 딸려왔다.
**README를 잘 읽자**

### configure 명령

프로젝트 루트에 `configure.cmd`를 하나 만들어두면 편하다.

```bat
@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -vcvars_ver=14.43 || exit /b 1
set "PATH=E:\aseprite\Aseprite-v1.3.17-Source\deps\ninja;%PATH%"
cd /d "E:\aseprite\Aseprite-v1.3.17-Source\build" || exit /b 1
cmake ^
  -DCMAKE_BUILD_TYPE=RelWithDebInfo ^
  -DLAF_BACKEND=skia ^
  -DSKIA_DIR=E:\aseprite\Aseprite-v1.3.17-Source\deps\skia ^
  -DSKIA_LIBRARY_DIR=E:\aseprite\Aseprite-v1.3.17-Source\deps\skia\out\Release-x64 ^
  -DSKIA_LIBRARY=E:\aseprite\Aseprite-v1.3.17-Source\deps\skia\out\Release-x64\skia.lib ^
  -G Ninja ..
```

여기서 `-vcvars_ver=14.43` 에러 또 발생..

configure 성공하고 `ninja aseprite`를 돌렸더니 컴파일은 1571개 타겟이 다 통과하고 **마지막 링크 단계**에서 이렇게 뻗었다.

```
skia.lib(skia.SkGlyph.obj) : error LNK2001: unresolved external symbol __std_minmax_f
skia.lib(skia.SkGradientBaseShader.obj) : error LNK2001: unresolved external symbol __std_max_f
skia.lib(skia.SkGradientBaseShader.obj) : error LNK2001: unresolved external symbol __std_min_f
bin\aseprite.exe : fatal error LNK1120: 3 unresolved externals
```

`__std_min_f` / `__std_max_f` / `__std_minmax_f` 같은 심볼은 MSVC 런타임(vcruntime) 쪽 함수다. MSVC 14.40부터 `<algorithm>`의 `std::min/max/minmax`가 인라이닝되는 대신 런타임 라이브러리에 외부 심볼로 빠지게 바뀌었다. Skia는 14.40 이후 툴체인으로 빌드됐는데 내 환경의 기본 링커는 14.38이어서, 14.38 vcruntime에는 그 심볼이 없으니 못 찾는 것이다.

이번에 알았는데 내 VS 2022에는 두 버전이 설치돼 있었다.

```bash
ls "C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/"
# 14.38.33130
# 14.43.34808
```

해결은 간단하다. `VsDevCmd.bat`에 `-vcvars_ver=14.43`을 넘겨서 새 툴체인을 쓰게 하면 된다. 그게 위 `configure.cmd`에 들어가 있는 이유다. 빌드 스크립트도 똑같이 넘겨야 한다.

```bat
@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -vcvars_ver=14.43 || exit /b 1
set "PATH=E:\aseprite\Aseprite-v1.3.17-Source\deps\ninja;%PATH%"
cd /d "E:\aseprite\Aseprite-v1.3.17-Source\build" || exit /b 1
ninja aseprite
```

주의: CMake 캐시가 14.38 컴파일러 경로를 저장해버리기 때문에, 툴체인을 바꾸면 `build/`를 한 번 날리고 reconfigure해야 한다. 재빌드 시간은 내 환경에서 2~3분 정도 걸렸다.

### 빌드 성공

```
[1570/1571] Linking CXX static library lib\app-lib.lib
[1571/1571] Linking CXX executable bin\aseprite.exe
```

결과는 `build/bin/aseprite.exe`. 21MB 짜리 단일 실행파일. `data/`, `icudtl.dat` 같은 리소스가 같은 폴더에 놓여 있다. 그냥 exe를 실행하면 GUI로 뜬다.

![수정중](/assets/images/ai-gemini-aseprite-pixelart-pipeline/s1.png)

GUI는 이 글의 주인공이 아니다. 내가 원한 건 **CLI 모드**였다.

```bash
aseprite.exe -b input.png --color-mode indexed --save-as output.aseprite
```

`-b`(batch)로 GUI 없이 돌아간다. `--shrink-to`, `--scale`, `--palette`, `--dithering-algorithm`, 스프라이트시트 export 같은 것들을 다 CLI로 할 수 있다. Lua 스크립트까지 얹으면 픽셀 단위로 뭐든 할 수 있긴 함.
나는 근데 파이프라인의 마지막 단계에서 PNG를 `.aseprite`로 변환하는 용도로만 쓸 것이다.

## Part 2. AI 이미지 → 픽셀아트 변환 파이프라인

이제 본론. Gemini가 뽑아준 이미지를 "진짜" 픽셀아트로 바꾸는 부분

### AI 이미지의 문제

Gemini한테 "pixel art style character" 같은 프롬프트를 주면 2048×2048의 픽셀아트같은 이미지가 나옴

하지만

1. 안티에일리어싱이 들어가 있어서 엣지가 부드럽다. 진짜 픽셀아트는 블록 단위 경계가 딱딱해야 한다.
2. 색이 너무 많다. DB32나 PICO-8 같은 제한된 팔레트에 스냅돼 있지 않다.
3. 픽셀 그리드가 일정하지 않다. 같은 "픽셀"인데 3×3이었다가 4×4였다가 한다.
4. 배경이 안 빠져 있다. 보통 캐릭터만 쓰고 싶은 경우가 많다.

그래서 필요한 건:
- 엣지 인식 다운샘플링 → **Pyxelate**
- 팔레트 양자화 → Pyxelate가 같이 처리
- 배경 제거 → **rembg** (u2net 모델)
- 최종적으로 `.aseprite`로 저장 → **방금 빌드한 aseprite CLI**

### 도구 선택: 왜 Pyxelate인가

처음엔 Pillow만으로 해봤다. 가우시안 블러 살짝 → nearest-neighbor 다운샘플 → `Image.quantize()`. 이것도 작동은 하는데 결과가 투박하다. 엣지 주변에 잡티가 남고, 색 영역 구분이 명확하지 않음

Pyxelate는 이 용도에 특화된 라이브러리다. 핵심은 두 가지:

- **Sobel 엣지 검출**로 블록 안에서 대표 픽셀을 고를 때 엣지를 보존
- **SVD 기반 색상 축소**가 median-cut보다 훨씬 나은 팔레트를 뽑음

DB32, PICO_8, COMMODORE_64, GAMEBOY_POCKET 같은 레트로 팔레트 39개가 내장돼 있고, 직접 만든 팔레트도 numpy 배열로 넘길 수 있다.

rembg는 u2net을 온디바이스로 돌리는 배경 제거 라이브러리다. 첫 실행 시 모델 ONNX 파일(~176MB)을 `~/.u2net/`에 받는다. CPU로도 2k 이미지 한 장에 몇 초 수준이라 로컬 배치에 충분함

### 설치

파이썬 3.13 환경 기준이다.

```bash
pip install pillow
pip install git+https://github.com/sedthh/pyxelate.git
pip install "rembg[cpu]"
```

Pyxelate는 PyPI에 없어서 GitHub에서 직접 받아야 한다. `[cpu]` extra를 붙여야 onnxruntime이 같이 들어온다. 이걸 안 붙이면 실행 시 "No onnxruntime backend found" 에러남

### 핵심 로직

코드 전체는 길지만 핵심 엔진 함수만 보면 이렇다.

```python
import numpy as np
from PIL import Image
from pyxelate import Pyx
from pyxelate.pal import BasePalette

def engine_pyxelate(img, target_size, palette, auto_colors, dither, alpha):
    w, h = img.size
    tw, th = target_dims(w, h, target_size)

    img_rgba = img.convert("RGBA")
    rgb_arr = np.array(img_rgba.convert("RGB"))
    alpha_arr = np.array(img_rgba.split()[3])

    if palette is None:
        pal_param = auto_colors               # 색상 수만 넘기면 자동 추출
    elif isinstance(palette, list):
        pal_param = BasePalette.from_rgb(palette)  # 내 .hex 파일
    else:
        pal_param = palette                   # Pyxelate 내장 Pal 멤버

    pyx = Pyx(height=th, width=tw, palette=pal_param, dither=dither, alpha=alpha)
    pyx.fit(rgb_arr)
    result_rgb = pyx.transform(rgb_arr)
    if result_rgb.dtype != np.uint8:
        result_rgb = (result_rgb * 255).clip(0, 255).astype(np.uint8)

    # Pyxelate는 RGB만 다루니까 알파 채널은 따로 다운샘플 + 이진화
    result_pil = Image.fromarray(result_rgb, mode="RGB").convert("RGBA")
    alpha_img = Image.fromarray(alpha_arr, mode="L").resize(
        (tw, th), Image.Resampling.NEAREST
    )
    thresh = int(alpha * 255)
    alpha_bin = alpha_img.point(lambda p: 255 if p >= thresh else 0, mode="L")
    result_pil.putalpha(alpha_bin)
    return result_pil
```

몇 가지 포인트.

**알파 채널을 따로 처리하는 이유.** Pyxelate는 RGB numpy 배열만 받는다. RGBA를 통째로 넘기면 알파 정보가 사라진다. 그래서 RGB는 Pyxelate에 돌리고, 알파는 같은 크기로 nearest-neighbor 리사이즈한 뒤 임계값 기준으로 0/255로 이진화해서 붙인다. 픽셀아트는 반투명을 거의 안 쓰니까 이진 알파가 자연스러움.

**팔레트 파라미터가 세 가지 형태를 받을 수 있다.**
- `int` — 색상 수만 넘기면 이미지에서 자동 추출
- `numpy.ndarray` — 직접 만든 팔레트 (`.hex` 파일 → `BasePalette.from_rgb()`)
- `Pal.PICO_8` 같은 내장 enum 멤버

내 파이프라인에서는 유저가 `-p db32`라고 쓰면 로컬 `.hex` 파일을 읽어서 numpy로 변환하고, `-p PICO_8`처럼 대문자로 쓰면 Pyxelate 내장 enum을 찾아감

### 배경 제거 붙이기

rembg는 간단하다. 세션 하나 만들어두고 재사용하면 배치 처리 시 효율적

```python
from rembg import remove, new_session

_bg_session = None

def remove_background(img: Image.Image, model_name: str = "u2net") -> Image.Image:
    global _bg_session
    if _bg_session is None:
        _bg_session = new_session(model_name)
    result = remove(img, session=_bg_session)
    return result.convert("RGBA") if result.mode != "RGBA" else result
```

모델은 `u2net`(기본, 일반 객체), `u2net_human_seg`(사람 전용, 경계가 훨씬 깔끔), `isnet-general-use`(더 최신), `sam`(Segment Anything) 같은 것들을 골라 쓸 수 있다. 캐릭터 뽑을 땐 `u2net_human_seg` 추천

파이프라인 전체 순서는 이렇게 된다.

```
입력 이미지
  → (옵션) rembg로 배경 제거
  → Pyxelate 엔진 (Sobel + SVD + 팔레트 양자화)
  → 알파 이진화
  → PNG 저장 (저해상도 + 8x 업스케일 프리뷰)
  → Aseprite CLI 호출 → .aseprite 저장
```

### 디렉토리 구조

```
pixelart-pipeline/
├── pixelate.py          # 메인 스크립트
├── palettes/
│   ├── db32.hex         # DawnBringer 32
│   ├── pico8.hex
│   └── nes.hex
├── input/               # Gemini 이미지 여기에
└── output/
```

`.hex` 팔레트 파일 포맷은 아주 단순하다. 한 줄에 `RRGGBB` 하나씩.

```
000000
222034
45283c
663931
...
```

## Part 3. 실전 워크플로우

이제 실제로 돌려보는 보겠~

### Step 1: Gemini에서 이미지 뽑기

그냥 아무 이미지나 프롬프트 넣고 "pixel art style[주제]" 로 이미지를 생성한다. 나노바나나는 픽셀아트 프롬프트를 꽤 잘 따르는 편인가? 이건 잘 모르겠음.
저장한 파일을 `input/` 폴더에 넣는다.

### Step 2: 파이프라인 돌리기

```bash
cd E:\aseprite\pixelart-pipeline
python pixelate.py input\gemini_hero.png --bg-remove
```

기본값은 DB32 팔레트, 64픽셀 (긴 변 기준), u2net 배경 제거. 첫 실행 시 u2net 모델 176MB가 다운로드된다. 이후엔 캐시돼서 즉시 동작

출력은 세 개

```
output/gemini_hero_64x64.png           ← 진짜 64x64 픽셀아트
output/gemini_hero_64x64_x8.png        ← 512x512 미리보기 (8배 업스케일)
output/gemini_hero_64x64.aseprite      ← Aseprite에서 바로 열리는 파일
```

![3개](/assets/images/ai-gemini-aseprite-pixelart-pipeline/monggu03.png)

### Step 3: 옵션 조합

실제로 써보면 이미지마다 잘 맞는 조합이 다르다.

```bash
# 캐릭터 뽑을 때 (사람 전용 세그멘테이션 모델)
python pixelate.py input\char.png --bg-remove --bg-model u2net_human_seg

# 레트로 느낌 (Gameboy 팔레트 + Bayer 디더)
python pixelate.py input\scene.png -p GAMEBOY_POCKET -d bayer

# 32x32 작은 아이콘
python pixelate.py input\icon.png -s 32 -p PICO_8 -d atkinson

# 이미지 색감 그대로 유지 (고정 팔레트 없이 자동 24색)
python pixelate.py input\scene.png -p auto -c 24
```

디더링 옵션은 `none`, `naive`, `bayer`, `floyd`, `atkinson` 다섯 가지. 내 경험상:

- **bayer**: 고전 레트로 느낌, PICO-8이나 Gameboy 같은 작은 팔레트랑 잘 어울린다
- **floyd/atkinson**: 디테일을 더 보존한다. 대신 노이즈가 좀 낀다
- **none**: 색 블록이 깔끔하게 나뉘어서 현대적인 픽셀아트에 맞다

`--alpha` 값은 배경 제거 후 어디까지 투명으로 자를지 결정한다. 기본 0.6이 보통 적당하고, 머리카락이나 안테나 같은 얇은 디테일이 날아가면 0.4로 내리고, 반대로 배경 찌꺼기(halo)가 남으면 0.8로 올린다.

### Step 4: Aseprite에서 터치업

파이프라인이 만드는 건 "기계가 만든 픽셀아트"다. 전체 톤이나 실루엣은 맞지만 눈, 입, 엣지 같은 결정적인 1~2픽셀은 사람이 직접 잡아야 한다. `.aseprite` 파일을 GUI로 열어서 마지막 손질
요건 개발자가 할 수 있잖어~

```bash
E:\aseprite\Aseprite-v1.3.17-Source\build\bin\aseprite.exe output\gemini_hero_64x64.aseprite
```

이 단계에서 픽셀 단위 수정을 하고 저장하면 `.aseprite` 포맷 그대로 유지된다. PNG로 export도 가능.

![수정중](/assets/images/ai-gemini-aseprite-pixelart-pipeline/monggu04.png)

다음에 시간이 나면 추가해볼 만한 것들:

- **스프라이트시트 모드** — 한 캐릭터의 여러 포즈를 한 `.aseprite` 파일에 프레임으로 묶기 (Aseprite CLI에 `--sheet` 옵션 있음)
- **아웃라인 자동 생성** — Pyxelate 후처리로 1픽셀 검은 아웃라인 추가 (Aseprite의 `Outline` 커맨드 Lua로 호출 가능)
- **고정 팔레트 미리 최적화** — 입력 이미지의 주요 색상을 분석해서 DB32/PICO-8 중 가장 덜 손해 보는 팔레트 자동 선택

일단은 여기까지.

---

파이프라인 코드는 GitHub에 올려두었다: [keemminxu/pixelart-pipeline](https://github.com/keemminxu/pixelart-pipeline)
