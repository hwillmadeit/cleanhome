'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './cleaning.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  text: string;
  done: boolean;
  completions: string[]; // ISO datetime strings
}

type PeriodKey = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual';
type MainView  = 'all' | 'undone' | 'history';

interface Period {
  key: PeriodKey;
  label: string;
  icon: string;
  color: string;
  resetLabel: string;
}

type TaskMap  = Record<PeriodKey, Task[]>;
type LastReset = Record<PeriodKey, string>;

// ─── Constants ───────────────────────────────────────────────────────────────
const PERIODS: Period[] = [
  { key: 'daily',     label: '일별',   icon: '☀️', color: '#FF6B6B', resetLabel: '매일 자정 초기화' },
  { key: 'weekly',    label: '주별',   icon: '📅', color: '#4ECDC4', resetLabel: '매주 월요일 초기화' },
  { key: 'monthly',   label: '월별',   icon: '🗓️', color: '#45B7D1', resetLabel: '매월 1일 초기화' },
  { key: 'quarterly', label: '분기별', icon: '🍃', color: '#96CEB4', resetLabel: '분기 시작일 초기화' },
  { key: 'biannual',  label: '반기별', icon: '⭐', color: '#FFEAA7', resetLabel: '1월·7월 초기화' },
  { key: 'annual',    label: '연별',   icon: '🏠', color: '#DDA0DD', resetLabel: '매년 1월 1일 초기화' },
];

