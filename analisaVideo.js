// Trigger Analisa Video
let button = document.getElementsByClassName('analyzeVideo');

Array.from(button).forEach((item)=>{
    item.textContent = "Menunggu video diunggah";
    item.onclick = (e)=>{
        item.textContent = "Video sedang diproses";
        let skill = item.getAttribute('data-id');
        //analyzeVideo(skill); //off
        tmpScore = 0.0000;
        tmpCount = 0;
        averageScore = 0;
        tmpSkill = skill;
        startTime = null;
        video1.play();
        //tampilkanNilai(skill);
    }
})

// fungsi analisa video
/*
function analyzeVideo(skill) {
            // Simulasi analisis AI (dalam implementasi nyata akan menggunakan API AI)
    alert(`Video ${skill} sedang dianalisis oleh AI...`);

    let vidContainer = document.getElementById(skill);
    vidContainer.innerHTML = "";

    let video = document.createElement('video');
    video.setAttribute('id',`${skill}-video`);
    let source = document.createElement('source');
    let videoUpload = document.getElementById(`${skill}-video`);
    let note = document.getElementById(`${skill}-note`);

    test = videoUpload.files[0];

    let tmp = videoUpload.files[0];
    if(tmp == undefined){
        return alert("Masukan video terlebih dahulu.")
    }
    note.textContent = tmp.name;
    source.src = URL.createObjectURL(tmp);
    source.type = tmp.type

    video.appendChild(source);
    video.controls = true;
    vidContainer.appendChild(video);
    video.addEventListener('loadeddata', async ()=>{
        console.log("Memulai analisa");
        renderLoop(`${skill}-video`);
    })
    //console.log(test);

            // Tampilkan hasil (ini hanya simulasi)
    setTimeout(() => {
        document.getElementById(`${skill}-result`).style.display = 'block';
        console.log('ok')
        if (skill == "catch") {
            scores['tangkap'] = getNilai(`${skill}-score`);
        }
        else if(skill == "throw"){
            scores['lempar'] = getNilai(`${skill}-score`);
        }
        else{
            scores[skill] = getNilai(`${skill}-score`);
        }
        //calculateOverallAverage();
    }, 2000);
}
*/

// fungsi untuk menampilkan nilai
function tampilkanNilai(skill){
    //console.log(skill)
    let buttonAnalize = document.getElementById(`${skill}-analize`);
    buttonAnalize.setAttribute('disabled', 'disabled');
    buttonAnalize.textContent = "Menunggu video baru, (tekan reset)";
    buttonAnalize.style.background = "rgba(100,100,100,.7)";
    document.getElementById(`${skill}-result`).style.display = 'block';
    console.log('ok')
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
        //console.log(el);
        let tmp = document.getElementById(el);
        //console.log(tmp)

    // fungsi yang paling riskan malah di sini
        let score = Math.round(averageScore*1000)/10;
        tmp.textContent = score;
        return score;
    }
