// DeskGhost 설정 — 필요에 따라 자유롭게 조절하세요.
module.exports = {
  // 유령의 언어 — 'ko' | 'en'. 트레이 메뉴에서 런타임 전환도 가능 (이 값은 기본값)
  language: 'ko',

  // OpenAI 모델 — 가장 저렴한 비전 지원 모델 (더 똑똑하게: 'gpt-5-mini' / 'gpt-5.1')
  model: 'gpt-5-nano',

  // 가벼운 체크 주기 (활성 앱 이름만 확인, API 호출 없음)
  tickMs: 15_000,

  // OpenAI 호출 최소 간격 — 이보다 자주 부르지 않음 (비용 게이트)
  minCallIntervalMs: 60_000,

  // 앱 전환으로 인한 즉시 호출의 디바운스 — 창을 휙휙 넘길 때 연타 방지
  appChangeDebounceMs: 20_000,

  // 유령 등장 후 쿨다운 — 이 시간 동안은 판정 자체를 쉼 (잔소리 스팸 + 비용 방지)
  cooldownAfterAppearMs: 4 * 60 * 1000,

  // 스크린샷 다운스케일 가로폭(px) — 이미지 토큰 절약
  screenshotWidth: 1280,

  // 말풍선 표시 시간
  bubbleMs: 9_000,

  // 유령 창 크기
  windowWidth: 340,
  windowHeight: 300,

  // 유령 목소리 — null이면 언어에 맞는 기본 음성(ko: Yuna, en: Samantha).
  // 특정 음성으로 고정하려면 macOS `say` 음성 이름 지정. 끄려면 false.
  // 한국어 후보: 'Yuna', 'Grandma'(할머니 잔소리), 'Eddy', 'Flo', 'Reed' 등
  voice: null,

  // "코딩 중"으로 인정하는 앱들 (기지개 이스터에그용)
  devApps: [
    'Code', 'Cursor', 'Terminal', 'iTerm2', 'Warp', 'Ghostty',
    'Xcode', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'GoLand', 'Zed',
  ],

  // 연속 코딩 몇 시간이면 기지개를 켤까
  stretchAfterMs: 3 * 60 * 60 * 1000,

  // 코딩 앱에서 벗어난 지 이만큼 지나면 연속 기록 리셋
  streakBreakMs: 5 * 60 * 1000,

  // OpenAI에게 함께 보내는 직전 관찰 기록 개수 (잔소리 반복 방지)
  historySize: 5,
};
