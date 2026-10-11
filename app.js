// =================================================================
// SUPABASE CONFIGURATION (Ganti dengan milikmu dari Project Settings)
// =================================================================
const SUPABASE_URL = "https://olmptjeybfzvzzhrxsmb.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_6nrGBfhRq0dfMTAnvaKBaQ_UXVP9yHD";

// Fungsi helper sederhana untuk fetch API Supabase
async function sbFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        ...options,
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            ...options.headers
        }
    });
    if (!res.ok) throw new Error("Gagal terhubung ke database Supabase");
    return res.json();
}

// Data Default Bawaan Laboratorium & Jurnal Awal
const defaultParameters = [
    {
        id: "hemoglobin",
        name: "Hemoglobin (Hb)",
        synonyms: "HGB, Kadar Hb Darah",
        category: "Hematologi",
        referenceRange: "Pria: 13.5 - 17.5 g/dL | Wanita: 12.0 - 15.5 g/dL",
        description: "Protein kaya zat besi dalam eritrosit yang mengangkut oksigen ke seluruh jaringan tubuh.",
        method: "Cyanmethemoglobin / Spektrofotometri",
        clinicalSignificance: "Krusial dalam diagnosis anemia dan polisitemia.",
        image_url: "",
        contributor: "Tim MedLab"
    },
    {
        id: "leukosit",
        name: "Leukosit (Sel Darah Putih)",
        synonyms: "WBC, White Blood Cell",
        category: "Hematologi",
        referenceRange: "Dewasa: 4.000 - 11.000 /µL",
        description: "Komponen sel darah garda terdepan sistem kekebalan tubuh.",
        method: "Impedance Electrical / Flow Cytometry",
        clinicalSignificance: "Menilai adanya infeksi bakteri/virus dan peradangan.",
        image_url: "",
        contributor: "Tim MedLab"
    },
    {
        id: "jurnal_malaria",
        name: "Studi Kasus: Identifikasi Parasit Malaria (Plasmodium falciparum)",
        synonyms: "Jurnal TLM: Mikroskopis Darah",
        category: "Jurnal Umum",
        referenceRange: "Negatif / Tidak ditemukan parasit",
        description: "Analisis mikroskopis sediaan darah tipis dan tebal untuk menemukan bentuk tropozoit ring form (cincin) pada eritrosit.",
        method: "Pewarnaan Giemsa 10%",
        clinicalSignificance: "Diagnosis pasti infeksi malaria tropika.",
        image_url: "https://images.unsplash.com/photo-1579165466949-30ef0a4d45c6?auto=format&fit=crop&w=600&q=80",
        contributor: "Ana S.Tr.A.K"
    }
];

let allData = [...defaultParameters];

// DOM Elements
const parameterContainer = document.getElementById('parameterContainer');
const searchInput = document.getElementById('searchInput');
const categoryList = document.getElementById('categoryList');
const sectionTitle = document.getElementById('sectionTitle');
const resultCount = document.getElementById('resultCount');

const detailModal = document.getElementById('detailModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalContent = document.getElementById('modalContent');

const submitModal = document.getElementById('submitModal');
const openSubmitModalBtn = document.getElementById('openSubmitModalBtn');
const closeSubmitModalBtn = document.getElementById('closeSubmitModalBtn');
const submitJournalForm = document.getElementById('submitJournalForm');

const calcModal = document.getElementById('calcModal');
const openCalculatorBtn = document.getElementById('openCalculatorBtn');
const closeCalcModalBtn = document.getElementById('closeCalcModalBtn');
const calculateBtn = document.getElementById('calculateBtn');

let currentCategory = 'all';
let currentSearchQuery = '';

// Ambil data dari Supabase Cloud saat pertama kali web dibuka
async function loadDataFromCloud() {
    try {
        const cloudData = await sbFetch("journals?select=*");
        // Format data dari supabase agar sesuai dengan struktur tampilan
        const formattedCloudData = cloudData.map(item => ({
            id: item.id,
            name: item.title,
            synonyms: 'Kontribusi Publik / Jurnal',
            category: item.category,
            referenceRange: item.reference_range,
            description: item.description,
            method: 'Analisis literatur kontributor',
            clinicalSignificance: 'Referensi penunjang wawasan laboratorium klinis.',
            image_url: item.image_url,
            contributor: item.contributor
        }));

        // Gabungkan data bawaan dengan data cloud dari Supabase
        allData = [...defaultParameters, ...formattedCloudData];
        filterAndSearchData();
    } catch (err) {
        console.error("Gagal memuat database cloud, menggunakan data lokal:", err);
        renderCards(allData);
    }
}

// Render Cards ke Web
function renderCards(data) {
    parameterContainer.innerHTML = '';
    resultCount.textContent = `Menampilkan ${data.length} konten`;

    if (data.length === 0) {
        parameterContainer.innerHTML = `
            <div style="grid-column: span 2; text-align: center; padding: 40px; color: var(--slate-500);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px; color: var(--warning);"></i>
                <p>Tidak ditemukan data atau jurnal yang sesuai.</p>
            </div>
        `;
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'param-card';
        card.onclick = () => openDetail(item.id);

        card.innerHTML = `
            <div>
                <div class="card-top">
                    <span class="badge-category">${item.category}</span>
                </div>
                <h3>${item.name}</h3>
                <div class="synonyms">Kontributor: ${item.contributor || 'Tim MedLab'}</div>
                <div class="range-box">
                    <div class="range-label">Nilai Rujukan / Keterangan</div>
                    <div class="range-value">${item.referenceRange}</div>
                </div>
                <p class="card-snippet">${item.description}</p>
            </div>
            <div class="card-footer-btn">
                <span>Baca Selengkapnya & Komentar</span>
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        `;
        parameterContainer.appendChild(card);
    });
}

