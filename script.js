
(() => {
  'use strict';
  const KEY = 'attendance-system-v1';
  const STATUSES = ['未記録', '出席', '欠席', '遅刻'];
  const $ = id => document.getElementById(id);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10) === s;
  function validate(data) {
    if (!data || !Array.isArray(data.students) || !data.attendance || typeof data.attendance !== 'object' || Array.isArray(data.attendance)) throw Error('保存形式が対応していません。');
    const ids = new Set();
    for (const s of data.students) {
      if (!s || !['string','number'].includes(typeof s.id) || !String(s.id) || ['__proto__','constructor','prototype'].includes(String(s.id)) || typeof s.name !== 'string' || !s.name.trim() || ids.has(String(s.id))) throw Error('生徒データに不正なID・名前、または重複があります。');
      ids.add(String(s.id));
    }
    for (const [date, records] of Object.entries(data.attendance)) {
      if (!validDate(date) || !records || typeof records !== 'object' || Array.isArray(records) || Object.values(records).some(v => !STATUSES.includes(v))) throw Error('出席記録の日付・状態を確認してください。');
    }
    return data;
  }
  let state = {students: [], attendance: {}}, locked = false, snapshot = null;
  function notice(message) { $('notice').textContent = message; }
  try { snapshot = localStorage.getItem(KEY); if (snapshot !== null) state = validate(JSON.parse(snapshot)); }
  catch (e) { locked = true; notice('保存データを読み込めません。元データを保護するため編集を停止しました。JSONバックアップを保存してください。詳細：'+e.message); }
  function commit(next) {
    if (locked) { notice('編集を停止中です。有効なJSONを復元するか、元データを確認してください。'); return false; }
    try {
      if (localStorage.getItem(KEY) !== snapshot) throw Error('別のタブでデータが更新されました。再読み込みしてください。');
      const json = JSON.stringify(next); localStorage.setItem(KEY, json); snapshot = json; state = next; notice('保存しました。'); return true;
    } catch(e) { notice('保存できませんでした。変更は反映していません。'+e.message); return false; }
  }
  const statusAt = (student, date) => own(state.attendance, date) && own(state.attendance[date], student.id) ? state.attendance[date][student.id] : '未記録';
  const counts = values => { const c = {present:0,absent:0,late:0,recorded:0}; for (const s of values) { if (s==='出席') c.present++; if(s==='欠席') c.absent++; if(s==='遅刻') c.late++; } c.recorded=c.present+c.absent+c.late; return c; };
  const percentage = c => c.recorded ? (c.present/c.recorded*100).toFixed(1)+'%' : '—';
  const matches = s => s.name.normalize('NFKC').toLocaleLowerCase('ja').includes($('search').value.trim().normalize('NFKC').toLocaleLowerCase('ja'));
  const cell = (row, text) => { const td=document.createElement('td'); td.textContent=text; row.append(td); return td; };
  function render() {
    const date=$('date').value, month=$('month').value;
    const daily=counts(state.students.map(s=>statusAt(s,date)));
    $('total').textContent=state.students.length; $('present').textContent=daily.present; $('other').textContent=`${daily.absent} / ${daily.late}`;
    // 既存仕様：日別は登録人数を分母とし、遅刻を出席に含めない。
    $('rate').textContent=state.students.length ? (daily.present/state.students.length*100).toFixed(1)+'%' : '—';
    $('dailySummary').textContent=`${date} · 記録済み ${daily.recorded}人 / 未記録 ${state.students.length-daily.recorded}人（日別出席率は登録人数が分母）`;
    $('students').replaceChildren(); $('monthlyStudents').replaceChildren();
    const visible=state.students.filter(matches);
    $('empty').textContent=visible.length?'':state.students.length?'該当する生徒がいません。':'生徒名を入力して、最初の生徒を登録しましょう。';
    const dates=Object.keys(state.attendance).filter(d=>d.startsWith(month+'-')).sort();
    for(const student of visible) {
      const tr=document.createElement('tr'); cell(tr,student.name);
      const select=document.createElement('select'); select.setAttribute('aria-label',student.name+'の出席状況');
      for(const value of STATUSES) { const option=document.createElement('option'); option.value=value; option.textContent=value; select.append(option); }
      select.value=statusAt(student,date); select.className=['unknown','present','absent','late'][STATUSES.indexOf(select.value)]; select.disabled=locked;
      select.addEventListener('change',()=>{ const next=JSON.parse(JSON.stringify(state)); if(!own(next.attendance,date)) next.attendance[date]={}; next.attendance[date][student.id]=select.value; commit(next); render(); });
// 出席状況を表示
cell(tr, '').append(select);

// 削除ボタンを作成
const deleteButton = document.createElement('button');
deleteButton.type = 'button';
deleteButton.textContent = '削除';
deleteButton.className = 'delete-btn';
deleteButton.disabled = locked;

// 削除ボタンが押されたとき
deleteButton.addEventListener('click', () => {

  const confirmed = confirm(
    student.name + 'を削除しますか？\n' +
    'この生徒の出席記録も削除されます。'
  );

  if (!confirmed) return;

  // 現在のデータをコピー
  const next = JSON.parse(JSON.stringify(state));

  // 生徒一覧から削除
  next.students = next.students.filter(
    s => String(s.id) !== String(student.id)
  );

  // すべての日付の出席記録から削除
  for (const records of Object.values(next.attendance)) {
    delete records[student.id];
  }

  // 保存が成功した場合だけ画面を更新
  if (commit(next)) {
    render();
  }
});

// 操作列に削除ボタンを追加
cell(tr, '').append(deleteButton);

// 行を生徒一覧に追加
$('students').append(tr);

      
      const c=counts(dates.map(d=>statusAt(student,d))); const row=document.createElement('tr'); [student.name,c.present,c.absent,c.late,percentage(c)].forEach(v=>cell(row,v)); $('monthlyStudents').append(row);
    }
    if(!visible.length) { const row=document.createElement('tr'); const td=cell(row,'表示する生徒がいません。'); td.colSpan=5; $('monthlyStudents').append(row); }
    const all=counts(dates.flatMap(d=>state.students.map(s=>statusAt(s,d))));
    $('monthRate').textContent=percentage(all); $('monthSummary').textContent=`${dates.filter(d=>state.students.some(s=>statusAt(s,d)!=='未記録')).length}日分の記録 · 出席 ${all.present} / 欠席 ${all.absent} / 遅刻 ${all.late}（延べ人数）`;
    $('chart').replaceChildren();
    const [year,m]=month.split('-').map(Number), days=new Date(year,m,0).getDate();
    for(let day=1;day<=days;day++) {
      const d=`${month}-${String(day).padStart(2,'0')}`, c=counts(state.students.map(s=>statusAt(s,d))), item=document.createElement('div'); item.className='bar-item'; item.setAttribute('role','listitem'); item.setAttribute('aria-label',`${d}：${c.recorded?percentage(c):'未記録'}`); item.title=item.getAttribute('aria-label');
      const value=document.createElement('b'); value.textContent=c.recorded?Math.round(c.present/c.recorded*100)+'%':'—'; const track=document.createElement('div'); track.className='bar-track';
      if(c.recorded) { const bar=document.createElement('div'); bar.className='bar'; bar.style.height=(c.present/c.recorded*100)+'%'; track.append(bar); }
      const label=document.createElement('span'); label.textContent=day; item.append(value,track,label); $('chart').append(item);
    }
  }
  function download(text,filename,type) { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  const csvCell = value => '"'+String(value).replace(/^[=+@\-\t\r\n]/,"'$&").replace(/"/g,'""')+'"';
  $('date').value=localDate(); $('month').value=localDate().slice(0,7);
  $('date').addEventListener('change',()=>{if(!validDate($('date').value)) $('date').value=localDate(); render();});
  $('month').addEventListener('change',()=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test($('month').value)) $('month').value=localDate().slice(0,7); render();});
  $('search').addEventListener('input',render);
  $('addForm').addEventListener('submit',event=>{event.preventDefault(); 
const name = $('name').value.trim();
if (!name) return;

// 名前を比較しやすい形式に統一
const normalizeName = value =>
  value.trim().normalize('NFKC').toLowerCase();

// 同じ名前が登録されているか確認
const isDuplicate = state.students.some(student =>
  normalizeName(student.name) === normalizeName(name)
);

if (isDuplicate) {
  alert('同じ名前の生徒は登録できません。');
  return;
}

const next = JSON.parse(JSON.stringify(state));
 let id; do { id='student-'+Date.now()+'-'+Math.random().toString(36).slice(2); } while(next.students.some(s=>String(s.id)===id)); next.students.push({id,name}); if(commit(next)) $('name').value=''; render();});
  $('csv').addEventListener('click',()=>{ const date=$('date').value; const rows=[['日付','生徒名','出席状況'],...state.students.map(s=>[date,s.name,statusAt(s,date)])]; download('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'attendance-'+date+'.csv','text/csv;charset=utf-8'); });
  $('export').addEventListener('click',()=>download(locked?snapshot??'':JSON.stringify(state,null,2),'attendance-backup-'+localDate()+'.json','application/json'));
  $('import').addEventListener('change',async event=>{ const file=event.target.files[0]; if(!file)return; try { const next=validate(JSON.parse((await file.text()).replace(/^\uFEFF/,''))); if(!confirm(`生徒${next.students.length}人のデータで現在のデータを置き換えます。先にバックアップを保存しましたか？`))return; const previous=locked; locked=false; if(!commit(next)) locked=previous; render(); } catch(e){notice('復元できませんでした。'+e.message);} finally{event.target.value='';} });
  window.addEventListener('storage',event=>{if(event.key===KEY || event.key===null) {locked=true; notice('別のタブで保存データが変更されました。再読み込みしてから編集してください。'); render();}});
  render();
})();