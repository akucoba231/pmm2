// ubah nilai k pada compareLandmarks untuk sensitifitas
// ubah buffer / intervalMs untuk kelancaran
// ubah modelComplexity ke 0 untuk kelancaran tapi kurang akurat.


// ------------------ FULL FIXED SCRIPT (overlay sudut: bawah canvas / posisi 3) ------------------

// Bagian - variabel (awal)
let rafID = null;
let test;
let scores = {
    lempar : 0,
    tangkap : 0,
    hit: 0,
    kick: 0,
}

let tmpScore = 0.0000;
let tmpSkill = ""; // bisa digunakan untuk filter landmarks
let tmpCount = 0;
let averageScore = 0;

let errorCatcher = document.getElementById('errorCatcher');
let loadScreenActive = true;

// lightweight frame smoothing buffer (kecil untuk mobile)
const FRAME_BUFFER = 5; // gunakan rata-rata bergerak dari 5 frame terakhir
let frameScores = [];

// Bagian - variabel (akhir)

// Bagian Mediapipe - awal

// deklarasi awal 
let video1;
let video2;
let canvas1;
let canvas2;
let ctx1;
let ctx2;

// --- SKILL LANDMARK FILTER ---
const FILTER_POINTS = {
    throw:  [11,12,13,14,15,16,23,24],
    catch:  [11,12,13,14,15,16,23,24],
    hit:    [11,12,13,14,15,16,23,24],
    kick:   [11,12,23,24,25,26,27,28]
};

// Per-landmark weighting (index -> relative weight)
// default small weight for torso points, bigger for limb endpoints
const LANDMARK_BASE_WEIGHT = {
    // torso/shoulders
    11: 0.8, // left_shoulder
    12: 0.8, // right_shoulder
    // arms
    13: 1.0, // left_elbow
    14: 1.0, // right_elbow
    15: 1.2, // left_wrist
    16: 1.2, // right_wrist
    // hips / pelvis
    23: 0.6,
    24: 0.6,
    // legs
    25: 1.0, // left_knee
    26: 1.0, // right_knee
    27: 1.2, // left_ankle
    28: 1.2, // right_ankle
    // foot index (if used)
    31: 1.2,
    32: 1.2
};

// skill-specific multipliers for those base weights (keeps vector sparse & cheap)
const SKILL_WEIGHT_MULTIPLIER = {
    throw: { // emphasis on arms
        13: 1.2, 14: 1.2, 15: 1.4, 16: 1.4, 11: 0.8, 12: 0.8, 23: 0.6, 24: 0.6
    },
    catch: {
        13: 1.2, 14: 1.2, 15: 1.4, 16: 1.4, 11: 0.8, 12: 0.8, 23: 0.6, 24: 0.6
    },
    hit: {
        13: 1.2, 14: 1.2, 15: 1.4, 16: 1.4, 11: 0.8, 12: 0.8, 23: 0.6, 24: 0.6
    },
    kick: {
        25: 1.2, 26: 1.2, 27: 1.4, 28: 1.4, 11: 0.6, 12: 0.6, 23: 0.6, 24: 0.6
    }
};

// utility to get weight for a global index and current skill
function getLandmarkWeight(idx, skill){
    const base = (LANDMARK_BASE_WEIGHT[idx] !== undefined) ? LANDMARK_BASE_WEIGHT[idx] : 0.6;
    const mult = (SKILL_WEIGHT_MULTIPLIER[skill] && SKILL_WEIGHT_MULTIPLIER[skill][idx]) ? SKILL_WEIGHT_MULTIPLIER[skill][idx] : 1.0;
    return base * mult;
}

// ------------------ UTILS: FILTER / NORMALIZE / COMPARE / ANGLE ------------------

// return array of { idx: globalIndex, x, y, z?, visibility? }
// safe: if lm undefined or a point missing, push placeholder with null coords (keeps order)
function filterLandmarks(lm, skill){
    if(!lm || !FILTER_POINTS[skill]) return [];
    const points = FILTER_POINTS[skill];
    const out = [];
    for (let gi of points) {
        const p = lm[gi];
        if(p && typeof p.x === 'number' && typeof p.y === 'number') {
            // Mediapipe sometimes includes 'visibility' or 'presence'
            out.push({ idx: gi, x: p.x, y: p.y, z: (p.z!==undefined?p.z:null), v: (p.visibility!==undefined?p.visibility:1) });
        } else {
            out.push({ idx: gi, x: null, y: null, z: null, v: 0 });
        }
    }
    return out;
}

