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



```bash
gsutil cors set cors.json gs://<FIREBASE_PROJECT_ID>.appspot.com
```

버킷 이름은 Firebase 콘솔 → Storage 상단에 표시됨 (보통 `<project-id>.appspot.com`).

### 5. 확인



```bash
gsutil cors get gs://<FIREBASE_PROJECT_ID>.appspot.com
```

`cors.json`은 작업용 파일이므로 `.gitignore`에 추가하거나 `docs/`에 둘 것.