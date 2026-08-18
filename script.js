const SUPABASE_URL = 'https://ummayguhoxfgfbmyzryn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TbHIpYf-nRrSAM54YQkTwQ_jQsxY9fw';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const adminBtn = document.getElementById('adminBtn');
const logoutBtn = document.getElementById('logoutBtn');
const uploadSection = document.getElementById('uploadSection');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.querySelector('.lightbox-close');

let currentUser = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadImages();
    setupEventListeners();
});

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        isAdmin = true;
        showAdminUI();
    } else {
        showVisitorUI();
    }
}

function showAdminUI() {
    adminBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    uploadSection.classList.remove('hidden');
}

function showVisitorUI() {
    adminBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    uploadSection.classList.add('hidden');
}

async function loadImages() {
    try {
        loading.classList.remove('hidden');
        emptyState.classList.add('hidden');
        gallery.innerHTML = '';

        const { data: files, error } = await supabaseClient
            .storage
            .from('gallery-images')  // ← تم التعديل هنا
            .list('', { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) throw error;
        if (!files || files.length === 0) {
            loading.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        for (const file of files) {
            if (file.name === '.emptyFolderPlaceholder') continue;
            const { data: { publicUrl } } = supabaseClient.storage.from('gallery-images').getPublicUrl(file.name);  // ← تم التعديل هنا
            const card = createImageCard(publicUrl, file.name);
            gallery.appendChild(card);
        }
        loading.classList.add('hidden');
    } catch (err) {
        console.error('خطأ في تحميل الصور:', err);
        loading.textContent = '❌ حدث خطأ أثناء تحميل الصور';
    }
}

function createImageCard(url, fileName) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
        <img src="${url}" alt="صورة" loading="lazy">
        ${isAdmin ? <div class="card-overlay"><button class="delete-btn" onclick="deleteImage('${fileName}')">🗑️ حذف</button></div> : ''}
    `;
    card.querySelector('img').addEventListener('click', () => openLightbox(url));
    return card;
}

async function uploadFiles(files) {
    if (!files.length) return;
    uploadProgress.classList.remove('hidden');
    let completed = 0;

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            alert(`⚠️ الملف "${file.name}" ليس صورة`);
            continue;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert(`⚠️ الملف "${file.name}" كبير جداً (الحد: 10MB)`);
            continue;
        }
        const fileName = ${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name};

        try {
            const { error } = await supabaseClient.storage.from('gallery-images').upload(fileName, file, {  // ← تم التعديل هنا
cacheControl: '3600', upsert: false
            });
            if (error) throw error;
            completed++;
            const progress = (completed / files.length) * 100;
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        } catch (err) {
            console.error('خطأ في الرفع:', err);
            alert(`❌ فشل رفع الملف: ${file.name}`);
        }
    }
    setTimeout(() => {
        uploadProgress.classList.add('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        fileInput.value = '';
        loadImages();
    }, 500);
}

async function deleteImage(fileName) {
    if (!confirm('🗑️ هل أنت متأكد من حذف هذه الصورة؟')) return;
    try {
        const { error } = await supabaseClient.storage.from('gallery-images').remove([fileName]);  // ← تم التعديل هنا
        if (error) throw error;
        loadImages();
    } catch (err) {
        console.error('خطأ في الحذف:', err);
        alert('❌ فشل حذف الصورة');
    }
}

function openLightbox(url) {
    lightboxImg.src = url;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
    document.body.style.overflow = '';
}

function setupEventListeners() {
    adminBtn.addEventListener('click', () => window.location.href = 'login.html');
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        currentUser = null; isAdmin = false;
        showVisitorUI(); loadImages();
    });
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault(); uploadArea.classList.remove('dragover'); uploadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => uploadFiles(e.target.files));
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user; isAdmin = true;
        showAdminUI(); loadImages();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null; isAdmin = false;
        showVisitorUI(); loadImages();
    }
});