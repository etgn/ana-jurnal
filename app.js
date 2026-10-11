// ==========================================
// CONFIGURATION & CREDENTIALS
// ==========================================
const SUPABASE_URL = "https://olmptjeybfzvzzhrxsmb.supabase.co";
// PASTI KAN KUNCI PUBLISHABLE DI BAWAH SUDAH DIGANTI DENGAN KUNCI ASLI KAMU (DARI MENU API SUPABASE)
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
});

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

// Upload file gambar ke Supabase Storage (Bucket: journals-images)
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
    throw new Error("Gagal mengunggah file gambar ke Supabase Storage. Pastikan Bucket 'journals-images' sudah dibuat & diset Public.");
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
    alert("Berhasil login sebagai Admin!");
  } else {
    alert("Password Admin Salah!");
  }
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  localStorage.removeItem("isAdmin");
  updateAdminUI();
  alert("Berhasil logout dari Admin.");
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
// LOAD & RENDER JURNAL
// ==========================================
async function loadJournals() {
  const listEl = document.getElementById("journal-list");
  listEl.innerHTML = `<p style="color: var(--slate-500);">Memuat data dari database cloud...</p>`;

  try {
    const data = await supabaseFetch("journals?select=*&order=created_at.desc");
    allJournals = data || [];
    renderJournals(allJournals);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p style="color: var(--danger); font-weight: 600;">Gagal memuat data. Pastikan Publishable Key di app.js sudah benar dan RLS di Supabase sudah di-disable.</p>`;
  }
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

  listEl.innerHTML = filtered.map(j => `
    <div class="param-card" onclick="openJournalDetail('${j.id}')">
      <div>
        <div class="card-top">
          <span class="badge-category">${escapeHtml(j.category)}</span>
          ${isAdminLoggedIn ? `<button class="btn-secondary" style="background:var(--danger); padding:4px 8px;" onclick="event.stopPropagation(); deleteJournal('${j.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        <h3>${escapeHtml(j.title)}</h3>
        <p class="synonyms">Oleh: ${escapeHtml(j.contributor || 'Anonim')}</p>

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
  `).join('');
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
// SUBMIT JURNAL DENGAN UPLOAD FILE
// ==========================================
async function submitJournal() {
  const title = document.getElementById("journal-title").value;
  const category = document.getElementById("journal-category").value;
  const reference_range = document.getElementById("journal-ref").value;
  const description = document.getElementById("journal-desc").value;
  const contributor = document.getElementById("journal-contributor").value || "Anonim";
  const fileInput = document.getElementById("journal-image-file");

  if (!title || !category) {
    alert("Judul dan Kategori wajib diisi!");
    return;
  }

  try {
    let imageUrl = "";
    if (fileInput && fileInput.files[0]) {
      alert("Sedang mengunggah berkas gambar ke Cloud Storage...");
      imageUrl = await uploadImageToStorage(fileInput.files[0]);
    }

    const newJournal = {
      id: "jurnal_" + Date.now(),
      title,
      category,
      reference_range,
      description,
      image_url: imageUrl,
      contributor
    };

    await supabaseFetch("journals", {
      method: "POST",
      body: JSON.stringify(newJournal)
    });

    alert("Berhasil menambahkan parameter baru!");
    document.getElementById("journal-form").reset();
    closeModal("modal-submit");
    loadJournals();
  } catch (err) {
    alert("Gagal menambahkan data: " + err.message);
  }
}

async function deleteJournal(id) {
  if (!isAdminLoggedIn) return;
  if (!confirm("Hapus postingan jurnal ini?")) return;

  try {
    await supabaseFetch(`journals?id=eq.${id}`, { method: "DELETE" });
    alert("Postingan dihapus.");
    loadJournals();
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
}

// ==========================================
// DETAIL & KOMENTAR
// ==========================================
async function openJournalDetail(id) {
  const journal = allJournals.find(j => j.id === id);
  if (!journal) return;

  document.getElementById("active-journal-id").value = id;
  const bodyEl = document.getElementById("modal-detail-body");

  bodyEl.innerHTML = `
    <span class="modal-category">${escapeHtml(journal.category)}</span>
    <h3 class="modal-title">${escapeHtml(journal.title)}</h3>
    <p class="modal-synonyms">Pengirim: ${escapeHtml(journal.contributor || 'Anonim')}</p>

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
        <div style="display:flex; justify-content:space-between;">
          <div class="comment-author">${escapeHtml(c.author)}</div>
          ${isAdminLoggedIn ? `<button style="background:var(--danger); color:white; border:none; padding:2px 6px; border-radius:4px; font-size:0.7rem; cursor:pointer;" onclick="deleteComment(${c.id}, '${journalId}')">Hapus</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
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

  if (!author || !text) {
    alert("Nama dan Komentar wajib diisi!");
    return;
  }

  try {
    await supabaseFetch("comments", {
      method: "POST",
      body: JSON.stringify({ journal_id: journalId, author, text })
    });

    document.getElementById("comment-text").value = "";
    loadComments(journalId);
  } catch (err) {
    alert("Gagal mengirim komentar: " + err.message);
  }
}

async function deleteComment(commentId, journalId) {
  if (!isAdminLoggedIn) return;
  if (!confirm("Hapus komentar ini?")) return;

  try {
    await supabaseFetch(`comments?id=eq.${commentId}`, { method: "DELETE" });
    loadComments(journalId);
  } catch (err) {
    alert("Gagal menghapus komentar: " + err.message);
  }
}

// ==========================================
// KALKULATOR
// ==========================================
function calculateGFR() {
  const creat = parseFloat(document.getElementById("gfr-creat").value);
  const age = parseInt(document.getElementById("gfr-age").value);
  const gender = document.getElementById("gfr-gender").value;
  const resEl = document.getElementById("gfr-result");

  if (!creat || !age) {
    alert("Mohon isi Serum Kreatinin dan Usia!");
    return;
  }

  let gfr = ((140 - age) * 70) / (72 * creat);
  if (gender === "female") gfr *= 0.85;

  resEl.style.display = "block";
  resEl.innerHTML = `Hasil eGFR: <strong>${gfr.toFixed(2)} mL/min/1.73m²</strong>`;
}

function calculateANC() {
  const wbc = parseFloat(document.getElementById("anc-wbc").value);
  const bands = parseFloat(document.getElementById("anc-bands").value) || 0;
  const segs = parseFloat(document.getElementById("anc-segs").value) || 0;
  const resEl = document.getElementById("anc-result");

  if (!wbc) {
    alert("Mohon isi Total Leukosit!");
    return;
  }

  const anc = (wbc * (bands + segs)) / 100;
  resEl.style.display = "block";
  resEl.innerHTML = `Hasil ANC: <strong>${anc.toFixed(0)} /µL</strong>`;
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
