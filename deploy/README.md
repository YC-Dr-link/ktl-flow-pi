# deploy — Pi 키오스크 설정 (REQ-A1-05)

전원을 켜면 키보드 · 마우스 조작 없이 PI-01이 전체 화면으로 떠야 한다. 이 폴더는 #7(키오스크 부팅 설정)에서 채운다.

할 일 (계획)
- 백엔드를 systemd 서비스로: `uvicorn app.main:app --host 127.0.0.1 --port 8000` (frontend는 미리 `npm run build`)
- 자동 로그인 + Chromium `--kiosk http://127.0.0.1:8000`
- 무선 · 블루투스 · SSH 끄기 (Pi는 어떤 네트워크에도 붙지 않는다)
- 한글 폰트: `fonts-noto-cjk` 패키지 (화면은 외부 폰트를 받지 않는다)

TODO(확인 필요): 사용하는 Raspberry Pi OS 버전 · 화면 회전 · 터치 보정 값
