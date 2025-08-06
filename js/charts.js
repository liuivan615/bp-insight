/* 图表配置与更新 */
(function () {
  let tsChart;
  let dayChart;
  let mapChart;

  /**
   * 更新时间序列折线图
   * @param {Array} data 数据
   * @param {string} windowDays 时间窗口，可以是数字或 'all'
   */
  function updateTimeSeriesChart(data, windowDays) {
    const el = document.getElementById('chart-timeseries');
    if (!el) return;
    if (!tsChart) {
      tsChart = echarts.init(el, null, { renderer: 'svg' });
    }
    // 过滤数据
    let filtered;
    if (!data) {
      filtered = [];
    } else {
      if (windowDays === 'all') {
        filtered = data.slice();
      } else {
        const days = parseInt(windowDays, 10);
        const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
        filtered = data.filter(rec => new Date(rec.ts).getTime() >= threshold);
      }
    }
    // 按时间升序
    filtered.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const seriesSbp = filtered.map(rec => [rec.ts, rec.sbp]);
    const seriesDbp = filtered.map(rec => [rec.ts, rec.dbp]);
    const seriesHr = filtered.map(rec => [rec.ts, rec.hr || null]);
    const option = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['SBP', 'DBP', 'HR'] },
      xAxis: { type: 'time' },
      yAxis: [
        { type: 'value', name: 'mmHg' },
        { type: 'value', name: 'bpm' }
      ],
      series: [
        { name: 'SBP', type: 'line', yAxisIndex: 0, data: seriesSbp },
        { name: 'DBP', type: 'line', yAxisIndex: 0, data: seriesDbp },
        { name: 'HR', type: 'line', yAxisIndex: 1, data: seriesHr }
      ]
    };
    tsChart.setOption(option, true);
  }

  /**
   * 更新一天内不同时间段的平均值柱状图
   * @param {Array} data 数据
   */
  function updateDayPartsChart(data) {
    const el = document.getElementById('chart-dayparts');
    if (!el) return;
    if (!dayChart) {
      dayChart = echarts.init(el, null, { renderer: 'svg' });
    }
    // 各时段分类
    const bins = {
      morning: { sbp: [], dbp: [] },    // 5-12点
      afternoon: { sbp: [], dbp: [] },  // 12-18点
      evening: { sbp: [], dbp: [] },    // 18-24点
      night: { sbp: [], dbp: [] }       // 0-5点
    };
    (data || []).forEach(rec => {
      const h = new Date(rec.ts).getHours();
      let key;
      if (h >= 5 && h < 12) key = 'morning';
      else if (h >= 12 && h < 18) key = 'afternoon';
      else if (h >= 18 && h < 24) key = 'evening';
      else key = 'night';
      bins[key].sbp.push(rec.sbp);
      bins[key].dbp.push(rec.dbp);
    });
    const categories = ['morning', 'afternoon', 'evening', 'night'];
    const labels = ['上午', '下午', '晚上', '夜间'];
    const sbpAvg = categories.map(c => average(bins[c].sbp));
    const dbpAvg = categories.map(c => average(bins[c].dbp));
    const option = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['平均SBP', '平均DBP'] },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value', name: 'mmHg' },
      series: [
        { name: '平均SBP', type: 'bar', data: sbpAvg },
        { name: '平均DBP', type: 'bar', data: dbpAvg }
      ]
    };
    dayChart.setOption(option, true);
  }

  /**
   * 计算平均值
   */
  function average(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    return +(sum / arr.length).toFixed(1);
  }

  /**
   * 更新 MAP 子弹条图
   * @param {Array} data 数据
   */
  function updateMapChart(data) {
    const el = document.getElementById('chart-map');
    if (!el) return;
    if (!mapChart) {
      mapChart = echarts.init(el, null, { renderer: 'svg' });
    }
    if (!data || data.length === 0) {
      mapChart.clear();
      return;
    }
    const rec = data[data.length - 1];
    const mapVal = rec.map;
    const option = {
      tooltip: {},
      xAxis: {
        show: false,
        min: 0,
        max: 150
      },
      yAxis: {
        type: 'category',
        show: false,
        data: ['MAP']
      },
      series: [
        {
          type: 'bar',
          data: [mapVal],
          barWidth: 20,
          itemStyle: {
            color: getLevelColor(rec.level)
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}'
          }
        },
        {
          type: 'bar',
          data: [150],
          barWidth: 20,
          itemStyle: {
            color: '#eee'
          },
          silent: true
        }
      ]
    };
    mapChart.setOption(option, true);
  }

  /**
   * 根据分级返回颜色
   */
  function getLevelColor(level) {
    const colors = {
      low: '#6495ED',
      normal: '#2E8B57',
      elevated: '#CCCC00',
      stage1: '#FFA500',
      stage2: '#FF4500',
      crisis: '#8B0000'
    };
    return colors[level] || '#888888';
  }

  // 暴露函数给全局
  window.updateTimeSeriesChart = updateTimeSeriesChart;
  window.updateDayPartsChart = updateDayPartsChart;
  window.updateMapChart = updateMapChart;
})();