// Improved normalization:
// - center on midpoint of hips if available, else mean
// - rotate to align shoulder axis horizontally when shoulders present (reduces rotational variance)
// - scale by torso length (distance shoulder midpoint <-> hip midpoint) when possible
// Note: keeps order and nulls
function normalizeLandmarks(filtered){
    if(!filtered || filtered.length === 0) return [];

    // helper to find by idx
    function find(idx){
        for(const p of filtered) if(p.idx === idx) return p;
        return null;
    }

    const hipL = find(23);
    const hipR = find(24);
    // shoulder indices in our filter are 11/12 only if included
    const shL = find(11);
    const shR = find(12);

    // compute hip center
    let hipCenter = null;
    if(hipL && hipL.x !== null && hipR && hipR.x !== null){
        hipCenter = { x: (hipL.x + hipR.x)/2, y: (hipL.y + hipR.y)/2 };
    } else {
        // fallback: mean of valid points
        const val = filtered.filter(p => p.x !== null && p.y !== null);
        if(val.length === 0) return filtered.map(p => ({ x: null, y: null, idx: p.idx }));
        hipCenter = { x: val.reduce((s,p)=>s+p.x,0)/val.length, y: val.reduce((s,p)=>s+p.y,0)/val.length };
    }

    // rotation angle: align shoulders horizontally (if both shoulders valid)
    let rot = 0;
    let torsoLength = null;
    if(shL && shL.x !== null && shR && shR.x !== null){
        const dx = shR.x - shL.x;
        const dy = shR.y - shL.y;
        rot = Math.atan2(dy, dx); // angle shoulder->shoulder
        // torso length approximated as distance between shoulder midpoint and hip midpoint
        const shMid = { x: (shL.x + shR.x)/2, y: (shL.y + shR.y)/2 };
        torsoLength = Math.hypot(shMid.x - hipCenter.x, shMid.y - hipCenter.y);
    }

    // fallback torso length: average distance from hip center to other valid points
    if(!torsoLength || torsoLength === 0){
        let total = 0, c = 0;
        for(const p of filtered){
            if(p.x === null) continue;
            total += Math.hypot(p.x - hipCenter.x, p.y - hipCenter.y);
            c++;
        }
        torsoLength = (c>0) ? (total / c) : 1;
        if(torsoLength === 0) torsoLength = 1;
    }

    // produce normalized coords: translate, rotate (-rot), scale by torsoLength
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);

    return filtered.map(p => {
        if(p.x === null || p.y === null) return { x: null, y: null, idx: p.idx };
        const tx = p.x - hipCenter.x;
        const ty = p.y - hipCenter.y;
        // rotate
        const rx = tx * cos - ty * sin;
        const ry = tx * sin + ty * cos;
        return { x: rx / torsoLength, y: ry / torsoLength, idx: p.idx };
    });
}

// compare normalized arrays (same length) using weighted Euclidean distance
// skip null points; return similarity in range 0..1
function compareLandmarks(lm1, lm2){
    if(!lm1 || !lm2) return null;
    // filter by tmpSkill first
    const f1 = filterLandmarks(lm1, tmpSkill);
    const f2 = filterLandmarks(lm2, tmpSkill);

    if(!f1.length || !f2.length) return null;

    const n1 = normalizeLandmarks(f1);
    const n2 = normalizeLandmarks(f2);

    let totalWeightedDist = 0;
    let totalWeight = 0;
    for (let i = 0; i < n1.length; i++) {
        const p1 = n1[i];
        const p2 = n2[i];
        if(!p1 || !p2) continue;
        if(p1.x === null || p1.y === null || p2.x === null || p2.y === null) continue;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const idx = n1[i].idx;
        const w = getLandmarkWeight(idx, tmpSkill);
        totalWeightedDist += Math.sqrt(dx*dx + dy*dy) * w;
        totalWeight += w;
    }
    if(totalWeight === 0) return null;
    const avgWeighted = totalWeightedDist / totalWeight; // expected small when similar

    // convert distance -> similarity: similarity = exp(-k * avgWeighted)
    // choose k to make similarity responsive; tuned for normalized torso-scale coords
    const k = 0.5; // higher -> more strict
    const similarity = Math.exp(-k * avgWeighted);
    return similarity;
}

