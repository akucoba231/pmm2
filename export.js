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
        exportToXLS();
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
