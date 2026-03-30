---
layout: post
title: "서버 API를 UE5 C++로 자동 변환하기 - 백엔드와 협업할 때 연동 코드를 직접 안 짜는 법"
title_en: "Auto-converting Server APIs to UE5 C++ - Eliminating Manual Network Code When Collaborating with Backend"
excerpt_en: "How we built a Python-based pipeline that auto-generates Unreal Engine 5 USTRUCT definitions and API request functions from OpenAPI/Swagger specs, eliminating manual network code integration."
date: 2026-03-30 18:00:00 +0900
categories: [unreal-engine]
tags: [swagger, openapi, code-generation, python, cpp, network-api]
excerpt: "서버 개발자가 Swagger를 업데이트하면 bat 파일 하나로 UE5 C++ 네트워크 코드가 전부 생성되는 시스템을 만들었다. 구조체, API 함수, 델리게이트까지 전부 자동이다."
---

서버 개발자가 API를 만들면 클라이언트 개발자가 해야 할 일이 뭘까? 보통은 API 문서를 읽고, 요청/응답 구조체를 만들고, HTTP 호출 코드를 작성하고, JSON 파싱 로직을 넣는다. API가 50개면 이걸 50번 반복한다.

우리 프로젝트에서는 이 과정을 전부 자동화했다. 서버 개발자가 Swagger를 업데이트하면, 클라이언트에서는 bat 파일 하나만 돌리면 된다. USTRUCT 정의, API 요청 함수, 응답 핸들러까지 전부 생성된다. Blueprint에서도 바로 쓸 수 있다.

## 전체 구조

```
서버 개발자: API 개발 → Swagger(OpenAPI) 문서 업데이트
                            ↓
                   OpenAPI JSON (4개 서비스)
                            ↓
                  ┌── Generate.bat ──┐
                  │                  │
                  ▼                  ▼
         StructGenerator.py    ApiGenerator.py
          (구조체 생성)          (API 함수 생성)
                  │                  │
                  ▼                  ▼
       FNetworkStructures.h   GeneratedNetworkAPIBase.h/.cpp
                  │                  │
                  └────────┬─────────┘
                           ▼
                    HttpService.cpp
                  (HTTP 통신 + 암호화)
                           ▼
                 BP / C++ 어디서든 호출
```

파이프라인은 크게 세 단계다:

1. **Swagger JSON을 가져와서 파싱** (JsonParser.py)
2. **USTRUCT 구조체 코드 생성** (StructGenerator.py)
3. **API 요청/응답 함수 코드 생성** (ApiGenerator.py)

엔트리 포인트인 `Generate.bat`이 이 세 단계를 순서대로 실행한다.

```batch
python StructGenerator.py d        # 구조체 생성 (d = dev 서버)
timeout /t 2 /nobreak >nul         # Rate Limit 대기
python ApiGenerator.py d           # API 함수 생성
```

마지막 인자 `d`는 서버 환경이다. `d`(dev), `s`(staging), `r`(release) 중 하나를 넣으면 해당 환경의 Swagger를 읽어온다.

## 1단계: Swagger JSON 파싱

`JsonParser.py`가 OpenAPI 스펙에서 두 가지를 추출한다.

**스키마(구조체 정의)와 경로(API 엔드포인트).**

타입 변환 규칙은 단순하다:

| OpenAPI Type | UE5 C++ Type |
|---|---|
| `string` | `FString` |
| `integer` (int32) | `int32` |
| `integer` (int64) | `int64` |
| `number` | `float` |
| `boolean` | `bool` |
| `array<T>` | `TArray<T>` |
| `object` (additionalProperties) | `TMap<FString, T>` |
| `$ref` | 해당 USTRUCT 참조 |

`$ref`로 다른 스키마를 참조하면 재귀적으로 파싱한다. 중첩 구조체가 있어도 알아서 의존 순서를 맞춰준다.