// safe angle calc: if any point missing or magnitude zero, return null
function angle(a, b, c){
    if(!a || !b || !c) return null;
    if(a.x === null || a.y === null || b.x === null || b.y === null || c.x === null || c.y === null) return null;

    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;

    const dot = abx * cbx + aby * cby;
    const magAB = Math.hypot(abx, aby);
    const magCB = Math.hypot(cbx, cby);

    if(magAB === 0 || magCB === 0) return null;

    let cos = dot / (magAB * magCB);
    if (!isFinite(cos)) return null;
    cos = Math.min(1, Math.max(-1, cos));
    return Math.acos(cos) * (180 / Math.PI);
}

// computeJointAnglesFromFull expects full mediapipe landmarks array (indexed 0..32) and returns angles in degrees or null
function computeJointAnglesFromFull(fullLm, skill){
    const angles = {};
    if(!fullLm) return angles;

    // helper to safely get point by global index (returns {x,y} or null) using normalized coords
    function pt(idx){
        const p = fullLm[idx];
        if(!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
        return { x: p.x, y: p.y };
    }

    if(skill === "kick"){
        // use hip-shoulder-knee configuration to better capture leg swing relative to body
        angles.leftKnee  = angle(pt(11), pt(23), pt(25));
        angles.rightKnee = angle(pt(12), pt(24), pt(26));
    } else {
        angles.leftElbow  = angle(pt(11), pt(13), pt(15));
        angles.rightElbow = angle(pt(12), pt(14), pt(16));
    }

    return angles;
}

// computeJointAnglesFromFiltered expects filtered array [{idx,x,y},...] (normalized coords or raw) - used for scoring if needed
function computeJointAnglesFromFiltered(filtered, skill){
    // helper to find point by global idx in filtered array
    function find(globalIdx){
        for(const p of filtered) if(p.idx === globalIdx) return p;
        return null;
    }
    const angles = {};
    if(!filtered || !filtered.length) return angles;

    if(skill === "kick"){
        angles.leftKnee  = angle(find(23), find(25), find(27));
        angles.rightKnee = angle(find(24), find(26), find(28));
    } else {
        angles.leftElbow  = angle(find(11), find(13), find(15));
        angles.rightElbow = angle(find(12), find(14), find(16));
    }
    return angles;
}

// ------------------ Setup Video/Canvas ------------------

// untuk mensetting element video dan canvas
function getVideoCanvas(vid1,vid2,canv1,canv2){
    video1 = document.getElementById(vid1);
    video2 = document.getElementById(vid2);
    
    if(video1) video1.muted = true;
    if(video2) video2.muted = true;

    canvas1 = document.getElementById(canv1);
    canvas2 = document.getElementById(canv2);
    if(canvas1) ctx1 = canvas1.getContext('2d');
    if(canvas2) ctx2 = canvas2.getContext('2d');
}

// loading model mediapipe
const pose1 = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
const pose2 = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });

// Use modelComplexity 1 for better landmark quality while keeping performance reasonable for mobile
pose1.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });
pose2.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

let landmarks1 = null;
let landmarks2 = null;
let modelsReady = false;

// proses mediapipe event handlers & draw to canvas
function drawResults(results, canvas, ctx) {
    if(!canvas || !ctx) return;

    // draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    } catch(e){
        // sometimes drawImage fails if image not ready
    }

    // use mediapipe's drawing for connectors/landmarks if available
    if (results.poseLandmarks) {
        try {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 });
        } catch(e){
            // ignore drawing errors
        }
    }

    // update text-below-canvas overlay (posisi 3)
    if(results.poseLandmarks){
        updateAngleTextBelow(canvas, results.poseLandmarks, tmpSkill);
    } else {
        updateAngleTextBelow(canvas, null, tmpSkill);
    }
}

