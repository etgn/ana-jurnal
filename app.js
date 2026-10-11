// ==========================================
// CONFIGURATION & CREDENTIALS
// ==========================================
const SUPABASE_URL = "https://olmptjeybfzvzzhrxsmb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6nrGBfhRq0dfMTAnvaKBaQ_UXVP9yHD"; 

const ADMIN_PASSWORD = "123"; 
let isAdminLoggedIn = false;
let allJournals = [];
let currentCategory = "ALL";

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("isAdmin") === "true") {
    isAdminLoggedIn = true;
  }
  updateAdminUI();
  loadJournals();
  switchCalculatorMode();

  // Tutup semua custom dropdown saat klik di luar
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown")) {
      document.querySelectorAll(".custom-dropdown").forEach(el => el.classList.remove("open"));
    }
  });
});

// Custom Dropdown Handler Umum
function toggleCustomDropdown(dropdownId) {
  document.querySelectorAll(".custom-dropdown").forEach(el => {
    if (el.id !== dropdownId) el.classList.remove("open");
  });
  document.getElementById(dropdownId).classList.toggle("open");
}

function selectCustomOption(dropdownId, value, text) {
  const dropdown = document.getElementById(dropdownId);
  dropdown.querySelector(".custom-dropdown-selected").innerText = text;
  dropdown.querySelector("input[type='hidden']").value = value;
  dropdown.classList.remove("open");

  if (dropdownId === 'calc-custom-dropdown') {
    switchCalculatorMode();
  }
}

// ==========================================
// CUSTOM MODERN POPUP NOTIFICATION
// ==========================================
function showPopup(title, message, type = "info", onOk = null) {
  const modal = document.getElementById("modal-popup");
  const titleEl = document.getElementById("popup-title");
  const msgEl = document.getElementById("popup-message");
  const iconEl = document.getElementById("popup-icon");
  const actionsEl = document.getElementById("popup-actions");

  titleEl.innerText = title;
  msgEl.innerText = message;

  if (type === "success") {
    iconEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--success);"></i>`;
  } else if (type === "error") {
    iconEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>`;
  } else if (type === "confirm") {
    iconEl.innerHTML = `<i class="fa-solid fa-circle-question" style="color: var(--warning);"></i>`;
  } else {
    iconEl.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--primary);"></i>`;
  }

  if (type === "confirm" && typeof onOk === "function") {
    actionsEl.innerHTML = `
      <button class="btn-secondary" style="flex:1;" onclick="closePopup()">Batal</button>
      <button class="btn-primary" style="flex:1; background:var(--danger); justify-content:center;" id="popup-confirm-btn">Ya, Lanjutkan</button>
    `;
    document.getElementById("popup-confirm-btn").onclick = () => {
      closePopup();
      onOk();
    };
  } else {
    actionsEl.innerHTML = `<button class="btn-primary" style="width:100%; justify-content:center;" onclick="closePopup()">OK</button>`;
  }

  modal.classList.add("active");
}

function closePopup() {
  document.getElementById("modal-popup").classList.remove("active");
}

// ==========================================
// SUPABASE HELPER
// ==========================================
async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
  return response.status !== 204 ? await response.json() : null;
}

async function uploadImageToStorage(file) {
  if (!file) return "";
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/journals-images/${fileName}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type
    },
    body: file
  });

  if (!response.ok) {
    throw new Error("Gagal mengunggah file gambar ke Supabase Storage.");
  }

  return `${SUPABASE_URL}/storage/v1/object/public/journals-images/${fileName}`;
}

// ==========================================
// MODAL CONTROLLER
// ==========================================
function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

// ==========================================
// ADMIN SYSTEM
// ==========================================
function loginAdmin() {
  const inputPass = document.getElementById("admin-pass-input").value;
  if (inputPass === ADMIN_PASSWORD) {
    isAdminLoggedIn = true;
    localStorage.setItem("isAdmin", "true");
    document.getElementById("admin-pass-input").value = "";
    closeModal("modal-admin");
    updateAdminUI();
    showPopup("Berhasil", "Anda sekarang berada di mode Admin.", "success");
  } else {
    showPopup("Gagal", "Password Admin Salah!", "error");
  }
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  localStorage.removeItem("isAdmin");
  updateAdminUI();
  showPopup("Informasi", "Berhasil logout dari mode Admin.", "info");
}

