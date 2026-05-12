import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// opentimestamps은 CommonJS 모듈
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenTimestamps = require('opentimestamps');

/**
 * POST /api/copyright/register
 * body: { contentHash: string (64 hex chars) }
 * OpenTimestamps 캘린더 서버에 해시를 제출하고 .ots 증명 파일을 반환.
 * 비용 무료, 지갑 불필요. 비트코인 블록 확정은 ~1시간 후 (백그라운드).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const contentHash = String(body?.contentHash || '');

    if (!/^[0-9a-f]{64}$/.test(contentHash)) {
      return NextResponse.json(
        { error: 'Invalid contentHash (64-char lowercase hex required)' },
        { status: 400 }
      );
    }

    // Buffer로 변환
    const hashBuffer = Buffer.from(contentHash, 'hex');

    // OpenTimestamps DetachedTimestampFile 생성
    const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      hashBuffer
    );

    // 캘린더 서버에 제출 (alice, bob, finney 3개 서버에 동시 제출)
    await OpenTimestamps.stamp(detached);

    // .ots 증명 파일을 base64로 직렬화
    const otsBytes = detached.serializeToBytes();
    const otsBase64 = Buffer.from(otsBytes).toString('base64');

    const registeredAt = new Date().toISOString();

    return NextResponse.json({
      contentHash,
      registeredAt,
      network: 'opentimestamps',
      status: 'pending',
      otsProof: otsBase64,
    });
  } catch (e: any) {
    console.error('OpenTimestamps 등록 실패:', e);
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}