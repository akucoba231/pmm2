// Untuk menampilkan hasil penilaian satu siswa
let record = document.getElementById('record');
record.onclick = ()=>{
    let showData = document.getElementsByClassName('show-data');
    let input = document.getElementsByClassName('input-text')
    let hasEmpty = false
    Array.from(input).forEach((item)=>{
        if(item.value == ""){
            let tmp = item.getAttribute('id');
            tmp = tmp.split('-');
            tmp = tmp.join(' ');
            alert("Masukan data : " + tmp ); //item.getAttribute('id'));
            hasEmpty = true;
        }
    })

    if(hasEmpty == true){
        //alert("Data tidak boleh kosong !");
        return;
    }

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
    document.getElementById('tanggal').textContent = data.tanggal


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
    
    document.getElementById('overall-result').style.display = 'block';
    //return "ok";

}