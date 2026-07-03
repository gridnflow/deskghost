// 언어 상태 + 언어별 문자열. 기본값은 config.language, 트레이 메뉴에서 런타임 전환 가능.
const config = require('./config');

let current = config.language === 'en' ? 'en' : 'ko';

const STRINGS = {
  ko: {
    trayResume: '다시 훔쳐보기',
    trayPause: '잠깐 눈 감기 (일시정지)',
    trayJudge: '지금 바로 판정하기',
    trayLanguage: '언어 (Language)',
    trayQuit: '성불하기 (종료)',
    stretch: (hours) => `${hours}시간째 코딩 중... 유령도 삭신이 쑤셔요. 기지개 한번 켜시죠.`,
    noApiKey: 'OPENAI_API_KEY가 없네요... 유령도 영혼의 양식이 필요해요.',
    testBoot: '테스트 부팅 성공! 👻',
    voice: 'Yuna', // macOS `say` 한국어 음성
    promptLanguageRule: '반드시 한국어, 1~2문장, 80자 이내.',
  },
  en: {
    trayResume: 'Resume haunting',
    trayPause: 'Close my eyes (pause)',
    trayJudge: 'Judge right now',
    trayLanguage: 'Language (언어)',
    trayQuit: 'Ascend to heaven (quit)',
    stretch: (hours) =>
      `${hours} hours of coding straight... even my ghostly joints ache. Go stretch.`,
    noApiKey: 'No OPENAI_API_KEY... even a ghost needs soul food.',
    testBoot: 'Test boot OK! 👻',
    voice: 'Samantha', // macOS `say` 영어 음성
    promptLanguageRule: 'Always in English, 1-2 sentences, under 120 characters.',
  },
};

function t(key, ...args) {
  const v = STRINGS[current][key];
  return typeof v === 'function' ? v(...args) : v;
}

function getLanguage() {
  return current;
}

function setLanguage(lang) {
  if (STRINGS[lang]) current = lang;
}

module.exports = { t, getLanguage, setLanguage };
