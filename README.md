# ktl-flow-pi — A-1 접수대 라즈베리파이

담당 **희승** · 리뷰 짝 여준 · 과제 A(유속계 정도검사)

업체가 오면 작년 기기 정보를 바로 띄우고, (S) 서류 사진으로 대조하고, 실험 PC로 넘길 **QR**을 LCD에 띄운다. Pi는 어떤 네트워크에도 연결하지 않는다.

| 기준 문서 | |
|---|---|
| 요구사항 | [REQ-A1-01~10](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/01-요구사항명세.md#2-a-1-접수대-라즈베리파이--희승) |
| QR 계약 | [02 §4](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/02-API명세.md#4-qr-스키마-a-1--a-2) · [테스트 벡터](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/contracts/qr-test-vectors.json) |
| 화면 | [PI-01~06](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/03-UI시나리오.md#시나리오-a--유속계-접수부터-실험-pc-excel까지) |

## 구성 (제안)

```
backend/    FastAPI (127.0.0.1:8000) · SQLite(WAL) · segno(QR) · (S) picamera2 + RapidOCR
frontend/   React + Vite + TS · 800×480 터치
deploy/     키오스크 설정 (Chromium --kiosk, 자동 로그인, 무선·SSH 끔)
synthetic/  가짜 기기 목록 CSV
```

## 실행

(뼈대 PR에서 채운다)