function updateAdminUI() {
  const btnLogin = document.getElementById("btn-login-admin");
  const btnLogout = document.getElementById("btn-logout-admin");

  if (isAdminLoggedIn) {
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "flex";
  } else {
    if (btnLogin) btnLogin.style.display = "flex";
    if (btnLogout) btnLogout.style.display = "none";
  }
  renderJournals(allJournals);
}

// ==========================================
// LOAD & RENDER JURNAL DENGAN TIMESTAMP
// ==========================================
async function loadJournals() {
  const listEl = document.getElementById("journal-list");
  listEl.innerHTML = `<p style="color: var(--slate-500);">Memuat data dari database cloud...</p>`;

  try {
    const data = await supabaseFetch("journals?select=*&order=created_at.desc");
    allJournals = data || [];
    
    if (allJournals.length === 0) {
      await seedDefaultJournals();
    } else {
      renderJournals(allJournals);
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p style="color: var(--danger); font-weight: 600;">Gagal memuat data. Pastikan kolom database 'updated_at' sudah ditambahkan via SQL Editor.</p>`;
  }
}

async function seedDefaultJournals() {
  const nowIso = new Date().toISOString();
  const defaults = [
    {
      id: "jurnal_hb",
      title: "Hemoglobin (Hb)",
      category: "Hematologi",
      reference_range: "Pria: 13.5 - 17.5 g/dL | Wanita: 12.0 - 15.5 g/dL",
      description: "Protein dalam sel darah merah yang berfungsi mengangkut oksigen ke seluruh tubuh.",
      contributor: "Ana",
      created_at: nowIso,
      updated_at: nowIso
    },
    {
      id: "jurnal_eritrosit",
      title: "Eritrosit (Sel Darah Merah)",
      category: "Hematologi",
      reference_range: "Pria: 4.5 - 5.5 juta/µL | Wanita: 4.0 - 5.0 juta/µL",
      description: "Sel darah merah yang bertugas membawa oksigen dari paru-paru ke jaringan tubuh.",
      contributor: "Ana",
      created_at: nowIso,
      updated_at: nowIso
    },
    {
      id: "jurnal_leukosit",
      title: "Leukosit (Sel Darah Putih)",
      category: "Hematologi",
      reference_range: "4,000 - 11,000 /µL",
      description: "Komponen sistem kekebalan tubuh yang melawan infeksi dan benda asing.",
      contributor: "Ana",
      created_at: nowIso,
      updated_at: nowIso
    },
    {
      id: "jurnal_trombosit",
      title: "Trombosit (Platelet)",
      category: "Hematologi",
      reference_range: "150,000 - 450,000 /µL",
      description: "Berperan penting dalam proses pembekuan darah untuk menghentikan pendarahan.",
      contributor: "Ana",
      created_at: nowIso,
      updated_at: nowIso
    }
  ];

  try {
    for (let item of defaults) {
      await supabaseFetch("journals", {
        method: "POST",
        body: JSON.stringify(item)
      });
    }
    const data = await supabaseFetch("journals?select=*&order=created_at.desc");
    allJournals = data || [];
    renderJournals(allJournals);
  } catch (err) {
    console.error("Gagal melakukan seed:", err);
  }
}

function formatLocalDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) + " pukul " + d.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
}

function renderJournals(journals) {
  const listEl = document.getElementById("journal-list");
  const countEl = document.getElementById("journal-count");

  let filtered = journals;
  if (currentCategory !== "ALL") {
    filtered = journals.filter(j => j.category === currentCategory);
  }

  const searchQuery = document.getElementById("search-input").value.toLowerCase();
  if (searchQuery) {
    filtered = filtered.filter(j => 
      j.title.toLowerCase().includes(searchQuery) || 
      (j.description && j.description.toLowerCase().includes(searchQuery))
    );
  }

  countEl.innerText = `${filtered.length} Parameter ditemukan`;

  if (!filtered || filtered.length === 0) {
    listEl.innerHTML = `<p style="color: var(--slate-500);">Tidak ada parameter atau jurnal yang sesuai.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map(j => {
    let timeLabel = j.updated_at ? `Diperbarui: ${formatLocalDate(j.updated_at)}` : `Dibuat: ${formatLocalDate(j.created_at)}`;
    return `
      <div class="param-card" onclick="openJournalDetail('${j.id}')">
        <div>
          <div class="card-top">
            <span class="badge-category">${escapeHtml(j.category)}</span>
            <div style="display: flex; gap: 6px;">
              ${isAdminLoggedIn ? `
                <button class="btn-secondary" style="background:var(--primary); padding:4px 8px;" onclick="event.stopPropagation(); openEditJournalModal('${j.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-secondary" style="background:var(--danger); padding:4px 8px;" onclick="event.stopPropagation(); deleteJournal('${j.id}')"><i class="fa-solid fa-trash"></i></button>
              ` : ''}
            </div>
          </div>
          <h3>${escapeHtml(j.title)}</h3>
          <p class="synonyms">Oleh: ${escapeHtml(j.contributor || 'Ana')} • <span style="font-size:0.75rem;">${timeLabel}</span></p>

          <div class="range-box">
            <div class="range-label">Rentang Normal</div>
            <div class="range-value">${escapeHtml(j.reference_range || '-')}</div>
          </div>

          <p class="card-snippet">${escapeHtml(j.description || '')}</p>
        </div>

        <div class="card-footer-btn">
          <span>Lihat Detail & Diskusi</span> <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    `;
  }).join('');
}

function selectCategory(cat, el) {
  currentCategory = cat;
  document.querySelectorAll(".category-list li").forEach(li => li.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("current-category-title").innerText = cat === "ALL" ? "Semua Parameter" : cat;
  renderJournals(allJournals);
}

function filterJournals() {
  renderJournals(allJournals);
}

// ==========================================
// TAMBAH & EDIT JURNAL
// ==========================================
function openAddJournalModal() {
  document.getElementById("journal-form").reset();
  document.getElementById("edit-journal-id").value = "";
  document.getElementById("form-modal-title").innerText = "Tambah Parameter / Jurnal";
  document.getElementById("form-modal-subtitle").innerText = "Tambahkan data referensi baru ke database cloud.";
  document.getElementById("btn-submit-journal-text").innerText = "Kirim Ke Cloud Database";
  selectCustomOption('journal-cat-dropdown', 'Hematologi', 'Hematologi');
  openModal("modal-submit");
}

function openEditJournalModal(id) {
  const journal = allJournals.find(j => j.id === id);
  if (!journal) return;

  document.getElementById("edit-journal-id").value = journal.id;
  document.getElementById("journal-title").value = journal.title || "";
  selectCustomOption('journal-cat-dropdown', journal.category || 'Hematologi', journal.category || 'Hematologi');
  document.getElementById("journal-ref").value = journal.reference_range || "";
  document.getElementById("journal-desc").value = journal.description || "";
  document.getElementById("journal-contributor").value = journal.contributor || "Ana";

  document.getElementById("form-modal-title").innerText = "Edit Parameter / Jurnal";
  document.getElementById("form-modal-subtitle").innerText = "Perbarui data referensi klinis di database.";
  document.getElementById("btn-submit-journal-text").innerText = "Simpan Perubahan";
  openModal("modal-submit");
}

async function submitJournalForm() {
  const editId = document.getElementById("edit-journal-id").value;
  const title = document.getElementById("journal-title").value;
  const category = document.getElementById("journal-category").value;
  const reference_range = document.getElementById("journal-ref").value;
  const description = document.getElementById("journal-desc").value;
  const contributor = document.getElementById("journal-contributor").value || "Ana";
  const fileInput = document.getElementById("journal-image-file");
  const nowIso = new Date().toISOString();

  if (!title || !category) {
    showPopup("Peringatan", "Judul dan Kategori wajib diisi!", "error");
    return;
  }

  try {
    let imageUrl = "";
    if (fileInput && fileInput.files[0]) {
      showPopup("Informasi", "Mengunggah gambar ke cloud...", "info");
      imageUrl = await uploadImageToStorage(fileInput.files[0]);
    }

    if (editId) {
      let updatePayload = { title, category, reference_range, description, contributor, updated_at: nowIso };
      if (imageUrl) updatePayload.image_url = imageUrl;

      await supabaseFetch(`journals?id=eq.${editId}`, {
        method: "PATCH",
        body: JSON.stringify(updatePayload)
      });
      showPopup("Berhasil", "Parameter berhasil diperbarui!", "success");
    } else {
      const newJournal = {
        id: "jurnal_" + Date.now(),
        title,
        category,
        reference_range,
        description,
        image_url: imageUrl,
        contributor,
        created_at: nowIso,
        updated_at: nowIso
      };

      await supabaseFetch("journals", {
        method: "POST",
        body: JSON.stringify(newJournal)
      });
      showPopup("Berhasil", "Parameter baru berhasil ditambahkan ke database!", "success");
    }

    document.getElementById("journal-form").reset();
    closeModal("modal-submit");
    loadJournals();
  } catch (err) {
    showPopup("Gagal", "Terjadi kesalahan: " + err.message, "error");
  }
}

async function deleteJournal(id) {
  if (!isAdminLoggedIn) return;
  showPopup("Konfirmasi Hapus", "Apakah Anda yakin ingin menghapus postingan jurnal ini?", "confirm", async () => {
    try {
      await supabaseFetch(`journals?id=eq.${id}`, { method: "DELETE" });
      showPopup("Berhasil", "Postingan berhasil dihapus.", "success");
      loadJournals();
    } catch (err) {
      showPopup("Gagal", "Gagal menghapus: " + err.message, "error");
    }
  });
}

// ==========================================
// DETAIL & KOMENTAR DENGAN WAKTU
// ==========================================
async function openJournalDetail(id) {
  const journal = allJournals.find(j => j.id === id);
  if (!journal) return;

  document.getElementById("active-journal-id").value = id;
  const bodyEl = document.getElementById("modal-detail-body");

  let timeInfo = journal.updated_at ? `Diperbarui: ${formatLocalDate(journal.updated_at)}` : `Dibuat: ${formatLocalDate(journal.created_at)}`;

  bodyEl.innerHTML = `
    <span class="modal-category">${escapeHtml(journal.category)}</span>
    <h3 class="modal-title">${escapeHtml(journal.title)}</h3>
    <p class="modal-synonyms">Pengirim: ${escapeHtml(journal.contributor || 'Ana')} • ${timeInfo}</p>

    ${journal.image_url ? `<img src="${escapeHtml(journal.image_url)}" class="modal-img-preview" alt="Gambar Jurnal">` : ''}

    <div class="modal-highlight-box">
      <div class="range-label">Nilai Rujukan / Rentang Normal</div>
      <p style="font-size: 1.1rem; color: var(--primary-dark);">${escapeHtml(journal.reference_range || '-')}</p>
    </div>

    <div class="modal-section-title"><i class="fa-solid fa-file-medical"></i> Penjelasan & Studi Klinis</div>
    <p class="modal-body-text">${escapeHtml(journal.description || 'Tidak ada penjelasan tambahan.')}</p>
  `;

  openModal("modal-detail");
  loadComments(id);
}

async function loadComments(journalId) {
  const commentsListEl = document.getElementById("comments-list");
  commentsListEl.innerHTML = `<p class="comment-text">Memuat komentar...</p>`;

  try {
    const comments = await supabaseFetch(`comments?journal_id=eq.${journalId}&order=created_at.asc`);
    if (!comments || comments.length === 0) {
      commentsListEl.innerHTML = `<p class="comment-text" style="color: var(--slate-500);">Belum ada catatan/komentar.</p>`;
      return;
    }

    commentsListEl.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-author">
          <span>${escapeHtml(c.author)}</span>
          <span class="comment-time">${formatLocalDate(c.created_at)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <div class="comment-text">${escapeHtml(c.text)}</div>
          ${isAdminLoggedIn ? `<button style="background:var(--danger); color:white; border:none; padding:2px 6px; border-radius:4px; font-size:0.7rem; cursor:pointer;" onclick="deleteComment(${c.id}, '${journalId}')">Hapus</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    commentsListEl.innerHTML = `<p class="comment-text" style="color: var(--danger);">Gagal memuat komentar.</p>`;
  }
}

async function submitComment() {
  const journalId = document.getElementById("active-journal-id").value;
  const author = document.getElementById("comment-author").value;
  const text = document.getElementById("comment-text").value;
  const nowIso = new Date().toISOString();

  if (!author || !text) {
    showPopup("Peringatan", "Nama dan Komentar wajib diisi!", "error");
    return;
  }

  try {
    await supabaseFetch("comments", {
      method: "POST",
      body: JSON.stringify({ journal_id: journalId, author, text, created_at: nowIso })
    });

    document.getElementById("comment-text").value = "";
    loadComments(journalId);
  } catch (err) {
    showPopup("Gagal", "Gagal mengirim komentar: " + err.message, "error");
  }
}

async function deleteComment(commentId, journalId) {
  if (!isAdminLoggedIn) return;
  showPopup("Konfirmasi", "Hapus komentar ini?", "confirm", async () => {
    try {
      await supabaseFetch(`comments?id=eq.${commentId}`, { method: "DELETE" });
      loadComments(journalId);
    } catch (err) {
      showPopup("Gagal", "Gagal menghapus komentar: " + err.message, "error");
    }
  });
}

// ==========================================
// KALKULATOR (DENGAN CARA MENGHITUNG)
// ==========================================
function switchCalculatorMode() {
  const mode = document.getElementById("calc-selector").value;
  const container = document.getElementById("calc-container");

  if (mode === "three_rule") {
    container.innerHTML = `
      <div style="background: var(--slate-50); padding: 16px; border-radius: 8px; border: 1px solid var(--slate-200);">
        <h4 style="color: var(--primary-dark); margin-bottom: 6px;">Three Rule (Aturan 3)</h4>
        <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Rumus: HB = 1/3 HCT | HCT = 3 × HB | AE = 1/3 HB</p>
        
        <div class="form-group">
          <label>Parameter yang diketahui:</label>
          <div class="custom-dropdown" id="three-known-dropdown">
            <div class="custom-dropdown-selected" onclick="toggleCustomDropdown('three-known-dropdown')">Diketahui Hemoglobin (HB)</div>
            <div class="custom-dropdown-options">
              <div onclick="selectCustomOption('three-known-dropdown', 'know_hb', 'Diketahui Hemoglobin (HB)'); toggleThreeRuleInputs();">Diketahui Hemoglobin (HB)</div>
              <div onclick="selectCustomOption('three-known-dropdown', 'know_hct', 'Diketahui Hematokrit (HCT)'); toggleThreeRuleInputs();">Diketahui Hematokrit (HCT)</div>
              <div onclick="selectCustomOption('three-known-dropdown', 'know_ae', 'Diketahui Antal Eritrosit (AE)'); toggleThreeRuleInputs();">Diketahui Antal Eritrosit (AE)</div>
            </div>
            <input type="hidden" id="three-known" value="know_hb">
          </div>
        </div>

        <div class="form-group" id="group-three-input" style="margin-top: 10px;">
          <label id="label-three-val">Masukkan HB (g/dL):</label>
          <input type="number" id="three-val" step="0.1" placeholder="Contoh: 12">
        </div>

        <button type="button" class="btn-primary" style="width: 100%; justify-content: center;" onclick="calculateThreeRule()">Hitung dengan Rumus</button>
        <div id="three-result" class="calc-result-box" style="display: none; margin-top: 10px;"></div>
      </div>
    `;
  } else if (mode === "hitung_eritrosit") {
    container.innerHTML = `
      <div style="background: var(--slate-50); padding: 16px; border-radius: 8px; border: 1px solid var(--slate-200);">
        <h4 style="color: var(--primary-dark); margin-bottom: 6px;">Hitung Eritrosit (AE / Antal Eritrosit)</h4>
        <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Rumus: AE = (N × Pengenceran) / (Volume Kamar Hitung)</p>
        
        <div class="form-group"><label>Jumlah Sel Terhitung (N)</label><input type="number" id="ae-n" placeholder="Contoh: 450"></div>
        <div class="form-group"><label>Pengenceran (Standar Hayem = 200)</label><input type="number" id="ae-p" value="200"></div>
        
        <button type="button" class="btn-primary" style="width: 100%; justify-content: center;" onclick="calculateAE()">Hitung dengan Rumus</button>
        <div id="ae-result" class="calc-result-box" style="display: none; margin-top: 10px;"></div>
      </div>
    `;
  } else if (mode === "hitung_leukosit") {
    container.innerHTML = `
      <div style="background: var(--slate-50); padding: 16px; border-radius: 8px; border: 1px solid var(--slate-200);">
        <h4 style="color: var(--primary-dark); margin-bottom: 6px;">Hitung Leukosit (AL / Antal Leukosit)</h4>
        <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Rumus: AL = (N × Pengenceran) / (Luas × Tinggi)</p>
        
        <div class="form-group"><label>Jumlah Sel Terhitung di 4 Kotak Besar (N)</label><input type="number" id="al-n" placeholder="Contoh: 140"></div>
        <div class="form-group"><label>Pengenceran (Standar Turk = 20)</label><input type="number" id="al-p" value="20"></div>
        
        <button type="button" class="btn-primary" style="width: 100%; justify-content: center;" onclick="calculateAL()">Hitung dengan Rumus</button>
        <div id="al-result" class="calc-result-box" style="display: none; margin-top: 10px;"></div>
      </div>
    `;
  } else if (mode === "hitung_trombosit") {
    container.innerHTML = `
      <div style="background: var(--slate-50); padding: 16px; border-radius: 8px; border: 1px solid var(--slate-200);">
        <h4 style="color: var(--primary-dark); margin-bottom: 6px;">Hitung Trombosit (AT / Antal Trombosit)</h4>
        <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Rumus: AT = (N × Pengenceran) / (Luas × Tinggi)</p>
        
        <div class="form-group"><label>Jumlah Trombosit Terhitung (N)</label><input type="number" id="at-n" placeholder="Contoh: 200"></div>
        <div class="form-group"><label>Pengenceran (Standar Rees Ecker = 100)</label><input type="number" id="at-p" value="100"></div>
        
        <button type="button" class="btn-primary" style="width: 100%; justify-content: center;" onclick="calculateAT()">Hitung dengan Rumus</button>
        <div id="at-result" class="calc-result-box" style="display: none; margin-top: 10px;"></div>
      </div>
    `;
  }
}

function toggleThreeRuleInputs() {
  const known = document.getElementById("three-known").value;
  const label = document.getElementById("label-three-val");
  const input = document.getElementById("three-val");

  if (known === "know_hb") {
    label.innerText = "Masukkan HB (g/dL):";
    input.placeholder = "Contoh: 12";
  } else if (known === "know_hct") {
    label.innerText = "Masukkan HCT (%):";
    input.placeholder = "Contoh: 36";
  } else {
    label.innerText = "Masukkan Antal Eritrosit / AE (juta/µL):";
    input.placeholder = "Contoh: 4.0";
  }
}

function calculateThreeRule() {
  const known = document.getElementById("three-known").value;
  const val = parseFloat(document.getElementById("three-val").value);
  const resEl = document.getElementById("three-result");

  if (!val) {
    showPopup("Peringatan", "Mohon masukkan nilai terlebih dahulu!", "error");
    return;
  }

  let hb = 0, hct = 0, ae = 0;
  let steps = "";

  if (known === "know_hb") {
    hb = val;
    hct = 3 * hb;
    ae = hb / 3;
    steps = `
      • Diketahui HB = ${hb} g/dL<br>
      • Rumus HCT = 3 × HB → 3 × ${hb} = <strong>${hct.toFixed(1)}%</strong><br>
      • Rumus AE = HB / 3 → ${hb} / 3 = <strong>${ae.toFixed(2)} juta/µL</strong>
    `;
  } else if (known === "know_hct") {
    hct = val;
    hb = hct / 3;
    ae = hb / 3;
    steps = `
      • Diketahui HCT = ${hct}%<br>
      • Rumus HB = HCT / 3 → ${hct} / 3 = <strong>${hb.toFixed(1)} g/dL</strong><br>
      • Rumus AE = HB / 3 → ${hb.toFixed(1)} / 3 = <strong>${ae.toFixed(2)} juta/µL</strong>
    `;
  } else {
    ae = val;
    hb = 3 * ae;
    hct = 3 * hb;
    steps = `
      • Diketahui AE = ${ae} juta/µL<br>
      • Rumus HB = 3 × AE → 3 × ${ae} = <strong>${hb.toFixed(1)} g/dL</strong><br>
      • Rumus HCT = 3 × HB → 3 × ${hb.toFixed(1)} = <strong>${hct.toFixed(1)}%</strong>
    `;
  }

  resEl.style.display = "block";
  resEl.innerHTML = `<strong>Cara & Hasil Perhitungan Three Rule:</strong><br>${steps}`;
}

function calculateAE() {
  const n = parseFloat(document.getElementById("ae-n").value);
  const p = parseFloat(document.getElementById("ae-p").value) || 200;
  const resEl = document.getElementById("ae-result");

  if (!n) {
    showPopup("Peringatan", "Mohon masukkan jumlah sel terhitung (N)!", "error");
    return;
  }

  const total = n * (p / 0.02);
  const juta = total / 1000000;

  resEl.style.display = "block";
  resEl.innerHTML = `
    <strong>Cara Perhitungan Antal Eritrosit (AE):</strong><br>
    • Jumlah sel (N) = ${n}<br>
    • Pengenceran = ${p}<br>
    • Perhitungan: (N × ${p}) / (0,02 mm³)<br>
    • Hasil Total: <strong>${total.toLocaleString("id-ID")} /µL</strong> (${juta.toFixed(2)} juta/µL)
  `;
}

function calculateAL() {
  const n = parseFloat(document.getElementById("al-n").value);
  const p = parseFloat(document.getElementById("al-p").value) || 20;
  const resEl = document.getElementById("al-result");

  if (!n) {
    showPopup("Peringatan", "Mohon masukkan jumlah sel terhitung (N)!", "error");
    return;
  }

  const total = (n / 0.4) * p;

  resEl.style.display = "block";
  resEl.innerHTML = `
    <strong>Cara Perhitungan Antal Leukosit (AL):</strong><br>
    • Jumlah sel di 4 kotak besar (N) = ${n}<br>
    • Pengenceran = ${p}<br>
    • Perhitungan: (${n} / 0,4 mm³) × ${p}<br>
    • Hasil Total: <strong>${total.toLocaleString("id-ID")} /µL</strong>
  `;
}

function calculateAT() {
  const n = parseFloat(document.getElementById("at-n").value);
  const p = parseFloat(document.getElementById("at-p").value) || 100;
  const resEl = document.getElementById("at-result");

  if (!n) {
    showPopup("Peringatan", "Mohon masukkan jumlah sel terhitung (N)!", "error");
    return;
  }

  const total = (n / 0.1) * p;

  resEl.style.display = "block";
  resEl.innerHTML = `
    <strong>Cara Perhitungan Antal Trombosit (AT):</strong><br>
    • Jumlah trombosit terhitung (N) = ${n}<br>
    • Pengenceran = ${p}<br>
    • Perhitungan: (${n} / 0,1 mm³) × ${p}<br>
    • Hasil Total: <strong>${total.toLocaleString("id-ID")} /µL</strong>
  `;
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