// Buka Modal Detail & Ambil Komentar dari Supabase
async function openDetail(id) {
    const item = allData.find(d => d.id === id);
    if (!item) return;

    // Ambil komentar dari Supabase berdasarkan ID jurnal
    let itemComments = [];
    try {
        itemComments = await sbFetch(`comments?journal_id=eq.${id}&select=*`);
    } catch (e) {
        console.error("Gagal memuat komentar:", e);
    }

    modalContent.innerHTML = `
        <span class="modal-category">${item.category}</span>
        <h2 class="modal-title">${item.name}</h2>
        <div class="modal-synonyms">Disumbangkan oleh: <strong>${item.contributor || 'Ana & Rekan Sejawat'}</strong></div>

        ${item.image_url ? `<img src="${item.image_url}" class="modal-img-preview" alt="Ilustrasi Kasus">` : ''}

        <div class="modal-highlight-box">
            <p><strong>Nilai Rujukan / Keterangan:</strong> ${item.referenceRange}</p>
        </div>

        <h4 class="modal-section-title"><i class="fa-solid fa-book-open"></i> Penjelasan & Studi Klinis</h4>
        <p class="modal-body-text">${item.description}</p>

        <h4 class="modal-section-title"><i class="fa-solid fa-microscope"></i> Metode Pemeriksaan</h4>
        <p class="modal-body-text">${item.method || 'Standar operasional laboratorium klinik.'}</p>

        <h4 class="modal-section-title"><i class="fa-solid fa-stethoscope"></i> Signifikansi Klinis</h4>
        <p class="modal-body-text">${item.clinicalSignificance || 'Penting untuk evaluasi diagnostik.'}</p>

        <!-- Komentar Section -->
        <div class="comments-section">
            <h4><i class="fa-solid fa-comments"></i> Diskusi & Komentar Sejawat (<span id="commentCount">${itemComments.length}</span>)</h4>
            <div class="comment-list" id="commentList">
                ${itemComments.length === 0 ? '<p style="font-size:0.85rem; color:var(--slate-500);">Belum ada komentar. Jadilah yang pertama memberikan ulasan!</p>' : 
                  itemComments.map(c => `
                    <div class="comment-item">
                        <div class="comment-author">${c.author}</div>
                        <div class="comment-text">${c.text}</div>
                    </div>
                  `).join('')}
            </div>

            <form id="commentForm" onsubmit="handleComment(event, '${id}')">
                <div class="form-group">
                    <input type="text" id="commentAuthor" required placeholder="Nama Anda / Sejawat TLM">
                </div>
                <div class="form-group">
                    <textarea id="commentText" rows="2" required placeholder="Tulis komentar atau pertanyaan klinis..."></textarea>
                </div>
                <button type="submit" class="btn-primary" style="width:100%; justify-content:center;">Kirim Komentar ke Cloud</button>
            </form>
        </div>
    `;

    detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Kirim Komentar ke Supabase
window.handleComment = async function(e, journalId) {
    e.preventDefault();
    const author = document.getElementById('commentAuthor').value;
    const text = document.getElementById('commentText').value;

    try {
        await sbFetch("comments", {
            method: "POST",
            body: JSON.stringify({ journal_id: journalId, author, text })
        });
        alert('Komentar berhasil dikirim!');
        openDetail(journalId); // Refresh modal detail
    } catch (err) {
        alert('Gagal mengirim komentar.');
        console.error(err);
    }
};

// Kirim Jurnal Baru ke Supabase
submitJournalForm.onsubmit = async (e) => {
    e.preventDefault();
    const newEntry = {
        id: 'custom_' + Date.now(),
        title: document.getElementById('contribTitle').value,
        category: document.getElementById('contribCategory').value,
        reference_range: document.getElementById('contribRange').value || 'Standar Klinis',
        description: document.getElementById('contribDesc').value,
        image_url: document.getElementById('contribImage').value,
        contributor: document.getElementById('contribName').value
    };

    try {
        await sbFetch("journals", {
            method: "POST",
            body: JSON.stringify(newEntry)
        });
        
        submitJournalForm.reset();
        submitModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        alert('Jurnal berhasil dipublikasikan ke Database Cloud Supabase dan langsung tampil untuk semua orang!');
        loadDataFromCloud(); // Reload data terbaru
    } catch (err) {
        alert('Gagal mempublikasikan jurnal ke database.');
        console.error(err);
    }
};

// Kalkulator Lab (MCV, MCH, MCHC)
calculateBtn.onclick = () => {
    const hb = parseFloat(document.getElementById('calcHb').value);
    const rbc = parseFloat(document.getElementById('calcRbc').value);
    const hct = parseFloat(document.getElementById('calcHct').value);
    const resBox = document.getElementById('calcResultContainer');
    const resText = document.getElementById('calcResultText');

    if (!hb || !rbc || !hct) {
        alert('Mohon isi semua nilai dengan benar.');
        return;
    }

    const mcv = (hct / rbc) * 10;
    const mch = (hb / rbc) * 10;
    const mchc = (hb / hct) * 100;

    resBox.style.display = 'block';
    resText.innerHTML = `
        • MCV (Volume Eritrosit Rata-rata): <strong>${mcv.toFixed(1)} fL</strong> (Normal: 80-100 fL)<br>
        • MCH (Hemoglobin Eritrosit Rata-rata): <strong>${mch.toFixed(1)} pg</strong> (Normal: 27-31 pg)<br>
        • MCHC (Kadar Hb Eritrosit Rata-rata): <strong>${mchc.toFixed(1)} g/dL</strong> (Normal: 32-36 g/dL)
    `;
};

// Filter & Search
function filterAndSearchData() {
    let filtered = allData;
    if (currentCategory !== 'all') {
        filtered = filtered.filter(d => d.category === currentCategory);
    }
    if (currentSearchQuery.trim() !== '') {
        const q = currentSearchQuery.toLowerCase();
        filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || (d.contributor && d.contributor.toLowerCase().includes(q)));
    }
    renderCards(filtered);
}

