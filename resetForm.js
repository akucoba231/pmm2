// Trigger untuk reset form
document.getElementById('reset').onclick = ()=>{
    return resetForm();
}
// fungsi untuk reset form
function resetForm() {
    if(confirm('Apakah Anda yakin ingin mereset semua data?')) {
        // document.getElementById('student-name').value = '';
        // document.getElementById('student-class').value = '';
        // document.getElementById('student-school').value = '';

        let input = document.getElementsByTagName('input');
        let video = document.getElementsByTagName('video');
        let canvas = document.getElementsByTagName('canvas');
        Array.from(input).forEach((item)=>{
            item.value = "";
        })
        Array.from(video).forEach((item)=>{
            item.removeAttribute('src');
            item.load();
        })
        Array.from(canvas).forEach((item)=>{
            const tmpCtx = item.getContext('2d');
            tmpCtx.fillStyle = "rgba(239,239,239,.7)";
            tmpCtx.fillRect(0, 0, item.width, item.height);
        })

        for(const obj in scores){
            scores[obj] = 0;
        }

        Array.from(button).forEach((item)=>{
            item.textContent = "Menunggu video diunggah";
        })

        

        document.getElementById('overall-result').style.display = 'none';
        document.getElementById('all-score-wrapper').style.display = 'none';
        document.getElementById('export').style.display = 'none';
    }
}