// updateAngleTextBelow: create/update a sibling div below canvas to show angles
function updateAngleTextBelow(canvas, fullLm, skill){
    if(!canvas) return;

    const containerId = `${canvas.id}-angles`;
    let el = document.getElementById(containerId);

    // create element if missing
    if(!el){
        el = document.createElement('div');
        el.id = containerId;
        el.setAttribute('class','overlay-angles');
        // simple default styling; user can override via CSS
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.fontSize = '14px';
        el.style.color = '#fff';
        el.style.background = 'rgba(0,0,0,0.45)';
        el.style.padding = '6px 10px';
        el.style.marginTop = '6px';
        el.style.borderRadius = '6px';
        el.style.display = 'inline-block';
        el.style.minWidth = '220px';
        // insert after canvas
        if(canvas.parentNode) {
            if(canvas.nextSibling) canvas.parentNode.insertBefore(el, canvas.nextSibling);
            else canvas.parentNode.appendChild(el);
        } else {
            document.body.appendChild(el);
        }
    }

    // compute angles (fullLm is mediapipe array normalized 0..1 or null)
    const angles = computeJointAnglesFromFull(fullLm, skill);

    // prepare text lines per skill
    let left = '—', right = '—';
    if(skill === 'kick'){
        if(angles.leftKnee != null) left = Math.round(angles.leftKnee) + '°';
        if(angles.rightKnee != null) right = Math.round(angles.rightKnee) + '°';
        el.textContent = `Kaki Kiri: ${left}  |  Kaki Kanan: ${right}`;
    } else {
        if(angles.leftElbow != null) left = Math.round(angles.leftElbow) + '°';
        if(angles.rightElbow != null) right = Math.round(angles.rightElbow) + '°';
        el.textContent = `Siku Kiri: ${left}  |  Siku Kanan: ${right}`;
    }
}

// proses mediapipe event handlers
pose1.onResults(results => {
    landmarks1 = results.poseLandmarks;
    if(canvas1 && ctx1) drawResults(results, canvas1, ctx1);
});

pose1.onError = (e) => {
    if(errorCatcher) errorCatcher.textContent = "mediapipe error : " + JSON.stringify(e);
}

pose2.onResults(results => {
    landmarks2 = results.poseLandmarks;
    if(canvas2 && ctx2) drawResults(results, canvas2, ctx2);
});

pose2.onError = (e) => {
    if(errorCatcher) errorCatcher.textContent = "mediapipe error : " + JSON.stringify(e);
};

// ------------------ FRAME PROCESSING / LOOP ------------------

let lastProcessed = 0;
let intervalMs = 200; // default

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const FRAME_INTERVAL = isMobile ? 400 : 200; // 2.5 fps on mobile
intervalMs = FRAME_INTERVAL;

let startTime = null;
const MAX_DURATION = 12000; // 12s

async function processFrames(timestamp) {
    if (!startTime) startTime = timestamp;

    const elapsed = timestamp - startTime;
    if (elapsed >= MAX_DURATION) {
        console.log("⏱ Penilaian selesai (12 detik)");
        if(video1) video1.pause();
        if(video2) video2.pause();
        cancelAnimationFrame(rafID);
        return;
    }
    if (!video1 || !video2) {
        rafID = requestAnimationFrame(processFrames);
        return;
    }
    if (video1.paused || video2.paused || video1.ended || video2.ended){
        if(video1) video1.pause();
        if(video2) video2.pause();
        cancelAnimationFrame(rafID);
        return;
    }

    if(timestamp - lastProcessed >= intervalMs){
        // draw frames to canvas (for pose send)
        if(ctx1 && canvas1 && video1.videoWidth && video1.videoHeight){
            ctx1.drawImage(video1, 0, 0, canvas1.width, canvas1.height);
        }
        if(ctx2 && canvas2 && video2.videoWidth && video2.videoHeight){
            ctx2.drawImage(video2, 0, 0, canvas2.width, canvas2.height);
        }

        // send frames to mediapipe
        try {
            if(pose1 && canvas1) await pose1.send({ image: canvas1 });
            if(pose2 && canvas2) await pose2.send({ image: canvas2 });
        } catch(e){
            console.warn("pose send error:", e);
        }

        lastProcessed = timestamp;

        // compute similarity & angles for scoring (safe)
        const similarity = compareLandmarks(landmarks1, landmarks2);
        // compute joint angles for scoring using filtered arrays (safer)
        const f1 = filterLandmarks(landmarks1, tmpSkill);
        const f2 = filterLandmarks(landmarks2, tmpSkill);
        const ang1 = computeJointAnglesFromFiltered(f1, tmpSkill);
        const ang2 = computeJointAnglesFromFiltered(f2, tmpSkill);

        // angle-based score (simple)
        let angleScore = null;
        if(tmpSkill === 'kick'){
            if(ang1.leftKnee != null && ang2.leftKnee != null){
                const dL = Math.abs((ang1.leftKnee||0) - (ang2.leftKnee||0));
                const sL = 1 - Math.min(1, dL/180);
                const dR = Math.abs((ang1.rightKnee||0) - (ang2.rightKnee||0));
                const sR = 1 - Math.min(1, dR/180);
                angleScore = (sL + sR) / 2;
            }
        } else {
            if(ang1.leftElbow != null && ang2.leftElbow != null){
                const dL = Math.abs((ang1.leftElbow||0) - (ang2.leftElbow||0));
                const sL = 1 - Math.min(1, dL/180);
                const dR = Math.abs((ang1.rightElbow||0) - (ang2.rightElbow||0));
                const sR = 1 - Math.min(1, dR/180);
                angleScore = (sL + sR) / 2;
            }
        }

        // combine similarity & angleScore (if available) with stricter weighting
        let finalScoreForFrame = null;
        if(similarity !== null && angleScore !== null){
            // make combination stricter: raise angle importance slightly
            finalScoreForFrame = (similarity * 0.55) + (angleScore * 0.45);
        } else if(similarity !== null){
            finalScoreForFrame = similarity;
        } else if(angleScore !== null){
            finalScoreForFrame = angleScore;
        }

        // apply small temporal smoothing using a short buffer
        if(finalScoreForFrame !== null){
            frameScores.push(finalScoreForFrame);
            if(frameScores.length > FRAME_BUFFER) frameScores.shift();
            const sum = frameScores.reduce((a,b)=>a+b,0);
            const smooth = sum / frameScores.length;

            tmpScore += smooth;
            tmpCount++;
            averageScore = (tmpScore / tmpCount);
            console.log("Frame finalScore:", finalScoreForFrame.toFixed(4), "Smooth:", smooth.toFixed(4), "Avg:", averageScore.toFixed(4));
            tampilkanNilai(tmpSkill);
        }
    }

    rafID = requestAnimationFrame(processFrames);
}

