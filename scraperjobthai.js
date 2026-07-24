async function scrapeJobthai(searchTerm, wfh, hybrid) {
  const wfhValue = wfh ? '&wfh=true' : '';
  const hybridValue = hybrid ? '&hybridwork=true' : '';
  const TARGET_URL = "https://www.jobthai.com/th/jobs?keyword=" + encodeURIComponent(searchTerm) + wfhValue + hybridValue;
  const selectorsRaw = "span.ohgq7e-0.msklqa-9.hbsTYj,h2.ohgq7e-0[id^=\"job-card-item-\"],h2[color=\"#222222\"],span[id=\"salary-text\"]";
  const columnsRaw = "Time,Title,Company,Salary";
  const selectors = selectorsRaw.split(',').map(s => s.trim());
  const columns = columnsRaw.split(',').map(s => s.trim());

  const resp = await proxyFetch(TARGET_URL);
  if (!resp.ok) throw new Error(`Jobthai HTTP ${resp.status}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const containers = doc.querySelectorAll('.ant-row.msklqa-11.blrqAx');

  if (containers.length === 0) return { columns: [...columns, 'URL', 'Info', 'Source'], data: [] };

  const extractedUrls = [];
  const data = [];
  containers.forEach(container => {
    const row = {};
    selectors.forEach((sel, colIdx) => {
      const el = container.querySelector(sel);
      let val = el ? cleanText(el.textContent.trim()) : '';
      if (columns[colIdx] === 'Time') val = parseThaiDate(val);
      row[columns[colIdx]] = val;
    });
    const mainLink = container.querySelector('a.msklqa-21.jUIAA');
    let href = mainLink ? mainLink.getAttribute('href') : '';
    if (href && href.startsWith('/')) href = 'https://www.jobthai.com' + href.replace('/company/', '/');
    if (href) extractedUrls.push(href);
    row['URL'] = href;
    row['Source'] = 'JobThai';
    data.push(row);
  });

  // Multi-page: fetch pages 2-5 in parallel
  const pageUrls = [];
  const pageLinks = doc.querySelectorAll('a.page-item');
  for (const link of pageLinks) {
    const num = parseInt(link.textContent.trim(), 10);
    if (!isNaN(num) && num >= 2 && num <= 5) {
      const h = link.getAttribute('href');
      if (h) pageUrls.push(h.startsWith('http') ? h : 'https://www.jobthai.com' + h);
    }
  }
  if (pageUrls.length > 0) {
    const pageResults = await Promise.allSettled(pageUrls.map(url =>
      proxyFetch(url).then(r => { if (!r.ok) throw new Error(); return r.text(); })
    ));
    pageResults.forEach(result => {
      if (result.status !== 'fulfilled') return;
      const pDoc = new DOMParser().parseFromString(result.value, 'text/html');
      const pContainers = pDoc.querySelectorAll('.ant-row.msklqa-11.blrqAx');
      pContainers.forEach(container => {
        const row = {};
        selectors.forEach((sel, colIdx) => {
          const el = container.querySelector(sel);
          let val = el ? cleanText(el.textContent.trim()) : '';
          if (columns[colIdx] === 'Time') val = parseThaiDate(val);
          row[columns[colIdx]] = val;
        });
        const mainLink = container.querySelector('a.msklqa-21.jUIAA');
        let href = mainLink ? mainLink.getAttribute('href') : '';
        if (href && href.startsWith('/')) href = 'https://www.jobthai.com' + href.replace('/company/', '/');
        if (href) extractedUrls.push(href);
        row['URL'] = href;
        row['Source'] = 'JobThai';
        data.push(row);
      });
    });
  }

  // Detail pages in batches
  const infoContents = [];
  const BATCH_SIZE = 6;
  for (let i = 0; i < extractedUrls.length; i += BATCH_SIZE) {
    const batch = extractedUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(url => {
      const detailUrl = url.startsWith('http') ? url : 'https://www.jobthai.com/' + url;
      return proxyFetch(detailUrl)
        .then(r => { if (!r.ok) throw new Error(); return r.text(); })
        .then(html => {
          const detailDoc = new DOMParser().parseFromString(html, 'text/html');
          let text = '';
          const detailEl = detailDoc.querySelector('#job-detail');
          if (detailEl) text += detailEl.textContent.replace(/\s+/g, ' ').trim() + '\n';
          const qualOl = detailDoc.querySelector('#job-properties-wrapper ol');
          if (qualOl) {
            const items = [...qualOl.querySelectorAll('li')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
            text += items.join(' | ');
          }
          if (!text) {
            const body = detailDoc.body;
            if (body) text = body.textContent.replace(/\s+/g, ' ').trim().slice(0, 500);
          }
          return cleanText(text);
        });
    }));
    batchResults.forEach(r => infoContents.push(r.status === 'fulfilled' ? r.value : ''));
  }

  data.forEach((row, i) => { row['Info'] = infoContents[i] || ''; });
  return { columns: [...columns, 'URL', 'Info', 'Source'], data };
}
