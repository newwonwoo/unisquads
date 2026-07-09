# addr-refine — Vercel 완전 올인원

주소 정제(지번·도로명·PNU·건물관리번호) + 등기고유번호 조회를 URL 하나로.
로컬 실행 없음. GitHub 푸시 → Vercel 자동배포 → 폰에서 바로 사용.

## 구조
```
addr-refine-vercel/
  public/
    index.html      웹앱 화면
    app.js          번들된 프론트(정제 UI + 등기조회)
  api/
    resolve.py      등기고유번호 조회 (iros_api 사용)
    juso.py         도로명주소 검색 프록시 (키 서버보관)
    kakao.py        카카오 키워드·좌표 프록시
    iros_api.py     IROS 검색 API 직결 리졸버
    iros_resolver.py 시/도 매핑·데이터클래스
  vercel.json       라우팅·파이썬 런타임
  requirements.txt  requests
```

## 배포 (3단계)

### 1. GitHub에 올리기
이 폴더를 newwonwoo 계정의 새 레포로 push
(ltvcheck·sellingpoint와 동일한 방식)
```
git init
git add .
git commit -m "addr-refine vercel all-in-one"
git remote add origin https://github.com/newwonwoo/addr-refine.git
git push -u origin main
```

### 2. Vercel에서 Import
- vercel.com → Add New → Project → 그 GitHub 레포 선택
- Framework Preset: **Other** (빌드 명령 없음, public/ 정적 서빙)
- Deploy

### 3. 환경변수 설정 (Vercel 대시보드 → Settings → Environment Variables)
| 이름 | 값 | 용도 |
|---|---|---|
| `JUSO_CONFM_KEY` | 도로명주소 API 승인키 | 정제(juso) |
| `KAKAO_REST_KEY` | 카카오 REST 키 | 정제(카카오 보완) |

설정 후 Redeploy 한 번. 끝.

## 사용
배포된 URL 열기 → 주소 입력 → 정제 결과(PNU 등) 표시 →
"등기고유번호 조회" 누르면 IROS에서 14자리 조회.
일괄: 엑셀 업로드 → 일괄 정제 → 등기 일괄조회 → 등기고유번호 포함 엑셀 다운로드.

## 등기고유번호가 ERROR로 뜨면
IROS 세션을 서버리스(requests)가 못 받은 경우입니다. 이때만 대안 필요:
- EC2 브리지(RPA 방식) 배포 후, 웹앱 ⚙ 설정의 BRIDGE_URL에 그 주소 입력
- (iros-resolver 패키지의 deploy/setup_ec2.sh 참고)
- 정제 기능은 세션과 무관하게 항상 동작합니다.

## 비용
- Vercel: 무료 티어
- juso·카카오·IROS 검색: 전부 무료 구간
