/* ═══════════════════════════════════════════════════════════════
   개선묶음 M2 A — 다이얼로그 모듈 싱글턴 (D3′)

   네이티브 `alert`/`confirm`/`prompt`를 대체한다. 호출부는 React 밖(`lib/pdfPrint.tsx`)
   에도 있으므로 훅이 아니라 **모듈 싱글턴 + Promise**여야 한다.

   ⚠ 이 파일은 React를 import하지 않는다 — 상태만 들고 `DialogHost`가 구독한다.
   ⚠ 큐: 두 번째 호출은 앞의 것이 닫힐 때까지 기다린다. 겹쳐 띄우면 오버레이가
     두 겹이 되고 Escape가 어느 것을 닫는지 알 수 없다. 네이티브 팝업도 직렬이었다.
   ⚠ Host가 아직 마운트되지 않았거나(서버 렌더) 이미 언마운트됐다면 즉시 기본값으로
     resolve한다 — 다이얼로그를 못 띄운다고 호출부가 영원히 await하면 안 된다.
   ═══════════════════════════════════════════════════════════════ */

export type DialogMessage = string | string[];

export interface ConfirmOptions {
  title?: string;
  message: DialogMessage;
  /** 확인 버튼을 위험색(#e53935)으로. 삭제·영구 삭제·해제 계열에 쓴다. */
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface PromptOptions {
  title: string;
  message?: DialogMessage;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  confirmLabel?: string;
  /** 반환값이 있으면 에러로 표시하고 확정을 막는다. */
  validate?: (value: string) => string | null;
}

export type DialogRequest =
  | { kind: 'alert'; message: DialogMessage; title?: string }
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions);

interface QueueEntry {
  request: DialogRequest;
  resolve: (value: unknown) => void;
}

type Listener = (entry: DialogRequest | null) => void;

const queue: QueueEntry[] = [];
let current: QueueEntry | null = null;
let listener: Listener | null = null;

function pump() {
  if (current || queue.length === 0) return;
  current = queue.shift()!;
  listener?.(current.request);
}

/** DialogHost 전용. 마운트 시 구독하고 언마운트 시 해제한다. */
export function subscribeDialogs(fn: Listener | null): void {
  listener = fn;
  if (fn) {
    // 늦게 마운트된 Host가 대기 중인 요청을 이어받는다.
    if (current) fn(current.request);
    else pump();
  } else {
    // Host가 사라졌다 — 대기 중인 것을 전부 기본값으로 흘려보낸다(영구 await 방지).
    const pending = current ? [current, ...queue] : [...queue];
    current = null;
    queue.length = 0;
    for (const e of pending) e.resolve(defaultResult(e.request));
  }
}

/** DialogHost 전용. 사용자가 닫으면 결과와 함께 부른다. */
export function resolveDialog(value: unknown): void {
  const entry = current;
  current = null;
  entry?.resolve(value);
  listener?.(null);
  pump();
}

function defaultResult(req: DialogRequest): unknown {
  if (req.kind === 'confirm') return false;
  if (req.kind === 'prompt') return null;
  return undefined;
}

function open<T>(request: DialogRequest): Promise<T> {
  // 서버·비브라우저 환경에서는 띄울 곳이 없다 → 기본값으로 즉시 끝낸다.
  if (typeof window === 'undefined') {
    return Promise.resolve(defaultResult(request) as T);
  }
  return new Promise<T>((resolve) => {
    queue.push({ request, resolve: resolve as (v: unknown) => void });
    pump();
  });
}

/** 네이티브 `alert` 대체. */
export function alertDialog(message: DialogMessage, title?: string): Promise<void> {
  return open<void>({ kind: 'alert', message, title });
}

/** 네이티브 `confirm` 대체. 취소·Escape·오버레이 클릭 = false. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return open<boolean>({ kind: 'confirm', ...options });
}

/** 네이티브 `prompt` 대체. 취소·Escape·오버레이 클릭 = null. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return open<string | null>({ kind: 'prompt', ...options });
}
