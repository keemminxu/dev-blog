---
layout: post
title: "UE5 HTTP 서비스에서 Multipart/form-data 파일 업로드 구현하기"
date: 2026-02-04 00:00:00 +0900
categories: [unreal-engine]
tags: [ue5, http, multipart, file-upload, cpp, mobile]
excerpt: "Unreal Engine 5의 IHttpRequest로 multipart/form-data 바이너리 파일 업로드를 구현하는 방법. Boundary 생성부터 바이너리 조립, 응답 처리, 실전 트러블슈팅까지 다룬다."
---

## 배경

UE5로 모바일 게임을 개발하다 보면 서버에 이미지를 업로드해야 하는 상황이 자주 생긴다. 프로필 사진, 캐릭터 커스텀 이미지, 사용자 생성 콘텐츠 등. REST API에서 파일 업로드의 표준은 `multipart/form-data`인데, UE5의 `FHttpModule`은 JSON 기반 요청에는 익숙하지만 멀티파트 바이너리 업로드를 직접 지원하지 않는다.

이 글에서는 UE5의 `IHttpRequest`를 사용해 multipart/form-data 파일 업로드를 구현하는 방법을 정리한다.

## multipart/form-data 구조 이해

멀티파트 요청의 핵심은 **Boundary**다. HTTP Body 안에서 각 파트를 구분하는 구분자 역할을 한다. 실제 HTTP 요청은 이런 형태가 된다:

```
POST /api/upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="character.png"
Content-Type: image/png

<바이너리 데이터>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

구조를 분해하면:
1. **Boundary 선언** — `Content-Type` 헤더에 boundary 값을 명시
2. **Part Header** — `--{boundary}\r\n` + `Content-Disposition` + `Content-Type` + 빈 줄
3. **Part Body** — 실제 파일 바이너리 데이터
4. **Part Footer** — `\r\n--{boundary}--\r\n` (마지막 boundary에 `--` 추가)

## UE5 구현

### 함수 선언

기존 HTTP 서비스 클래스에 멀티파트 전용 함수를 추가한다.

```cpp
// HttpService.h
UFUNCTION(BlueprintCallable, Category = "Network|Http")
static void RequestMultipartUpload(
    const FString& Url,
    const TArray<uint8>& FileData,
    const FString& FileName,
    const FString& MimeType,
    const FNetworkApiResponse Response,
    bool bUseVibeApi = false);
