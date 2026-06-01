// AltroBoard / AltroShop / AltroTodo / AltroDashBoard 의 lib/security.js 와 동일한 해시 포맷 — 통합 로그인 호환 필수
// 입력 포맷: `v1$<salt>$<plain>` (salt = 소문자 이메일)
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(plain, salt = '') {
  return sha256Hex(`v1$${salt}$${plain}`);
}
