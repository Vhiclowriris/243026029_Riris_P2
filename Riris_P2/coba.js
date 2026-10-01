// ============================================
// VARIABEL GLOBAL
// ============================================
let stream = null;
let model = null;
let isCameraOn = false;
let isAIScanOn = false;
let isFlashOn = false;
let facingMode = 'environment';
let detectionInterval = null;
let animationId = null;
let photoCount = 0;

let video, canvas, ctx, overlayMsg, overlayText, objectList;
let btnCamera, btnSwitch, btnFlash, btnAI, btnCapture;
let galleryContainer;

// ============================================
// TUNGGU DOM SIAP
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    overlayMsg = document.getElementById('overlay-msg');
    overlayText = document.getElementById('overlay-text');
    objectList = document.getElementById('object-list');
    galleryContainer = document.getElementById('gallery-container');

    btnCamera = document.getElementById('btn-camera');
    btnSwitch = document.getElementById('btn-switch');
    btnFlash = document.getElementById('btn-flash');
    btnAI = document.getElementById('btn-ai');
    btnCapture = document.getElementById('btn-capture');

    // Load model COCO-SSD
    loadModel();

    // Load gallery dari localStorage
    loadGallery();
});

// ============================================
// LOAD MODEL COCO-SSD
// ============================================
async function loadModel() {
    overlayText.textContent = "Memuat Model AI...";
    try {
        model = await cocoSsd.load();
        console.log("✅ Model COCO-SSD berhasil dimuat!");
        overlayText.textContent = "Model AI Siap! Klik 'Nyalakan Kamera'";
    } catch (err) {
        console.error(" Gagal memuat model:", err);
        overlayText.textContent = "Gagal memuat model AI";
    }
}

// ============================================
// KAMERA
// ============================================
async function toggleCamera() {
    if (isCameraOn) {
        stopCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    try {
        overlayMsg.classList.remove('hidden');
        overlayText.textContent = "Mengakses Kamera...";

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;

        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                console.log('Resolusi kamera:', video.videoWidth, 'x', video.videoHeight);
                resolve();
            };
        });

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        isCameraOn = true;
        btnCamera.textContent = "⏹ Matikan Kamera";
        btnCamera.classList.add('active');
        btnSwitch.disabled = false;
        btnFlash.disabled = false;
        btnAI.disabled = false;
        btnCapture.disabled = false;

        overlayMsg.classList.add('hidden');
        console.log("✅ Kamera berhasil dinyalakan!");

        if (isAIScanOn) {
            startDetection();
        }

    } catch (err) {
        console.error("Gagal akses kamera:", err);
        alert("Akses kamera ditolak. Pastikan izin kamera diizinkan di browser.");
        overlayText.textContent = "Gagal mengakses kamera";
    }
}

function stopCamera() {
    isCameraOn = false;
    isAIScanOn = false;
    btnAI.classList.remove('active');
    btnAI.textContent = " AI Scan";

    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objectList.innerHTML = '';

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;

    btnCamera.textContent = "📷 Nyalakan Kamera";
    btnCamera.classList.remove('active');
    btnSwitch.disabled = true;
    btnFlash.disabled = true;
    btnAI.disabled = true;
    btnCapture.disabled = true;

    console.log("⏹ Kamera dimatikan");
}

// ============================================
// SWITCH KAMERA
// ============================================
async function switchCamera() {
    if (!isCameraOn) return;

    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    console.log(" Switch ke kamera:", facingMode === 'environment' ? 'Belakang' : 'Depan');

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    await startCamera();
}

// ============================================
// FLASH
// ============================================
function toggleFlash() {
    isFlashOn = !isFlashOn;
    const flashOverlay = document.getElementById('flash-overlay');

    if (isFlashOn) {
        btnFlash.classList.add('active');
        btnFlash.textContent = "🔦 Flash ON";

        if (stream) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.torch) {
                track.applyConstraints({ advanced: [{ torch: true }] })
                    .then(() => console.log("🔦 Torch hardware aktif"))
                    .catch(() => {
                        flashOverlay.classList.add('active');
                    });
            } else {
                flashOverlay.classList.add('active');
            }
        }
    } else {
        btnFlash.classList.remove('active');
        btnFlash.textContent = "🔦 Flash";

        if (stream) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.torch) {
                track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
            }
        }
        document.getElementById('flash-overlay').classList.remove('active');
    }
}