여기서 좀 신경 쓴 부분이 **페이징 자동 감지**다. 구조체 필드에 `pageNo` + `pagingRow`가 있으면 `FDtoPage`를 상속하고, `latestId` + `pagingRow`가 있으면 `FDtoScroll`을 상속하도록 했다. 서버 쪽 페이징 방식에 따라 클라이언트 구조체가 자동으로 맞춰지는 거다.

## 2단계: 구조체 자동 생성

`StructGenerator.py`가 파싱된 스키마를 가지고 `FNetworkStructures.h` 파일을 통째로 생성한다.

Swagger에 이런 스키마가 있다고 하면:

```json
{
  "ResUser": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "age": { "type": "integer", "format": "int32" }
    }
  }
}
```

이게 이렇게 변환된다:

```cpp
USTRUCT(BlueprintType)
struct FResUser
{
    GENERATED_BODY()

    FResUser()
        : id("")
        , name("")
        , age(0)
    {}

    FResUser(const FString& InId, const FString& InName, int32 InAge)
        : id(InId)
        , name(InName)
        , age(InAge)
    {}

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString id;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 age;
};
```

몇 가지 포인트:

- **기본 생성자와 파라미터 생성자** 둘 다 만든다. Blueprint에서는 기본 생성자를, C++에서는 파라미터 생성자를 쓸 수 있다.
- `FString` 같은 복합 타입은 `const FString&`로 받고, `int32`나 `bool` 같은 원시 타입은 값으로 받는다.
- `UPROPERTY(EditAnywhere, BlueprintReadWrite)`라서 Blueprint에서 바로 접근 가능하다.
- 각 구조체 위에 해당 API 경로가 주석으로 붙는다. 이 구조체가 어디서 쓰이는지 바로 알 수 있다.

파일 맨 위에는 기본 구조체들도 같이 생성한다:

```cpp
struct FResError { int32 status; FString message; };
struct FDtoPage { int32 pageNo; int32 pagingRow; };        // 페이지 기반
struct FDtoScroll { FString latestId; int32 pagingRow; };   // 스크롤 기반
struct FPageableData : public FDtoPage {                     // 응답용 페이지 정보
    int32 totalPage; int64 totalRow; bool isFirst; bool isLast;
};
```

## 3단계: API 함수 자동 생성

`ApiGenerator.py`가 OpenAPI의 `paths` 섹션을 읽어서 `GeneratedNetworkAPIBase.h/.cpp`를 생성한다.

각 엔드포인트마다 세 가지가 만들어진다:

1. **델리게이트 타입** - 응답 콜백 시그니처
2. **Request 함수** - HTTP 요청 발신
3. **OnReceived 함수** - 응답 수신 + 파싱

### 응답 유형별 델리게이트

서버 응답 구조를 분석해서 4가지 유형으로 분류한다:

```cpp
// 단일 객체 응답
DECLARE_DYNAMIC_DELEGATE_ThreeParams(
    FOnGenReceive_FindMyspace_Completed,
    FResMyspace, Result,
    const FString&, Message,
    bool, Success);

// 배열 응답 (페이징 없음)
DECLARE_DYNAMIC_DELEGATE_ThreeParams(
    FOnGenReceive_GetSnsLinks_Completed,
    const TArray<FResSnsLinkList>&, ResultList,
    const FString&, Message,
    bool, Success);

// 배열 응답 (페이징 있음)
DECLARE_DYNAMIC_DELEGATE_FourParams(
    FOnGenReceive_GetPosts_Completed,
    const TArray<FResPost>&, ResultList,
    FPageableData, ResPage,
    const FString&, Message,
    bool, Success);

// 메시지만 (데이터 없음)
DECLARE_DYNAMIC_DELEGATE_TwoParams(
    FOnGenReceive_DeletePost_Completed,
    const FString&, Message,
    const bool, Success);
```

