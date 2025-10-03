export const runtime = 'nodejs';

export async function POST() {
  return Response.json(
    {
      ok: false,
      error: 'mock-feed-disabled',
      message: 'The mock tick generator has been removed. Point the blotter at a real market data source instead.',
    },
    { status: 410 },
  );
}
