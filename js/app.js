/* 应用逻辑：数据管理与页面交互 */
(function () {
  // 存储键名
  const storageKey = 'bpData';
  // 全局数据数组
  let data = [];

  /**
   * 加载 localStorage 中的历史数据
   */
  function loadData() {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        data = JSON.parse(stored) || [];
      } catch (e) {
        data = [];
      }
    }
  }

  /**
   * 保存数据到 localStorage
   */
  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  /**
   * 根据阈值计算 PP/MAP/分级，并检测体位性低血压
   * @param {Object} rec 新记录
   */
  function computeMetrics(rec) {
    rec.sbp = Number(rec.sbp);
    rec.dbp = Number(rec.dbp);
    rec.hr = rec.hr ? Number(rec.hr) : null;
    // 脉压
    rec.pp = rec.sbp - rec.dbp;
    // 平均动脉压
    rec.map = Math.round((rec.sbp + 2 * rec.dbp) / 3);
    // 分级计算
    if (rec.sbp >= 180 || rec.dbp >= 120) {
      rec.level = 'crisis';
    } else if (rec.sbp >= 140 || rec.dbp >= 90) {
      rec.level = 'stage2';
    } else if ((rec.sbp >= 130 && rec.sbp <= 139) || (rec.dbp >= 80 && rec.dbp <= 89)) {
      rec.level = 'stage1';
    } else if (rec.sbp >= 120 && rec.sbp <= 129 && rec.dbp < 80) {
      rec.level = 'elevated';
    } else if (rec.sbp < 90 || rec.dbp < 60) {
      rec.level = 'low';
    } else {
      rec.level = 'normal';
    }
    // 体位性低血压判断
    rec.orthostatic = false;
    if (rec.posture === 'standing') {
      // 找到最近一次卧位记录
      for (let i = data.length - 1; i >= 0; i--) {
        const prev = data[i];
        if (prev.posture === 'lying') {
          const diffMs = Math.abs(new Date(rec.ts) - new Date(prev.ts));
          // 在2小时内认为相关
          if (diffMs <= 2 * 60 * 60 * 1000) {
            const dropSbp = prev.sbp - rec.sbp;
            const dropDbp = prev.dbp - rec.dbp;
            rec.orthostatic = (dropSbp >= 20 || dropDbp >= 10);
            break;
          }
        }
      }
    }
  }

  /**
   * 更新最新读数卡片
   */
  function updateLatest() {
    const container = document.getElementById('latest-content');
    if (!data.length) {
      container.innerHTML = '<p>暂无读数。</p>';
      return;
    }
    const rec = data[data.length - 1];
    const levelName = LEVEL_LABELS[rec.level] || rec.level;
    const levelClass = 'level-' + rec.level;
    const map = rec.map;
    const pp = rec.pp;
    const parts = [];
    parts.push(`<span>${new Date(rec.ts).toLocaleString()}</span>`);
    parts.push(`<span class="${levelClass}">${rec.sbp}/${rec.dbp}</span>`);
    parts.push(`<span>${rec.hr ? rec.hr + ' bpm' : ''}</span>`);
    parts.push(`<span>MAP ${map}</span>`);
    parts.push(`<span>PP ${pp}</span>`);
    parts.push(`<span>${levelName}</span>`);
    if (rec.orthostatic) {
      parts.push('<span class="level-elevated">疑似体位性低血压</span>');
    }
    container.innerHTML = '<div class="latest-row">' + parts.join(' ') + '</div>';
  }

  /**
   * 刷新所有表格
   */
  function refreshTables() {
    renderHistoryTable(data);
    renderPostureTable(data);
  }

  /**
   * 刷新图表
   */
  function refreshCharts() {
  updateTimeSeriesChart(data, document.getElementById('time-window').value);
    updateDayPartsChart(data);
    updateMapChart(data);
  }

  /**
   * 向数组添加新记录并更新界面
   * @param {Object} rec 记录对象
   */
  function addRecord(rec) {
    computeMetrics(rec);
    // 生成简单唯一 ID
    rec.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    data.push(rec);
    saveData();
    // 更新全局供表格排序使用
    window.bpData = data;
    updateLatest();
    refreshTables();
    refreshCharts();
  }

  /**
   * CSV 导出
   */
  function toCSV(arr) {
    const header = ['ts','sbp','dbp','hr','posture','symptoms','meds','note'];
    const lines = [header.join(',')];
    arr.forEach(rec => {
      const medsStr = rec.meds.map(m => `${m.name};${m.dose};${m.at}`).join('|');
      const row = [
        rec.ts,
        rec.sbp,
        rec.dbp,
        rec.hr || '',
        rec.posture,
        rec.symptoms.join(';'),
        medsStr,
        (rec.note || '').replace(/,/g, ' ')
      ];
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  /**
   * CSV 导入
   */
  function importCSV(text) {
    const rows = text.trim().split(/\r?\n/);
    if (!rows.length) return;
    const header = rows[0].split(',');
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',');
      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = cols[idx];
      });
      obj.symptoms = obj.symptoms ? obj.symptoms.split(';').filter(Boolean) : [];
      // 解析 meds
      obj.meds = [];
      if (obj.meds && typeof obj.meds === 'string') {
        const medsParts = obj.meds.split('|');
        obj.meds = medsParts.filter(Boolean).map(part => {
          const [name, dose, at] = part.split(';');
          return { name, dose, at };
        });
      }
      addRecord(obj);
    }
  }

  /**
   * 生成并下载文件
   */
  function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 定义中文标签
   */
  const LEVEL_LABELS = {
    low: '低血压',
    normal: '正常',
    elevated: '升高',
    stage1: '1级高血压',
    stage2: '2级高血压',
    crisis: '危象'
  };

  // 页面加载完成时绑定事件
  document.addEventListener('DOMContentLoaded', () => {
    // 加载数据
    loadData();
    window.bpData = data;
    updateLatest();
    refreshTables();
    refreshCharts();
    // 设置默认时间戳为当前时间
    const tsInput = document.getElementById('ts');
    if (tsInput) {
      tsInput.value = new Date().toISOString().slice(0, 16);
    }
    // 提交表单事件
    const form = document.getElementById('entry-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const rec = {
        ts: formData.get('ts'),
      sbp: formData.get('sbp'),
        dbp: formData.get('dbp'),
        hr: formData.get('hr'),
        posture: formData.get('posture') || '',
        symptoms: formData.getAll('symptoms'),
        meds: [],
        note: formData.get('note') || ''
      };
      // 收集药物信息
      const medEntries = document.querySelectorAll('.med-entry');
      medEntries.forEach(item => {
        const name = item.querySelector('.med-name').value.trim();
        const dose = item.querySelector('.med-dose').value.trim();
        const at = item.querySelector('.med-time').value;
        if (name) {
          rec.meds.push({ name, dose, at });
        }
      });
      addRecord(rec);
      // 重置表单并更新时间
      form.reset();
      tsInput.value = new Date().toISOString().slice(0, 16);
    });
    // 添加药物按钮
    document.getElementById('add-med').addEventListener('click', () => {
      const container = document.getElementById('meds-container');
      const div = document.createElement('div');
      div.className = 'med-entry';
      div.innerHTML = `
        <input type="text" class="med-name" placeholder="药名">
        <input type="text" class="med-dose" placeholder="剂量">
        <input type="datetime-local" class="med-time">
        <button type="button" class="remove-med">删除</button>
      `;
      container.appendChild(div);
    });
    // 删除药物事件委托
    document.getElementById('meds-container').addEventListener('click', (ev) => {
      if (ev.target.classList.contains('remove-med')) {
        ev.target.parentElement.remove();
      }
    });
    // 清空数据按钮
    document.getElementById('clear-data').addEventListener('click', () => {
      if (confirm('确定要清空所有数据吗？')) {
        data = [];
        saveData();
        window.bpData = data;
        updateLatest();
        refreshTables();
        refreshCharts();
      }
    });
    // 导出 CSV
    document.getElementById('export-csv').addEventListener('click', () => {
      const csv = toCSV(data);
      downloadFile('bp-data.csv', 'text/csv', csv);
    });
    // 导出 JSON
    document.getElementById('export-json').addEventListener('click', () => {
      const json = JSON.stringify(data, null, 2);
      downloadFile('bp-data.json', 'application/json', json);
    });
    // 时间窗口切换
    document.getElementById('time-window').addEventListener('change', () => {
      refreshCharts();
    });
    // 粘贴 CSV
    document.getElementById('paste-csv').addEventListener('click', () => {
      const input = prompt('请粘贴 CSV 内容：\n首行应包含列名，如 ts,sbp,dbp,hr,posture,symptoms,meds,note');
      if (input) {
        importCSV(input);
      }
    });
  });

  // 对外暴露必要函数和常量（给其他脚本调用）
  window.getLevelLabel = function (level) {
    return LEVEL_LABELS[level] || level;
  };
  // 暴露数据引用供排序使用
  window.bpData = data;
})();