// ------------------ Video setup and preload ------------------

function setupVideo(v1, v2) {
    if(!v1 || !v2) return;
    v1.addEventListener('play', () => {
        if (!modelsReady) {
            v1.pause();
            alert("Model belum siap. Silakan tunggu sebentar...");
            return;
        }

        // Sync — lebih ketat pada sinkronisasi
        if (Math.abs(v2.currentTime - v1.currentTime) > 0.05) {
            v2.currentTime = v1.currentTime;
        }
        if (v2.paused) {
            v2.play();
        }

        // set canvas sizes to video natural size (or choose smaller for performance)
        // untuk mobile, gunakan ukuran terbatas untuk menghemat CPU
        const MAX_W = isMobile ? 480 : v1.videoWidth;
        const MAX_H = isMobile ? Math.round((v1.videoHeight / v1.videoWidth) * MAX_W) : v1.videoHeight;
        canvas1.width = MAX_W;
        canvas1.height = MAX_H;
        canvas2.width = MAX_W;
        canvas2.height = MAX_H;

        // start loop
        processFrames();
    });

    v1.addEventListener('pause', () => {
        if (!v2.paused) v2.pause();
    });
}

async function preloadModels(el) {
    let buttonAnalize = el;
    const dummy = document.createElement('canvas');
    dummy.width = 320;
    dummy.height = 240;
    const dctx = dummy.getContext('2d');
    dctx.fillStyle = "black";
    dctx.fillRect(0, 0, dummy.width, dummy.height);

    // warm-up model
    try {
        await pose1.send({ image: dummy });
        await pose2.send({ image: dummy });
    } catch(e){
        console.warn("warmup error:", e);
    }

    modelsReady = true;
    if(buttonAnalize) buttonAnalize.removeAttribute('disabled');
    if(buttonAnalize) buttonAnalize.textContent = "Video siap diproses";
    if(buttonAnalize) buttonAnalize.style.background = "linear-gradient(135deg, var(--maroon-dark), var(--maroon-light))";
    loadScreenActive = false;
    if(errorCatcher) errorCatcher.textContent = "mediapipe siap";
}

// trigger awal (pastikan element exist)
let hideButton = document.getElementById('hideButton');
getVideoCanvas('vidH1','vidH2','canH1','canH2');
preloadModels(hideButton);