const DEFAULT_TASKS: TaskMap = {
  daily:     [
    { id: 'd1', text: '주방 싱크대 닦기', done: false, completions: [] },
    { id: 'd2', text: '식탁 닦기',        done: false, completions: [] },
    { id: 'd3', text: '쓰레기통 비우기',  done: false, completions: [] },
  ],
  weekly:    [
    { id: 'w1', text: '진공청소기 돌리기', done: false, completions: [] },
    { id: 'w2', text: '화장실 청소',       done: false, completions: [] },
    { id: 'w3', text: '욕실 거울 닦기',    done: false, completions: [] },
  ],
  monthly:   [
    { id: 'm1', text: '냉장고 내부 청소', done: false, completions: [] },
    { id: 'm2', text: '전자레인지 청소',  done: false, completions: [] },
  ],
  quarterly: [
    { id: 'q1', text: '에어컨 필터 청소', done: false, completions: [] },
    { id: 'q2', text: '창문 청소',        done: false, completions: [] },
  ],
  biannual:  [
    { id: 'b1', text: '소파 깊은 청소',  done: false, completions: [] },
    { id: 'b2', text: '매트리스 청소',   done: false, completions: [] },
  ],
  annual:    [
    { id: 'a1', text: '이불 세탁',       done: false, completions: [] },
    { id: 'a2', text: '대청소 (전체)',   done: false, completions: [] },
  ],
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getPeriodKey(key: PeriodKey, now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  switch (key) {
    case 'daily':     return `${y}-${m}-${d}`;
    case 'weekly': {
      const day  = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon  = new Date(now);
      mon.setDate(d + diff);
      return `${mon.getFullYear()}-W${mon.getMonth()+1}-${mon.getDate()}`;
    }
    case 'monthly':   return `${y}-${m}`;
    case 'quarterly': return `${y}-Q${Math.ceil(m/3)}`;
    case 'biannual':  return `${y}-H${m <= 6 ? 1 : 2}`;
    case 'annual':    return `${y}`;
  }
}

// 날짜 포맷 헬퍼
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7)  return `${days}일 전`;
  if (days < 30) return `${Math.floor(days/7)}주 전`;
  if (days < 365)return `${Math.floor(days/30)}개월 전`;
  return `${Math.floor(days/365)}년 전`;
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────
function TaskRow({ task, color, onToggle, onDelete }: {
  task: Task; color: string; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={styles.taskRow}>
      <button
        onClick={onToggle}
        className={styles.checkbox}
        style={{ borderColor: task.done ? color : 'rgba(255,255,255,0.25)', backgroundColor: task.done ? color : 'transparent' }}
        aria-label={task.done ? '완료 취소' : '완료 처리'}
      >
        {task.done && <span className={styles.checkmark}>✓</span>}
      </button>
      <span className={styles.taskText} style={{ color: task.done ? '#4a4a5a' : '#ddd', textDecoration: task.done ? 'line-through' : 'none' }}>
        {task.text}
      </span>
      <button onClick={onDelete} className={styles.deleteBtn} aria-label="삭제">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── HistoryView ─────────────────────────────────────────────────────────────
function HistoryView({ tasks }: { tasks: TaskMap }) {
  const [search, setSearch]       = useState('');
  const [filterPeriod, setFilter] = useState<PeriodKey | 'all'>('all');
  const [expandedId, setExpanded] = useState<string | null>(null);

  // 모든 태스크를 마지막 완료일 기준으로 정렬
  const allTasks = useMemo(() => {
    return PERIODS.flatMap(({ key, label, color, icon }) =>
      (tasks[key] || [])
        .filter(t => t.completions && t.completions.length > 0)
        .map(t => ({ ...t, periodKey: key, periodLabel: label, color, icon }))
    )
    .filter(t => {
      const matchSearch = t.text.toLowerCase().includes(search.toLowerCase());
      const matchPeriod = filterPeriod === 'all' || t.periodKey === filterPeriod;
      return matchSearch && matchPeriod;
    })
    .sort((a, b) => {
      const aLast = a.completions[a.completions.length - 1] ?? '';
      const bLast = b.completions[b.completions.length - 1] ?? '';
      return bLast.localeCompare(aLast);
    });
  }, [tasks, search, filterPeriod]);

  // 완료 기록이 하나도 없는 항목
  const neverDone = useMemo(() => {
    return PERIODS.flatMap(({ key, label, color, icon }) =>
      (tasks[key] || [])
        .filter(t => !t.completions || t.completions.length === 0)
        .map(t => ({ ...t, periodKey: key, periodLabel: label, color, icon }))
    ).filter(t => {
      const matchSearch = t.text.toLowerCase().includes(search.toLowerCase());
      const matchPeriod = filterPeriod === 'all' || t.periodKey === filterPeriod;
      return matchSearch && matchPeriod;
    });
  }, [tasks, search, filterPeriod]);

  return (
    <div className={styles.section}>

      {/* 검색 */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="청소 항목 검색..."
          className={styles.searchInput}
        />
        {search && (
          <button onClick={() => setSearch('')} className={styles.searchClear}>✕</button>
        )}
      </div>

      {/* 주기 필터 */}
      <div className={styles.periodScroll}>
        <div className={styles.periodTrack}>
          {[{ key: 'all' as const, label: '전체', icon: '📋', color: '#888' }, ...PERIODS].map(p => (
            <button
              key={p.key}
              onClick={() => setFilter(p.key as PeriodKey | 'all')}
              className={`${styles.periodChip} ${filterPeriod === p.key ? styles.periodChipActive : ''}`}
              style={filterPeriod === p.key ? { borderColor: p.color, color: p.color } : {}}
            >
              <span className={styles.periodChipIcon}>{p.icon}</span>
              <span className={styles.periodChipLabel}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 완료 기록 있는 항목 */}
      {allTasks.length > 0 && (
        <div>
          <p className={styles.historyGroupTitle}>📌 완료 기록</p>
          <div className={styles.historyList}>
            {allTasks.map(t => {
              const last     = t.completions[t.completions.length - 1];
              const count    = t.completions.length;
              const expanded = expandedId === t.id;
              return (
                <div key={t.id} className={styles.historyCard}>
                  {/* 카드 헤더 */}
                  <button
                    className={styles.historyCardHeader}
                    onClick={() => setExpanded(expanded ? null : t.id)}
                  >
                    <div className={styles.historyCardLeft}>
                      <span className={styles.historyPeriodDot} style={{ background: t.color }} />
                      <div>
                        <p className={styles.historyTaskName}>{t.text}</p>
                        <div className={styles.historyMeta}>
                          <span className={styles.historyPeriodBadge} style={{ background: t.color + '28', color: t.color }}>
                            {t.icon} {t.periodLabel}
                          </span>
                          <span className={styles.historyLastDate}>
                            마지막 완료: <strong>{timeAgo(last)}</strong> ({formatDate(last)})
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.historyCardRight}>
                      <div className={styles.historyCount}>
                        <span className={styles.historyCountNum} style={{ color: t.color }}>{count}</span>
                        <span className={styles.historyCountLabel}>회</span>
                      </div>
                      <span className={styles.historyChevron} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* 펼쳐진 완료 날짜 목록 */}
                  {expanded && (
                    <div className={styles.historyExpanded}>
                      <p className={styles.historyExpandedTitle}>완료 기록 전체 ({count}회)</p>
                      <div className={styles.historyTimeline}>
                        {[...t.completions].reverse().map((iso, i) => (
                          <div key={iso} className={styles.historyTimelineItem}>
                            <div className={styles.historyTimelineDot} style={{ background: i === 0 ? t.color : 'rgba(255,255,255,0.15)' }} />
                            <div className={styles.historyTimelineText}>
                              <span className={styles.historyTimelineDate} style={{ color: i === 0 ? t.color : '#bbb' }}>
                                {formatDate(iso)}
                              </span>
                              {i === 0 && <span className={styles.historyTimelineTag}>최근</span>}
                              <span className={styles.historyTimelineAgo}>{timeAgo(iso)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 한 번도 완료 안 한 항목 */}
      {neverDone.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p className={styles.historyGroupTitle}>⏳ 아직 완료 기록 없음</p>
          <div className={styles.neverList}>
            {neverDone.map(t => (
              <div key={t.id} className={styles.neverCard}>
                <span className={styles.historyPeriodDot} style={{ background: t.color, opacity: 0.4 }} />
                <span className={styles.neverTaskName}>{t.text}</span>
                <span className={styles.historyPeriodBadge} style={{ background: t.color + '20', color: t.color }}>
                  {t.icon} {t.periodLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allTasks.length === 0 && neverDone.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>🔍</span>
          <p className={styles.emptyTitle}>검색 결과 없음</p>
        </div>
      )}

      {allTasks.length === 0 && neverDone.length > 0 && search === '' && filterPeriod === 'all' && (
        <div className={styles.historyEmpty}>
          <span style={{ fontSize: 40 }}>📋</span>
          <p>청소를 완료하면 여기에 기록이 쌓여요!</p>
          <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>항목을 체크하면 날짜가 자동으로 저장됩니다</p>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CleaningApp() {
  const [tasks,       setTasks]     = useState<TaskMap>(DEFAULT_TASKS);
  const [lastReset,   setLastReset] = useState<LastReset>({} as LastReset);
  const [activeTab,   setActiveTab] = useState<PeriodKey>('daily');
  const [mainView,    setMainView]  = useState<MainView>('all');
  const [newTaskText, setNewTask]   = useState('');
  const [addingTo,    setAddingTo]  = useState<PeriodKey | null>(null);
  const [hydrated,    setHydrated]  = useState(false);
  const [justReset,   setJustReset] = useState<PeriodKey[]>([]);

  // ── 초기 로드 + 주기별 리셋 ──
  useEffect(() => {
    const savedTasks = localStorage.getItem('cleaningTasks');
    const savedReset = localStorage.getItem('cleaningLastReset');

    let loadedTasks: TaskMap   = savedTasks ? JSON.parse(savedTasks) : DEFAULT_TASKS;
    const loadedReset: LastReset = savedReset ? JSON.parse(savedReset) : {} as LastReset;

    // 기존 데이터에 completions 필드 없으면 추가 (마이그레이션)
    PERIODS.forEach(({ key }) => {
      loadedTasks[key] = (loadedTasks[key] || []).map(t => ({
        completions: [],
        ...t,
      }));
    });

    const now       = new Date();
    const newTasks  = { ...loadedTasks };
    const newReset  = { ...loadedReset };
    const resetList: PeriodKey[] = [];

    PERIODS.forEach(({ key }) => {
      const cur = getPeriodKey(key, now);
      if (loadedReset[key] !== cur) {
        newTasks[key] = (newTasks[key] || []).map(t => ({ ...t, done: false }));
        newReset[key] = cur;
        if (loadedReset[key]) resetList.push(key);
      }
    });

    setTasks(newTasks);
    setLastReset(newReset);
    setJustReset(resetList);
    setHydrated(true);
    localStorage.setItem('cleaningTasks',     JSON.stringify(newTasks));
    localStorage.setItem('cleaningLastReset', JSON.stringify(newReset));
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('cleaningTasks', JSON.stringify(tasks));
  }, [tasks, hydrated]);

  useEffect(() => {
    if (!justReset.length) return;
    const t = setTimeout(() => setJustReset([]), 3500);
    return () => clearTimeout(t);
  }, [justReset]);

  // 체크 시 completions에 날짜 추가/제거
  const toggleTask = useCallback((period: PeriodKey, id: string) => {
    setTasks(prev => ({
      ...prev,
      [period]: prev[period].map(t => {
        if (t.id !== id) return t;
        const nowIso = new Date().toISOString();
        if (!t.done) {
          // 완료 → completions에 추가
          return { ...t, done: true, completions: [...(t.completions || []), nowIso] };
        } else {
          // 취소 → 마지막 completions 제거
          const comps = [...(t.completions || [])];
          comps.pop();
          return { ...t, done: false, completions: comps };
        }
      }),
    }));
  }, []);

  const addTask = useCallback((period: PeriodKey) => {
    if (!newTaskText.trim()) return;
    setTasks(prev => ({
      ...prev,
      [period]: [...prev[period], { id: generateId(), text: newTaskText.trim(), done: false, completions: [] }],
    }));
    setNewTask('');
    setAddingTo(null);
  }, [newTaskText]);

  const deleteTask = useCallback((period: PeriodKey, id: string) => {
    if (!confirm('이 항목을 삭제할까요? 완료 기록도 함께 삭제됩니다.')) return;
    setTasks(prev => ({ ...prev, [period]: prev[period].filter(t => t.id !== id) }));
  }, []);

  const getStats = (period: PeriodKey) => {
    const list = tasks[period] || [];
    const done = list.filter(t => t.done).length;
    return { total: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  };

  const getTotalStats = () => {
    let total = 0, done = 0;
    PERIODS.forEach(({ key }) => { const s = getStats(key); total += s.total; done += s.done; });
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  const allUndone = PERIODS.flatMap(({ key, label, color, icon }) =>
    (tasks[key] || []).filter(t => !t.done).map(t => ({ ...t, period: key as PeriodKey, periodLabel: label, color, icon }))
  );

  // 전체 완료 횟수
  const totalCompletions = useMemo(() =>
    PERIODS.flatMap(({ key }) => tasks[key] || []).reduce((sum, t) => sum + (t.completions?.length || 0), 0)
  , [tasks]);

  const totalStats = getTotalStats();
  const period     = PERIODS.find(p => p.key === activeTab)!;

  if (!hydrated) return null;

  return (
    <div className={styles.root}>

      {justReset.length > 0 && (
        <div className={styles.toast}>
          🔄 {justReset.map(k => PERIODS.find(p => p.key === k)?.label).join(', ')} 항목이 새 주기로 초기화됐어요
        </div>
      )}

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTop}>
            <div className={styles.headerTitle}>
              <span className={styles.headerEmoji}>🧹</span>
              <h1 className={styles.headerText}>홈 클리닝</h1>
            </div>
            <div className={styles.headerStatBadge}>
              <span className={styles.headerStatNum}>{totalStats.pct}%</span>
              <span className={styles.headerStatSub}>{totalStats.done}/{totalStats.total}</span>
            </div>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${totalStats.pct}%` }} />
          </div>
          <div className={styles.mainTabs}>
            {([
              { key: 'all'     as const, label: '전체 목록' },
              { key: 'undone'  as const, label: `미완료${allUndone.length > 0 ? ` (${allUndone.length})` : ''}` },
              { key: 'history' as const, label: `히스토리` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMainView(key)}
                className={`${styles.mainTab} ${mainView === key ? styles.mainTabActive : ''}`}
              >
                {label}
                {key === 'undone'  && allUndone.length > 0       && <span className={styles.undoneDot} />}
                {key === 'history' && totalCompletions > 0        && <span className={styles.historyDot} />}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={styles.body}>

        {/* ── 히스토리 뷰 ── */}
        {mainView === 'history' && <HistoryView tasks={tasks} />}

        {/* ── 미완료 뷰 ── */}
        {mainView === 'undone' && (
          <div className={styles.section}>
            {allUndone.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyEmoji}>🎉</span>
                <p className={styles.emptyTitle}>모든 청소 완료!</p>
                <p className={styles.emptyDesc}>잘 하셨어요. 다음 주기에 또 만나요.</p>
              </div>
            ) : (
              PERIODS.map(({ key, label, color, icon }) => {
                const group = allUndone.filter(t => t.period === key);
                if (!group.length) return null;
                const p = PERIODS.find(p => p.key === key)!;
                return (
                  <div key={key} className={styles.undoneGroup}>
                    <div className={styles.undoneGroupHeader}>
                      <span className={styles.undoneGroupIcon}>{icon}</span>
                      <span className={styles.undoneGroupLabel} style={{ color }}>{label}</span>
                      <span className={styles.badge} style={{ background: color + '28', color }}>{group.length}개 남음</span>
                      <span className={styles.resetHint}>{p.resetLabel}</span>
                    </div>
                    <div className={styles.taskCardBody}>
                      {group.map(t => (
                        <TaskRow key={t.id} task={t} color={color}
                          onToggle={() => toggleTask(t.period, t.id)}
                          onDelete={() => deleteTask(t.period, t.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── 전체 뷰 ── */}
        {mainView === 'all' && (
          <div className={styles.section}>

            <div className={styles.periodScroll}>
              <div className={styles.periodTrack}>
                {PERIODS.map(({ key, label, icon, color }) => {
                  const s      = getStats(key);
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`${styles.periodChip} ${active ? styles.periodChipActive : ''}`}
                      style={active ? { borderColor: color, color } : {}}
                    >
                      <span className={styles.periodChipIcon}>{icon}</span>
                      <span className={styles.periodChipLabel}>{label}</span>
                      {s.total > 0 && (
                        <span className={styles.periodChipBadge}
                          style={{ background: active ? color+'33' : 'rgba(255,255,255,0.08)', color: active ? color : '#777' }}>
                          {s.done}/{s.total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.taskCard}>
              <div className={styles.taskCardHeader} style={{ borderColor: period.color + '40' }}>
                <div className={styles.taskCardTitleRow}>
                  <span style={{ fontSize: 20 }}>{period.icon}</span>
                  <div>
                    <p className={styles.taskCardTitle} style={{ color: period.color }}>{period.label} 청소 목록</p>
                    <p className={styles.taskCardSub}>{period.resetLabel}</p>
                  </div>
                </div>
                <div className={styles.pctCircle}>
                  <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
                    <circle cx="22" cy="22" r="18" fill="none" stroke={period.color} strokeWidth="4"
                      strokeDasharray={`${2*Math.PI*18}`}
                      strokeDashoffset={`${2*Math.PI*18*(1-getStats(activeTab).pct/100)}`}
                      strokeLinecap="round" transform="rotate(-90 22 22)"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <span className={styles.pctCircleText} style={{ color: period.color }}>{getStats(activeTab).pct}%</span>
                </div>
              </div>

              <div className={styles.taskCardBody}>
                {tasks[activeTab].length === 0 && <p className={styles.emptyList}>항목이 없어요. 아래에서 추가해보세요!</p>}
                {tasks[activeTab].map(task => (
                  <TaskRow key={task.id} task={task} color={period.color}
                    onToggle={() => toggleTask(activeTab, task.id)}
                    onDelete={() => deleteTask(activeTab, task.id)}
                  />
                ))}
              </div>

              <div className={styles.addSection}>
                {addingTo === activeTab ? (
                  <div className={styles.addRow}>
                    <input autoFocus value={newTaskText} onChange={e => setNewTask(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter') addTask(activeTab); if (e.key==='Escape'){setAddingTo(null);setNewTask('');} }}
                      placeholder="청소 항목 입력 후 Enter"
                      className={styles.input} style={{ borderColor: period.color+'66' }}
                    />
                    <button onClick={() => addTask(activeTab)} className={styles.addBtn} style={{ background: period.color }}>추가</button>
                    <button onClick={() => {setAddingTo(null);setNewTask('');}} className={styles.cancelBtn}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingTo(activeTab)} className={styles.addPlaceholder}>
                    <span className={styles.addPlaceholderIcon} style={{ color: period.color }}>+</span>
                    <span>항목 추가하기</span>
                  </button>
                )}
              </div>
            </div>

            <div className={styles.statsSection}>
              <p className={styles.statsTitle}>주기별 달성률</p>
              <div className={styles.statsGrid}>
                {PERIODS.map(({ key, label, icon, color }) => {
                  const s = getStats(key);
                  return (
                    <button key={key} onClick={() => setActiveTab(key)}
                      className={`${styles.statCard} ${activeTab===key ? styles.statCardActive : ''}`}
                      style={activeTab===key ? { borderColor: color+'60' } : {}}
                    >
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>{icon}</span>
                        <span className={styles.statPct} style={{ color }}>{s.pct}%</span>
                      </div>
                      <p className={styles.statLabel}>{label}</p>
                      <div className={styles.statBar}>
                        <div className={styles.statBarFill} style={{ width: `${s.pct}%`, background: color }} />
                      </div>
                      <p className={styles.statCount}>{s.done}/{s.total}</p>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        <div style={{ height: 40 }} />
      </main>
    </div>
  );
}
