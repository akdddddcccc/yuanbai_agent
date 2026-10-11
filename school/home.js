const grid = document.querySelector('.hero-grid');
for (let i = 0; i < 25; i++) {
  const tile = document.createElement('i');
  tile.style.setProperty('--delay', `${(i % 5 + Math.floor(i / 5)) * 100}ms`);
  if ([2, 8, 13, 19].includes(i)) tile.classList.add('void');
  if ([15, 20, 21, 22, 17, 12].includes(i)) tile.classList.add('lit');
  if (i === 12) tile.classList.add('here');
  grid.append(tile);
}
try {
  if (localStorage.getItem('yuanbai-school-tutorial-v1') === 'complete') {
    document.querySelector('#enter-game').href = 'explore/';
    document.querySelector('#entry-note').textContent = '欢迎回来，继续探索元白。也可以从下方重新练习。';
  }
} catch {}
let board = 'normal', generation = 0;
const status = document.querySelector('#board-status'), results = document.querySelector('#board-results');
async function loadBoard() {
  const request = ++generation;
  status.hidden = false; results.hidden = true; status.textContent = '正在读取学院排行榜…';
  try {
    const response = await fetch(`/api/yuanbai/game/leaderboard?board=${board}&page=1`, {signal: AbortSignal.timeout(10000), cache: 'no-store'});
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('invalid response');
    if (request !== generation) return;
    if (!data.items.length) { status.textContent = '这里还在等待第一位探索者。完成正式探索，留下你的名字。'; return; }
    const body = document.querySelector('#board-body'); body.replaceChildren();
    for (const [index, item] of data.items.slice(0, 10).entries()) {
      const row = document.createElement('tr');
      const ms = Number(item.durationMs), seconds = Math.max(0, Math.floor(ms / 1000));
      const dateValue = item.completedAt || item.createdAt;
      const date = dateValue ? new Date(dateValue) : null;
      for (const value of [String(index + 1).padStart(2, '0'), item.nickname, item.deaths, Number.isFinite(ms) ? `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, '0')}″` : '—', date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-CN') : '—']) {
        const cell = document.createElement('td'); cell.textContent = String(value ?? '—'); row.append(cell);
      }
      body.append(row);
    }
    status.hidden = true; results.hidden = false;
  } catch {
    if (request === generation) status.textContent = '学院排行榜暂时未连接。你仍然可以体验教学和练习，连接恢复后再挑战入榜。';
  }
}
document.querySelectorAll('[data-board]').forEach(button => button.addEventListener('click', () => {
  board = button.dataset.board;
  document.querySelectorAll('[data-board]').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
  document.querySelector('#board-note').textContent = board === 'normal' ? '先比坠落次数，再比通关用时，最后比步数。完全相同按首次提交时间。' : '统计已校验通关中坠落最多的一局，每位探索者保留一条记录。';
  loadBoard();
}));
document.querySelector('#refresh-board').addEventListener('click', loadBoard);
loadBoard();