categoryList.querySelectorAll('li').forEach(li => {
    li.onclick = () => {
        categoryList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        currentCategory = li.getAttribute('data-category');
        sectionTitle.textContent = currentCategory === 'all' ? 'Semua Parameter & Jurnal Laboratorium' : `Kategori: ${currentCategory}`;
        filterAndSearchData();
    };
});

searchInput.oninput = (e) => {
    currentSearchQuery = e.target.value;
    filterAndSearchData();
};

// Modal Toggles
closeModalBtn.onclick = () => { detailModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
detailModal.onclick = (e) => { if(e.target === detailModal) { detailModal.classList.remove('active'); document.body.style.overflow = 'auto'; } };

openSubmitModalBtn.onclick = () => { submitModal.classList.add('active'); document.body.style.overflow = 'hidden'; };
closeSubmitModalBtn.onclick = () => { submitModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
submitModal.onclick = (e) => { if(e.target === submitModal) { submitModal.classList.remove('active'); document.body.style.overflow = 'auto'; } };

openCalculatorBtn.onclick = () => { calcModal.classList.add('active'); document.body.style.overflow = 'hidden'; };
closeCalcModalBtn.onclick = () => { calcModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
calcModal.onclick = (e) => { if(e.target === calcModal) { calcModal.classList.remove('active'); document.body.style.overflow = 'auto'; } };

// Jalankan saat pertama kali dimuat
loadDataFromCloud();
