async function scrapeSdb(searchTerm, wfh, hybrid) {
  let filterParam = '';
  if (wfh && hybrid) filterParam = '?workarrangement=3%2C2';
  else if (hybrid) filterParam = '/hybrid';
  else if (wfh) filterParam = '/remote';
  const TARGET_URL = "https://th.jobsdb.com/th/" + encodeURIComponent(searchTerm) + "-jobs" + filterParam;
  const selectorsRaw = "div.l4do40,a[data-automation=\"jobTitle\"],a[data-automation=\"jobCompany\"],span[data-automation=\"jobSalary\"]";
  const columnsRaw = "Time,Title,Company,Salary";
  const selectors = selectorsRaw.split(',').map(s => s.trim());
  const columns = columnsRaw.split(',').map(s => s.trim());

  const resp = await fetch(window.PROXY + encodeURIComponent(TARGET_URL));
  if (!resp.ok) throw new Error(`SDB HTTP ${resp.status}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const containers = doc.querySelectorAll('article[data-automation="normalJob"]');

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
    const mainLink = container.querySelector('a[data-automation="job-list-view-job-link"]');
    let href = mainLink ? mainLink.getAttribute('href') : '';
    if (href && href.startsWith('/')) href = 'https://th.jobsdb.com' + href;
    if (href) extractedUrls.push(href);
    row['URL'] = href;
    row['Source'] = 'JobsDB';
    data.push(row);
  });

  // Multi-page pages 2-5
  let pageUrl = '';
  const page2 = doc.querySelector('a[data-automation="page-2"]');
  if (page2) pageUrl = page2.getAttribute('href');
  let pageNum = 2;
  while (pageUrl && pageNum <= 5) {
    const fullUrl = pageUrl.startsWith('http') ? pageUrl : 'https://th.jobsdb.com' + pageUrl;
    try {
      const pResp = await fetch(window.PROXY + encodeURIComponent(fullUrl));
      if (!pResp.ok) break;
      const pHtml = await pResp.text();
      const pDoc = new DOMParser().parseFromString(pHtml, 'text/html');
      const pContainers = pDoc.querySelectorAll('article[data-automation="normalJob"]');
      pContainers.forEach(container => {
        const row = {};
        selectors.forEach((sel, colIdx) => {
          const el = container.querySelector(sel);
          let val = el ? cleanText(el.textContent.trim()) : '';
          if (columns[colIdx] === 'Time') val = parseThaiDate(val);
          row[columns[colIdx]] = val;
        });
        const mainLink = container.querySelector('a[data-automation="job-list-view-job-link"]');
        let href = mainLink ? mainLink.getAttribute('href') : '';
        if (href && href.startsWith('/')) href = 'https://th.jobsdb.com' + href;
        if (href) extractedUrls.push(href);
        row['URL'] = href;
        row['Source'] = 'JobsDB';
        data.push(row);
      });
      pageNum++;
      const nextPage = pDoc.querySelector('a[data-automation="page-' + pageNum + '"]');
      pageUrl = nextPage ? nextPage.getAttribute('href') : '';
    } catch { break; }
  }

  // Detail pages in batches
  const infoContents = [];
  const batchSize = 5;
  for (let i = 0; i < extractedUrls.length; i += batchSize) {
    const batch = extractedUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (url) => {
      const detailUrl = url.startsWith('http') ? url : 'https://th.jobsdb.com' + url;
      try {
        const resp = await fetch(window.PROXY + encodeURIComponent(detailUrl));
        if (!resp.ok) return '';
        const html = await resp.text();
        const detailDoc = new DOMParser().parseFromString(html, 'text/html');
        let text = '';
        const detailsEl = detailDoc.querySelector('[data-automation="jobAdDetails"]');
        if (detailsEl) text += detailsEl.textContent.replace(/\s+/g, ' ').trim();
        if (!text) {
          const body = detailDoc.body;
          if (body) text = body.textContent.replace(/\s+/g, ' ').trim().slice(0, 500);
        }
        return cleanText(text);
      } catch { return ''; }
    }));
    infoContents.push(...results);
  }

  data.forEach((row, i) => { row['Info'] = infoContents[i] || ''; });
  return { columns: [...columns, 'URL', 'Info', 'Source'], data };
}