function loadScreen(){
    let ls = document.getElementById('loadScreen');
    if(!ls) return;
    let x = setInterval(()=>{
        if(loadScreenActive == false){
            ls.style.display = "none";
            clearInterval(x);
        }
    }, 1000);
}
loadScreen();

// ------------------ Proses Video - input onchange ------------------

let inputFile = document.getElementsByClassName('untuk-input');

Array.from(inputFile).forEach((item)=>{
    item.onchange = (e)=>{
        let tmp = e.target.id;
        let vid1 = `${tmp}-1`;
        let vid2 = `${tmp}-2`;
        let tmp2 = tmp.split('-')[0];
        let cvs1 = `${tmp2}-canvas-1`;
        let cvs2 = `${tmp2}-canvas-2`;
        getVideoCanvas(vid1,vid2,cvs1,cvs2);

        // gunakan tmp2 sebagai controller
        if(video1) video1.src = cekTest(tmp2);
        if(video1) video1.load();
        if(video2) video2.src = URL.createObjectURL(e.target.files[0]);

        // panggil setupvideo
        setupVideo(video1,video2);
        let btnAnalize = document.getElementById(`${tmp2}-analize`);

        // ubah status tombol analize
        if(btnAnalize) btnAnalize.textContent = "Menunggu model mediapipe"

        // initialize (warmup)
        preloadModels(btnAnalize);
    }
})

// untuk controller
function cekTest(str){
    switch(str) {
        case "throw" :
            return "lempar.mp4";
        case "catch" :
            return "lempar.mp4";
        case "hit" :
            return "hit.mp4";
        case "kick" :
            return "kick.mp4";
        default :
            return "";
    }
}

// ------------------ Analisa Video - trigger ------------------

// Trigger Analisa Video
let button = document.getElementsByClassName('analyzeVideo');

Array.from(button).forEach((item)=>{
    item.textContent = "Menunggu video diunggah";
    item.onclick = (e)=>{
        item.textContent = "Video sedang diproses";
        let skill = item.getAttribute('data-id');
        tmpScore = 0.0000;
        tmpCount = 0;
        averageScore = 0;
        tmpSkill = skill;
        frameScores = [];
        startTime = null;
        if(video1) video1.play();
    }
})

// fungsi untuk menampilkan nilai
function tampilkanNilai(skill){
    let buttonAnalize = document.getElementById(`${skill}-analize`);
    if(buttonAnalize){
        buttonAnalize.setAttribute('disabled', 'disabled');
        buttonAnalize.textContent = "Menunggu video baru, (tekan reset)";
        buttonAnalize.style.background = "rgba(100,100,100,.7)";
    }
    const resultEl = document.getElementById(`${skill}-result`);
    if(resultEl) resultEl.style.display = 'block';

    if (skill == "catch") {
        scores['tangkap'] = getNilai(`${skill}-score`);
    }
    else if(skill == "throw"){
        scores['lempar'] = getNilai(`${skill}-score`);
    }
    else{
        scores[skill] = getNilai(`${skill}-score`);
    }
}

// binding fungsi analisa video (untuk mendapatkan nilai)
function getNilai(el){
    let tmp = document.getElementById(el);
    let score = Math.round(averageScore*1000)/10;
    if(tmp) tmp.textContent = score;
    return score;
}

// ------------------ Reset / Records / Export (tidied) ------------------

// Trigger untuk reset form
const resetBtn = document.getElementById('reset');
if(resetBtn) resetBtn.onclick = ()=> resetForm();

function resetForm() {
    if(!confirm('Apakah Anda yakin ingin mereset semua data?')) return;
    let input = document.getElementsByTagName('input');
    let video = document.getElementsByTagName('video');
    let canvas = document.getElementsByTagName('canvas');
    let angles = document.getElementsByClassName('overlay-angles');
    let analysisResult = document.getElementsByClassName('analysis-result');
    Array.from(input).forEach((item)=>{
        item.value = "";
    })
    Array.from(video).forEach((item)=>{
        item.removeAttribute('src');
        try { item.load(); } catch(e){}
    })
    Array.from(canvas).forEach((item)=>{
        try {
            const tmpCtx = item.getContext('2d');
            tmpCtx.clearRect(0,0, item.width, item.height);
        } catch(e){}
    })
    Array.from(angles).forEach((item)=>{
        const parentEl = item.parentNode;
        parentEl.removeChild(item);
    });

    for(const obj in scores){
        scores[obj] = 0;
    }

    Array.from(button).forEach((item)=>{
        item.textContent = "Menunggu video diunggah";
        item.removeAttribute('disabled');
        item.style.background = '';
    })

    Array.from(analysisResult).forEach((item)=>{
        item.style.display = 'none';
    })

    const overall = document.getElementById('overall-result');
    if(overall) overall.style.display = 'none';
    const allScoreWrapper = document.getElementById('all-score-wrapper');
    if(allScoreWrapper) allScoreWrapper.style.display = 'none';
    const exportBtn = document.getElementById('export');
    if(exportBtn) exportBtn.style.display = 'none';

    // reset scoring data
    tmpScore = 0;
    tmpCount = 0;
    averageScore = 0;
    tmpSkill = "";
}

