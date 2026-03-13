(function () {
  const timers = [];
  const terminalCommands = [
    'dbt build --select mart.customer_360+',
    'mlflow models serve -m runs:/latest/',
    'spark-submit jobs/feature_stream.py'
  ];
  const streamSnapshots = [
    { events: 164316, latency: 7, throughput: 2.7 },
    { events: 158942, latency: 5, throughput: 3.4 },
    { events: 171208, latency: 6, throughput: 3.1 },
    { events: 153872, latency: 5, throughput: 3.8 }
  ];

  function clearTimers() {
    while (timers.length) {
      clearTimeout(timers.pop());
    }
  }

  function formatMetric(value, decimals, suffix, format) {
    const options = {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    };
    const normalized = format === 'integer' ? Math.round(value) : value;
    return `${normalized.toLocaleString('en-US', options)}${suffix || ''}`;
  }

  function animateNumber(element, to, duration) {
    const decimals = Number(element.dataset.decimals || 0);
    const suffix = element.dataset.suffix || '';
    const format = element.dataset.format || 'float';
    const from = Number(element.dataset.currentValue || element.textContent.replace(/[^0-9.]/g, '') || 0);
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      element.textContent = formatMetric(next, decimals, suffix, format);

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        element.dataset.currentValue = String(to);
      }
    }

    window.requestAnimationFrame(frame);
  }

  function typeCommand(element, command, callback) {
    element.textContent = '';
    let index = 0;

    function tick() {
      element.textContent = command.slice(0, index);
      index += 1;

      if (index <= command.length) {
        const timer = window.setTimeout(tick, 28);
        timers.push(timer);
      } else if (callback) {
        callback();
      }
    }

    tick();
  }

  function animateMeter(element, duration, callback) {
    element.style.width = '0%';
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      element.style.width = `${progress * 100}%`;

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else if (callback) {
        callback();
      }
    }

    window.requestAnimationFrame(frame);
  }

  function updateStatus() {
    document.querySelectorAll('.trm-stream-status-text').forEach((element) => {
      const onlineText = element.dataset.statusOnline || 'online';
      const idleText = element.dataset.statusIdle || 'idle';
      element.textContent = document.hidden ? idleText : onlineText;
    });
  }

  function initLiveStream() {
    const metricElements = document.querySelectorAll('[data-stream-metric]');
    const meter = document.querySelector('[data-stream-meter]');
    const commandElement = document.querySelector('[data-stream-command]');

    if (!metricElements.length || !meter || !commandElement) return;

    let cycleIndex = 0;

    const applySnapshot = (snapshot) => {
      animateNumber(metricElements[0], snapshot.events, 520);
      animateNumber(metricElements[1], snapshot.latency, 420);
      animateNumber(metricElements[2], snapshot.throughput, 520);
    };

    const runCycle = () => {
      const nextCommand = terminalCommands[cycleIndex % terminalCommands.length];
      const nextSnapshot = streamSnapshots[cycleIndex % streamSnapshots.length];

      typeCommand(commandElement, nextCommand, function () {
        animateMeter(meter, 2200, function () {
          applySnapshot(nextSnapshot);
          meter.style.width = '0%';
          cycleIndex += 1;
          const timer = window.setTimeout(runCycle, 520);
          timers.push(timer);
        });
      });
    };

    const initialSnapshot = streamSnapshots[0];
    metricElements[0].dataset.currentValue = String(initialSnapshot.events);
    metricElements[1].dataset.currentValue = String(initialSnapshot.latency);
    metricElements[2].dataset.currentValue = String(initialSnapshot.throughput);
    metricElements[0].textContent = formatMetric(initialSnapshot.events, Number(metricElements[0].dataset.decimals || 0), metricElements[0].dataset.suffix || '', metricElements[0].dataset.format || 'integer');
    metricElements[1].textContent = formatMetric(initialSnapshot.latency, Number(metricElements[1].dataset.decimals || 0), metricElements[1].dataset.suffix || '', metricElements[1].dataset.format || 'float');
    metricElements[2].textContent = formatMetric(initialSnapshot.throughput, Number(metricElements[2].dataset.decimals || 0), metricElements[2].dataset.suffix || '', metricElements[2].dataset.format || 'float');
    meter.style.width = '0%';
    runCycle();
  }

  function initSidebarLive() {
    clearTimers();
    updateStatus();
    initLiveStream();
  }

  document.addEventListener('visibilitychange', updateStatus);
  document.addEventListener('DOMContentLoaded', initSidebarLive);
  document.addEventListener('swup:contentReplaced', initSidebarLive);
})();
