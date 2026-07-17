(() => {
  const state = {
    view: 'news',
    newsDate: null,
    newsRows: [],
    targetsDate: null,
    companies: [],
    infoLines: [],
    selectedCompany: null,
    cardsData: null,
    search: '',
  };

  const el = {
    sideNav: document.getElementById('side-nav'),
    newsTree: document.getElementById('news-tree'),
    targetsTree: document.getElementById('targets-tree'),
    contentTitle: document.getElementById('content-title'),
    contentSubtitle: document.getElementById('content-subtitle'),
    searchInput: document.getElementById('search-input'),
    viewBody: document.getElementById('view-body'),
    rowTemplate: document.getElementById('contact-row-template'),
  };

  function h(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
    return res.json();
  }

  // ---------- Init ----------

  async function init() {
    const [newsData, targetsData] = await Promise.all([
      fetchJson('data/news.json'),
      fetchJson('data/targets.json'),
    ]);

    state.newsDate = newsData.date;
    state.newsRows = newsData.rows;
    state.targetsDate = targetsData.date;
    state.companies = targetsData.companies;
    state.infoLines = targetsData.infoLines || [];

    renderNewsMenu();
    renderTargetsMenu();

    const newsGroup = document.querySelector('.nav-group[data-key="news"]');
    if (newsGroup) newsGroup.classList.add('open');

    el.sideNav.addEventListener('click', onNavClick);
    el.searchInput.addEventListener('input', onSearchInput);

    selectNews();
  }

  // ---------- Nav menu builders ----------

  function renderNewsMenu() {
    el.newsTree.innerHTML = '';
    const btn = h('div', 'nav-month-group');
    const leaf = document.createElement('button');
    leaf.type = 'button';
    leaf.className = 'nav-leaf active';
    const [y, m, d] = state.newsDate.split('-');
    leaf.textContent = `${y}.${m}.${d}`;
    leaf.dataset.newsHome = '1';
    btn.appendChild(leaf);
    el.newsTree.appendChild(btn);
  }

  function renderTargetsMenu() {
    el.targetsTree.innerHTML = '';
    if (!state.companies.length) {
      el.targetsTree.appendChild(h('div', 'nav-empty', '대상 데이터 없음'));
      return;
    }
    for (const c of state.companies) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav-leaf';
      b.dataset.company = c.company;
      b.appendChild(h('span', null, c.company));
      b.appendChild(h('span', 'nav-count', String(c.contacts.length)));
      el.targetsTree.appendChild(b);
    }
  }

  // ---------- Nav interaction ----------

  function clearAllActive() {
    document.querySelectorAll('#side-nav .active').forEach((n) => n.classList.remove('active'));
  }

  function onNavClick(e) {
    const newsLeaf = e.target.closest('.nav-leaf[data-news-home]');
    if (newsLeaf) {
      selectNews();
      return;
    }

    const companyLeaf = e.target.closest('#targets-tree .nav-leaf');
    if (companyLeaf) {
      selectCompany(companyLeaf.dataset.company);
      return;
    }

    const cardsLeaf = e.target.closest('.nav-parent.nav-leaf[data-key="cards"]');
    if (cardsLeaf) {
      selectCardsView();
      return;
    }

    const parentBtn = e.target.closest('.nav-parent[data-key]:not(.nav-leaf)');
    if (parentBtn) {
      parentBtn.closest('.nav-group').classList.toggle('open');
    }
  }

  function selectNews() {
    state.view = 'news';
    clearAllActive();
    const leaf = el.newsTree.querySelector('.nav-leaf');
    if (leaf) leaf.classList.add('active');
    renderHeader();
    renderView();
  }

  function selectCompany(companyName) {
    state.view = 'targets';
    state.selectedCompany = companyName;
    clearAllActive();
    el.targetsTree.querySelectorAll('.nav-leaf').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.company === companyName);
    });
    renderHeader();
    renderView();
  }

  function selectCardsView() {
    state.view = 'cards';
    clearAllActive();
    const btn = document.querySelector('.nav-parent.nav-leaf[data-key="cards"]');
    if (btn) btn.classList.add('active');
    renderHeader();
    renderView();
    if (!state.cardsData) {
      fetchJson('data/cards.json')
        .then((data) => {
          state.cardsData = data;
          renderHeader();
          renderView();
        })
        .catch(() => {
          state.cardsData = { Contacts: [], TotalContacts: 0 };
          renderView();
        });
    }
  }

  function onSearchInput(e) {
    state.search = e.target.value.trim().toLowerCase();
    renderView();
  }

  // ---------- Header ----------

  function renderHeader() {
    if (state.view === 'news') {
      el.contentTitle.textContent = '뉴스 스카우트';
      el.contentSubtitle.textContent = state.newsDate
        ? `기준일 ${state.newsDate} · ${state.newsRows.length}건`
        : '';
    } else if (state.view === 'targets') {
      el.contentTitle.textContent = '연락대상';
      if (state.selectedCompany) {
        const companyData = state.companies.find((c) => c.company === state.selectedCompany);
        const count = companyData ? companyData.contacts.length : 0;
        el.contentSubtitle.textContent = `${state.selectedCompany} · 기준일 ${state.targetsDate} · ${count}명 연락도래`;
      } else {
        el.contentSubtitle.textContent = `기준일 ${state.targetsDate} · 왼쪽에서 회사를 선택하세요`;
      }
    } else if (state.view === 'cards') {
      el.contentTitle.textContent = '명함리스트';
      const total = state.cardsData ? state.cardsData.TotalContacts : '...';
      el.contentSubtitle.textContent = `전체 ${total}명 (이름·이메일·전화 비공개)`;
    }
  }

  // ---------- View router ----------

  function renderView() {
    el.viewBody.classList.add('view-transitioning');
    window.setTimeout(() => {
      el.viewBody.innerHTML = '';
      if (state.view === 'news') renderNewsView(el.viewBody);
      else if (state.view === 'targets') renderTargetsView(el.viewBody);
      else if (state.view === 'cards') renderCardsView(el.viewBody);
      requestAnimationFrame(() => el.viewBody.classList.remove('view-transitioning'));
    }, 100);
  }

  // ---------- News view ----------

  function renderNewsView(container) {
    const rows = state.newsRows.filter((r) => {
      if (!state.search) return true;
      const hay = `${r['회사']} ${r['제목']}`.toLowerCase();
      return hay.includes(state.search);
    });

    if (!rows.length) {
      container.appendChild(h('div', 'empty-state', '표시할 뉴스가 없습니다.'));
      return;
    }

    const byCompany = new Map();
    for (const r of rows) {
      const company = r['회사'] || '기타';
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company).push(r);
    }

    const list = h('div', 'news-list');
    for (const [company, articles] of byCompany) {
      const card = h('div', 'news-card');
      card.appendChild(h('div', 'news-card-company', company));

      const isNone = articles.length === 1 && (!articles[0]['링크'] || articles[0]['링크'] === '-');
      if (isNone) {
        card.appendChild(h('div', 'news-article-none', articles[0]['제목'] || '이번 기간 확인된 뉴스 없음'));
      } else {
        for (const a of articles) {
          const art = h('div', 'news-article');
          art.appendChild(h('div', 'news-article-meta', `${a['뉴스출처']} · ${a['기사일자']}`));
          art.appendChild(h('div', 'news-article-title', a['제목']));
          art.appendChild(h('div', 'news-article-summary', a['주요내용']));
          if (a['링크'] && a['링크'] !== '-') {
            const link = document.createElement('a');
            link.className = 'news-article-link';
            link.href = a['링크'];
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = '기사 보기 ↗';
            art.appendChild(link);
          }
          card.appendChild(art);
        }
      }
      list.appendChild(card);
    }
    container.appendChild(list);
  }

  // ---------- Targets view ----------

  function renderTargetsView(container) {
    if (!state.selectedCompany) {
      container.appendChild(h('div', 'prompt-state', '왼쪽 연락대상 메뉴에서 회사를 선택하세요.'));
      return;
    }
    const companyData = state.companies.find((c) => c.company === state.selectedCompany);
    if (!companyData) {
      container.appendChild(h('div', 'prompt-state', '회사 데이터를 찾을 수 없습니다.'));
      return;
    }

    const panel = h('div', 'target-list-pane');
    const header = h('div', 'target-panel-header');

    const titleRow = h('div', 'target-panel-title');
    titleRow.appendChild(h('span', 'company-name', companyData.company));
    if (companyData.priority) {
      titleRow.appendChild(h('span', 'priority-badge p-' + companyData.priority, companyData.priority));
    }
    header.appendChild(titleRow);

    const newsRow = h('div', 'target-panel-news');
    newsRow.appendChild(document.createTextNode(companyData.news || '핵심 뉴스 없음'));
    if (companyData.newsLink) {
      const link = document.createElement('a');
      link.className = 'news-link';
      link.href = companyData.newsLink;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '기사 보기 ↗';
      newsRow.appendChild(link);
    }
    header.appendChild(newsRow);
    panel.appendChild(header);

    const contacts = companyData.contacts.filter(
      (c) => !state.search || c.title.toLowerCase().includes(state.search)
    );

    const table = document.createElement('table');
    table.className = 'contact-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>이름</th><th>직급</th><th>이메일</th><th>마지막 컨택</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    for (const contact of contacts) {
      const rowNode = el.rowTemplate.content.cloneNode(true);
      const tr = rowNode.querySelector('tr');
      tr.querySelector('.contact-name').textContent = contact.name;
      tr.querySelector('.contact-title').textContent = contact.title;
      tr.querySelector('.contact-email').textContent = contact.email;
      tr.querySelector('.contact-lastcontact').textContent = contact.daysSince != null
        ? `${contact.lastContact} (${contact.daysSince}일)`
        : (contact.lastContact || '-');
      tbody.appendChild(rowNode);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    container.appendChild(panel);
  }

  // ---------- Cards view ----------

  function renderCardsView(container) {
    if (!state.cardsData) {
      container.appendChild(h('div', 'prompt-state', '명함 데이터를 불러오는 중입니다...'));
      return;
    }
    const contacts = (state.cardsData.Contacts || []).filter((c) => {
      if (!state.search) return true;
      const hay = `${c.Company} ${c.Title}`.toLowerCase();
      return hay.includes(state.search);
    });

    if (!contacts.length) {
      container.appendChild(h('div', 'empty-state', '표시할 명함 데이터가 없습니다.'));
      return;
    }

    const wrap = h('div', 'cards-table-wrap');
    const table = document.createElement('table');
    table.className = 'cards-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>이름</th><th>회사</th><th>직급</th><th>이메일</th><th>전화</th><th>마지막 컨택</th><th>연락도래</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    for (const c of contacts) {
      const tr = document.createElement('tr');
      tr.appendChild(h('td', null, c.Name));
      tr.appendChild(h('td', null, c.Company));
      tr.appendChild(h('td', null, c.Title));
      tr.appendChild(h('td', null, c.Email));
      tr.appendChild(h('td', null, c.Phone));
      tr.appendChild(h('td', null, c.LastContact ? `${c.LastContact} (${c.DaysSinceContact}일)` : '-'));
      tr.appendChild(h('td', c.IsDue ? 'due-yes' : 'due-no', c.IsDue ? '도래' : '-'));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  init();
})();