// ============================================
// AI SCAN
// ============================================
function toggleAI() {
    isAIScanOn = !isAIScanOn;

    if (isAIScanOn) {
        btnAI.classList.add('active');
        btnAI.textContent = "🤖 AI Scan ON";

        if (!model) {
            alert("Model AI masih dimuat, tunggu sebentar...");
            isAIScanOn = false;
            btnAI.classList.remove('active');
            btnAI.textContent = "🤖 AI Scan";
            return;
        }

        if (isCameraOn) {
            startDetection();
        }
    } else {
        btnAI.classList.remove('active');
        btnAI.textContent = "🤖 AI Scan";
        stopDetection();
    }
}

function startDetection() {
    if (detectionInterval) clearInterval(detectionInterval);

    detectionInterval = setInterval(() => {
        if (isCameraOn && isAIScanOn && model && video.readyState === 4) {
            detectObjects();
        }
    }, 5000);
}

function stopDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objectList.innerHTML = '';
}

async function detectObjects() {
    try {
        const predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        objectList.innerHTML = '';

        if (predictions.length === 0) {
            objectList.innerHTML = '<li>Tidak ada objek terdeteksi</li>';
        } else {
            predictions.forEach(prediction => {
                const [x, y, width, height] = prediction.bbox;
                const label = prediction.class;
                const score = Math.round(prediction.score * 100);
                const color = getColorForClass(label);

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                ctx.fillStyle = color;
                const textWidth = ctx.measureText(`${label} ${score}%`).width;
                ctx.fillRect(x, y - 25, textWidth + 20, 25);

                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.fillText(`${label} ${score}%`, x + 5, y - 8);

                const li = document.createElement('li');
                li.innerHTML = `${label} <span class="confidence">${score}%</span>`;
                li.style.borderColor = color;
                objectList.appendChild(li);
            });
        }

        saveToDatabase(predictions);

    } catch (err) {
        console.error("Error saat deteksi:", err);
    }
}

function getColorForClass(className) {
    const colors = {
        'person': '#FF0000', 'bicycle': '#00FF00', 'car': '#0000FF',
        'motorcycle': '#FFFF00', 'airplane': '#FF00FF', 'bus': '#00FFFF',
        'train': '#FF8000', 'truck': '#8000FF', 'boat': '#0080FF',
        'traffic light': '#FF0080', 'fire hydrant': '#80FF00',
        'stop sign': '#FF0040', 'parking meter': '#40FF00',
        'bench': '#0040FF', 'bird': '#FF4000', 'cat': '#00FF40',
        'dog': '#4000FF', 'horse': '#FF00BF', 'sheep': '#BF00FF',
        'cow': '#00BFFF', 'elephant': '#FFBF00', 'bear': '#BFFF00',
        'zebra': '#00FFBF', 'giraffe': '#FF0080', 'backpack': '#80FF00',
        'umbrella': '#0080FF', 'handbag': '#FF8000', 'tie': '#8000FF',
        'suitcase': '#00FF80', 'frisbee': '#FF0040', 'skis': '#40FF00',
        'snowboard': '#0040FF', 'sports ball': '#FF4000', 'kite': '#00FF40',
        'baseball bat': '#ff00bf', 'baseball glove': '#FF00BF',
        'skateboard': '#BF00FF', 'surfboard': '#00BFFF',
        'tennis racket': '#FFBF00', 'bottle': '#BFFF00',
        'wine glass': '#00FFBF', 'cup': '#FF0080', 'fork': '#80FF00',
        'knife': '#0080FF', 'spoon': '#FF8000', 'bowl': '#8000FF',
        'banana': '#00FF80', 'apple': '#FF0040', 'sandwich': '#40FF00',
        'orange': '#0040FF', 'broccoli': '#FF4000', 'carrot': '#00FF40',
        'hot dog': '#4000FF', 'pizza': '#FF00BF', 'donut': '#BF00FF',
        'cake': '#00BFFF', 'chair': '#FFBF00', 'couch': '#BFFF00',
        'potted plant': '#00FFBF', 'bed': '#FF0080',
        'dining table': '#80FF00', 'toilet': '#0080FF',
        'tv': '#FF8000', 'laptop': '#8000FF', 'mouse': '#00FF80',
        'remote': '#FF0040', 'keyboard': '#40FF00',
        'cell phone': '#0040FF', 'microwave': '#FF4000',
        'oven': '#00FF40', 'toaster': '#1aff00', 'sink': '#FF00BF',
        'refrigerator': '#BF00FF', 'book': '#00BFFF', 'clock': '#FFBF00',
        'vase': '#BFFF00', 'scissors': '#00FFBF',
        'teddy bear': '#FF0080', 'hair drier': '#80FF00',
        'toothbrush': '#0080FF'
    };
    return colors[className] || '#00FFFF';
}

