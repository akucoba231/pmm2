// ini adalah inisiasi awal, karena ketidakpahaman

import {
  ObjectDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

const vision = await FilesetResolver.forVisionTasks(
  // path/to/wasm/root
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

let objectDetector = await ObjectDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite`,
    //delegate: "GPU"
},
scoreThreshold: 0.5,
  runningMode: "IMAGE", //VIDEO , IMAGE
  displayNamesLocale: "id",
  categoryAllowList: ["person", "ball"]
});


function makeBox2(el, x, y, w, h, keterangan, confident) {
  //imgCont;
  let scale = 1; //(video.naturalWidth / video.offsetWidth).toFixed(1);

  x = (x / scale).toFixed(1)
  y = (y / scale).toFixed(1)
  w = (w / scale).toFixed(1)
  h = (h / scale).toFixed(1)

  let span = document.createElement('span');
  span.textContent = keterangan + " : " + confident
  let box = document.createElement('div');
  box.setAttribute('class', 'box');
  box.classList.add('video-box')
  box.setAttribute('style', `
    top: ${y}px;
    left: ${x}px;
    width: ${w}px;
    height: ${h}px;
  `);
  box.appendChild(span)
  el.appendChild(box);
}

await objectDetector.setOptions({ runningMode: "VIDEO" });


let lastVideoTime = -1;
function renderLoop(nama_video) {
  const video = document.getElementById(nama_video);

  if(video.ended){
    lastVideoTime = -1;
  }
  else if (video.currentTime !== lastVideoTime) {
    let vidCont = video.parentNode;
    //console.log(video);
    try {
      let videoBox = document.getElementsByClassName('video-box');
      Array.from(videoBox).forEach((item) => {
        item.parentNode.removeChild(item);
    })
  } catch (e) {
      console.log(e.toString())
  }

  const detections = objectDetector.detectForVideo(video, lastVideoTime);
  console.log(detections.detections);
  let lihat = detections.detections;
  
  lihat.forEach((item) => {
      let keterangan = item.categories[0].categoryName;
      let confident = item.categories[0].score;
      let x = item.boundingBox.originX
      let y = item.boundingBox.originY
      let width = item.boundingBox.width
      let height = item.boundingBox.height

      makeBox2(vidCont, x, y, width, height, keterangan, confident);
      //console.log("ok")
  })
  lastVideoTime = video.currentTime;
  
}

requestAnimationFrame(() => {
    renderLoop(nama_video);
});
}






// Fungsi ini tidak diketahui
// function generateReport() {
//     const name = document.getElementById('student-name').value || 'Nama Siswa';
//     calculateOverallAverage();
//     alert(`Laporan lengkap untuk ${name} sedang diproses...`);
//             // Dalam implementasi nyata akan menghasilkan PDF atau tampilan laporan
// }



