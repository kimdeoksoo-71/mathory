## H — Firebase Storage CORS 설정 방법

인라인 SVG는 `fetch`로 다른 origin의 파일을 가져오므로 CORS 헤더가 필요해. 절차:

### 1. gsutil 설치 확인



```bash
gsutil --version
```

없으면 [Google Cloud SDK 설치](https://cloud.google.com/sdk/docs/install) (Mac은 `brew install --cask google-cloud-sdk`).

### 2. Firebase 프로젝트 인증



```bash
gcloud auth login
gcloud config set project <FIREBASE_PROJECT_ID>
```

프로젝트 ID는 Firebase 콘솔 → 프로젝트 설정에서 확인.

### 3. CORS 설정 파일 작성 — 프로젝트 루트에 `cors.json`



```json
[
  {
    "origin": [
      "http://localhost:3000",
      "https://mathory.vercel.app",
      "https://*.vercel.app"
    ],
    "method": ["GET"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type"]
  }
]
```

(실제 배포 도메인 정확히 입력 필요. 커스텀 도메인 있으면 추가)

### 4. 버킷에 적용

⚠️ **2024 이후 새로 만든 Firebase 프로젝트는 버킷 이름이 `<project-id>.firebasestorage.app`** (구 `.appspot.com` 아님).
정확한 이름은 `gsutil ls -p <project-id>` 또는 Firebase 콘솔 → Storage 상단에서 확인.

Mathory의 경우: `gs://mathory-d7d03.firebasestorage.app`

```bash
gsutil cors set cors.json gs://<BUCKET_NAME>
```

### 5. 확인

```bash
gsutil cors get gs://<BUCKET_NAME>
```

### 알려진 함정

- 잘못된 버킷 이름(`.appspot.com` 대신 실제 이름이 `.firebasestorage.app`)에 적용하면 `gsutil`이 "BucketNotFoundException" 같은 에러 없이 조용히 실패하지 않고 명확히 알려주지만, **fetch는 일부 케이스에서 우연히 동작할 수 있어** 잘못된 버킷에 적용해도 한참 후에야 발견될 수 있음.
- CORS 응답은 브라우저가 maxAgeSeconds 동안 캐시하므로, 변경 후엔 하드 리프레시(Cmd+Shift+R) 권장.

`cors.json`은 작업용 파일이므로 `.gitignore`에 추가하거나 `docs/`에 둘 것.