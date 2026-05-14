'use client';

import { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import useAuth from '../../../hooks/useAuth';

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
      const snap = await getDocs(collection(db, 'problems'));
      const needAuthorUid: string[] = [];
      const needVisibility: string[] = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data.authorUid) needAuthorUid.push(d.id);
        if (!data.visibility) needVisibility.push(d.id);
      });
      setResult({ total: snap.size, needAuthorUid, needVisibility });
      appendLog(`스캔 완료: 전체 ${snap.size}개`);
      appendLog(`authorUid 누락: ${needAuthorUid.length}개`);
      appendLog(`visibility 누락: ${needVisibility.length}개`);
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
    if (!confirm(`정말 ${total}개 문제를 마이그레이션 하시겠습니까?\n\n- authorUid 누락 ${result.needAuthorUid.length}개에 ${user.uid} 채움\n- visibility 누락 ${result.needVisibility.length}개에 'private' 채움`)) {
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
