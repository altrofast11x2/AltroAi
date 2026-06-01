// ───────────────────────────────────────────────────────────────────────────
//  Web Speech API 래퍼 — 음성 입력(SpeechRecognition) / 출력(SpeechSynthesis)
//  브라우저 전용. SSR·미지원 환경에서 안전하게 동작하도록 모두 가드 처리.
// ───────────────────────────────────────────────────────────────────────────

export function isRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * 음성 인식기 생성 — { start, stop, abort, supported } 반환
 * @param {Object} [opts]
 * @param {string} [opts.lang]
 * @param {boolean} [opts.interim]
 * @param {(t: string) => void} [opts.onPartial] 중간 결과
 * @param {(t: string) => void} [opts.onFinal]   최종 결과
 * @param {(e: any) => void} [opts.onError]
 * @param {() => void} [opts.onStart]
 * @param {() => void} [opts.onEnd]
 */
export function createRecognizer(opts = {}) {
  const { lang = 'ko-KR', interim = true, onPartial, onFinal, onError, onStart, onEnd } = opts;
  if (!isRecognitionSupported()) {
    return { supported: false, start() {}, stop() {}, abort() {} };
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = interim;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => onStart && onStart();
  rec.onerror = (e) => onError && onError(e?.error || 'error');
  rec.onend = () => onEnd && onEnd();
  rec.onresult = (e) => {
    let interimText = '';
    let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interimText += r[0].transcript;
    }
    if (interimText && onPartial) onPartial(interimText);
    if (finalText && onFinal) onFinal(finalText.trim());
  };

  return {
    supported: true,
    start() { try { rec.start(); } catch {} },
    stop() { try { rec.stop(); } catch {} },
    abort() { try { rec.abort(); } catch {} },
  };
}

// 마크다운/코드 기호를 제거해 음성으로 읽기 좋게 변환
export function stripForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' 코드 블록 ')   // 코드블록은 통째로 치환
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>~]/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')         // 링크는 텍스트만
    .replace(/\s+/g, ' ')
    .trim();
}

// 한국어 음성 우선 선택
function pickVoice(lang) {
  if (!isSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const base = (lang || 'ko-KR').slice(0, 2).toLowerCase();
  return (
    voices.find(v => v.lang && v.lang.toLowerCase() === (lang || '').toLowerCase()) ||
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith(base)) ||
    voices[0]
  );
}

/**
 * 텍스트를 음성으로 읽기. 이전 발화는 취소하고 새로 재생.
 * @param {string} text
 * @param {Object} [opts]
 * @param {string} [opts.lang]
 * @param {number} [opts.rate]
 * @param {number} [opts.pitch]
 * @param {() => void} [opts.onStart]
 * @param {() => void} [opts.onEnd]
 */
export function speak(text, opts = {}) {
  const { lang = 'ko-KR', rate = 1.02, pitch = 1, onStart, onEnd } = opts;
  if (!isSynthesisSupported()) return;
  const clean = stripForSpeech(text);
  if (!clean) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    if (onStart) u.onstart = onStart;
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    window.speechSynthesis.speak(u);
  } catch {}
}

export function cancelSpeech() {
  if (isSynthesisSupported()) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
}
