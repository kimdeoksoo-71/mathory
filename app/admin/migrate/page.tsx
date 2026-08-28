'use client';

import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import useAuth from '../../../hooks/useAuth';
import { confirmDialog } from '../../../lib/dialogs';

const ADMIN_EMAIL = 'kimdeoksoo@gmail.com';

interface ScanResult {
  total: number;
  needAuthorUid: string[];     // authorUid 누락
  needVisibility: string[];    // visibility 누락
}

export default function MigratePage() {
  const { user, loading } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [log, setLog] = useState<string[]>([]);

  if (loading) return <div style={{ padding: 40 }}>로딩 중...</div>;
  if (!user) return <div style={{ padding: 40 }}>로그인 필요</div>;
  if (user.email !== ADMIN_EMAIL) {
    return <div style={{ padding: 40, color: '#e53935' }}>권한 없음 ({user.email})</div>;
  }

  const appendLog = (s: string) => setLog((prev) => [...prev, s]);

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    setLog([]);
    try {
      // 본인 authorUid 문제 (이미 마이그레이션됐을 가능성)
      const ownSnap = await getDocs(
        query(collection(db, 'problems'), where('authorUid', '==', user.uid))
      );
      // visibility 만 누락된 케이스 체크
      const needVisibility: string[] = [];
      ownSnap.docs.forEach((d) => {
        if (!d.data().visibility) needVisibility.push(d.id);
      });
      // authorUid 자체가 없는 문제는 Rules에 막혀서 조회 불가
      // (Rules 적용 전에 한 번이라도 마이그레이션을 돌렸으면 0개여야 정상)
      setResult({ total: ownSnap.size, needAuthorUid: [], needVisibility });
      appendLog(`내 authorUid 보유: ${ownSnap.size}개`);
      appendLog(`visibility 누락: ${needVisibility.length}개`);
      appendLog('(authorUid 누락 문제는 Rules에 막혀 조회 불가. Rules 배포 전에 마이그레이션 완료했어야 함)');
    } catch (e: any) {
      appendLog(`스캔 실패: ${e?.message || e}`);
    } finally {
      setScanning(false);
    }
  };

  const handleMigrate = async () => {
    if (!result) return;
    const total = new Set([...result.needAuthorUid, ...result.needVisibility]).size;
    if (total === 0) {
      appendLog('마이그레이션할 대상 없음');
      return;
    }
    if (!await confirmDialog({
      title: '마이그레이션 실행',
      message: [`정말 ${total}개 문제를 마이그레이션 하시겠습니까?`,
                `- authorUid 누락 ${result.needAuthorUid.length}개에 ${user.uid} 채움`,
                `- visibility 누락 ${result.needVisibility.length}개에 'private' 채움`],
      danger: true, confirmLabel: '실행',
    })) {
      return;
    }

    setMigrating(true);
    try {
      const allIds = Array.from(new Set([...result.needAuthorUid, ...result.needVisibility]));
      let done = 0;
      for (const id of allIds) {
        const patch: Record<string, any> = {};
        if (result.needAuthorUid.includes(id)) patch.authorUid = user.uid;
        if (result.needVisibility.includes(id)) patch.visibility = 'private';
        await updateDoc(doc(db, 'problems', id), patch);
        done += 1;
        if (done % 10 === 0 || done === allIds.length) {
          appendLog(`진행: ${done}/${allIds.length}`);
        }
      }
      appendLog(`마이그레이션 완료: ${done}개 갱신`);
      // 재스캔
      await handleScan();
    } catch (e: any) {
      appendLog(`마이그레이션 실패: ${e?.message || e}`);
    } finally {
      setMigrating(false);
    }
  };

  // Phase 52(B1): 공개 문항의 기존 댓글에 commentStream 플래그 백필.
  //   addComment는 신규 댓글에 자동 세팅하므로, 배포 이전 댓글만 대상.
  //   미실행 시 기존 공개 댓글이 공개 뷰어(필터 쿼리)에서 안 보임.
  const handleBackfillCommentStream = async () => {
    setMigrating(true);
    setLog([]);
    try {
      appendLog('B1 백필 시작: 공개 문항 댓글 스트림 플래그…');
      const pubSnap = await getDocs(query(
        collection(db, 'problems'),
        where('authorUid', '==', user.uid),
        where('visibility', '==', 'public'),
      ));
      appendLog(`공개 문항: ${pubSnap.size}개`);
      let scanned = 0, updated = 0;
      for (const pd of pubSnap.docs) {
        const csid = (pd.data().commentSessionId ?? null) as string | null;
        const cSnap = await getDocs(collection(db, 'problems', pd.id, 'tab_comments'));
        for (const cd of cSnap.docs) {
          const c = cd.data();
          scanned += 1;
          if (c.commentStream === true) continue;          // 이미 플래그됨
          if (c.authorType === 'ai') continue;             // AI/agent 메시지 제외
          const sid = typeof c.discussionSessionId === 'string' ? c.discussionSessionId : null;
          const isStream = sid === null || sid === csid;   // 댓글세션/legacy만 스트림
          if (!isStream) continue;                         // agent('normal') 세션 제외
          await updateDoc(doc(db, 'problems', pd.id, 'tab_comments', cd.id), { commentStream: true });
          updated += 1;
        }
      }
      appendLog(`백필 완료: ${scanned}개 검사, ${updated}개 갱신`);
    } catch (e: any) {
      appendLog(`백필 실패: ${e?.message || e}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Stage 0 데이터 마이그레이션</h1>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
        로그인 사용자: {user.email} ({user.uid})
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          onClick={handleScan}
          disabled={scanning || migrating}
          style={btn(scanning || migrating)}
        >
          {scanning ? '스캔 중...' : '1. 스캔'}
        </button>
        <button
          onClick={handleMigrate}
          disabled={!result || migrating || scanning}
          style={btn(!result || migrating || scanning, '#e8a23a')}
        >
          {migrating ? '마이그레이션 중...' : '2. 마이그레이션 실행'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Phase 52(B1): 공개 문항 기존 댓글에 <code>commentStream</code> 플래그 백필
          (미실행 시 기존 공개 댓글이 공개 뷰어에서 안 보임). 신규 댓글은 자동.
        </div>
        <button
          onClick={handleBackfillCommentStream}
          disabled={migrating || scanning}
          style={btn(migrating || scanning, '#43a047')}
        >
          {migrating ? '백필 중...' : 'B1: commentStream 백필'}
        </button>
      </div>

      {result && (
        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          <div>전체 문제: {result.total}개</div>
          <div>authorUid 누락: <b>{result.needAuthorUid.length}</b>개</div>
          <div>visibility 누락: <b>{result.needVisibility.length}</b>개</div>
        </div>
      )}

      {log.length > 0 && (
        <div style={{ padding: 12, background: '#1a1a1a', color: '#e0e0e0', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {log.join('\n')}
        </div>
      )}
    </div>
  );
}

function btn(disabled: boolean, bg = '#1976d2'): React.CSSProperties {
  return {
    padding: '10px 20px',
    fontSize: 14,
    borderRadius: 6,
    border: 'none',
    background: disabled ? '#999' : bg,
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
  };
}