// ------------------ Record & Export (kept original logic) ------------------

let record = document.getElementById('record');
if(record) record.onclick = ()=>{
    let showData = document.getElementsByClassName('show-data');
    let input = document.getElementsByClassName('input-text')
    let hasEmpty = false
    Array.from(input).forEach((item)=>{
        if(item.value == ""){
            let tmp = item.getAttribute('id');
            tmp = tmp.split('-');
            tmp = tmp.join(' ');
            alert("Masukan data : " + tmp );
            hasEmpty = true;
        }
    })

    if(hasEmpty == true) return;

    let data = {
        nama : "",
        kelas : "",
        sekolah : "",
        nilai1 : 0,
        nilai2 : 0,
        nilai3 : 0,
        nilai4 : 0,
    }

    let key = ['nama', 'kelas', 'sekolah'];

    for(let i = 0; i < 7; ++i){
        if(i < 3){
            showData[i].textContent = input[i].value
            data[key[i]] = input[i].value
        }
        switch(i) {
        case 3:
            showData[i].textContent = scores.lempar
            data.nilai1 = scores.lempar
            break;
        case 4:
            showData[i].textContent = scores.tangkap
            data.nilai2 = scores.tangkap
            break;
        case 5:
            showData[i].textContent = scores.hit
            data.nilai3 = scores.hit
            break;
        case 6:
            showData[i].textContent = scores.kick
            data.nilai4 = scores.kick
            break;
        default:
            break;
        }
    }

    data['tanggal'] = getTanggal();
    const tanggalEl = document.getElementById('tanggal');
    if(tanggalEl) tanggalEl.textContent = data.tanggal

    let dataNilai = [];
    if(localStorage.getItem('dataNilai') == null){
        dataNilai[0] = data;
        localStorage.setItem('dataNilai', JSON.stringify(dataNilai));
    }
    else{
        let tmp = localStorage.getItem('dataNilai');
        dataNilai = JSON.parse(tmp);
        dataNilai[dataNilai.length] = data
        localStorage.setItem('dataNilai', JSON.stringify(dataNilai));
    }
    
    const overall = document.getElementById('overall-result');
    if(overall) overall.style.display = 'block';
}

// tanggal helper
function getTanggal(){
    let d = new Date();
    let y = d.getFullYear();
    let m = d.getMonth()+1;
    if(m.toString().length > 1){ m = m } else { m = `0${m}` }
    let t = d.getDate()
    if(t.toString().length > 1){ t = t } else { t = `0${t}` }
    let h = d.getHours();
    let mnt = d.getMinutes();
    let dtk = d.getSeconds();
    return `${y}/${m}/${t} ${h}:${mnt}:${dtk}`;
}

// export to xlsx (unchanged)
/*
function exportToXLS() {
    let newDate = getTanggal();
    newDate = newDate.replaceAll("/", "-");
    newDate = newDate.replaceAll(" ", "_");
    newDate = newDate.replaceAll(":","-");
    const table = document.getElementById('table-record');
    if(!table) return;
    const ws = XLSX.utils.table_to_sheet(table, {
        cellDates: true,
        dateNF: "dd/mm/yyyy hh:mm:ss",
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Hasil Penilaian");
    XLSX.writeFile(wb, "PMM_data_analisa_video_"+ newDate +".xlsx");
}
*/

