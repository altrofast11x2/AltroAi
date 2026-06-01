// ───────────────────────────────────────────────────────────────────────────
//  아주 작은 마크다운 → HTML 렌더러 (의존성 없음, XSS 안전)
//  먼저 HTML 을 모두 이스케이프한 뒤 제한된 문법만 다시 태그로 바꾼다.
//  지원: 코드블록 ```, 인라인 `code`, **굵게**, *기울임*, [링크](url), 제목 #, 목록 -/1.
// ───────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 인라인 요소 변환 (이미 이스케이프된 텍스트에 적용)
function inline(s: string): string {
  return s
    // 링크 [텍스트](http…) — http/https 만 허용
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 굵게
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 기울임 (단어 경계 안전하게)
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1<em>$2</em>');
}

// 코드블록을 제외한 일반 텍스트 블록 처리 (제목/목록/문단)
function renderBlock(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) { html.push(`<p>${para.map(inline).join('<br/>')}</p>`); para = []; }
  };
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const lvl = Math.min(6, h[1].length + 2); // # → h3
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (listType !== want) { closeList(); html.push(`<${want}>`); listType = want as 'ul' | 'ol'; }
      html.push(`<li>${inline((ul ? ul[1] : ol![1]))}</li>`);
      continue;
    }

    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return html.join('');
}

export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(String(src || ''));
  // ``` 코드펜스 기준으로 분리 — 짝수 인덱스는 일반 텍스트, 홀수는 코드
  const parts = escaped.split(/```/);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // 코드 블록: 첫 줄이 언어표기면 제거
      const body = parts[i].replace(/^[a-zA-Z0-9_-]*\n/, '');
      out += `<pre><code>${body.replace(/\n$/, '')}</code></pre>`;
    } else {
      out += renderBlock(parts[i]);
    }
  }
  return out;
}
