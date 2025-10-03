import { NextRequest, NextResponse } from 'next/server';
import type { Layouts } from 'react-grid-layout';
import { sanitizeLayouts } from '@/lib/layoutUtils';
import {
  getDefaultLayoutRecord,
  readUserLayout,
  resetUserLayout,
  type LayoutMode,
  type LayoutRecord,
  writeUserLayout,
} from '@/lib/server/layoutStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USER_COOKIE = 'l2dash_user';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function ensureUser(req: NextRequest): { userId: string; shouldSet: boolean } {
  const existing = req.cookies.get(USER_COOKIE)?.value;
  if (existing && typeof existing === 'string') {
    return { userId: existing, shouldSet: false };
  }
  const generated = crypto.randomUUID();
  return { userId: generated, shouldSet: true };
}

function resolveMode(value: unknown): LayoutMode {
  return value === 'live' ? 'live' : 'paper';
}

function resolveSymbol(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toUpperCase();
  }
  return 'ALL';
}

function respondWithCookie(
  data: LayoutRecord,
  shouldSetCookie: boolean,
  userId: string,
) {
  const response = NextResponse.json({
    layouts: data.layouts,
    locked: data.locked,
    savedAt: data.savedAt,
  });
  if (shouldSetCookie) {
    response.cookies.set(USER_COOKIE, userId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: false,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
  }
  return response;
}

export async function GET(req: NextRequest) {
  const { userId, shouldSet } = ensureUser(req);
  const url = new URL(req.url);
  const mode = resolveMode(url.searchParams.get('mode'));
  const symbol = resolveSymbol(url.searchParams.get('symbol'));

  const record = await readUserLayout(userId, mode, symbol);
  return respondWithCookie(record, shouldSet, userId);
}

interface PostPayload {
  mode?: LayoutMode;
  symbol?: string;
  layouts?: Layouts;
  locked?: boolean;
  reset?: boolean;
}

export async function POST(req: NextRequest) {
  const { userId, shouldSet } = ensureUser(req);
  const body = (await req.json().catch(() => null)) as PostPayload | null;
  if (!body || typeof body !== 'object') {
    const fallback = getDefaultLayoutRecord();
    return respondWithCookie(fallback, shouldSet, userId);
  }

  const mode = resolveMode(body.mode);
  const symbol = resolveSymbol(body.symbol);

  if (body.reset) {
    const record = await resetUserLayout(userId, mode, symbol);
    return respondWithCookie(record, shouldSet, userId);
  }

  const sanitizedLayouts = sanitizeLayouts(body.layouts ?? null);
  const record = await writeUserLayout(
    userId,
    mode,
    symbol,
    sanitizedLayouts ?? getDefaultLayoutRecord().layouts,
    typeof body.locked === 'boolean' ? body.locked : false,
  );

  return respondWithCookie(record, shouldSet, userId);
}