// export to xlsx (fixed for Android WebView)
function exportToXLS() {
    let newDate = getTanggal();
    newDate = newDate.replaceAll("/", "-").replaceAll(" ", "_").replaceAll(":", "-");

    const table = document.getElementById('table-record');
    if (!table) return;

    const ws = XLSX.utils.table_to_sheet(table, {
        cellDates: true,
        dateNF: "dd/mm/yyyy hh:mm:ss",
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Hasil Penilaian");

    // Jika tidak ada Android interface → browser biasa
    if (!window.Android) {
        XLSX.writeFile(wb, "PMM_data_analisa_video_" + newDate + ".xlsx");
        return;
    }

    // Jika di WebView Android → convert ke Base64
    const base64 = XLSX.write(wb, {
        bookType: "xlsx",
        type: "base64"
    });

    // Kirim ke Android untuk disimpan sebagai file
    window.Android.saveExcelBase64(
        base64,
        "PMM_data_analisa_video_" + newDate + ".xlsx"
    );
}


function showAllRecord(){
    let allScoreWrapper = document.getElementById('all-score-wrapper');
    let exportXLS = document.getElementById('export')

    if(exportXLS){
        exportXLS.onclick = ()=>{
            if(localStorage.getItem('dataNilai') == null){
                alert('Data tidak ditemukan, atau sudah dihapus');
            }
            else {
                konfirmasi('Apakah Anda ingin menghapus semua data penilaian juga ?')            
            }
        }
    }

    if(localStorage.getItem('dataNilai') == null){
        return alert('No data found !');
    }
    else {
        if(allScoreWrapper) allScoreWrapper.style.display = "block"
        if(exportXLS) exportXLS.style.display = "block";

        let tbodyRecord = document.getElementById('tbody-record');
        if(!tbodyRecord) return;
        tbodyRecord.innerHTML = "";

        let controlShow = ['tanggal','nama','kelas','sekolah','nilai1', 'nilai2', 'nilai3', 'nilai4']

        let dataNilai = localStorage.getItem('dataNilai');
        dataNilai = JSON.parse(dataNilai);

        let n = 1;
        Array.from(dataNilai).forEach((item)=>{
            let tr = document.createElement('tr');
            let td = document.createElement('td');
            td.textContent = n;
            tr.appendChild(td)
            for(let i of controlShow){
                let tdN = document.createElement('td');
                tdN.textContent = item[i]
                tr.appendChild(tdN);
            }

            tbodyRecord.appendChild(tr);
            ++n;
        })
    }
}

let tombolShowRecord = document.getElementById('show-all');
if(tombolShowRecord) tombolShowRecord.onclick = ()=>{
    showAllRecord();
}

function konfirmasi(str){
    let wrapper = document.createElement('div');
    let pesan = document.createElement('div');
    let isiPesan = document.createElement('span');
    let wrapperTombol = document.createElement('div');
    let iya = document.createElement('button');
    let tidak = document.createElement('button');

    iya.textContent = "iya";
    iya.setAttribute('style','text-align: center; padding: 2% 3%; border-radius: 8px; background: #6D94C5; width: 150px; border: 1px solid white;')
    tidak.textContent = "tidak";
    tidak.setAttribute('style','text-align: center; padding: 2% 3%; border-radius: 8px; background: #37353E; width: 150px; border: 1px solid white;')

    wrapperTombol.appendChild(iya);
    wrapperTombol.appendChild(tidak);
    wrapperTombol.setAttribute('style','display: flex; justify-content: center; align-items: center; gap: 5px; flex-wrap: nowrap; color: white;')

    isiPesan.textContent = str;
    pesan.appendChild(isiPesan);
    pesan.appendChild(wrapperTombol);
    pesan.setAttribute('style','display: flex; gap: 10px; flex-direction: column; justify-content: center; align-items: center; padding: 3% 5%; background: rgba(50,50,50,.9); color: white; border-radius: 8px; width: 480px;');
    wrapper.appendChild(pesan);
    wrapper.setAttribute('style','display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 15; background: rgba(0,0,0,.5);');
    document.body.appendChild(wrapper);

    iya.onclick = () => {
        document.body.removeChild(wrapper);
        localStorage.removeItem('dataNilai');
        exportToXLS();
        let allScoreWrapper = document.getElementById('all-score-wrapper');
        if(allScoreWrapper) allScoreWrapper.style.display = 'none';
        resetForm();
    }    
    tidak.onclick = () => {
        document.body.removeChild(wrapper);
        exportToXLS();
    }
}

// ------------------ END OF SCRIPT ------------------
