(() => {
  const DEMO_MESSAGE = '공개 데모 사이트입니다. 실제 메일 발송은 로컬 프로그램(npm start)에서만 가능합니다.';

  const state = {
    view: 'news',
    newsDate: null,
    newsRows: [],
    targetsDate: null,
    companies: [],
    infoLines: [],
    selectedCompany: null,
    activeContact: null,
    template: null,
    selected: new Map(), // key: `${company}::${email}` -> { company, name, title, email }
    cardsData: null,
    search: '',
  };

  const PLACEHOLDER_HINT = '사용 가능: {{이름}} {{직급}} {{이메일}} {{회사}} {{뉴스}} {{뉴스링크}} (미리보기 전용, 저장되지 않음)';

  const el = {
    sideNav: document.getElementById('side-nav'),
    newsTree: document.getElementById('news-tree'),
    targetsTree: document.getElementById('targets-tree'),
    contentTitle: document.getElementById('content-title'),
    contentSubtitle: document.getElementById('content-subtitle'),
    searchInput: document.getElementById('search-input'),
    viewBody: document.getElementById('view-body'),
    sideSelection: document.getElementById('side-selection'),
    selectionCount: document.getElementById('selection-count'),
    selectionCompanies: document.getElementById('selection-companies'),
    clearSelectionBtn: document.getElementById('clear-selection-btn'),
    openComposeBtn: document.getElementById('open-compose-btn'),
    overlay: document.getElementById('compose-overlay'),
    composeTitle: document.getElementById('compose-title'),
    closeComposeBtn: document.getElementById('close-compose-btn'),
    composeTo: document.getElementById('compose-to'),
    composeCc: document.getElementById('compose-cc'),
    composeSubject: document.getElementById('compose-subject'),
    composeBody: document.getElementById('compose-body'),
    composeMessage: document.getElementById('compose-message'),
    sendBtn: document.getElementById('send-btn'),
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

  function selKey(company, email) {
    return `${company}::${email}`;
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
    el.clearSelectionBtn.addEventListener('click', clearSelection);
    el.openComposeBtn.addEventListener('click', openCompose);
    el.closeComposeBtn.addEventListener('click', closeCompose);
    el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeCompose(); });
    el.sendBtn.addEventListener('click', doSend);

    selectNews();
  }

  // ---------- Nav menu builders ----------

  function renderNewsMenu() {
    el.newsTree.innerHTML = '';
    const group = h('div', 'nav-month-group');
    const leaf = document.createElement('button');
    leaf.type = 'button';
    leaf.className = 'nav-leaf active';
    const [y, m, d] = state.newsDate.split('-');
    leaf.textContent = `${y}.${m}.${d}`;
    leaf.dataset.newsHome = '1';
    group.appendChild(leaf);
    el.newsTree.appendChild(group);
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
    state.activeContact = null;
    const companyData = state.companies.find((c) => c.company === companyName);
    state.template = defaultTemplateFor(companyData);
    clearAllActive();
    el.targetsTree.querySelectorAll('.nav-leaf').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.company === companyName);
    });
    renderHeader();
    renderView();
  }

  function defaultTemplateFor(companyData) {
    const bodyLines = ['{{이름}} {{직급}}님, 안녕하세요.', '', '{{회사}} 관련하여 안부 인사드리며 연락드립니다.'];
    if (companyData && companyData.news) {
      bodyLines.push('', '최근 소식 잘 보았습니다 — {{뉴스}} ({{뉴스링크}})', '관련하여 편하실 때 잠시 통화나 미팅 가능하실지 여쭙고자 합니다.');
    } else {
      bodyLines.push('오랜만에 안부 여쭙고, 편하실 때 잠시 미팅 가능하실지 여쭙고자 합니다.');
    }
    bodyLines.push('', '감사합니다.');
    return {
      subject: '[{{회사}}] {{이름}} {{직급}}님께 안부 인사드립니다',
      body: bodyLines.join('\n'),
    };
  }

  function substituteTemplate(text, companyData, contact) {
    return String(text || '')
      .replace(/\{\{\s*이름\s*\}\}/g, contact.name)
      .replace(/\{\{\s*직급\s*\}\}/g, contact.title)
      .replace(/\{\{\s*이메일\s*\}\}/g, contact.email)
      .replace(/\{\{\s*회사\s*\}\}/g, companyData.company)
      .replace(/\{\{\s*뉴스링크\s*\}\}/g, companyData.newsLink || '')
      .replace(/\{\{\s*뉴스\s*\}\}/g, companyData.news || '');
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
      el.contentSubtitle.textContent = `전체 ${total}명 (이름·이메일·전화 일부 마스킹)`;
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

    const split = h('div', 'targets-split');
    split.appendChild(buildTargetListPane(companyData));
    split.appendChild(buildDraftPane(companyData));
    container.appendChild(split);

    if (state.activeContact) updateDraftPreview(companyData);
  }

  function buildTargetListPane(companyData) {
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

    const contacts = companyData.contacts.filter(
      (c) => !state.search || c.title.toLowerCase().includes(state.search)
    );

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'btn btn-ghost btn-sm';
    selectAllBtn.style.marginTop = '14px';
    const allSelected = contacts.length > 0 && contacts.every((c) => state.selected.has(selKey(companyData.company, c.email)));
    selectAllBtn.textContent = allSelected ? '전체 해제' : '전체 선택';
    selectAllBtn.addEventListener('click', () => {
      for (const c of contacts) setContactSelected(companyData, c, !allSelected);
      updateSelectionBar();
      renderView();
    });
    header.appendChild(selectAllBtn);

    panel.appendChild(header);

    const table = document.createElement('table');
    table.className = 'contact-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th class="col-check"></th><th>이름</th><th>직급</th><th>이메일</th><th>마지막 컨택</th></tr>';
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

      const checkbox = tr.querySelector('.contact-checkbox');
      const key = selKey(companyData.company, contact.email);
      checkbox.checked = state.selected.has(key);
      tr.classList.toggle('contact-row-selected', checkbox.checked);
      tr.classList.toggle(
        'active-row',
        !!state.activeContact && state.activeContact.email === contact.email && state.selectedCompany === companyData.company
      );

      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        setContactSelected(companyData, contact, checkbox.checked);
        tr.classList.toggle('contact-row-selected', checkbox.checked);
        updateSelectionBar();
      });

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.contact-checkbox')) return;
        state.activeContact = contact;
        tbody.querySelectorAll('tr.active-row').forEach((r) => r.classList.remove('active-row'));
        tr.classList.add('active-row');
        updateDraftPreview(companyData);
      });

      tbody.appendChild(rowNode);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  function buildDraftPane(companyData) {
    const pane = h('div', 'target-draft-pane');
    if (!state.template) {
      pane.appendChild(h('div', 'prompt-state', '템플릿을 불러오는 중입니다...'));
      return pane;
    }

    const templateSection = h('div', 'draft-section');
    const templateHead = h('div', 'draft-section-head');
    templateHead.appendChild(h('h3', null, '회사 템플릿 (미리보기 전용)'));
    const statusEl = h('span', 'draft-status', '데모 · 저장되지 않음');
    templateHead.appendChild(statusEl);
    templateSection.appendChild(templateHead);
    templateSection.appendChild(h('p', 'draft-hint', PLACEHOLDER_HINT));

    const subjectInput = document.createElement('input');
    subjectInput.type = 'text';
    subjectInput.className = 'draft-input';
    subjectInput.value = state.template.subject;
    templateSection.appendChild(subjectInput);

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'draft-textarea';
    bodyInput.rows = 9;
    bodyInput.value = state.template.body;
    templateSection.appendChild(bodyInput);

    const onTemplateEdit = () => {
      state.template = { subject: subjectInput.value, body: bodyInput.value };
      if (state.activeContact) updateDraftPreview(companyData);
    };
    subjectInput.addEventListener('input', onTemplateEdit);
    bodyInput.addEventListener('input', onTemplateEdit);

    pane.appendChild(templateSection);
    pane.appendChild(h('div', 'draft-divider'));

    const previewSection = h('div', 'draft-section');
    previewSection.appendChild(h('h3', null, '발송 미리보기 (데모)'));

    const promptEl = h('div', 'draft-preview-prompt', '왼쪽 목록에서 대상자를 클릭하면 미리보기가 채워집니다.');
    promptEl.id = 'preview-prompt';
    previewSection.appendChild(promptEl);

    const fields = h('div', 'draft-section');
    fields.id = 'draft-preview-fields';
    fields.classList.add('hidden');

    const targetLabel = h('div', 'draft-preview-target');
    targetLabel.id = 'preview-target-label';
    fields.appendChild(targetLabel);

    const toInput = document.createElement('input');
    toInput.type = 'text';
    toInput.className = 'draft-input';
    toInput.id = 'preview-to-input';
    toInput.readOnly = true;
    fields.appendChild(toInput);

    const previewSubjectInput = document.createElement('input');
    previewSubjectInput.type = 'text';
    previewSubjectInput.className = 'draft-input';
    previewSubjectInput.id = 'preview-subject-input';
    previewSubjectInput.readOnly = true;
    fields.appendChild(previewSubjectInput);

    const previewBodyInput = document.createElement('textarea');
    previewBodyInput.className = 'draft-textarea';
    previewBodyInput.id = 'preview-body-input';
    previewBodyInput.rows = 10;
    previewBodyInput.readOnly = true;
    fields.appendChild(previewBodyInput);

    const msgEl = h('div', 'draft-message hidden');
    msgEl.id = 'draft-message';
    fields.appendChild(msgEl);

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'btn btn-primary';
    sendBtn.textContent = '발송 (데모)';
    sendBtn.addEventListener('click', () => {
      showInlineMessage(msgEl, DEMO_MESSAGE, false);
    });
    fields.appendChild(sendBtn);

    previewSection.appendChild(fields);
    pane.appendChild(previewSection);

    return pane;
  }

  function updateDraftPreview(companyData) {
    const contact = state.activeContact;
    const promptEl = document.getElementById('preview-prompt');
    const fields = document.getElementById('draft-preview-fields');
    if (!contact || !fields) return;

    if (promptEl) promptEl.classList.add('hidden');
    fields.classList.remove('hidden');

    const label = document.getElementById('preview-target-label');
    const toInput = document.getElementById('preview-to-input');
    const subjInput = document.getElementById('preview-subject-input');
    const bodyInput = document.getElementById('preview-body-input');
    const msgEl = document.getElementById('draft-message');

    if (label) label.textContent = `${contact.name} ${contact.title} · ${contact.email}`;
    if (toInput) toInput.value = contact.email;
    if (subjInput) subjInput.value = substituteTemplate(state.template.subject, companyData, contact);
    if (bodyInput) bodyInput.value = substituteTemplate(state.template.body, companyData, contact);
    if (msgEl) msgEl.classList.add('hidden');
  }

  function showInlineMessage(target, text, ok) {
    target.textContent = text;
    target.className = 'draft-message ' + (ok ? 'ok' : 'error');
    target.classList.remove('hidden');
  }

  function setContactSelected(companyData, contact, selected) {
    const key = selKey(companyData.company, contact.email);
    if (selected) {
      state.selected.set(key, { company: companyData.company, name: contact.name, title: contact.title, email: contact.email });
    } else {
      state.selected.delete(key);
    }
  }

  function clearSelection() {
    state.selected.clear();
    updateSelectionBar();
    renderView();
  }

  function updateSelectionBar() {
    const count = state.selected.size;
    el.sideSelection.classList.toggle('hidden', count === 0);
    el.selectionCount.textContent = `${count}명`;
    const companies = new Set([...state.selected.values()].map((v) => v.company));
    el.selectionCompanies.textContent = companies.size ? [...companies].join(', ') : '선택된 회사 없음';
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

  // ---------- Compose: bulk digest (demo only) ----------

  function buildDigestBody() {
    const byCompany = new Map();
    for (const v of state.selected.values()) {
      if (!byCompany.has(v.company)) byCompany.set(v.company, []);
      byCompany.get(v.company).push(v);
    }

    const lines = [`VERA 영업관리팀 컨택 리스트 (${state.targetsDate})`, ''];
    for (const [companyName, contacts] of byCompany) {
      const companyData = state.companies.find((c) => c.company === companyName);
      lines.push(`■ ${companyName}${companyData?.priority ? ` [우선순위 ${companyData.priority}]` : ''}`);
      if (companyData?.news) {
        lines.push(`  핵심뉴스: ${companyData.news}${companyData.newsLink ? ` (${companyData.newsLink})` : ''}`);
      }
      for (const c of contacts) {
        lines.push(`  - ${c.name} ${c.title} <${c.email}>`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  function openCompose() {
    if (state.selected.size === 0) return;
    const companies = new Set([...state.selected.values()].map((v) => v.company));
    el.composeTitle.textContent = '메일 발송 (데모)';
    el.composeTo.value = '';
    el.composeCc.value = '';
    el.composeSubject.value = `VERA 영업관리팀 컨택 리스트 (${state.targetsDate}) - ${companies.size}개사 ${state.selected.size}명`;
    el.composeBody.value = buildDigestBody();
    el.composeMessage.classList.add('hidden');
    el.overlay.classList.remove('hidden');
  }

  function closeCompose() {
    el.overlay.classList.add('hidden');
  }

  function doSend() {
    el.composeMessage.classList.add('hidden');
    showComposeMessage(DEMO_MESSAGE, false);
  }

  function showComposeMessage(text, ok) {
    el.composeMessage.textContent = text;
    el.composeMessage.className = 'compose-message ' + (ok ? 'ok' : 'error');
    el.composeMessage.classList.remove('hidden');
  }

  init();
})();
