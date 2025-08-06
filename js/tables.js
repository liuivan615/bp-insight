/* 表格渲染与交互 */
(function () {
  // 渲染历史记录表
  function renderHistoryTable(data) {
    const container = document.getElementById('history-table-container');
    if (!container) return;
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p>暂无数据</p>';
      return;
    }
    let html = '<table><thead><tr>' +
      '<th data-field="ts">时间</th>' +
      '<th data-field="sbp">SBP</th>' +
      '<th data-field="dbp">DBP</th>' +
      '<th data-field="hr">HR</th>' +
      '<th>MAP</th>' +
      '<th>PP</th>' +
      '<th>分级</th>' +
      '<th>体位</th>' +
      '<th>体位性</th>' +
      '<th>症状</th>' +
      '<th>用药</th>' +
      '<th>备注</th>' +
      '</tr></thead><tbody>';
    const rows = data.slice().reverse();
    rows.forEach(rec => {
      const meds = rec.meds && rec.meds.length ? rec.meds.map(m => m.name + (m.dose ? '(' + m.dose + ')' : '')).join(',') : '';
      html += '<tr>' +
        '<td>' + new Date(rec.ts).toLocaleString() + '</td>' +
        '<td>' + rec.sbp + '</td>' +
        '<td>' + rec.dbp + '</td>' +
        '<td>' + (rec.hr || '') + '</td>' +
        '<td>' + rec.map + '</td>' +
        '<td>' + rec.pp + '</td>' +
        '<td class="level-' + rec.level + '">' + (typeof getLevelLabel !== 'undefined' ? getLevelLabel(rec.level) : rec.level) + '</td>' +
        '<td>' + rec.posture + '</td>' +
        '<td>' + (rec.orthostatic ? '是' : '') + '</td>' +
        '<td>' + (rec.symptoms ? rec.symptoms.join(',') : '') + '</td>' +
        '<td>' + meds + '</td>' +
        '<td>' + (rec.note || '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    // 排序功能
    const thead = container.querySelector('thead');
    thead.querySelectorAll('th[data-field]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.field;
        const order = th.dataset.order === 'asc' ? 'desc' : 'asc';
        thead.querySelectorAll('th[data-field]').forEach(other => {
          if (other !== th) other.removeAttribute('data-order');
        });
        th.dataset.order = order;
        window.bpData.sort((a, b) => {
          let av = a[field];
          let bv = b[field];
          if (field === 'ts') {
            av = new Date(a.ts);
            bv = new Date(b.ts);
          }
          if (av > bv) return order === 'asc' ? 1 : -1;
          if (av < bv) return order === 'asc' ? -1 : 1;
          return 0;
        });
        renderHistoryTable(window.bpData);
      });
    });
  }
  // 渲染体位对照表
  function renderPostureTable(data) {
    const container = document.getElementById('posture-table-container');
    if (!container) return;
    const pairs = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const cur = data[i];
      if (prev.posture === 'lying' && cur.posture === 'standing') {
        pairs.push({ lying: prev, standing: cur });
      }
    }
    if (pairs.length === 0) {
      container.innerHTML = '<p>暂无体位对照记录</p>';
      return;
    }
    let html = '<table><thead><tr>' +
      '<th>卧位时间</th><th>卧位 SBP</th><th>卧位 DBP</th>' +
      '<th>站立时间</th><th>站立 SBP</th><th>站立 DBP</th>' +
      '<th>SBP 差值</th><th>DBP 差值</th><th>是否体位性低血压</th>' +
      '</tr></thead><tbody>';
    pairs.forEach(p => {
      const dropSbp = p.lying.sbp - p.standing.sbp;
      const dropDbp = p.lying.dbp - p.standing.dbp;
      const flag = dropSbp >= 20 || dropDbp >= 10;
      html += '<tr>' +
        '<td>' + new Date(p.lying.ts).toLocaleString() + '</td>' +
        '<td>' + p.lying.sbp + '</td>' +
        '<td>' + p.lying.dbp + '</td>' +
        '<td>' + new Date(p.standing.ts).toLocaleString() + '</td>' +
        '<td>' + p.standing.sbp + '</td>' +
        '<td>' + p.standing.dbp + '</td>' +
        '<td>' + dropSbp + '</td>' +
        '<td>' + dropDbp + '</td>' +
        '<td>' + (flag ? '是' : '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  window.renderHistoryTable = renderHistoryTable;
  window.renderPostureTable = renderPostureTable;
})();
