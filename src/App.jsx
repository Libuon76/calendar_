import React, { useState, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ICAL from 'ical.js';
import { 
  Search, Moon, Sun, Settings, Plus, Calendar as CalIcon, 
  Upload, Download, Trash2, MapPin, CheckCircle2, Circle, X, Palette, Clock
} from 'lucide-react';
import { format, isSameDay, addDays, getDay, startOfMonth } from 'date-fns';

const PRESET_COLORS = ['#0ea5e9', '#2dd4bf', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6', '#64748b'];

// --- 高度な祝日計算ロジック（10年対応） ---
const getJapaneseHolidays = (year) => {
  const holidays = [];
  const add = (date, title) => holidays.push({ date, title });

  // 固定祝日
  add(`${year}-01-01`, '元日');
  add(`${year}-02-11`, '建国記念の日');
  add(`${year}-02-23`, '天皇誕生日');
  add(`${year}-04-29`, '昭和の日');
  add(`${year}-05-03`, '憲法記念日');
  add(`${year}-05-04`, 'みどりの日');
  add(`${year}-05-05`, 'こどもの日');
  add(`${year}-08-11`, '山の日');
  add(`${year}-11-03`, '文化の日');
  add(`${year}-11-23`, '勤労感謝の日');

  // ハッピーマンデー (第n月曜日)
  const getNthMonday = (y, month, nth) => {
    let first = new Date(y, month - 1, 1);
    let day = (8 - first.getDay()) % 7;
    if (day === 0) day = 7;
    let target = (nth - 1) * 7 + day + 1;
    return format(new Date(y, month - 1, target), 'yyyy-MM-dd');
  };

  add(getNthMonday(year, 1, 2), '成人の日');
  add(getNthMonday(year, 7, 3), '海の日');
  add(getNthMonday(year, 9, 3), '敬老の日');
  add(getNthMonday(year, 10, 2), 'スポーツの日');

  // 春分・秋分の計算
  const shunbun = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const shubun = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  add(`${year}-03-${shunbun}`, '春分の日');
  add(`${year}-09-${shubun}`, '秋分の日');

  // 振替休日の判定
  const result = [];
  holidays.forEach(h => {
    result.push(h);
    let d = new Date(h.date);
    if (d.getDay() === 0) { // 日曜日なら翌月曜を振替に
      let nextDay = format(addDays(d, 1), 'yyyy-MM-dd');
      result.push({ date: nextDay, title: '振替休日' });
    }
  });

  return result.map(h => ({
    id: `holiday-${h.date}-${h.title}`,
    title: h.title,
    start: h.date,
    allDay: true,
    display: 'background',
    backgroundColor: '#fff1f2',
    textColor: '#e11d48',
    className: 'fc-holiday'
  }));
};

const GradientFrame = ({ children, className = "" }) => (
  <div className={`p-[3px] rounded-[32px] bg-gradient-to-br from-cyan-400 via-sky-300 to-blue-500 shadow-xl shadow-sky-100 ${className}`}>
    <div className="bg-white rounded-[29px] h-full w-full overflow-hidden flex flex-col">{children}</div>
  </div>
);

export default function App() {
  const [calendars, setCalendars] = useState([{ id: '1', name: 'メイン', events: [], categories: [{id:'c1', label:'仕事', color:'#0ea5e9'}], todos: [] }]);
  const [activeId, setActiveId] = useState('1');
  const [searchTerm, setSearchTerm] = useState("");
  const [eventModal, setEventModal] = useState({ open: false, isEdit: false });
  const [form, setForm] = useState({ id: '', title: '', start: '', end: '', category: 'c1', allDay: false });
  const [catModal, setCatModal] = useState({ open: false, name: '', color: '#0ea5e9' });
  const calendarRef = useRef(null);

  const activeCal = useMemo(() => calendars.find(c => c.id === activeId) || calendars[0], [calendars, activeId]);

  // 10年分の祝日を生成 (2024~2034)
  const holidayEvents = useMemo(() => {
    let allHolidays = [];
    for (let i = 2024; i <= 2035; i++) {
      allHolidays = allHolidays.concat(getJapaneseHolidays(i));
    }
    return allHolidays;
  }, []);

  const calendarEvents = useMemo(() => {
    const filtered = activeCal.events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
    return [...filtered, ...holidayEvents];
  }, [activeCal.events, searchTerm, holidayEvents]);

  useEffect(() => {
    const saved = localStorage.getItem('master_ultra_v10_final');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.forEach(c => c.events.forEach(e => { e.start = new Date(e.start); e.end = e.end ? new Date(e.end) : new Date(e.start); }));
      setCalendars(parsed);
    }
  }, []);
  useEffect(() => { localStorage.setItem('master_ultra_v10_final', JSON.stringify(calendars)); }, [calendars]);

  const updateActiveCal = (newData) => setCalendars(prev => prev.map(c => c.id === activeId ? { ...c, ...newData } : c));

  const saveEvent = () => {
    if (!form.title) return;
    const cat = activeCal.categories.find(c => c.id === form.category);
    const newEv = { 
        id: form.id || String(Date.now()), title: form.title, start: new Date(form.start), end: new Date(form.end), 
        allDay: form.allDay, backgroundColor: cat?.color || '#0ea5e9', borderColor: 'transparent',
        extendedProps: { category: form.category }
    };
    updateActiveCal({ events: form.id ? activeCal.events.map(e => e.id === form.id ? newEv : e) : [...activeCal.events, newEv] });
    setEventModal({ open: false });
  };

  const handleImport = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const jcal = ICAL.parse(ev.target.result);
        const comp = new ICAL.Component(jcal);
        const imported = comp.getAllSubcomponents('vevent').map(ve => {
          const event = new ICAL.Event(ve);
          return { id: event.uid || String(Math.random()), title: event.summary, start: event.startDate.toJSDate(), end: event.endDate.toJSDate(), allDay: event.startDate.isDate, backgroundColor: '#e0f2fe', textColor: '#0369a1', extendedProps: { category: 'c1' } };
        });
        updateActiveCal({ events: [...activeCal.events, ...imported] });
      } catch (err) { alert("ICS形式エラー"); }
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] font-sans overflow-hidden text-slate-700">
      <header className="h-14 border-b border-sky-50 bg-white flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xl font-black text-sky-600"><CalIcon size={24} /> <span>Calendar</span></div>
          <div className="flex bg-sky-50 p-1 rounded-xl">
            {calendars.map(c => (<button key={c.id} onClick={()=>setActiveId(c.id)} className={`px-4 py-1 text-[10px] font-bold rounded-lg ${activeId === c.id ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400'}`}>{c.name}</button>))}
            <button onClick={()=>{const n=prompt('名:'); if(n) setCalendars([...calendars, {id:String(Date.now()), name:n, events:[], categories:[...activeCal.categories], todos:[]}])}} className="px-2 text-sky-400 font-bold">+</button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-200" size={14} /><input type="text" placeholder="検索" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-9 pr-4 py-1.5 bg-sky-50 border border-sky-100 rounded-full text-xs w-48 outline-none focus:ring-2 ring-sky-200"/></div>
      </header>

      <div className="flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">
        <aside className="w-56 flex flex-col gap-4 shrink-0 overflow-y-auto no-scrollbar">
          <GradientFrame><div className="p-5 text-slate-700">
            <h1 className="text-lg font-bold leading-tight mb-4 text-slate-700">10年祝日対応<br/>Calendar</h1>
            <button onClick={() => { setForm({id:'', title:'', start: format(new Date(), "yyyy-MM-dd'T'09:00"), end: format(new Date(), "yyyy-MM-dd'T'10:00"), category: activeCal.categories[0].id, allDay: false}); setEventModal({open:true, isEdit:false}); }} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 text-white rounded-2xl py-3 text-xs font-bold shadow-lg shadow-sky-100 mb-2 transition-all hover:scale-105 active:scale-95">+ 予定追加</button>
          </div></GradientFrame>
          
          <GradientFrame className="flex-1"><div className="p-5">
            <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-sky-300 uppercase">CATEGORY</span><Plus size={14} className="text-sky-400 cursor-pointer" onClick={()=>setCatModal({open:true, name:'', color: '#0ea5e9'})}/></div>
            {activeCal.categories.map(cat => (<div key={cat.id} className="flex items-center justify-between mb-3 text-[11px] font-bold text-slate-500 group"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: cat.color}}></div>{cat.label}</div><X size={10} className="opacity-0 group-hover:opacity-100 text-rose-300 cursor-pointer" onClick={()=>updateActiveCal({categories: activeCal.categories.filter(c=>c.id!==cat.id)})}/></div>))}
          </div></GradientFrame>

          <GradientFrame><div className="p-4 grid grid-cols-2 gap-2 text-center text-[8px] font-bold text-slate-400 uppercase">
            <label className="cursor-pointer group flex flex-col items-center border border-sky-50 rounded-xl p-2"><Upload size={18} className="text-sky-400 mb-1 group-hover:scale-110 transition-all"/>IMPORT<input type="file" onChange={handleImport} className="hidden" accept=".ics"/></label>
            <div className="cursor-pointer group flex flex-col items-center border border-sky-50 rounded-xl p-2" onClick={()=>{}}><Download size={18} className="text-sky-400 mb-1 group-hover:scale-110 transition-all"/>EXPORT</div>
          </div></GradientFrame>
        </aside>

        <div className="flex-1 min-w-0 relative p-[4px] rounded-[40px] bg-gradient-to-br from-cyan-400 via-sky-300 to-blue-500 shadow-2xl shadow-sky-100">
          <div className="bg-white rounded-[36px] h-full w-full p-6 overflow-hidden">
            <FullCalendar 
              ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale="ja" events={calendarEvents} height="100%" selectable={true} editable={true}
              eventClick={(i) => {
                if(i.event.id.startsWith('holiday')) return;
                const e = i.event;
                setForm({ id: e.id, title: e.title, start: format(e.start, e.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"), end: format(e.end || e.start, e.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"), category: e.extendedProps.category, allDay: e.allDay });
                setEventModal({ open: true, isEdit: true });
              }}
              headerToolbar={{left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek'}}
            />
          </div>
        </div>

        <aside className="w-60 flex flex-col gap-4">
          <GradientFrame><div className="p-5">
            <h3 className="font-bold text-[11px] text-slate-700 mb-4 flex items-center gap-2"><div className="w-1.5 h-3 bg-sky-400 rounded-full"></div> 今日の予定</h3>
            {activeCal.events.filter(e=>isSameDay(new Date(e.start), new Date())).slice(0,3).map((ev,i)=>(<div key={i} className="text-[11px] font-bold mb-2 p-3 bg-sky-50/50 rounded-xl border border-sky-50 truncate">{ev.title}</div>))}
          </div></GradientFrame>
          <div className="mt-auto p-6 rounded-[35px] bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-xl shadow-sky-100 text-center">
            <div className="text-[10px] font-bold">名古屋市 <Sun size={14} className="inline ml-1"/></div>
            <div className="text-4xl font-black">28°C</div>
            <div className="text-[10px] opacity-80">晴れのち曇り</div>
          </div>
        </aside>
      </div>

      {eventModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border-4 border-sky-50">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{eventModal.isEdit ? '編集' : '追加'}</h2><button onClick={()=>setEventModal({open:false})}><X/></button></div>
            <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl mb-4 outline-none font-bold" value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} placeholder="タイトル"/>
            <label className="flex items-center gap-3 p-3 bg-sky-50/50 rounded-xl cursor-pointer mb-4"><input type="checkbox" checked={form.allDay} onChange={(e)=>setForm({...form, allDay: e.target.checked})} className="accent-sky-500 w-5 h-5"/><span className="text-sm font-bold">終日予定</span></label>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <input type={form.allDay ? "date" : "datetime-local"} className="p-3 bg-slate-50 rounded-xl text-xs" value={form.start} onChange={(e)=>setForm({...form, start: e.target.value})}/>
               <input type={form.allDay ? "date" : "datetime-local"} className="p-3 bg-slate-50 rounded-xl text-xs" value={form.end} onChange={(e)=>setForm({...form, end: e.target.value})}/>
            </div>
            <select className="w-full p-3 bg-slate-50 rounded-xl text-xs mb-6" value={form.category} onChange={(e)=>setForm({...form, category: e.target.value})}>
               {activeCal.categories.map(c=>(<option key={c.id} value={c.id}>{c.label}</option>))}
            </select>
            <button onClick={saveEvent} className="w-full py-4 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold rounded-2xl shadow-lg">保存する</button>
            {eventModal.isEdit && <button onClick={()=>{updateActiveCal({events: activeCal.events.filter(e=>e.id!==form.id)}); setEventModal({open:false})}} className="w-full mt-4 text-rose-400 text-xs font-bold hover:underline">削除する</button>}
          </div>
        </div>
      )}

      {catModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-xs p-8 shadow-2xl border-4 border-sky-100 text-slate-700">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-black text-sky-600 flex items-center gap-2"><Palette size={20}/> カテゴリー作成</h2><button onClick={()=>setCatModal({open:false})}><X/></button></div>
            <input type="text" placeholder="名前" className="w-full p-4 bg-sky-50/50 rounded-2xl mb-6 outline-none font-bold" value={catModal.name} onChange={(e)=>setCatModal({...catModal, name:e.target.value})} />
            <div className="grid grid-cols-4 gap-3 mb-6">{PRESET_COLORS.map(c => (<button key={c} onClick={()=>setCatModal({...catModal, color:c})} className={`w-10 h-10 rounded-full border-4 transition-all ${catModal.color === c ? 'border-sky-400 scale-110 shadow-lg' : 'border-transparent'}`} style={{backgroundColor: c}} />))}</div>
            <button onClick={()=>{const n={id:String(Date.now()), label:catModal.name, color:catModal.color}; updateActiveCal({categories:[...activeCal.categories, n]}); setCatModal({open:false})}} className="w-full py-4 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-black rounded-3xl">作成する</button>
          </div>
        </div>
      )}
    </div>
  );
}