# addr-refine — Vercel 완전 올인원

> **작업을 이어받는 사람은 [`인수인계.md`](인수인계.md)를 먼저 읽어라.**
> 무엇이 측정으로 확인됐고 무엇이 아직 가설인지, 다음에 뭘 해야 하는지가 거기에 있다.

주소 정제(지번·도로명·PNU·건물관리번호) + 등기고유번호 조회를 URL 하나로.
로컬 실행 없음. GitHub 푸시 → Vercel 자동배포 → 폰에서 바로 사용.

## 구조
```
addr-refine-vercel/
  public/
    index.html      웹앱 화면
    app.js          오케스트레이션·정제 UI·등기조회
    pipeline-contract.mjs        주소 성공값 잠금·버전 계약
    failure-recovery-plan.mjs    실패 분류·선택 재처리·확정금지 판정
    confirmed-unit-recovery.mjs  PNU 확정 후 원문 동·층·호 구조 복구
    address-*.mjs                주소 정제·복구 규칙
    unit-match.mjs               IROS 후보·동호 매칭 규칙
    iros-run-contract.mjs        IROS 실행·재개·성공값 잠금
  api/
    resolve.py      등기고유번호 조회 (iros_api 사용)
    juso.py         도로명주소 검색 프록시 (키 서버보관)
    naver.py        네이버 지역검색 프록시
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
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 검색 API 키 | 건물명 보조검색 |

설정 후 Redeploy 한 번. 끝.

## 사용
배포된 URL 열기 → 주소 입력 → 정제 결과(PNU 등) 표시 →
"등기고유번호 조회" 누르면 IROS에서 14자리 조회.
일괄: 엑셀 업로드 → 일괄 정제 → 등기 일괄조회 → 등기고유번호 포함 엑셀 다운로드.

## 판정 계약

- 목표 성공률을 맞추기 위해 후보를 임의 선택하지 않습니다.
- 주소는 검증된 단일 PNU, IROS는 완전응답에서 한 고유번호로 수렴할 때만 확정합니다.
- 기존 확정 PNU와 IROS 고유번호는 입력·근거가 바뀌지 않는 한 잠급니다.
- 실패행은 `AUTO_RETRY`, `INPUT_REQUIRED`, `FAIL_AMBIGUOUS`,
  `FAIL_UNIDENTIFIABLE`로 분리해 결과 파일의 `처리판정`과 `복구모듈`에 기록합니다.
- 오염·정보부족·근거충돌 행은 성공률을 높이기 위해 추정하지 않고 실패로 남깁니다.

## 등기고유번호가 ERROR로 뜨면
IROS 세션을 서버리스(requests)가 못 받은 경우입니다. 이때만 대안 필요:
- EC2 브리지(RPA 방식) 배포 후, 웹앱 ⚙ 설정의 BRIDGE_URL에 그 주소 입력
- (iros-resolver 패키지의 deploy/setup_ec2.sh 참고)
- 정제 기능은 세션과 무관하게 항상 동작합니다.

## 비용
- Vercel: 무료 티어
- JUSO·네이버·IROS 검색: 각 서비스 정책 범위 내