이 분류가 자동으로 이뤄진다. Swagger 응답 스키마에서 `data` 필드 타입을 보고 Object면 단일 객체, Array면 배열, 스키마 이름에 "page"가 들어가면 페이징 배열, `data` 필드가 없으면 메시지만.

### Request 함수

실제 생성되는 코드를 보면:

```cpp
// GET /member-api/terms/res/marketing/agree
void UGeneratedNetworkAPIBase::Request_CheckMarketingAgree(
    FOnGenReceive_CheckMarketingAgree_Completed Callback)
{
    const FString Url = TEXT("/member-api/terms/res/marketing/agree");
    FNetworkApiResponse ApiDelegate;
    ApiDelegate.BindUFunction(this, TEXT("OnReceived_CheckMarketingAgree"));
    UHttpService::RequestNetworkApi(
        EHttpRequestType::GET, Url, TEXT(""), ApiDelegate, false);
    OnCheckMarketingAgreeReceiveCompleted.Clear();
    OnCheckMarketingAgreeReceiveCompleted = Callback;
}
```

POST 요청에 Body가 필요하면 `FJsonObjectConverter::UStructToJsonObjectString()`으로 자동 직렬화한다:

```cpp
// PUT /member-api/terms/res/marketing/agree
void UGeneratedNetworkAPIBase::Request_CreateTerms(
    FReqMarketingApproveTerms ReqBody,
    FOnGenReceive_CreateTerms_Completed Callback)
{
    const FString Url = TEXT("/member-api/terms/res/marketing/agree");
    FString BodyString{};
    FJsonObjectConverter::UStructToJsonObjectString(
        FReqMarketingApproveTerms::StaticStruct(), &ReqBody, BodyString);
    // ... HTTP 요청 발신
}
```

Path 파라미터가 있으면 `FString::Printf()`로 URL에 치환하고, Query 파라미터는 `?key=value&` 형태로 붙인다.

### 응답 핸들러: 매크로로 보일러플레이트 제거

OnReceived 함수는 응답 유형마다 패턴이 똑같다. JSON 파싱하고, 성공이면 구조체로 변환해서 콜백 실행하고, 실패면 에러 메시지 파싱해서 콜백 실행하고. 이걸 매크로 4개로 정리했다.

```cpp
// cpp 파일에서는 이렇게 한 줄이면 끝
IMPLEMENT_API_RECEIVED_MESSAGE(CheckMarketingAgree)
IMPLEMENT_API_RECEIVED_OBJECT(FindMyspace, ResMyspace)
IMPLEMENT_API_RECEIVED_ARRAY(GetSnsLinks, ResSnsLinkList)
IMPLEMENT_API_RECEIVED_ARRAY_PAGED(GetPosts, ResPost)
```

매크로 내부는 이런 구조다 (단일 객체 기준):

```cpp
#define IMPLEMENT_API_RECEIVED_OBJECT(Name, ResponseType) \
void UGeneratedNetworkAPIBase::OnReceived_##Name(                  \
    const FString& Response, FPageableData Page, bool Success)     \
{                                                                   \
    F##ResponseType Result{};                                       \
    FString ErrorMessage{};                                         \
    if (!Success) {                                                 \
        TryParseErrorMessage(Response, ErrorMessage);               \
        On##Name##ReceiveCompleted.ExecuteIfBound(                  \
            Result, ErrorMessage, false);                           \
        return;                                                     \
    }                                                               \
    if (FJsonObjectConverter::JsonObjectStringToUStruct<            \
            F##ResponseType>(Response, &Result)) {                  \
        On##Name##ReceiveCompleted.ExecuteIfBound(                  \
            Result, FString{}, true);                               \
        return;                                                     \
    }                                                               \
    // 파싱 실패 처리 ...                                             \
}
```

이 매크로들은 `NetworkAPIHelperMacros.h`에 있고, 수동으로 관리하는 유일한 파일이다. 생성된 코드가 이 매크로를 참조하는 구조라서, 응답 처리 로직을 바꾸고 싶으면 매크로만 수정하면 모든 API에 일괄 적용된다.

