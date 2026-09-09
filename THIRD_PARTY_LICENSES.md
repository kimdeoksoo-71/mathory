# Third-Party Licenses

## Phosphor Icons

- 출처: https://phosphoricons.com · https://github.com/phosphor-icons/core
- 사용: `@phosphor-icons/core`(devDependency)에서 아이콘 path 데이터를 `components/ui/phosphorPaths.ts`로 생성해 사용 (개선묶음 M4). 런타임 의존성 없음.

## Pretendard (파비콘 글리프 출처)

- 출처: https://github.com/orioncactus/pretendard · SIL Open Font License 1.1
- 사용: `app/icon.svg`의 'M' 글자 형상이 Pretendard 1.3.9 SemiBold(600) 글리프에서 추출한 path다(개선묶음 M6 D15). 폰트 파일은 재배포하지 않으며 렌더된 글자 형상의 사용은 OFL이 허용한다(고지 의무 없음 — 출처만 기록). 앱 UI 글꼴로 쓰는 Pretendard는 jsDelivr CDN에서 로드한다(`app/layout.tsx`).

```
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