// ============================================
// SIMPAN KE DATABASE
// ============================================
async function saveToDatabase(predictions) {
    const detectedObjects = predictions.map(p => ({
        class: p.class,
        confidence: Math.round(p.score * 100)
    }));

    const record = {
        type: 'detection',
        objects: detectedObjects,
        count: predictions.length,
        timestamp: new Date().toISOString()
    };

    try {
        await window.db.collection('detections').add(record);
        console.log("💾 Data deteksi disimpan:", record);
    } catch (err) {
        console.error("Gagal simpan ke database:", err);
    }
}

// ============================================
//  CAPTURE PHOTO - FUNGSI BARU!
// ============================================
function capturePhoto() {
    if (!isCameraOn) {
        alert("Nyalakan kamera terlebih dahulu!");
        return;
    }

    // Buat canvas temporary untuk capture
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const captureCtx = captureCanvas.getContext('2d');

    // Gambar frame video ke canvas
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    // Jika AI Scan aktif, gambar juga bounding box
    if (isAIScanOn) {
        captureCtx.drawImage(canvas, 0, 0);
    }

    // Convert ke data URL (JPEG)
    const photoData = captureCanvas.toDataURL('image/jpeg', 0.9);

    // Tambah flash effect
    const flashOverlay = document.getElementById('flash-overlay');
    flashOverlay.classList.add('active');
    setTimeout(() => {
        flashOverlay.classList.remove('active');
    }, 300);

    // Simpan photo
    photoCount++;
    const photoInfo = {
        id: Date.now(),
        data: photoData,
        timestamp: new Date().toLocaleString('id-ID'),
        objects: isAIScanOn ? getCurrentDetections() : []
    };

    savePhotoToGallery(photoInfo);
    savePhotoToDatabase(photoInfo);

    console.log(`📸 Foto ke-${photoCount} berhasil diambil!`);
}

function getCurrentDetections() {
    const items = objectList.querySelectorAll('li');
    const detections = [];
    items.forEach(item => {
        const text = item.textContent.trim();
        detections.push(text);
    });
    return detections;
}

function savePhotoToGallery(photoInfo) {
    // Simpan ke localStorage
    let gallery = JSON.parse(localStorage.getItem('photo_gallery') || '[]');
    gallery.unshift(photoInfo);
    if (gallery.length > 20) gallery.pop(); // Batasi 20 foto
    localStorage.setItem('photo_gallery', JSON.stringify(gallery));

    // Tampilkan di gallery
    displayPhoto(photoInfo);
}

function displayPhoto(photoInfo) {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    galleryItem.innerHTML = `
        <img src="${photoInfo.data}" alt="Foto ${photoInfo.id}">
        <button class="delete-btn" onclick="deletePhoto(${photoInfo.id})">✕</button>
        <div class="photo-info">${photoInfo.timestamp}</div>
    `;

    galleryContainer.insertBefore(galleryItem, galleryContainer.firstChild);
}

function deletePhoto(photoId) {
    let gallery = JSON.parse(localStorage.getItem('photo_gallery') || '[]');
    gallery = gallery.filter(photo => photo.id !== photoId);
    localStorage.setItem('photo_gallery', JSON.stringify(gallery));

    // Hapus dari DOM
    const items = galleryContainer.querySelectorAll('.gallery-item');
    items.forEach(item => {
        const img = item.querySelector('img');
        if (img && img.src.includes(photoId)) {
            item.remove();
        }
    });

    console.log("🗑️ Foto dihapus");
}

function loadGallery() {
    const gallery = JSON.parse(localStorage.getItem('photo_gallery') || '[]');
    gallery.forEach(photo => displayPhoto(photo));
    photoCount = gallery.length;
}

async function savePhotoToDatabase(photoInfo) {
    const record = {
        type: 'photo',
        timestamp: photoInfo.timestamp,
        objects: photoInfo.objects,
        photoData: photoInfo.data.substring(0, 100) + '...' // Simpan preview saja
    };

    try {
        await window.db.collection('photos').add(record);
        console.log("💾 Foto disimpan ke database");
    } catch (err) {
        console.error("Gagal simpan foto ke database:", err);
    }
}