```

파라미터 설계 포인트:
- `FileData`를 `TArray<uint8>`로 받아서 이미 메모리에 로드된 바이너리를 그대로 전달
- `MimeType`을 외부에서 지정할 수 있게 하되, 호출부에서 확장자 기반 추론도 가능
- 기존 JSON 요청과 동일한 `FNetworkApiResponse` 델리게이트를 재사용

### 핵심 구현

```cpp
void UHttpService::RequestMultipartUpload(
    const FString& Url,
    const TArray<uint8>& FileData,
    const FString& FileName,
    const FString& MimeType,
    const FNetworkApiResponse Response,
    bool bUseVibeApi)
{
    UHttpService* Agent = NewObject<UHttpService>();
    Agent->NetworkApiResponse = Response;
    FString ServerUrl = Agent->ClassifyByUrl(Url, bUseVibeApi);

    TSharedRef<IHttpRequest> HttpRequest = FHttpModule::Get().CreateRequest();
    HttpRequest->SetVerb(TEXT("POST"));

    // Authorization
    FString AccessToken = USuperPlatNetworkSubsystem::This().GetAccessToken();
    if (!AccessToken.IsEmpty())
    {
        HttpRequest->SetHeader(TEXT("Authorization"),
            FString::Printf(TEXT("Bearer %s"), *AccessToken));
    }

    // 1. Boundary 생성 — GUID로 유니크한 값 보장
    const FString Boundary = FString::Printf(
        TEXT("----WebKitFormBoundary%s"),
        *FGuid::NewGuid().ToString(EGuidFormats::Digits));

    // 2. Content-Type 헤더
    HttpRequest->SetHeader(TEXT("Content-Type"),
        FString::Printf(TEXT("multipart/form-data; boundary=%s"), *Boundary));

    // 파일 업로드는 타임아웃을 넉넉하게
    HttpRequest->SetTimeout(TIMEOUT_INTERVAL * 3);

    // 3. Body 조립 — TArray<uint8>에 텍스트와 바이너리를 순서대로 Append
    TArray<uint8> RequestContent;

    // Part Header (텍스트 → UTF8 바이너리 변환)
    FString PartHeader = FString::Printf(
        TEXT("--%s\r\n"
             "Content-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\n"
             "Content-Type: %s\r\n\r\n"),
        *Boundary, *FileName, *MimeType);

    FTCHARToUTF8 PartHeaderUtf8(*PartHeader);
    RequestContent.Append(
        (const uint8*)PartHeaderUtf8.Get(), PartHeaderUtf8.Length());

    // File Data (바이너리 그대로)
    RequestContent.Append(FileData);

    // Part Footer
    FString PartFooter = FString::Printf(TEXT("\r\n--%s--\r\n"), *Boundary);
    FTCHARToUTF8 PartFooterUtf8(*PartFooter);
    RequestContent.Append(
        (const uint8*)PartFooterUtf8.Get(), PartFooterUtf8.Length());

    HttpRequest->SetContent(RequestContent);
    HttpRequest->SetURL(ServerUrl + Url);

    // GC 방지 (비동기 요청 중 Agent가 수거되지 않도록)
    Agent->AddToRoot();
    HttpRequest->OnProcessRequestComplete().BindUObject(
        Agent, &UHttpService::OnMultipartUploadCompletedEvent);
    HttpRequest->ProcessRequest();
}
```

### 주의할 점

**FTCHARToUTF8 변환이 핵심이다.** UE의 `FString`은 내부적으로 UTF-16이므로, HTTP Body에 그대로 넣으면 서버가 파싱하지 못한다. `FTCHARToUTF8`로 변환한 후 `Get()`으로 raw 포인터를, `Length()`로 바이트 길이를 얻어서 `TArray<uint8>`에 Append한다.

**GC 방지도 중요하다.** `NewObject<UHttpService>()`로 생성한 Agent는 UE의 가비지 컬렉터에 의해 수거될 수 있다. 비동기 HTTP 요청이 완료되기 전에 수거되면 크래시가 발생하므로, `AddToRoot()`로 루트 레퍼런스를 잡아두고 응답 콜백에서 `RemoveFromRoot()`로 해제한다.

### 응답 처리

```cpp
void UHttpService::OnMultipartUploadCompletedEvent(
    const FHttpRequestPtr Request,
    const FHttpResponsePtr Response,
    bool bWasSuccessful)
{
    RemoveFromRoot(); // GC 방지 해제

    if (bWasSuccessful && Response.IsValid())
    {
        int32 ResponseCode = Response->GetResponseCode();
        FString Result = Response->GetContentAsString();

        if (ResponseCode >= 200 && ResponseCode < 300)
        {
            // 서버 응답의 "data" 필드 추출
            TSharedPtr<FJsonObject> JsonObject;
            TSharedRef<TJsonReader<TCHAR>> Reader =
                TJsonReaderFactory<TCHAR>::Create(Result);
            FJsonSerializer::Deserialize(Reader, JsonObject);

            TSharedPtr<FJsonValue> DataValue =
                JsonObject.IsValid()
                    ? JsonObject->TryGetField(TEXT("data"))
                    : nullptr;
            FString ConvertedValue =
                DataValue.IsValid()
                    ? ConvertJsonToString(DataValue)
                    : Result;

            NetworkApiResponse.ExecuteIfBound(
                ConvertedValue, FPageableData(), true);
        }
        else
        {
            // 에러 응답 파싱
            NetworkApiResponse.ExecuteIfBound(
                Result, FPageableData(), false);
        }
    }
    else
    {
        NetworkApiResponse.ExecuteIfBound(
            TEXT("Network Error"), FPageableData(), false);
    }
}
```

## API 레이어에서의 사용 예시

네트워크 서브시스템에서 이렇게 호출한다:

```cpp
void USuperPlatNetworkAPISubsystem::RequestPost_EpisodeUploadCharacterImage(
    const FString& ScenarioId,
    int32 CharacterIndex,
    const FString& StyleCode,
    const TArray<uint8>& ImageData,
    const FString& FileName,
    FOnReceiveEpisodeImageUploadCompleted Callback)
{
    const FString Url = FString::Printf(
        TEXT("/member-api/v5/episode/%s/characters/%d/image/upload?styleCode=%s"),
        *ScenarioId, CharacterIndex, *StyleCode);

    // MIME 타입 추론
    FString MimeType = TEXT("image/png");
    if (FileName.EndsWith(TEXT(".jpg")) || FileName.EndsWith(TEXT(".jpeg")))
        MimeType = TEXT("image/jpeg");
    else if (FileName.EndsWith(TEXT(".webp")))
        MimeType = TEXT("image/webp");

    FNetworkApiResponse UploadDelegate;
    UploadDelegate.BindUFunction(
        this, TEXT("OnReceived_EpisodeUploadCharacterImage"));
    UHttpService::RequestMultipartUpload(
        Url, ImageData, FileName, MimeType, UploadDelegate, true);

    OnEpisodeUploadCharacterImageReceiveCompleted = Callback;
}
```

## 실전 트러블슈팅

### 413 Request Entity Too Large

파일 업로드를 구현하고 나서 가장 먼저 만나는 에러가 **413**이다. 이건 코드 문제가 아니라 서버(nginx) 설정 문제다.

```
nginx: 413 Request Entity Too Large
```

nginx의 기본 `client_max_body_size`는 1MB로, 이미지 업로드에는 턱없이 부족하다. 서버 설정에서 늘려야 한다:

```nginx
# nginx.conf
client_max_body_size 20M;
```

### 응답 타입 불일치

업로드 API의 응답 구조체가 다른 API와 다를 수 있다. 예를 들어 일반적인 에피소드 API는 `FEpisodeCreationStatus`를 반환하지만, 이미지 업로드는 `FEpisodeImageResponse`(fileId, imageUrl 등)를 반환할 수 있다. 서버 API 스펙을 반드시 확인하고, 응답 콜백의 USTRUCT 타입을 맞춰야 한다.

```cpp
// 잘못된 예 — 업로드인데 CreationStatus로 파싱
FJsonObjectConverter::JsonObjectStringToUStruct<FEpisodeCreationStatus>(
    Response, &Result);

// 올바른 예 — 업로드 전용 응답 구조체 사용
FJsonObjectConverter::JsonObjectStringToUStruct<FEpisodeImageResponse>(
    Response, &Result);
```

## 정리

- UE5의 `IHttpRequest`는 멀티파트를 직접 지원하지 않지만, `TArray<uint8>`에 텍스트 헤더와 바이너리 데이터를 순서대로 조립하면 구현할 수 있다
- `FTCHARToUTF8`로 문자열을 UTF-8 바이너리로 변환하는 것이 핵심
- Boundary는 `FGuid::NewGuid()`로 유니크하게 생성
- 비동기 요청 중 GC에 수거되지 않도록 `AddToRoot()` / `RemoveFromRoot()` 패턴 필수
- 파일 업로드 시 타임아웃을 넉넉하게 설정 (기본의 2~3배)
- 서버 측 `client_max_body_size` 설정 확인은 배포 전 필수 체크리스트
