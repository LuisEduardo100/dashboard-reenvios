import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { company, year } = body;

    // Call the n8n webhook (uses Production URL by default, can be overridden by env variable)
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n-study.gogroupgl.com/webhook/atualizar-dados';
    
    console.log(`Sending sync request to n8n: company=${company}, year=${year}`);

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ company, year }),
      // Set a reasonable timeout or keep-alive if needed
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook n8n retornou status ${response.status}: ${text}`);
    }

    let result = {};
    try {
      result = await response.json();
    } catch (e) {
      // If the response is not JSON (e.g. simple text "OK")
      const text = await response.text();
      result = { message: text || 'Sincronização iniciada' };
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error in /api/sync:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao acionar webhook n8n' },
      { status: 500 }
    );
  }
}
