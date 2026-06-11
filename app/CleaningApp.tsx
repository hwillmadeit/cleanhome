'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './cleaning.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  text: string;
  done: boolean;
}

type PeriodKey = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual';

interface Period {
  key: PeriodKey;
  label: string;
  icon: string;
  color: string;
}

type TaskMap = Record<PeriodKey, Task[]>;

// ─── Constants ───────────────────────────────────────────────────────────────
const PERIODS: Period[] = [
  { key: 'daily',     label: '일별',   icon: '☀️', color: '#FF6B6B' },
  { key: 'weekly',    label: '주별',   icon: '📅', color: '#4ECDC4' },
  { key: 'monthly',   label: '월별',   icon: '🗓️', color: '#45B7D1' },
  { key: 'quarterly', label: '분기별', icon: '🍃', color: '#96CEB4' },
  { key: 'biannual',  label: '반기별', icon: '⭐', color: '#FFEAA7' },
  { key: 'annual',    label: '연별',   icon: '🏠', color: '#DDA0DD' },
];

const DEFAULT_TASKS: TaskMap = {
  daily:     [
    { id: 'd1', text: '주방 싱크대 닦기', done: false },
    { id: 'd2', text: '식탁 닦기',        done: false },
    { id: 'd3', text: '쓰레기통 비우기',  done: false },
  ],
  weekly:    [
    { id: 'w1', text: '진공청소기 돌리기', done: false },
    { id: 'w2', text: '화장실 청소',       done: false },
    { id: 'w3', text: '욕실 거울 닦기',    done: false },
  ],
  monthly:   [
    { id: 'm1', text: '냉장고 내부 청소', done: false },
    { id: 'm2', text: '전자레인지 청소',  done: false },
  ],
  quarterly: [
    { id: 'q1', text: '에어컨 필터 청소', done: false },
    { id: 'q2', text: '창문 청소',        done: false },
  ],
  biannual:  [
    { id: 'b1', text: '소파 깊은 청소',  done: false },
    { id: 'b2', text: '매트리스 청소',   done: false },
  ],
  annual:    [
    { id: 'a1', text: '이불 세탁',       done: false },
    { id: 'a2', text: '대청소 (전체)',   done: false },
  ],
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────
function TaskRow({
  task, color, onToggle, onDelete,
}: {
  task: Task; color: string;
  onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={styles.taskRow}>
      <button
        onClick={onToggle}
        className={styles.checkbox}
        style={{
          borderColor: task.done ? color : 'rgba(255,255,255,0.2)',
          backgroundColor: task.done ? color : 'transparent',
        }}
        aria-label={task.done ? '완료 취소' : '완료'}
      >
        {task.done && <span className={styles.checkmark}>✓</span>}
      </button>

      <span
        className={styles.taskText}
        style={{ color: task.done ? '#555' : '#ddd', textDecoration: task.done ? 'line-through' : 'none' }}
      >
        {task.text}
      </span>

      <button onClick={onDelete} className={styles.deleteBtn} aria-label="삭제">✕</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CleaningApp() {
  const [tasks, setTasks]           = useState<TaskMap>(DEFAULT_TASKS);
  const [activeTab, setActiveTab]   = useState<PeriodKey>('daily');
  const [mainView, setMainView]     = useState<'all' | 'undone'>('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTo, setAddingTo]     = useState<PeriodKey | null>(null);

  // Persist
  useEffect(() => {
    const saved = localStorage.getItem('cleaningTasks');
    if (saved) {
      try { setTasks(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cleaningTasks', JSON.stringify(tasks));
  }, [tasks]);

  const toggleTask = useCallback((period: PeriodKey, id: string) => {
    setTasks(prev => ({
      ...prev,
      [period]: prev[period].map(t => t.id === id ? { ...t, done: !t.done } : t),
    }));
  }, []);

  const addTask = useCallback((period: PeriodKey) => {
    if (!newTaskText.trim()) return;
    setTasks(prev => ({
      ...prev,
      [period]: [...prev[period], { id: generateId(), text: newTaskText.trim(), done: false }],
    }));
    setNewTaskText('');
    setAddingTo(null);
  }, [newTaskText]);

  const deleteTask = useCallback((period: PeriodKey, id: string) => {
    if (!confirm('이 항목을 삭제할까요?')) return;
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

  const totalStats = getTotalStats();
  const period = PERIODS.find(p => p.key === activeTab)!;

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            <span>🧹</span>
            <h1>홈 클리닝 시스템</h1>
          </div>

          {/* Overall progress */}
          <div className={styles.progressCard}>
            <div className={styles.progressTop}>
              <span className={styles.progressLabel}>전체 달성률</span>
              <span className={styles.progressPct}>{totalStats.pct}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${totalStats.pct}%` }}
              />
            </div>
            <span className={styles.progressSub}>{totalStats.done} / {totalStats.total} 항목 완료</span>
          </div>

          {/* Main view tabs */}
          <div className={styles.mainTabs}>
            {([
              { key: 'all',    label: '📋 전체' },
              { key: 'undone', label: `⚠️ 미완료 (${allUndone.length})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMainView(key)}
                className={`${styles.mainTab} ${mainView === key ? styles.mainTabActive : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className={styles.body}>
        <div className={styles.bodyInner}>

          {/* ── UNDONE VIEW ── */}
          {mainView === 'undone' && (
            <>
              {allUndone.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyEmoji}>🎉</span>
                  <p>모든 청소 항목 완료!</p>
                </div>
              ) : (
                PERIODS.map(({ key, label, color, icon }) => {
                  const group = allUndone.filter(t => t.period === key);
                  if (!group.length) return null;
                  return (
                    <div key={key} className={styles.undoneGroup}>
                      <div className={styles.undoneGroupHeader}>
                        <span>{icon}</span>
                        <span style={{ color }} className={styles.undoneGroupLabel}>{label}</span>
                        <span className={styles.badge} style={{ background: color + '33', color }}>{group.length}개</span>
                      </div>
                      {group.map(t => (
                        <TaskRow key={t.id} task={t} color={color}
                          onToggle={() => toggleTask(t.period, t.id)}
                          onDelete={() => deleteTask(t.period, t.id)}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ── ALL VIEW ── */}
          {mainView === 'all' && (
            <>
              {/* Period grid */}
              <div className={styles.periodGrid}>
                {PERIODS.map(({ key, label, icon, color }) => {
                  const s = getStats(key);
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={styles.periodCard}
                      style={active ? { borderColor: color + '99', background: color + '18' } : {}}
                    >
                      <span className={styles.periodIcon}>{icon}</span>
                      <span className={styles.periodLabel} style={{ color: active ? color : '#bbb' }}>{label}</span>
                      <span className={styles.periodCount}>{s.done}/{s.total}</span>
                      <div className={styles.miniBar}>
                        <div className={styles.miniBarFill} style={{ width: `${s.pct}%`, background: color }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Task list card */}
              <div className={styles.taskCard}>
                <div className={styles.taskCardHeader}>
                  <div className={styles.taskCardTitleRow}>
                    <span style={{ fontSize: 18 }}>{period.icon}</span>
                    <span className={styles.taskCardTitle} style={{ color: period.color }}>
                      {period.label} 청소 목록
                    </span>
                  </div>
                  <span className={styles.badge} style={{ background: period.color + '33', color: period.color }}>
                    {getStats(activeTab).pct}%
                  </span>
                </div>

                {tasks[activeTab].length === 0 && (
                  <p className={styles.emptyList}>아직 항목이 없어요. 추가해보세요!</p>
                )}

                {tasks[activeTab].map(task => (
                  <TaskRow
                    key={task.id} task={task} color={period.color}
                    onToggle={() => toggleTask(activeTab, task.id)}
                    onDelete={() => deleteTask(activeTab, task.id)}
                  />
                ))}

                {/* Add task */}
                <div className={styles.addSection}>
                  {addingTo === activeTab ? (
                    <div className={styles.addRow}>
                      <input
                        autoFocus
                        value={newTaskText}
                        onChange={e => setNewTaskText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addTask(activeTab);
                          if (e.key === 'Escape') { setAddingTo(null); setNewTaskText(''); }
                        }}
                        placeholder="청소 항목 입력..."
                        className={styles.input}
                        style={{ borderColor: period.color + '66' }}
                      />
                      <button
                        onClick={() => addTask(activeTab)}
                        className={styles.addBtn}
                        style={{ background: period.color }}
                      >추가</button>
                      <button
                        onClick={() => { setAddingTo(null); setNewTaskText(''); }}
                        className={styles.cancelBtn}
                      >취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTo(activeTab)} className={styles.addPlaceholder}>
                      + 항목 추가
                    </button>
                  )}
                </div>
              </div>

              {/* Stats summary */}
              <div className={styles.statsGrid}>
                {PERIODS.map(({ key, label, icon, color }) => {
                  const s = getStats(key);
                  return (
                    <div key={key} className={styles.statCard}>
                      <span className={styles.statIcon}>{icon}</span>
                      <div className={styles.statInfo}>
                        <span className={styles.statLabel}>{label}</span>
                        <div className={styles.statBar}>
                          <div className={styles.statBarFill} style={{ width: `${s.pct}%`, background: color }} />
                        </div>
                      </div>
                      <span className={styles.statPct} style={{ color }}>{s.pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
