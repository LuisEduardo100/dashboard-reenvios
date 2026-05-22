const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

let credPart = envContent.split('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=')[1] || '';
let spreadsheetPart = envContent.split('SPREADSHEET_ID=')[1] || '';

if (credPart.includes('SPREADSHEET_ID=')) {
  credPart = credPart.split('SPREADSHEET_ID=')[0];
}
credPart = credPart.trim();
if (credPart.startsWith("'") && credPart.endsWith("'")) credPart = credPart.slice(1, -1);
if (credPart.startsWith('"') && credPart.endsWith('"')) credPart = credPart.slice(1, -1);
env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = credPart;

spreadsheetPart = spreadsheetPart.trim();
if (spreadsheetPart.startsWith("'") && spreadsheetPart.endsWith("'")) spreadsheetPart = spreadsheetPart.slice(1, -1);
if (spreadsheetPart.startsWith('"') && spreadsheetPart.endsWith('"')) spreadsheetPart = spreadsheetPart.slice(1, -1);
env.SPREADSHEET_ID = spreadsheetPart;

async function test() {
  try {
    const credentialsStr = env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
    const credentials = JSON.parse(credentialsStr);
    const spreadsheetId = env.SPREADSHEET_ID;

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
      range: 'Reenvios e Envios!A:R',
    });

    const rows = response.data.values;
    const headers = rows[0];
    
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = row[index] || null;
      });
      return obj;
    });

    console.log('Total entries:', data.length);

    // Let's count original creation months and resend creation months
    const parseCurrencyValue = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (str.includes(',')) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      }
      return parseFloat(str) || 0;
    };

    const formatMonth = (dateStr) => {
      if (!dateStr || dateStr === 'N/A') return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`; // YYYY-MM
    };

    const cohortData = {};
    const originalMonths = new Set();
    const resendMonths = new Set();

    data.forEach(r => {
      if (!r.external_id_original) return;
      const oMonth = formatMonth(r.data_criacao_original);
      const rMonth = formatMonth(r.data_criacao_reenvio);
      const amount = parseCurrencyValue(r.total_amount);

      if (oMonth && rMonth) {
        originalMonths.add(oMonth);
        resendMonths.add(rMonth);

        if (!cohortData[oMonth]) cohortData[oMonth] = {};
        cohortData[oMonth][rMonth] = (cohortData[oMonth][rMonth] || 0) + amount;
      }
    });

    const sortedOriginalMonths = Array.from(originalMonths).sort();
    const sortedResendMonths = Array.from(resendMonths).sort();

    console.log('Original Months:', sortedOriginalMonths);
    console.log('Resend Months:', sortedResendMonths);
    console.log('Cohort sample row for', sortedOriginalMonths[0], ':', cohortData[sortedOriginalMonths[0]]);

  } catch (err) {
    console.error(err);
  }
}

test();
