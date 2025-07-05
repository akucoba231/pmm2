// deklarasi awal 

let video1;
let video2;
let canvas1;
let canvas2;
let ctx1;
let ctx2;

	// untuk mensetting element video dan canvas
function getVideoCanvas(vid1,vid2,canv1,canv2){
	video1 = document.getElementById(vid1);
	video2 = document.getElementById(vid2);
	
	canvas1 = document.getElementById(canv1);
	canvas2 = document.getElementById(canv2);
	ctx1 = canvas1.getContext('2d');
	ctx2 = canvas2.getContext('2d');
    //const mirrorCheckbox = document.getElementById('mirrorCheckbox');
    //const loadingText = document.getElementById('loading');
}

	// loading model mediapipe
const pose1 = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
const pose2 = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });

pose1.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });
pose2.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

let landmarks1 = null;
let landmarks2 = null;
let modelsReady = false;

    // proses mediapipe
pose1.onResults(results => {
	landmarks1 = results.poseLandmarks;
	drawResults(results, canvas1, ctx1);
});

pose2.onResults(results => {
	landmarks2 = results.poseLandmarks;
	drawResults(results, canvas2, ctx2);
});

    // untuk menggambar result ke canvas
function drawResults(results, canvas, ctx) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
	if (results.poseLandmarks) {
		drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
		drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 });
	}
}

    // untuk mendeteksi posisi orang (jadi patokan bukan secara pixel saja)
function normalizeLandmarks(landmarks) {
	const hipsCenter = {
		x: (landmarks[23].x + landmarks[24].x) / 2,
		y: (landmarks[23].y + landmarks[24].y) / 2
	};
	const shoulderCenter = {
		x: (landmarks[11].x + landmarks[12].x) / 2,
		y: (landmarks[11].y + landmarks[12].y) / 2
	};
	const torsoLength = Math.hypot(
		shoulderCenter.x - hipsCenter.x,
		shoulderCenter.y - hipsCenter.y
		);
	return landmarks.map(pt => ({
		x: (pt.x - hipsCenter.x) / torsoLength,
		y: (pt.y - hipsCenter.y) / torsoLength
	}));
}

    // untuk membandingkan dan memberi nilai
function compareLandmarks(lm1, lm2) {
	if (!lm1 || !lm2) return null;
	// if (mirrorCheckbox.checked) {
	// 	lm2 = flipLandmarksHorizontally(lm2);
	// }
	const norm1 = normalizeLandmarks(lm1);
	const norm2 = normalizeLandmarks(lm2);

	let total = 0;
	for (let i = 0; i < norm1.length; i++) {
		const dx = norm1[i].x - norm2[i].x;
		const dy = norm1[i].y - norm2[i].y;
		total += Math.sqrt(dx * dx + dy * dy);
	}
	const diff = total / norm1.length;
      // utamanya di sini
      return 1 / (1 + diff); // similarity score: 1 = perfect, 0 = very different
    }

  // untuk membatasi frame 
  let lastProcessed = 0;
  const intervalMs = 200; //setting ke 5 FPS

  // untuk stop jika sudah 15 detik

  let startTime = null;
  const MAX_DURATION = 15000; // batas video 15 detik

  // pemanggilan proses puncaknya di sini
  async function processFrames(timestamp) {
  	if (!startTime) startTime = timestamp;

  	const elapsed = timestamp - startTime;
  	if (elapsed >= MAX_DURATION) {
    	console.log("⏱ Penilaian selesai (15 detik)");
    	video1.pause();
    	video2.pause();
    	return; // Hentikan penilaian
  	}
  	if (video1.paused || video2.paused || video1.ended || video2.ended){
  		video1.pause();
  		video2.pause();
  		return;
  	}

  	if(timestamp - lastProcessed >= intervalMs){
      // ini akan menggambar per frame (karena ada requestAnimationFrame)

  		ctx1.drawImage(video1, 0, 0, canvas1.width, canvas1.height); 
  		ctx2.drawImage(video2, 0, 0, canvas2.width, canvas2.height);

  		await pose1.send({ image: canvas1 });
  		await pose2.send({ image: canvas2 });

  		lastProcessed = timestamp;

  		const similarity = compareLandmarks(landmarks1, landmarks2);
  		if (similarity !== null) {
        // untuk menampilkan similarty (Penting)
  		//console.log("Pose similarity score:", similarity.toFixed(4));
  		/* // ini untuk versi awal
  		if(tmpScore == 0.0000){
  			tmpScore = parseFloat(similarity).toFixed(4);
  		}
  		else {
  			tmpScore = (parseFloat(tmpScore) + parseFloat(similarity)) / 2;
  			tmpScore = tmpScore.toFixed(4);
  		}*/

  			tmpScore += similarity;
  			tmpCount++;

  			averageScore = (tmpScore / tmpCount)
  			console.log("Pose similarity : " + similarity.toFixed(4));
  		//console.log(tmpScore);
  			tampilkanNilai(tmpSkill);
  		}
  	}
      // jika ingin mengatur speed proses, ada di sini
  	requestAnimationFrame(processFrames);
  }

  function setupVideo(video1, video2) {
  	video1.addEventListener('play', () => {
  		if (!modelsReady) {
  			video1.pause();
  			alert("Model belum siap. Silakan tunggu sebentar...");
  			return;
  		}

        // Sync
  		if (Math.abs(video2.currentTime - video1.currentTime) > 0.1) {
  			video2.currentTime = video1.currentTime;
  		}
  		if (video2.paused) {
  			video2.play();
  		}

  		canvas1.width = video1.videoWidth;
  		canvas1.height = video1.videoHeight;
  		canvas2.width = video2.videoWidth;
  		canvas2.height = video2.videoHeight;

  		processFrames();
  	});

  	video1.addEventListener('pause', () => {
  		if (!video2.paused) video2.pause();
  	});
  }

  async function preloadModels(el) {
  	let buttonAnalize = el;
  	if(!modelsReady){
  		const dummy = document.createElement('canvas');
  		dummy.width = 320;
  		dummy.height = 240;
  		const dctx = dummy.getContext('2d');
  		dctx.fillStyle = "black";
  		dctx.fillRect(0, 0, dummy.width, dummy.height);

      // dari sini fungsi draw akan dipanggil (berpengaruh ke canvas);
  		await pose1.send({ image: dummy }); 
  		await pose2.send({ image: dummy });

  		modelsReady = true;
  		buttonAnalize.removeAttribute('disabled');
  		buttonAnalize.textContent = "Video siap diproses";
  		buttonAnalize.style.background = "linear-gradient(135deg, var(--maroon-dark), var(--maroon-light))";
  	}
  	else {
  		buttonAnalize.removeAttribute('disabled');
  		buttonAnalize.textContent = "Video siap diproses";
      buttonAnalize.style.background = "linear-gradient(135deg, var(--maroon-dark), var(--maroon-light))";
  	}
  }

    // trigger di sini, tetapi video src belum didefinisi
    //setupVideo(video1, video2);
    //preloadModels(); // inisialisasi model di awal

    /* Catatan : element video dan canvas dapat diset dengan fungsi getVideoCanvas(vid1,vid2,cvs1,cvs2)
		Catatan update : fungsi di atas dipakai di onchange input file
     */
    // setelah itu masukan video.src
    // lalu panggil setupVideo(); // ada di prosesvIdeo onchange input file
    /* untuk pemanggilan awal model mediapipe gunakan preloadModels 
    (bisa korbankan 1 sesi canvas atau buat canvas hidden) */

