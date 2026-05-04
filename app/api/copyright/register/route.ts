import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/copyright/register
 * body: { contentHash: string (64 hex chars) }
 * 결과: Polygon mainnet 에 자기 주소로 0 MATIC 트랜잭션을 보내며 data 필드에 해시를 기록.
 * 인증: 없음 (Phase 29 — C2). 단일 사용자 운영 동안의 임시 정책.
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

    const pk = process.env.MATHORY_WALLET_PRIVATE_KEY;
    const rpc = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    if (!pk) {
      return NextResponse.json(
        { error: 'Server wallet not configured (MATHORY_WALLET_PRIVATE_KEY)' },
        { status: 500 }
      );
    }

    const privateKey = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const wallet = createWalletClient({ account, chain: polygon, transport: http(rpc) });
    const publicClient = createPublicClient({ chain: polygon, transport: http(rpc) });

    const txHash = await wallet.sendTransaction({
      account,
      chain: polygon,
      to: account.address,
      value: 0n,
      data: `0x${contentHash}` as `0x${string}`,
      kzg: undefined,
    } as any);

    // 1 confirmation 대기 (Polygon ~2초)
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

    return NextResponse.json({
      txHash,
      contentHash,
      registeredAt: new Date().toISOString(),
      network: 'polygon',
      explorerUrl: `https://polygonscan.com/tx/${txHash}`,
    });
  } catch (e: any) {
    console.error('블록체인 등록 실패:', e);
    return NextResponse.json(
      { error: e?.shortMessage || e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
