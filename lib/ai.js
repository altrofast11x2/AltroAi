// AltroAi Firebase Realtime DB helpers — 모든 노드는 `ai_` 프리픽스 사용
import {
  ref, get, set, update, push, remove, query, orderByChild, equalTo,
} from 'firebase/database';
import { db } from './firebase';
import { hashPassword } from './security';

// Altro 패밀리 계정 노드 — board=users, shop=shop_users, todo=todo_users, dash=dash_users.
// 해시 포맷(`v1$email$plain`)이 모두 동일하므로 어느 노드에서든 이메일+해시가 맞으면 인증.
const FAMILY_NODES = [
  { node: 'users', source: 'altroboard' },
  { node: 'shop_users', source: 'altroshop' },
  { node: 'todo_users', source: 'altrotodo' },
  { node: 'dash_users', source: 'altrodash' },
];

// ───────── USERS ─────────
export async function findUserByEmail(email) {
  const lower = String(email || '').toLowerCase();
  try {
    const snap = await get(query(ref(db, 'ai_users'), orderByChild('email'), equalTo(lower)));
    if (!snap.exists()) return null;
    const [uid, u] = Object.entries(snap.val())[0];
    return { uid, ...u };
  } catch (e) {
    console.warn('[AltroAi] ai_users 조회 실패 (Firebase 규칙 미게시 가능성):', e?.message || e);
    return null;
  }
}

