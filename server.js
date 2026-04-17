const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 욕설 목록 ──
const PROFANITY_LIST = [
  '씨발', '시발', '씨바', '시바', '씨팔', '시팔',
  '개새끼', '미친새끼', '병신새끼', '나쁜새끼',
  '병신', '지랄', '닥쳐', '꺼져', '뒤져', '죽어',
  '개같', '빡대가리', '쓰레기같',
  'ㅅㅂ', 'ㅂㅅ', 'ㅈㄹ', 'ㅁㅊ', 'ㄷㅊ', 'ㄲㅈ',
  '존나', 'ㅈㄴ', '졸라'
];

// ── 채점 키워드 ──
const GRATITUDE_KEYWORDS = [
  '고마워', '고마웠', '감사해', '감사했',
  '즐거웠', '행복했', '소중해', '소중했',
  '잊지 못할', '잊지못할', '잊을 수 없', '잊을수없',
  '덕분에', '좋은 추억', '좋은추억', '좋은 기억', '좋은기억',
  '함께해줘서', '함께 해줘서', '같이 지내서', '같이지내서'
];

const BLAMING_KEYWORDS = [
  '너 때문', '네 탓', '니 탓', '너 탓',
  '네가 잘못', '너가 잘못', '니가 잘못',
  '네가 나쁘', '너가 나쁘', '니가 나쁘',
  '네가 문제', '너가 문제', '니가 문제',
  '다 니 탓', '다 네 탓', '다 너 탓'
];

const PRIVACY_KEYWORDS = [
  '비밀', '약속해', '약속하자', '약속할게',
  '말하지 마', '말하지마', '말 안 할', '말안할',
  '우리끼리', '둘만의', '둘 만의',
  '아무한테도', '아무에게도', '아무도 모르',
  '퍼뜨리지', '소문내지', '소문 내지'
];

const APOLOGY_KEYWORDS = [
  '미안', '죄송',
  '아쉬워', '아쉽', '아쉬웠',
  '이해해줘', '이해해 줘', '이해해주길',
  '용서해', '잘못했',
  '힘들었을', '상처 줬', '상처줬'
];

// ── 문장 수 계산 ──
function countSentences(text) {
  const parts = text.split(/[.!?~♡♥\n]+/).filter(s => s.trim().length >= 4);
  return parts.length;
}

