// Pertama buat fungsi onchange untuk input
let inputFile = document.getElementsByClassName('untuk-input');

Array.from(inputFile).forEach((item)=>{
	item.onchange = (e)=>{
		// panggil getVideoCanvas()
		let tmp = e.target.id;
		let vid1 = `${tmp}-1`;
		let vid2 = `${tmp}-2`;
		let tmp2 = tmp.split('-')[0];
		let cvs1 = `${tmp2}-canvas-1`;
		let cvs2 = `${tmp2}-canvas-2`;
		getVideoCanvas(vid1,vid2,cvs1,cvs2);

		//gunakan tmp2 sebagai controller
		video1.src = cekTest(tmp2);
		console.log(video1.src);
		video1.load();
		video2.src = URL.createObjectURL(e.target.files[0]);

		// ubah status tombol analize

		// panggil setupvideo
		setupVideo(video1,video2);
		let btnAnalize = document.getElementById(`${tmp2}-analize`);

		// ubah status tombol analize
		btnAnalize.textContent = "Menunggu model mediapipe"

		//initialize
		preloadModels(btnAnalize);
	}
})

// untuk controller
function cekTest(str){
	switch(str) {
		case "throw" :
			return "lempar.mp4";
			break;
		case "catch" :
			return "lempar.mp4";
			break;
		case "hit" :
			return "hit.mp4";
			break;
		case "kick" :
			return "kick.mp4";
			break;
		default :
			break;
	}
}
