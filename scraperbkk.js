async function scrapeBkk(searchTerm, wfh) {
  const wfhValue = wfh ? '&wfh=1' : '';
  const term = encodeURIComponent(searchTerm);
  const TARGET_URL = "https://www.jobbkk.com/jobs/lists/1/หางาน," + term + ",ทุกจังหวัด,ทั้งหมด.html?keyword_type=" + term + wfhValue;
  const selectorsRaw = ".joblist-updatetime-md-upper span a,.joblist-name-urgent span a,.joblist-company-name a,.position-salary";
  const columnsRaw = "Time,Title,Company,Salary";
  const selectors = selectorsRaw.split(',').map(s => s.trim());
  const columns = columnsRaw.split(',').map(s => s.trim());

  const url = encodeURI(TARGET_URL);
  const resp = await proxyFetch(url);
  if (!resp.ok) throw new Error(`BKK HTTP ${resp.status}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const containers = doc.querySelectorAll('.joblist-boxrow');

  if (containers.length === 0) return { columns: [...columns, 'URL', 'Info', 'Source'], data: [] };

  const extractedUrls = [];
  const data = [];
  containers.forEach(container => {
    const row = {};
    selectors.forEach((sel, colIdx) => {
      const el = container.querySelector(sel);
      row[columns[colIdx]] = el ? cleanText(el.textContent.trim()) : '';
    });
    const linkEl = container.querySelector('.joblist-name-urgent span a');
    const href = linkEl ? linkEl.getAttribute('href') : '';
    if (href) extractedUrls.push(href);
    row['URL'] = href;
    row['Source'] = 'JobBKK';
    data.push(row);
  });
  window.incProgress();

  // Multi-page: pages 2-15
  const pagePromises = [];
  for (let p = 2; p <= 15; p++) {
    const pageUrl = TARGET_URL.replace('/lists/1/', '/lists/' + p + '/');
    pagePromises.push(proxyFetch(encodeURI(pageUrl)).then(r => r.ok ? r.text() : null));
  }
  const pageResults = await Promise.allSettled(pagePromises);
  for (const result of pageResults) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const pDoc = new DOMParser().parseFromString(result.value, 'text/html');
    const pContainers = pDoc.querySelectorAll('.joblist-boxrow');
    pContainers.forEach(container => {
      const row = {};
      selectors.forEach((sel, colIdx) => {
        const el = container.querySelector(sel);
        row[columns[colIdx]] = el ? cleanText(el.textContent.trim()) : '';
      });
      const linkEl = container.querySelector('.joblist-name-urgent span a');
      const href = linkEl ? linkEl.getAttribute('href') : '';
      if (href) extractedUrls.push(href);
      row['URL'] = href;
      row['Source'] = 'JobBKK';
      data.push(row);
    });
  }
  window.incProgress();

  // Detail page scraping with concurrency
  const infoContents = [];
  const CONCURRENCY = 3;
  let idx = 0;
  async function fetchOne() {
    while (true) {
      const i = idx++;
      if (i >= extractedUrls.length) return;
      const detailUrl = extractedUrls[i].startsWith('http') ? extractedUrls[i] : 'https://www.jobbkk.com' + extractedUrls[i];
      try {
        const resp = await proxyFetch(detailUrl);
        if (!resp.ok) { infoContents[i] = ''; continue; }
        const html = await resp.text();
        const detailDoc = new DOMParser().parseFromString(html, 'text/html');
        const ps = detailDoc.querySelectorAll('p.textRed, p.text-red');
        const targets = ['หน้าที่ความรับผิดชอบ', 'คุณสมบัติด้านความรู้และความสามารถ', 'คุณสมบัติ'];
        let text = '';
        for (const p of ps) {
          const pText = p.textContent.replace(/\s+/g, ' ').trim();
          if (targets.some(t => pText.includes(t))) {
            const section = p.nextElementSibling;
            if (section) text += section.textContent.trim() + '\n';
          }
        }
        infoContents[i] = cleanText(text);
      } catch { infoContents[i] = ''; }
    }
  }
  await Promise.all(Array(CONCURRENCY).fill().map(() => fetchOne()));
  window.incProgress();

  data.forEach((row, i) => { row['Info'] = infoContents[i] || ''; });
  return { columns: [...columns, 'URL', 'Info', 'Source'], data };
}