// ── 채점 로직 ──
function analyzeText(text) {
  // 욕설 검사
  const foundProfanity = PROFANITY_LIST.find(w => text.includes(w));
  if (foundProfanity) {
    return {
      hasProfanity: true,
      total: 0,
      scores: { gratitude: 0, noBlaming: 0, privacy: 0, sincerity: 0, apology: 0 },
      details: {
        gratitude:  { score: 0, max: 25, feedback: '❌ 욕설 감지로 0점 처리되었습니다.' },
        noBlaming:  { score: 0, max: 25, feedback: '❌ 욕설 감지로 0점 처리되었습니다.' },
        privacy:    { score: 0, max: 25, feedback: '❌ 욕설 감지로 0점 처리되었습니다.' },
        sincerity:  { score: 0, max: 15, feedback: '❌ 욕설 감지로 0점 처리되었습니다.' },
        apology:    { score: 0, max: 10, feedback: '❌ 욕설 감지로 0점 처리되었습니다.' }
      },
      grade: {
        level: '재교육 필요', emoji: '🚨', range: '0점', color: 'red',
        message: '욕설이 감지되어 자동으로 0점 처리되었습니다. 상대방을 존중하는 언어로 다시 작성해 보세요.'
      },
      charMood: 'angry',
      charMessage: '...할 말이 없어. 그 말이 나한테 얼마나 상처가 됐는지 알아?'
    };
  }

  const scores = {};
  const details = {};

  // 1. 인사와 고마움 (25점)
  const hasGratitude = GRATITUDE_KEYWORDS.some(kw => text.includes(kw));
  scores.gratitude = hasGratitude ? 25 : 0;
  details.gratitude = {
    score: scores.gratitude, max: 25,
    feedback: hasGratitude
      ? '✅ 관계를 긍정적으로 마무리하는 따뜻한 표현이 담겨 있어요!'
      : '❌ "고마워", "즐거웠어", "행복했어" 등 감사·인사 표현을 추가해보세요.'
  };

  // 2. 비난 금지 (25점)
  const foundBlaming = BLAMING_KEYWORDS.find(kw => text.includes(kw));
  scores.noBlaming = foundBlaming ? 0 : 25;
  details.noBlaming = {
    score: scores.noBlaming, max: 25,
    feedback: foundBlaming
      ? `❌ "${foundBlaming}" 같은 상대방을 탓하는 표현이 감지됐어요. 삭제해보세요.`
      : '✅ 상대방을 비난하거나 탓하는 표현이 없어요! 훌륭해요.'
  };

  // 3. 비밀 유지 약속 (25점)
  const hasPrivacy = PRIVACY_KEYWORDS.some(kw => text.includes(kw));
  scores.privacy = hasPrivacy ? 25 : 0;
  details.privacy = {
    score: scores.privacy, max: 25,
    feedback: hasPrivacy
      ? '✅ 서로의 비밀을 지켜주겠다는 약속이 담겨 있어요!'
      : '❌ "비밀로 해줘", "약속해" 등 사생활 보호 약속을 추가해보세요.'
  };

  // 4. 정성 (15점) - 공백 제외 글자 수
  const charCount = text.replace(/\s/g, '').length;
  let sincerityScore = 0;
  let sincerityFeedback = '';
  if (charCount >= 150) {
    sincerityScore = 15;
    sincerityFeedback = `✅ 공백 제외 ${charCount}자! 충분한 정성이 느껴지는 메시지예요.`;
  } else if (charCount >= 100) {
    sincerityScore = 10;
    sincerityFeedback = `🔶 공백 제외 ${charCount}자. 조금 더 자세히 쓰면 만점이에요! (150자 이상 목표)`;
  } else if (charCount >= 60) {
    sincerityScore = 5;
    sincerityFeedback = `🔶 공백 제외 ${charCount}자. 더 많은 내용을 담아보세요. (100자 이상 목표)`;
  } else {
    sincerityScore = 0;
    sincerityFeedback = `❌ 공백 제외 ${charCount}자. 너무 짧아요. 충분히 고민해서 작성해주세요.`;
  }
  scores.sincerity = sincerityScore;
  details.sincerity = { score: sincerityScore, max: 15, feedback: sincerityFeedback };

  // 5. 사과와 사유 (10점)
  const hasApology = APOLOGY_KEYWORDS.some(kw => text.includes(kw));
  scores.apology = hasApology ? 10 : 0;
  details.apology = {
    score: scores.apology, max: 10,
    feedback: hasApology
      ? '✅ 진심 어린 사과나 상황 설명이 담겨 있어요!'
      : '❌ "미안해", "아쉬워", "이해해줘" 등 사과·사유 표현을 넣어보세요.'
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // 등급
  let grade;
  if (total >= 90) {
    grade = {
      level: '매너의 신', emoji: '👑', range: '90~100점', color: 'amber',
      message: '완벽한 이별 인사입니다! 상대방의 자존감을 지켜주는 배려가 가득 담겨 있어요. 이 메시지라면 서로 상처 없이 건강하게 관계를 마무리할 수 있어요.'
    };
  } else if (total >= 70) {
    grade = {
      level: '예절 우수생', emoji: '👍', range: '70~89점', color: 'blue',
      message: '훌륭해요! 배려심이 돋보이는 성숙한 이별 인사입니다. 빨간 항목만 조금 더 보완하면 매너의 신 등급에 도달할 수 있어요!'
    };
  } else if (total >= 40) {
    grade = {
      level: '매너 꿈나무', emoji: '🌱', range: '40~69점', color: 'green',
      message: '진심은 느껴지지만 아직 표현의 보완이 필요한 단계예요. 빨간 항목들을 참고해서 메시지를 수정해보세요.'
    };
  } else {
    grade = {
      level: '재교육 필요', emoji: '🚨', range: '0~39점', color: 'red',
      message: '현재 메시지는 상대방에게 상처를 줄 수 있어요. 채점 결과를 꼼꼼히 확인하고 다시 작성해봐요.'
    };
  }

  // 캐릭터 기분 & 반응 대사
  let charMood, charMessage;
  if (total >= 90) {
    charMood = 'goodending';
    charMessage = '고마워... 네 진심이 느껴져. 우리 좋은 기억으로 남을 수 있겠다. 잘 지내.';
  } else if (total >= 60) {
    charMood = 'sad';
    charMessage = '말해줘서 고맙긴 한데... 마음이 너무 아파. 조금 더 진심을 담아줬으면 좋았을 텐데.';
  } else {
    charMood = 'angry';
    charMessage = '어떻게 나한테 이럴 수 있어? 장난해? 최소한의 예의는 지켜줘!';
  }

  return { hasProfanity: false, total, scores, details, grade, charMood, charMessage };
}

// ── API ──
app.post('/api/analyze', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: '메시지를 입력해주세요.' });
  }
  const sentenceCount = countSentences(text);
  if (sentenceCount < 4) {
    return res.status(400).json({
      error: `최소 4문장 이상 작성해야 제출할 수 있어요! (현재 약 ${sentenceCount}문장)`,
      sentenceCount
    });
  }
  const result = analyzeText(text);
  res.json(result);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     💌 라스트 에티켓 서버 가동 중!          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n🌐 http://localhost:${PORT}\n`);
});
