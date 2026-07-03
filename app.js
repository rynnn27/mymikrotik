(() => {
  'use strict';

  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }
  };

  const html = document.documentElement;
  const sidebar = document.getElementById('sidebar');
  const menuButton = document.getElementById('menuButton');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const themeButton = document.getElementById('themeButton');
  const backToTop = document.getElementById('backToTop');
  const globalSearch = document.querySelector('.global-search');
  const globalSearchInput = document.getElementById('globalSearch');
  const searchPanel = document.getElementById('searchPanel');
  const searchResults = document.getElementById('searchResults');

  // Theme
  const savedTheme = storage.get('fiberlab-theme', null);
  const preferredDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  html.dataset.theme = savedTheme || (preferredDark ? 'dark' : 'light');
  updateThemeLabel();

  themeButton.addEventListener('click', () => {
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    storage.set('fiberlab-theme', html.dataset.theme);
    updateThemeLabel();
  });

  function updateThemeLabel() {
    themeButton.setAttribute('aria-label', html.dataset.theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
  }

  // Mobile navigation
  function setSidebar(open) {
    sidebar.classList.toggle('open', open);
    sidebarOverlay.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  menuButton.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
  sidebarOverlay.addEventListener('click', () => setSidebar(false));
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (window.innerWidth <= 900) setSidebar(false);
  }));

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setSidebar(false);
  });

  // Class filtering
  const classTabs = [...document.querySelectorAll('.class-tab')];
  const moduleSections = [...document.querySelectorAll('.module-section')];
  const classNavLinks = [...document.querySelectorAll('.nav-link[data-class]')];
  const navLabels = [...document.querySelectorAll('.nav-label')];

  classTabs.forEach(tab => tab.addEventListener('click', () => {
    const filter = tab.dataset.classFilter;
    classTabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });

    moduleSections.forEach(section => {
      section.hidden = filter !== 'all' && section.dataset.class !== filter;
    });
    classNavLinks.forEach(link => {
      link.classList.toggle('filtered-out', filter !== 'all' && link.dataset.class !== filter);
    });

    navLabels.forEach(label => {
      const text = label.textContent.toLowerCase();
      const isXI = text.includes('kelas xi ·');
      const isXII = text.includes('kelas xii ·');
      label.classList.toggle('filtered-out', (filter === 'xi' && isXII) || (filter === 'xii' && isXI));
    });

    if (filter !== 'all') {
      const target = document.querySelector(`.module-section[data-class="${filter}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }));

  // Progress tracking
  const completed = new Set(storage.get('fiberlab-completed', []));
  const completeButtons = [...document.querySelectorAll('[data-complete-module]')];

  function renderProgress() {
    completeButtons.forEach(button => {
      const id = button.dataset.completeModule;
      const done = completed.has(id);
      button.classList.toggle('completed', done);
      button.innerHTML = `<span>${done ? '✓' : '○'}</span> ${done ? 'Modul selesai' : 'Tandai selesai'}`;
      button.setAttribute('aria-pressed', String(done));

      const nav = document.querySelector(`.nav-link[data-nav-target="modul-${id}"]`);
      nav?.classList.toggle('completed', done);
      const check = nav?.querySelector('.nav-check');
      if (check) {
        check.textContent = done ? '●' : '○';
        check.setAttribute('aria-label', done ? 'Selesai' : 'Belum selesai');
      }
    });

    const count = completed.size;
    const percentage = Math.round((count / 8) * 100);
    document.getElementById('sidebarProgressText').textContent = `${percentage}%`;
    document.getElementById('sidebarProgressBar').style.width = `${percentage}%`;
    document.getElementById('completedCount').textContent = count;
  }

  completeButtons.forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.completeModule;
    completed.has(id) ? completed.delete(id) : completed.add(id);
    storage.set('fiberlab-completed', [...completed]);
    renderProgress();
  }));
  renderProgress();

  // Persist K3 checklist
  document.querySelectorAll('[data-persist-checklist]').forEach(group => {
    const key = `fiberlab-checklist-${group.dataset.persistChecklist}`;
    const states = storage.get(key, []);
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    boxes.forEach((box, index) => {
      box.checked = Boolean(states[index]);
      box.addEventListener('change', () => storage.set(key, boxes.map(item => item.checked)));
    });
  });

  // Active navigation state
  const navLinks = [...document.querySelectorAll('.nav-link[data-nav-target]')];
  const observedSections = [...document.querySelectorAll('.content-section[id]')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting && !entry.target.hidden)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.navTarget === visible.target.id));
  }, { rootMargin: '-20% 0px -68% 0px', threshold: [0, .1, .3] });
  observedSections.forEach(section => observer.observe(section));

  // Search
  const searchIndex = observedSections.flatMap(section => {
    const title = section.dataset.sectionTitle || section.querySelector('h2')?.textContent || section.id;
    const blocks = section.matches('.module-section') ? [...section.querySelectorAll('.searchable')] : [section];
    return blocks.map((block, blockIndex) => ({
      sectionId: section.id,
      title,
      subtitle: block.querySelector('h3')?.textContent || title,
      text: block.textContent.replace(/\s+/g, ' ').trim(),
      blockIndex,
      element: block
    }));
  });

  function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHTML(text) {
    return text.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function runSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      searchPanel.hidden = true;
      return;
    }

    const terms = normalized.split(/\s+/).filter(Boolean);
    const matches = searchIndex
      .map(item => {
        const haystack = `${item.title} ${item.subtitle} ${item.text}`.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { ...item, score };
      })
      .filter(item => item.score === terms.length)
      .slice(0, 12);

    searchPanel.hidden = false;
    if (!matches.length) {
      searchResults.innerHTML = '<div class="no-results">Materi tidak ditemukan. Gunakan istilah yang lebih singkat.</div>';
      return;
    }

    const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
    searchResults.innerHTML = matches.map((item, index) => {
      const lowerText = item.text.toLowerCase();
      const firstPosition = Math.max(0, lowerText.indexOf(terms[0]));
      const start = Math.max(0, firstPosition - 55);
      const snippet = `${start > 0 ? '…' : ''}${item.text.slice(start, start + 165)}${item.text.length > start + 165 ? '…' : ''}`;
      return `<a href="#${item.sectionId}" class="search-result" data-search-result="${index}">
        <strong>${escapeHTML(item.subtitle).replace(regex, '<mark>$1</mark>')}</strong>
        <span>${escapeHTML(snippet).replace(regex, '<mark>$1</mark>')}</span>
      </a>`;
    }).join('');

    [...searchResults.querySelectorAll('.search-result')].forEach((link, index) => {
      link.addEventListener('click', () => {
        const item = matches[index];
        searchPanel.hidden = true;
        globalSearchInput.value = '';
        globalSearch.classList.remove('mobile-expanded');
        setTimeout(() => {
          item.element.classList.add('highlight-search');
          setTimeout(() => item.element.classList.remove('highlight-search'), 1900);
        }, 450);
      });
    });
  }

  globalSearchInput.addEventListener('input', event => runSearch(event.target.value));
  document.getElementById('closeSearch').addEventListener('click', () => {
    searchPanel.hidden = true;
    globalSearchInput.value = '';
    globalSearch.classList.remove('mobile-expanded');
  });

  globalSearch.addEventListener('click', () => {
    if (window.innerWidth <= 680 && !globalSearch.classList.contains('mobile-expanded')) {
      globalSearch.classList.add('mobile-expanded');
      globalSearchInput.focus();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      if (window.innerWidth <= 680) globalSearch.classList.add('mobile-expanded');
      globalSearchInput.focus();
    }
    if (event.key === 'Escape') {
      searchPanel.hidden = true;
      globalSearch.classList.remove('mobile-expanded');
      if (sidebar.classList.contains('open')) setSidebar(false);
    }
  });

  document.addEventListener('click', event => {
    if (!globalSearch.contains(event.target) && !searchPanel.contains(event.target)) {
      searchPanel.hidden = true;
      if (!globalSearchInput.value) globalSearch.classList.remove('mobile-expanded');
    }
  });

  // Link loss calculator
  const calcIds = ['cableLength', 'fiberAtt', 'connectorCount', 'connectorLoss', 'spliceCount', 'spliceLoss', 'splitterLoss', 'engineeringMargin'];
  const calcInputs = calcIds.map(id => document.getElementById(id));
  const calcDefaults = [5, 0.35, 4, 0.30, 6, 0.10, 10.5, 3];

  function calculateLoss() {
    const values = calcInputs.map(input => Math.max(0, Number.parseFloat(input.value) || 0));
    const [length, fiberAtt, connectorCount, connectorLoss, spliceCount, spliceLoss, splitterLoss, margin] = values;
    const cable = length * fiberAtt;
    const connectors = connectorCount * connectorLoss;
    const splices = spliceCount * spliceLoss;
    const total = cable + connectors + splices + splitterLoss + margin;
    document.getElementById('totalLoss').textContent = `${total.toFixed(2)} dB`;
    document.getElementById('calcBreakdown').textContent = `Kabel ${cable.toFixed(2)} + konektor ${connectors.toFixed(2)} + splice ${splices.toFixed(2)} + splitter ${splitterLoss.toFixed(2)} + margin ${margin.toFixed(2)}`;
  }

  calcInputs.forEach(input => input.addEventListener('input', calculateLoss));
  document.getElementById('resetCalculator').addEventListener('click', () => {
    calcInputs.forEach((input, index) => { input.value = calcDefaults[index]; });
    calculateLoss();
  });
  calculateLoss();

  // Glossary filter
  const glossarySearch = document.getElementById('glossarySearch');
  const glossaryItems = [...document.querySelectorAll('#glossaryGrid article')];
  const glossaryEmpty = document.getElementById('glossaryEmpty');
  glossarySearch.addEventListener('input', () => {
    const query = glossarySearch.value.trim().toLowerCase();
    let visible = 0;
    glossaryItems.forEach(item => {
      const match = `${item.dataset.term} ${item.textContent}`.toLowerCase().includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    glossaryEmpty.hidden = visible !== 0;
  });

  // Quiz
  const quizQuestions = [
    { topic: 'Dasar Fiber Optik', q: 'Lapisan yang menjaga cahaya tetap terpandu di dalam core karena indeks biasnya lebih rendah adalah…', a: ['Coating', 'Cladding', 'Jacket', 'Strength member'], correct: 1, explain: 'Cladding memiliki indeks bias lebih rendah daripada core sehingga mendukung pemantulan internal total.' },
    { topic: 'Dasar Fiber Optik', q: 'Pernyataan yang paling tepat tentang Single Mode adalah…', a: ['Core lebih besar dan banyak lintasan cahaya', 'Umumnya memakai LED pada 850 nm', 'Core sekitar 9 µm dan cocok untuk jarak lebih panjang', 'Selalu memiliki jaket berwarna hijau'], correct: 2, explain: 'Single Mode umumnya memiliki core sekitar 9 µm dan digunakan untuk backbone, FTTH, serta jarak yang lebih panjang.' },
    { topic: 'Kabel & Konektor', q: 'Urutan warna serat nomor 1 sampai 4 adalah…', a: ['Biru, jingga, hijau, cokelat', 'Biru, hijau, jingga, putih', 'Jingga, biru, cokelat, hijau', 'Biru, jingga, abu-abu, cokelat'], correct: 0, explain: 'Empat warna pertama adalah biru, jingga, hijau, dan cokelat.' },
    { topic: 'Kabel & Konektor', q: 'Konektor dengan mekanisme ulir adalah…', a: ['SC', 'LC', 'FC', 'ST'], correct: 2, explain: 'FC menggunakan mekanisme threaded/ulir.' },
    { topic: 'Kabel & Konektor', q: 'Mengapa UPC dan APC tidak boleh dikawinkan langsung?', a: ['Diameter kabel berbeda', 'Geometri polish ferrule berbeda', 'Wavelength selalu berbeda', 'APC hanya untuk multimode'], correct: 1, explain: 'UPC dan APC memiliki geometri permukaan berbeda; APC umumnya memiliki sudut sekitar 8°.' },
    { topic: 'Alat & K3', q: 'Fungsi utama precision cleaver adalah…', a: ['Mengupas coating', 'Membersihkan V-groove', 'Membuat potongan serat presisi', 'Mengukur daya optik'], correct: 2, explain: 'Cleaver menghasilkan end-face yang rata dan mendekati tegak lurus sebelum fusion splicing.' },
    { topic: 'Alat & K3', q: 'Tindakan paling tepat terhadap potongan serat hasil cleaving adalah…', a: ['Disapu dengan tangan', 'Dibuang ke tempat sampah terbuka', 'Dimasukkan ke wadah tertutup tahan tusuk', 'Ditiup dari meja kerja'], correct: 2, explain: 'Serpihan kaca harus langsung dimasukkan ke wadah tertutup dan tahan tusuk.' },
    { topic: 'Fusion Splicing', q: 'Protection sleeve harus dimasukkan…', a: ['Setelah serat selesai di-splice', 'Sebelum kedua serat di-splice', 'Setelah pengujian OTDR', 'Sebelum kabel dikupas dari drum'], correct: 1, explain: 'Sleeve harus berada pada salah satu serat sebelum penyambungan; setelah splice sleeve digeser ke titik sambungan.' },
    { topic: 'Fusion Splicing', q: 'Nilai splice loss pada layar fusion splicer sebaiknya dianggap sebagai…', a: ['Pengukuran end-to-end final', 'Estimasi berdasarkan analisis alat', 'Nilai mutlak tanpa toleransi', 'Pengganti pengujian OPM/OTDR'], correct: 1, explain: 'Fusion splicer umumnya menampilkan estimasi. Verifikasi link tetap dilakukan dengan alat ukur yang sesuai.' },
    { topic: 'Perangkat Pasif', q: 'Perangkat yang membagi satu input optik menjadi beberapa output secara pasif adalah…', a: ['OTDR', 'VFL', 'Optical splitter', 'Fusion splicer'], correct: 2, explain: 'Optical splitter membagi daya optik, misalnya dengan rasio 1:8 atau 1:16.' },
    { topic: 'Perangkat Pasif', q: 'Dalam cable dressing di joint closure, tindakan yang benar adalah…', a: ['Mengikat pigtail sekuat mungkin', 'Melanggar radius tekuk agar tray tertutup', 'Menempatkan sleeve pada holder tray', 'Mencampur semua core tanpa label'], correct: 2, explain: 'Splice sleeve harus ditempatkan pada holder dan serat ditata sesuai radius tekuk serta identitas core.' },
    { topic: 'Pengukuran', q: 'Saat mengukur dengan OPM dan light source, wavelength OPM harus…', a: ['Selalu 1550 nm', 'Sama dengan wavelength sumber', 'Dipilih acak untuk pembanding', 'Diubah setelah hasil disimpan'], correct: 1, explain: 'Wavelength pada OPM harus cocok dengan wavelength sumber agar pembacaan benar.' },
    { topic: 'Pengukuran', q: 'Komponen link loss budget yang benar adalah…', a: ['Panjang kabel, loss/km, konektor, splice, splitter, margin', 'Hanya panjang kabel dan jumlah core', 'Daya listrik splicer dan suhu ruangan', 'Warna jacket dan tipe closure'], correct: 0, explain: 'Total budget pasif menjumlahkan loss kabel, konektor, splice, splitter, serta margin teknik.' },
    { topic: 'Analisis OTDR', q: 'Pulse width OTDR yang lebih pendek umumnya memberikan…', a: ['Resolusi lebih baik tetapi jangkauan lebih kecil', 'Jangkauan lebih jauh dan dead zone lebih besar', 'Loss splitter lebih kecil', 'IOR otomatis lebih akurat'], correct: 0, explain: 'Pulse pendek meningkatkan resolusi event, tetapi energinya lebih rendah sehingga jangkauan/dynamic range berkurang.' },
    { topic: 'Analisis OTDR', q: 'Loss yang jauh lebih besar pada 1550 nm dibanding 1310 nm sering mengindikasikan…', a: ['Konektor SC', 'Macro-bending', 'Kode warna salah', 'OTB terlalu besar'], correct: 1, explain: 'Macro-bending biasanya lebih sensitif pada wavelength lebih panjang seperti 1550/1625 nm.' },
    { topic: 'Troubleshooting', q: 'Langkah awal yang paling rasional saat loss link meningkat adalah…', a: ['Langsung memotong kabel', 'Mengganti semua splitter', 'Verifikasi gejala lalu inspect dan clean konektor', 'Menaikkan daya transmitter tanpa diagnosis'], correct: 2, explain: 'Diagnosis dimulai dari verifikasi dan tindakan non-destruktif seperti inspeksi/pembersihan sebelum lokalisasi lebih lanjut.' }
  ];

  const quizIntro = document.getElementById('quizIntro');
  const quizActive = document.getElementById('quizActive');
  const quizResult = document.getElementById('quizResult');
  const bestScoreElement = document.getElementById('bestScore');
  let activeQuestions = [];
  let currentQuestion = 0;
  let correctAnswers = 0;
  let answered = false;

  function shuffle(array) {
    const clone = [...array];
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  }

  function renderBestScore() {
    const best = storage.get('fiberlab-best-score', null);
    bestScoreElement.textContent = best === null ? 'Belum ada' : `${best}/100`;
  }

  function startQuiz() {
    activeQuestions = shuffle(quizQuestions).map(question => ({ ...question, a: [...question.a] }));
    currentQuestion = 0;
    correctAnswers = 0;
    quizIntro.hidden = true;
    quizResult.hidden = true;
    quizActive.hidden = false;
    renderQuestion();
  }

  function renderQuestion() {
    answered = false;
    const question = activeQuestions[currentQuestion];
    document.getElementById('quizProgressText').textContent = `Soal ${currentQuestion + 1} dari ${activeQuestions.length}`;
    document.getElementById('quizScoreLive').textContent = `Benar: ${correctAnswers}`;
    document.getElementById('quizProgressBar').style.width = `${(currentQuestion / activeQuestions.length) * 100}%`;
    document.getElementById('questionTopic').textContent = question.topic;
    document.getElementById('questionText').textContent = question.q;
    const answerList = document.getElementById('answerList');
    answerList.innerHTML = question.a.map((answer, index) => `<button class="answer-option" data-answer="${index}"><span>${String.fromCharCode(65 + index)}</span>${escapeHTML(answer)}</button>`).join('');
    const feedback = document.getElementById('answerFeedback');
    feedback.hidden = true;
    feedback.className = 'answer-feedback';
    const next = document.getElementById('nextQuestion');
    next.disabled = true;
    next.textContent = currentQuestion === activeQuestions.length - 1 ? 'Lihat hasil' : 'Soal berikutnya';

    answerList.querySelectorAll('.answer-option').forEach(button => button.addEventListener('click', () => selectAnswer(Number(button.dataset.answer))));
  }

  function selectAnswer(selected) {
    if (answered) return;
    answered = true;
    const question = activeQuestions[currentQuestion];
    const isCorrect = selected === question.correct;
    if (isCorrect) correctAnswers += 1;

    document.querySelectorAll('.answer-option').forEach((button, index) => {
      button.disabled = true;
      if (index === question.correct) button.classList.add('correct');
      if (index === selected && !isCorrect) button.classList.add('wrong');
    });

    const feedback = document.getElementById('answerFeedback');
    feedback.hidden = false;
    feedback.classList.add(isCorrect ? 'correct' : 'wrong');
    feedback.innerHTML = `<strong>${isCorrect ? 'Benar.' : 'Belum tepat.'}</strong> ${escapeHTML(question.explain)}`;
    document.getElementById('quizScoreLive').textContent = `Benar: ${correctAnswers}`;
    document.getElementById('nextQuestion').disabled = false;
  }

  function nextQuestion() {
    if (!answered) return;
    if (currentQuestion < activeQuestions.length - 1) {
      currentQuestion += 1;
      renderQuestion();
    } else {
      showResult();
    }
  }

  function showResult() {
    const score = Math.round((correctAnswers / activeQuestions.length) * 100);
    const passed = score >= 75;
    const previousBest = storage.get('fiberlab-best-score', 0);
    if (score > previousBest) storage.set('fiberlab-best-score', score);

    quizActive.hidden = true;
    quizResult.hidden = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('scoreRing').style.setProperty('--score', `${score * 3.6}deg`);
    document.getElementById('resultTitle').textContent = passed ? 'Kompetensi dasar tercapai' : 'Perlu penguatan materi';
    document.getElementById('resultMessage').textContent = passed
      ? 'Nilai memenuhi batas minimum. Tinjau kembali jawaban yang keliru sebelum praktik lapangan.'
      : 'Pelajari kembali modul yang belum dikuasai, khususnya konsep yang salah dijawab.';
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('wrongCount').textContent = activeQuestions.length - correctAnswers;
    document.getElementById('resultStatus').textContent = passed ? 'LULUS' : 'REMEDIAL';
    renderBestScore();
  }

  document.getElementById('startQuiz').addEventListener('click', startQuiz);
  document.getElementById('retryQuiz').addEventListener('click', startQuiz);
  document.getElementById('nextQuestion').addEventListener('click', nextQuestion);
  renderBestScore();

  // Back to top
  window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 650), { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Current year
  document.getElementById('currentYear').textContent = new Date().getFullYear();
})();
