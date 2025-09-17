// Fungsi untuk export ke XLSX
function exportToXLS() {
    let newDate = getTanggal();
    newDate = newDate.replaceAll("/", "-");
    newDate = newDate.replaceAll(" ", "_");
    newDate = newDate.replaceAll(":","-");
            /* Ambil data dari tabel HTML */
    const table = document.getElementById('table-record');
    const ws = XLSX.utils.table_to_sheet(table, {
        cellDates: true, // Penting: agar tanggal dikenali sebagai objek tanggal Excel
        dateNF: "dd/mm/yyyy hh:mm:ss", // Format yang diinginkan (tanggal dan waktu)

    });

            /* Buat workbook baru */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Hasil Penilaian");

            /* Tulis file XLSX */
    XLSX.writeFile(wb, "PMM_data_analisa_video_"+ newDate +".xlsx");
}

// Binding Fungsi 
function showAllRecord(){
    let allScoreWrapper = document.getElementById('all-score-wrapper');
    let exportXLS = document.getElementById('export')

    exportXLS.onclick = ()=>{
        if(localStorage.getItem('dataNilai') == null){
            alert('Data tidak ditemukan, atau sudah dihapus');
        }
        else {
            konfirmasi('Apakah Anda ingin menghapus juga semua data penilaian ?')            
        }
    }


    if(localStorage.getItem('dataNilai') == null){
        return alert('No data found !');
    }
    else {

        allScoreWrapper.style.display = "block"
        exportXLS.style.display = "block";

        let tbodyRecord = document.getElementById('tbody-record');
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

// Trigger Button untuk Export

let tombolShowRecord = document.getElementById('show-all');
tombolShowRecord.onclick = ()=>{
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
    }    
    tidak.onclick = () => {
        document.body.removeChild(wrapper);
        exportToXLS();
    }
}