## HttpService: 공통 통신 레이어

생성된 API 함수들은 전부 `UHttpService::RequestNetworkApi()`를 거친다. 이 레이어에서 처리하는 것들:

- **서버 라우팅**: URL 패턴을 보고 Member API, Gateway, Vibe API 서버 중 어디로 보낼지 결정
- **인증 토큰 주입**: 로그인/게스트 토큰 요청을 제외하고 자동으로 Bearer 토큰 헤더 추가
- **암호화/복호화**: 서버와 합의된 방식으로 요청 Body를 암호화하고 응답을 복호화
- **페이지 정보 추출**: 응답 JSON에서 `page` 객체를 자동으로 분리해서 `FPageableData`로 전달

생성된 코드 입장에서는 이런 걸 전혀 신경 쓸 필요가 없다. URL과 Body만 넘기면 된다.

## 설정으로 제어하기

모든 API를 자동 생성하면 기존 수동 구현과 충돌이 생길 수 있다. `ApiConfig.json`으로 이걸 제어한다:

```json
{
    "exclude_urls": [
        "/lgn/",                    // 로그인은 수동 구현
        "/member-api/iap/",         // IAP도 수동
        "/member-api/v5/character"  // 레거시 API 제외
    ],
    "exclude_operation_ids": [
        "uploadCharacterImage",     // 파일 업로드는 별도 처리
        "loginMember"
    ],
    "name_overrides": {},           // 함수명 커스터마이징
    "force_vibe_api": [],           // 서버 라우팅 강제 지정
    "force_no_vibe_api": []
}
```

로그인이나 파일 업로드처럼 특수한 처리가 필요한 API는 제외하고 수동으로 구현한다. 나머지 일반적인 CRUD API는 전부 자동 생성으로 처리한다.

## 실제 사용하는 모습

이 시스템을 쓰면 클라이언트 개발자가 API 연동할 때 하는 일이 이거다:

```
1. Generate.bat 실행 (10초)
2. 에디터에서 컴파일
3. Blueprint나 C++에서 Request_함수명() 호출
```

C++에서 호출하면:

```cpp
// Subsystem 가져오기
auto* API = GetGameInstance()->GetSubsystem<UGeneratedNetworkAPIBase>();

// API 호출 - 델리게이트 바인딩
FOnGenReceive_FindMyspace_Completed Callback;
Callback.BindDynamic(this, &UMyClass::OnMyspaceReceived);
API->Request_FindMyspace(MyspaceId, Callback);

// 응답 핸들러
void UMyClass::OnMyspaceReceived(FResMyspace Result, const FString& Message, bool Success)
{
    if (Success)
    {
        // Result.필드명으로 바로 접근
    }
}
```

Blueprint에서도 `Request_` 노드를 검색해서 붙이고, 커스텀 이벤트에 델리게이트를 연결하면 끝이다.

## 정리

이 시스템의 핵심은 **생성 코드와 수동 코드의 경계를 명확히 나눈 것**이다.

- **전부 자동**: 구조체 정의, Request 함수, 델리게이트 타입, OnReceived 함수 시그니처
- **수동 관리**: 응답 파싱 매크로 (`NetworkAPIHelperMacros.h`), HTTP 통신 레이어 (`HttpService`), 제외 설정 (`ApiConfig.json`)

자동 생성 파일은 건드릴 일이 없고, 동작 방식을 바꾸고 싶으면 매크로나 HttpService만 수정하면 된다.

서버 API가 바뀌면? bat 파일 한번 돌리면 끝이다. 구조체 필드가 바뀌어도, 새 API가 추가되어도, 응답 형식이 달라져도 다 자동으로 반영된다. 클라이언트 개발자가 API 연동에 쓰는 시간이 거의 0에 가까워졌다.
