import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    let credentialsStr = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentialsStr) {
      return NextResponse.json({ error: 'Credenciais ausentes no .env.local.' }, { status: 401 });
    }

    // Remove single quotes if they exist around the JSON string
    if (credentialsStr.startsWith("'") && credentialsStr.endsWith("'")) {
      credentialsStr = credentialsStr.slice(1, -1);
    }

    const credentials = JSON.parse(credentialsStr);
    let spreadsheetId = process.env.SPREADSHEET_ID;
    if (spreadsheetId && spreadsheetId.startsWith("'") && spreadsheetId.endsWith("'")) {
      spreadsheetId = spreadsheetId.slice(1, -1);
    }

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Falta o SPREADSHEET_ID no .env.local.' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Reenvios e Envios!A:R', // A ao R cobre as colunas mencionadas
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // A primeira linha são os headers
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = row[index] || null;
      });
      return obj;
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

