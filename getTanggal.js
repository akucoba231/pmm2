// Untuk mendapatkan tanggal otomatis
function getTanggal(){
    let d = new Date();
    let y = d.getFullYear();

    let m = d.getMonth()+1;

    if(m.toString().length > 1){
        m = m
    }
    else {
        m = `0${m}`
    }

    let t = d.getDate()

    if(t.toString().length > 1){
        t = t
    } else {
        t = `0${t}`
    }

    let h = d.getHours();
    let mnt = d.getMinutes();
    let dtk = d.getSeconds();

    return `${y}/${m}/${t} ${h}:${mnt}:${dtk}`;
}