export async function loginUser(email, password) {
  const lower = String(email || '').toLowerCase();
  const hashed = await hashPassword(password, lower);

  // 1) AltroAi 자체 회원
  const own = await findUserByEmail(lower);
  if (own && own.password === hashed) {
    return { id: own.uid, name: own.name, email: own.email, source: 'ai' };
  }

  // 2) Altro 패밀리 통합 로그인 — 다른 앱 노드에서 같은 이메일+해시가 있으면 자동 인증.
  //    이 노드들은 이미 읽기 허용이라 규칙 게시 전에도 동작.
  for (const { node, source } of FAMILY_NODES) {
    try {
      const snap = await get(query(ref(db, node), orderByChild('email'), equalTo(lower)));
      if (!snap.exists()) continue;
      for (const [uid, u] of Object.entries(snap.val())) {
        if (!u || typeof u.password !== 'string') continue;
        if (u.password !== hashed) continue;
        // ai_users 미러 생성 (권한 없으면 무시 — 메모리 세션만)
        try {
          const mirror = await get(ref(db, `ai_users/${uid}`));
          if (!mirror.exists()) {
            await set(ref(db, `ai_users/${uid}`), {
              name: u.name || '익명',
              email: lower,
              password: hashed,
              linkedFrom: source,
              createdAt: u.createdAt || new Date().toISOString(),
              linkedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('[AltroAi] ai_users 미러 생성 실패 — Firebase 규칙 게시 필요:', e?.message || e);
        }
        return { id: uid, name: u.name || '익명', email: lower, source };
      }
    } catch (e) {
      console.warn(`[AltroAi] ${node} 조회 실패:`, e?.message || e);
    }
  }

  return null;
}

export async function registerUser(name, email, password) {
  const lower = String(email).toLowerCase();
  if (await findUserByEmail(lower)) return { error: '이미 가입된 이메일입니다. 로그인 해주세요.' };

  // Altro 패밀리에 이미 있으면 기존 비밀번호로 바로 로그인하도록 안내
  for (const { node } of FAMILY_NODES) {
    try {
      const snap = await get(query(ref(db, node), orderByChild('email'), equalTo(lower)));
      if (snap.exists()) {
        return { error: '이미 Altro 패밀리(Board·Shop·Todo·DashBoard)에 가입된 이메일입니다. 기존 비밀번호로 바로 로그인 해주세요.' };
      }
    } catch {}
  }

  const hashed = await hashPassword(password, lower);
  const newRef = push(ref(db, 'ai_users'));
  await set(newRef, { name, email: lower, password: hashed, createdAt: new Date().toISOString() });
  return { id: newRef.key, name, email: lower };
}

export async function getUser(uid) {
  try {
    const snap = await get(ref(db, `ai_users/${uid}`));
    if (!snap.exists()) return null;
    return { id: uid, ...snap.val() };
  } catch { return null; }
}

// ───────── CONVERSATIONS (대화방) ─────────
// ai_conversations/{uid}/{convId} = { title, personaId, createdAt, updatedAt, lastMessage, messageCount }
export async function listConversations(uid) {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `ai_conversations/${uid}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
      .map(([id, v]) => ({ id, ...v }))
      // 최근 업데이트 순(내림차순)
      .sort((a, b) => (String(b.updatedAt || b.createdAt || '') > String(a.updatedAt || a.createdAt || '') ? 1 : -1));
  } catch (e) {
    console.warn('[AltroAi] listConversations 실패:', e?.message || e);
    return [];
  }
}

export async function getConversation(uid, convId) {
  if (!uid || !convId) return null;
  try {
    const snap = await get(ref(db, `ai_conversations/${uid}/${convId}`));
    if (!snap.exists()) return null;
    return { id: convId, ...snap.val() };
  } catch { return null; }
}

export async function createConversation(uid, { personaId, title }) {
  const now = new Date().toISOString();
  const newRef = push(ref(db, `ai_conversations/${uid}`));
  const conv = {
    title: (title || '새 대화').slice(0, 80),
    personaId: personaId || 'study',
    createdAt: now,
    updatedAt: now,
    lastMessage: '',
    messageCount: 0,
  };
  await set(newRef, conv);
  return { id: newRef.key, ...conv };
}

export async function updateConversation(uid, convId, patch) {
  if (!uid || !convId) return;
  await update(ref(db, `ai_conversations/${uid}/${convId}`), patch);
}

// 대화 삭제 시 메시지도 함께 삭제
export async function deleteConversation(uid, convId) {
  if (!uid || !convId) return;
  await remove(ref(db, `ai_conversations/${uid}/${convId}`));
  await remove(ref(db, `ai_messages/${uid}/${convId}`));
}

// ───────── MESSAGES (메시지) ─────────
// ai_messages/{uid}/{convId}/{msgId} = { role: 'user'|'assistant', content, createdAt }
export async function listMessages(uid, convId) {
  if (!uid || !convId) return [];
  try {
    const snap = await get(ref(db, `ai_messages/${uid}/${convId}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (String(a.createdAt || '') > String(b.createdAt || '') ? 1 : -1));
  } catch { return []; }
}

export async function addMessage(uid, convId, { role, content }) {
  if (!uid || !convId) return null;
  const newRef = push(ref(db, `ai_messages/${uid}/${convId}`));
  const msg = { role, content: String(content || ''), createdAt: new Date().toISOString() };
  await set(newRef, msg);
  return { id: newRef.key, ...msg };
}

// 메시지 한 쌍(질문/답변) 저장 후 대화방 메타 갱신을 한 번에 처리하는 편의 함수
export async function appendTurn(uid, convId, { userText, assistantText, personaId }) {
  await addMessage(uid, convId, { role: 'user', content: userText });
  if (assistantText) await addMessage(uid, convId, { role: 'assistant', content: assistantText });
  const conv = await getConversation(uid, convId);
  const count = (conv?.messageCount || 0) + (assistantText ? 2 : 1);
  await updateConversation(uid, convId, {
    updatedAt: new Date().toISOString(),
    lastMessage: String(assistantText || userText).slice(0, 120),
    messageCount: count,
    ...(personaId ? { personaId } : {}),
  });
}

// ───────── SETTINGS ─────────
// ai_settings/{uid} = { theme, voiceOutput, voiceLang, defaultPersona }
export async function getSettings(uid) {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, `ai_settings/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}

export async function saveSettings(uid, settings) {
  if (!uid) return;
  await update(ref(db, `ai_settings/${uid}`), settings);
}
