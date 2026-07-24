const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const isNetlify = location.hostname.endsWith('netlify.app');
const PROXY_LIST = isLocal
  ? ['proxy.php?url=']
  : isNetlify
    ? ['/.netlify/functions/proxy?url=']
    : ['https://corsproxy.io/?', 'https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest='];

async function proxyFetch(url) {
  let lastErr;
  for (const proxy of PROXY_LIST) {
    try {
      const resp = await fetch(proxy + encodeURIComponent(url));
      if (resp.ok) return resp;
      lastErr = 'HTTP ' + resp.status;
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error('All proxies failed. Last: ' + lastErr);
}
window.proxyFetch = proxyFetch;

const form = document.getElementById('scrapeForm');
const scrapeBtn = document.getElementById('scrapeBtn');
const exportBtn = document.getElementById('exportCsvBtn');
const clearBtn = document.getElementById('clearBtn');
const resultsSection = document.getElementById('resultsSection');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const rowCount = document.getElementById('rowCount');
const wfhCheck = document.getElementById('wfhCheck');
const hybridCheck = document.getElementById('hybridCheck');

const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');

function setProgress(pct) {
  progressFill.style.width = pct + '%';
  progressLabel.textContent = pct + '%';
}

let currentData = [];

const THAI_MONTHS = {
  'ม.ค.':0,'ก.พ.':1,'มี.ค.':2,'เม.ย.':3,'พ.ค.':4,'มิ.ย.':5,
  'ก.ค.':6,'ส.ค.':7,'ก.ย.':8,'ต.ค.':9,'พ.ย.':10,'ธ.ค.':11
};

function parseThaiDate(text) {
  const m = text.match(/^(\d+)\s+(\S+)\s+(\d+)$/);
  if (!m) return text;
  const day = parseInt(m[1], 10);
  const month = THAI_MONTHS[m[2]];
  let year = parseInt(m[3], 10);
  if (month === undefined) return text;
  if (year < 100) year = 1957 + year;
  else year -= 543;
  const date = new Date(year, month, day);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return text;
  const diffH = Math.round(diffMs / 3600000);
  if (diffH < 1) return '<1 H';
  if (diffH < 24) return diffH + ' H';
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return diffD + ' D';
  return text;
}

function cleanText(str) {
  let s = str.replace(/บาท|ที่แล้ว|บริษัท|เพศ\s*:\s*ไม่ระบุ|อายุ\(ปี\)\s*:\s*ไม่จำกัด|ผ่านมา|per month|฿|Listed more than |ago/gi, '');
  s = s.replace(/seventeen|eighteen|nineteen|fourteen|thirteen|sixteen|fifteen|hundred|seventy|eighty|ninety|sixty|forty|fifty|thirty|twenty|twelve|eleven|seven|eight|three|four|five|nine|one|two|six|ten/gi, m => ({
    seventeen:'17',eighteen:'18',nineteen:'19',fourteen:'14',thirteen:'13',sixteen:'16',fifteen:'15',hundred:'100',
    seventy:'70',eighty:'80',ninety:'90',sixty:'60',forty:'40',fifty:'50',thirty:'30',twenty:'20',
    twelve:'12',eleven:'11',
    seven:'7',eight:'8',three:'3',four:'4',five:'5',nine:'9',
    one:'1',two:'2',six:'6',ten:'10'
  })[m]);
  while (/(\d+)\s+(\d+)/.test(s)) s = s.replace(/(\d+)\s+(\d+)/g, (_, a, b) => String(Number(a) + Number(b)));
  return s.replace(/months|month|เดือน/g, 'M').replace(/weeks|week/g, 'W').replace(/days|day|วัน/g, 'D').replace(/hours|hour|ชั่วโมง/g, 'H').replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderTable(columns, data) {
  const headerRow = columns.map(col => `<th>${escapeHtml(col)}</th>`).join('');
  tableHead.innerHTML = `<tr>${headerRow}</tr>`;

  const bodyRows = data.map(row => {
    const cells = columns.map(col => {
      let val = row[col] || '';
      if (col === 'URL') {
        return `<td><button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(val)}')" title="${escapeHtml(val)}">Copy</button></td>`;
      }
      return `<td><span title="${escapeHtml(val)}">${escapeHtml(val.length > 100 ? val.slice(0, 100) + '...' : val)}</span></td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  tableBody.innerHTML = bodyRows;

  rowCount.textContent = `${data.length} row${data.length !== 1 ? 's' : ''}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const searchTerm = document.getElementById('searchTerm').value.trim();
  const wfh = wfhCheck.checked;
  const hybrid = hybridCheck.checked;

  scrapeBtn.disabled = true;
  scrapeBtn.textContent = 'Scraping all sites...';
  progressWrap.style.display = 'flex';
  setProgress(0);

  try {
    const results = await Promise.all([
      scrapeBkk(searchTerm, wfh),
      scrapeJobthai(searchTerm, wfh, hybrid),
      scrapeSdb(searchTerm, wfh, hybrid)
    ]);

    let allData = [];
    let allColumns = ['Time', 'Title', 'Company', 'Salary', 'URL', 'Info', 'Source'];

    for (const result of results) {
      if (result.data.length > 0) {
        allData = allData.concat(result.data);
      }
    }

    if (allData.length === 0) {
      alert('No job listings found on any site.');
      return;
    }

    currentData = allData;
    setProgress(100);
    renderTable(allColumns, allData);
    resultsSection.style.display = 'block';
  } catch (err) {
    alert('Scrape failed: ' + err.message);
  } finally {
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = 'Scrape All';
    progressWrap.style.display = 'none';
  }
});

exportBtn.addEventListener('click', () => {
  if (currentData.length === 0) return;
  const columns = Object.keys(currentData[0]);
  const csvRows = [columns.join(',')];
  for (const row of currentData) {
    const values = columns.map(col => {
      let val = (row[col] || '').toString();
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'scraped_data.csv';
  link.click();
  URL.revokeObjectURL(link.href);
});

clearBtn.addEventListener('click', () => {
  currentData = [];
  resultsSection.style.display = 'none';
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';
});
