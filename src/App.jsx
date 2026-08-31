import React, { useState, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ICAL from 'ical.js';
import { 
  Search, Plus, Calendar as CalIcon, Upload, Download, 
  Trash2, MapPin, X, Sun, CheckCircle2, Circle, FileText
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';

const GradientFrame = ({ children, className = "" }) => (
  <div className={`p-[3px] rounded-[32px] bg-gradient-to-br from-cyan-400 via-sky-300 to-blue-500 shadow-xl shadow-sky-100 ${className}`}>
    <div className="bg-white rounded-[29px] h-full w-full overflow-hidden flex flex-col">{children}</div>
  </div>
);

export default function App() {
  const [calendars, setCalendars] = useState([{ id: '1', name: 'メイン', events: [], categories: [{id:'c1', label:'仕事', color:'#0ea5e9'}], todos: [] }]);
  const [activeId, setActiveId] = useState('1');
  const [searchTerm, setSearchTerm] = useState("");
  const [modal, setModal] = useState({ open: false, data: null });
  const calendarRef = useRef(null);

  const activeCal = calendars.find(c => c.id === activeId) || calendars[0];

  useEffect(() => {
    const saved = localStorage.getItem('master_ultra_v6');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.forEach(c => c.events.forEach(e => { e.start = new Date(e.start); e.end = new Date(e.end); }));
      setCalendars(parsed);
    }
  }, []);

  useEffect(() => { localStorage.setItem('master_ultra_v6', JSON.stringify(calendars)); }, [calendars]);

  const updateActiveCal = (newData) => setCalendars(calendars.map(c => c.id === activeId ? { ...c, ...newData } : c));

  // --- 機能：ICSインポート ---
  const handleImport = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const jcal = ICAL.parse(ev.target.result);
        const imported = new ICAL.Component(jcal).getAllSubcomponents('vevent').map(ve => {
          const event = new ICAL.Event(ve);
          return { id: event.uid || String(Math.random()), title: event.summary, start: event.startDate.toJSDate(), end: event.endDate.toJSDate(), allDay: event.startDate.isDate, backgroundColor: '#e0f2fe', textColor: '#0369a1', extendedProps: { uid: event.uid, location: event.location, description: event.description, category: 'c1' } };
        });
        updateActiveCal({ events: [...activeCal.events, ...imported] });
        alert("インポート完了！");
      } catch (err) { alert("形式エラー"); }
    };
    reader.readAsText(e.target.files[0]);
  };

  // --- 機能：CSVエクスポート ---
  const handleExportCSV = () => {
    let csv = "タイトル,開始,終了,場所,メモ\n";
    activeCal.events.forEach(e => {
      csv += `"${e.title}","${format(e.start, 'yyyy/MM/dd HH:mm')}","${format(e.end, 'yyyy/MM/dd HH:mm')}","${e.extendedProps.location || ''}","${e.extendedProps.description || ''}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${activeCal.name}.csv`; link.click();
  };

  // --- 機能：ToDo操作 ---
  const addTodo = () => {
    const text = prompt("タスクを入力:");
    if(text) updateActiveCal({ todos: [...activeCal.todos, { id: Date.now(), text, done: false }] });
  };

  const toggleTodo = (id) => {
    updateActiveCal({ todos: activeCal.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) });
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] font-sans overflow-hidden text-slate-700">
      <header className="h-14 border-b border-sky-50 bg-white flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xl font-black text-sky-600"><CalIcon size={24} /> <span>Calendar</span></div>
          <div className="flex bg-sky-50 p-1 rounded-xl">
            {calendars.map(c => (
              <button key={c.id} onClick={()=>setActiveId(c.id)} className={`px-4 py-1 text-[10px] font-bold rounded-lg ${activeId === c.id ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400'}`}>{c.name}</button>
            ))}
            <button onClick={()=>{const n=prompt('カレンダー名:'); if(n) setCalendars([...calendars, {id:String(Date.now()), name:n, events:[], categories:[...activeCal.categories], todos:[]}])}} className="px-2 text-sky-400">+</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-200" size={14} />
          <input type="text" placeholder="予定を検索..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-9 pr-4 py-1.5 bg-sky-50 border border-sky-100 rounded-full text-xs w-48 outline-none focus:ring-2 ring-sky-200"/>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">
        {/* 左 */}
        <aside className="w-56 flex flex-col gap-4 shrink-0">
          <GradientFrame><div className="p-5 text-slate-700">
            <h1 className="text-lg font-bold leading-tight mb-4">{activeCal.name}</h1>
            <button onClick={()=>setModal({open:true, data:{title:'', start: format(new Date(), "yyyy-MM-dd'T'09:00"), end: format(new Date(), "yyyy-MM-dd'T'10:00"), category: 'c1'}})} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 text-white rounded-2xl py-3 text-xs font-bold shadow-lg shadow-sky-100 mb-2">+ 予定追加</button>
          </div></GradientFrame>
          
          <GradientFrame className="flex-1"><div className="p-5 overflow-y-auto no-scrollbar">
            <h3 className="text-[10px] font-black text-sky-300 uppercase mb-4">Category</h3>
            {activeCal.categories.map(cat => (<div key={cat.id} className="flex items-center gap-2 mb-3 text-[11px] font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: cat.color}}></div>{cat.label}</div>))}
          </div></GradientFrame>

          <GradientFrame><div className="p-4 grid grid-cols-2 gap-2 text-center">
            <label className="cursor-pointer group"><Upload size={18} className="mx-auto text-sky-400 mb-1 group-hover:scale-110 transition-all"/><div className="text-[8px] font-bold text-slate-400 uppercase">Import</div><input type="file" onChange={handleImport} className="hidden" accept=".ics"/></label>
            <div className="cursor-pointer group" onClick={handleExportCSV}><FileText size={18} className="mx-auto text-sky-400 mb-1 group-hover:scale-110 transition-all"/><div className="text-[8px] font-bold text-slate-400 uppercase">Export CSV</div></div>
          </div></GradientFrame>
        </aside>

        {/* 中 */}
        <div className="flex-1 min-w-0 relative p-[4px] rounded-[40px] bg-gradient-to-br from-cyan-400 via-sky-300 to-blue-500 shadow-2xl shadow-sky-100">
          <div className="bg-white rounded-[36px] h-full w-full p-6 overflow-hidden">
            <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale="ja" events={activeCal.events.filter(e=>e.title.includes(searchTerm))} height="100%" eventClick={(i)=>setModal({open:true, data:{...i.event.extendedProps, id:i.event.id, title:i.event.title, start:format(i.event.start,"yyyy-MM-dd'T'HH:mm"), end:format(i.event.end||i.event.start,"yyyy-MM-dd'T'HH:mm")}})} headerToolbar={{left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek'}}/>
          </div>
        </div>

        {/* 右 */}
        <aside className="w-60 flex flex-col gap-4 shrink-0 overflow-y-auto no-scrollbar">
          <GradientFrame><div className="p-5">
            <h3 className="font-bold text-[11px] mb-4 flex items-center gap-2"><div className="w-1.5 h-3 bg-sky-400 rounded-full"></div> 今日の予定</h3>
            {activeCal.events.filter(e=>isSameDay(new Date(e.start), new Date())).slice(0,3).map((ev,i)=>(<div key={i} className="text-[11px] font-bold mb-2 p-3 bg-sky-50/50 rounded-xl border border-sky-50">{ev.title}</div>))}
            {activeCal.events.filter(e=>isSameDay(new Date(e.start), new Date())).length === 0 && <div className="text-[10px] text-slate-300">予定はありません</div>}
          </div></GradientFrame>

          <GradientFrame className="flex-1"><div className="p-5">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-[11px]">ToDo</h3><Plus size={14} className="text-sky-400 cursor-pointer" onClick={addTodo}/></div>
            {activeCal.todos.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 mb-3 cursor-pointer" onClick={()=>toggleTodo(todo.id)}>
                {todo.done ? <CheckCircle2 size={16} className="text-sky-400"/> : <Circle size={16} className="text-slate-200"/>}
                <span className={`text-[11px] font-medium ${todo.done ? 'line-through text-slate-300' : 'text-slate-500'}`}>{todo.text}</span>
              </div>
            ))}
          </div></GradientFrame>

          <div className="p-6 rounded-[35px] bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-xl shadow-sky-100">
            <div className="text-[10px] font-bold">名古屋市 <Sun size={14} className="inline ml-1"/></div>
            <div className="text-4xl font-black">28°C</div>
            <div className="text-[10px] opacity-80">晴れのち曇り</div>
          </div>
        </aside>
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-6 text-xl font-bold">予定の編集<button onClick={()=>setModal({open:false})}><X/></button></div>
            <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl mb-4 outline-none font-bold" value={modal.data.title} onChange={(e)=>setModal({...modal, data:{...modal.data, title:e.target.value}})} placeholder="タイトル"/>
            <button onClick={()=>{
                const newEv = { ...modal.data, id: modal.data.id || String(Date.now()), backgroundColor: '#0ea5e9' };
                const evs = modal.data.id ? activeCal.events.map(e=>e.id===modal.data.id?newEv:e) : [...activeCal.events, newEv];
                updateActiveCal({ events: evs }); setModal({open:false});
            }} className="w-full py-4 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold rounded-2xl">保存する</button>
            {modal.data.id && <button onClick={()=>{updateActiveCal({events:activeCal.events.filter(e=>e.id!==modal.data.id)}); setModal({open:false})}} className="w-full mt-4 text-rose-400 text-xs">予定を削除</button>}
          </div>
        </div>
      )}
    </div>
  );
}