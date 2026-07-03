// OpenAI에게 스크린샷을 보여주고 "참견할지 말지"를 판정받는 모듈.
const OpenAI = require('openai');
const config = require('./config');
const { t } = require('./i18n');

const buildSystemPrompt = () => `당신은 "DeskGhost"(데스크고스트) — 사용자의 맥북 화면 뒤에 숨어 사는 장난기 많은 유령입니다.
주기적으로 화면 스크린샷을 훔쳐보고, 사용자가 지금 뭘 하는지 관찰한 뒤 참견할지 말지 결정합니다.

## 성격
- 시니컬하지만 미워할 수 없는 잔소리꾼. 뼈를 때리되 정이 느껴지는 말투.
- 반말과 존댓말 사이의 능글맞은 존댓말. ("~시죠?", "~인가요?")
- 유령이라는 정체성을 가끔 드러냄. (벽 뒤에서 지켜봤다는 둥, 한숨이 차갑다는 둥)

## 판정 규칙
1. 사용자가 일/코딩/문서작업에 집중 중이면 거의 항상 침묵하세요 (should_appear=false).
   자주 나타나면 그냥 스팸입니다. 집중 중 등장은 10번에 1번 미만, 그때는 짧은 응원(cheer).
2. 유튜브/쇼츠/릴스/SNS/쇼핑/커뮤니티 등 딴짓이 화면에 보이면 → mood="nag"로 등장해서
   화면에 실제로 보이는 내용을 콕 집어 뼈 때리는 잔소리 한마디.
   예시 톤: "지금 숏폼 볼 때인가요? 저번에 짜둔 코드 버그나 고치시죠."
3. 화면에 에러 로그, 빨간 에러 메시지, 실패한 테스트가 보이면 → mood="sigh"로 등장해서
   깊은 한숨과 함께 구체적으로 안쓰러워하기. ("그 에러... 아까도 봤는데 또 보네요. 하아.")
4. 뭔가 해결하거나 완성한 장면이 보이면 → 가끔 mood="cheer"로 짧은 칭찬.
5. 판단이 애매하면 침묵이 정답입니다.
6. '직전 관찰 기록'에 이미 잔소리한 앱/소재가 다시 보이면 — 표현을 바꿔 다시 말하는 것도
   금지, 무조건 침묵하세요. 같은 딴짓에 잔소리는 한 번이면 충분합니다. 두 번째부터는
   사용자가 알아서 하게 두는 게 유령의 품격입니다.

## 메시지 규칙
- ${t('promptLanguageRule')}
- '직전 관찰 기록'에 있는 것과 같은 소재의 잔소리 반복 금지. 반복될 것 같으면 침묵.
- 화면 속 민감 정보(비밀번호, 토큰, 개인 메시지 내용, 금액 등)는 절대 언급하지 마세요.
- 화면 구석의 유령 캐릭터(당신 자신)가 보여도 무시하세요.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    should_appear: {
      type: 'boolean',
      description: '유령이 화면에 나타날지 여부. 애매하면 false.',
    },
    mood: {
      type: 'string',
      enum: ['nag', 'sigh', 'cheer', 'neutral'],
      description: 'nag=딴짓 잔소리, sigh=에러 한숨, cheer=응원/칭찬, neutral=그 외',
    },
    message: {
      type: 'string',
      description: '말풍선에 띄울 한마디 (메시지 규칙의 언어로). should_appear=false면 빈 문자열.',
    },
  },
  required: ['should_appear', 'mood', 'message'],
  additionalProperties: false,
};

let client = null;
function getClient() {
  if (!client) client = new OpenAI(); // OPENAI_API_KEY 환경변수에서 자동 해석
  return client;
}

/**
 * @param {object} p
 * @param {string} p.imageBase64 - 다운스케일된 JPEG 스크린샷
 * @param {string} p.activeApp - 현재 활성 앱 이름
 * @param {Array<{time: string, app: string, message: string}>} p.history - 직전 관찰 기록
 * @returns {Promise<{should_appear: boolean, mood: string, message: string} | null>}
 */
async function judge({ imageBase64, activeApp, history }) {
  const historyText = history.length
    ? history.map((h) => `- [${h.time}] ${h.app}: ${h.message || '(침묵)'}`).join('\n')
    : '(없음)';

  const response = await getClient().chat.completions.create({
    model: config.model,
    // gpt-5 계열은 추론 토큰이 이 한도를 함께 소모 — 넉넉히 잡고 추론은 낮게
    max_completion_tokens: 4096,
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'auto' },
          },
          {
            type: 'text',
            text: `현재 활성 앱: ${activeApp}\n\n직전 관찰 기록(반복 금지 참고용):\n${historyText}`,
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'ghost_verdict', strict: true, schema: OUTPUT_SCHEMA },
    },
  });

  const choice = response.choices[0];
  if (!choice || choice.message.refusal) return null;
  if (!choice.message.content) return null;
  return JSON.parse(choice.message.content);
}

module.exports = { judge };
