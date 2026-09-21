/**
 * Interactive Bauhaus Data Chart & SVG Adapter Engine
 * Features:
 * 1. Interactive Bar, Line, Confusion Matrix, and Python SVG / Plotly Embeds
 * 2. 📸 Snapshot Exporter (PNG Image, SVG Vector, JSON / CSV Data Points)
 * 3. 🎨 Live Color Palette Customizer with Official 15 Bauhaus x Swiss Swatches
 * 4. Perceptual Nearest-Color SVG Adapter (for Matplotlib / Seaborn SVG exports)
 */

(function () {
  'use strict';

  // --- OFFICIAL BAUHAUS x SWISS COLOR PALETTES ---
  const BAUHAUS_SWISS_PALETTE = [
    { name: 'Ink', hex: '#111111' },
    { name: 'Graphite', hex: '#4A4945' },
    { name: 'Bauhaus Red', hex: '#E03C31' },
    { name: 'Bauhaus Yellow', hex: '#F2C230' },
    { name: 'Swiss Blue', hex: '#2457A6' },
    { name: 'Primary Green', hex: '#2F7D5A' },
    { name: 'Bauhaus Orange', hex: '#E87524' },
    { name: 'Cyan / Teal', hex: '#23827F' },
    { name: 'Violet', hex: '#8064A8' },
    { name: 'Magenta', hex: '#C05A89' },
    { name: 'Warm Paper', hex: '#FBF9F5' },
    { name: 'Ivory', hex: '#E8E5DC' },
    { name: 'Light Grey', hex: '#D4D1C9' },
    { name: 'Mid Grey', hex: '#A9A7A0' },
    { name: 'Absolute Black', hex: '#000000' }
  ];

  const PRESET_PALETTES = {
    classic: ['#111111', '#E03C31', '#F2C230', '#2457A6', '#2F7D5A'],
    swiss: ['#4A4945', '#23827F', '#2F7D5A', '#E87524', '#C05A89'],
    obsidian: ['#FFFFFF', '#E03C31', '#23827F', '#F2C230', '#8064A8']
  };

  // Convert Hex to RGB
  function hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // Calculate Euclidean Distance between 2 RGB colors
  function colorDistance(c1, c2) {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
  }

  // Find nearest color in Bauhaus palette
  function getNearestBauhausColor(hexColor) {
    if (!hexColor || hexColor === 'none' || hexColor === 'transparent') return hexColor;
    try {
      const rgb = hexToRgb(hexColor);
      let minDistance = Infinity;
      let nearestHex = hexColor;

      BAUHAUS_SWISS_PALETTE.forEach(p => {
        const pRgb = hexToRgb(p.hex);
        const dist = colorDistance(rgb, pRgb);
        if (dist < minDistance) {
          minDistance = dist;
          nearestHex = p.hex;
        }
      });
      return nearestHex;
    } catch (e) {
      return hexColor;
    }
  }

  // --- AUTOMATIC SVG BAUHAUS ADAPTER ---
  function adaptSvgElement(svgEl, activeColors) {
    if (!svgEl) return;
    const colors = activeColors || PRESET_PALETTES.classic;

    // 1. Convert White / Near-White Background Fills to Warm Paper (#FBF9F5)
    svgEl.querySelectorAll("[fill='#ffffff'], [fill='#fff'], [fill='white'], [style*='fill: #ffffff']").forEach(el => {
      el.setAttribute("fill", "#FBF9F5");
    });

    // 2. Format Text & Labels to Monospace
    svgEl.querySelectorAll("text, tspan").forEach(el => {
      el.setAttribute("font-family", "Courier New, monospace");
      el.setAttribute("letter-spacing", "0.04em");
    });

    // 3. Grid lines & Hairlines
    svgEl.querySelectorAll("path, line, rect").forEach(el => {
      const stroke = el.getAttribute("stroke");
      if (stroke && stroke !== "none") {
        const sw = parseFloat(el.getAttribute("stroke-width") || "1");
        if (sw > 0.5 && sw < 2) {
          el.setAttribute("stroke-width", "1");
        }
      }
    });

    // 4. Map Common Matplotlib / Seaborn default colors to Nearest Bauhaus Palette Color
    const defaultColorMap = {
      "#1f77b4": colors[0] || "#111111", // Matplotlib Blue -> Primary Dark
      "#ff7f0e": colors[1] || "#E03C31", // Matplotlib Orange -> Red Accent
      "#2ca02c": colors[4] || "#2F7D5A", // Matplotlib Green -> Green Accent
      "#d62728": colors[1] || "#E03C31", // Matplotlib Red -> Red Accent
      "#9467bd": colors[3] || "#8064A8", // Matplotlib Purple -> Violet
      "#8c564b": colors[2] || "#4A4945", // Matplotlib Brown -> Graphite
      "#e377c2": colors[4] || "#C05A89"  // Matplotlib Pink -> Magenta
    };

    Object.entries(defaultColorMap).forEach(([oldHex, newHex]) => {
      svgEl.querySelectorAll(`[stroke='${oldHex}'], [fill='${oldHex}']`).forEach(el => {
        if (el.getAttribute("stroke") === oldHex) el.setAttribute("stroke", newHex);
        if (el.getAttribute("fill") === oldHex) el.setAttribute("fill", newHex);
      });
    });
  }

  // --- CUSTOM INTERACTIVE SVG & PLOTLY RECOLORING ENGINE ---
  function recolorSvgElement(svgEl, customColors) {
    if (!svgEl || !customColors) return;
    const { primary, accent, bg, text } = customColors;

    if (bg) {
      svgEl.style.backgroundColor = bg;
      svgEl.querySelectorAll("rect:first-child, [fill='#ffffff'], [fill='#fff'], [fill='white'], [style*='fill: #ffffff']").forEach(el => {
        el.setAttribute("fill", bg);
      });
    }

    if (text) {
      svgEl.querySelectorAll("text, tspan").forEach(el => {
        el.setAttribute("fill", text);
        el.setAttribute("font-family", "Courier New, monospace");
      });
    }

    if (primary || accent) {
      let idx = 0;
      svgEl.querySelectorAll("path, circle, polygon, rect:not(:first-child)").forEach((el) => {
        const fill = el.getAttribute("fill");
        if (fill && fill !== "none" && fill !== "transparent") {
          el.setAttribute("fill", idx % 2 === 0 ? (primary || "#111111") : (accent || "#E03C31"));
          idx++;
        }
        const stroke = el.getAttribute("stroke");
        if (stroke && stroke !== "none" && stroke !== "transparent") {
          el.setAttribute("stroke", primary || "#111111");
        }
      });
    }
  }

  // --- ELEMENT-LEVEL SVG COLOR INSPECTOR & GROUP RECOLORER ---
  function inspectSvgElements(svgEl) {
    if (!svgEl) return [];
    const colorMap = new Map();
    const addColor = (val) => {
      if (!val || val === "none" || val === "transparent" || val.startsWith("url(")) return;
      const cleanVal = val.toLowerCase().trim();
      colorMap.set(cleanVal, (colorMap.get(cleanVal) || 0) + 1);
    };

    svgEl.querySelectorAll("*").forEach(el => {
      addColor(el.getAttribute("fill"));
      addColor(el.getAttribute("stroke"));
      const style = el.getAttribute("style") || "";
      const fillMatch = style.match(/fill:\s*([^;]+)/i);
      if (fillMatch) addColor(fillMatch[1]);
      const strokeMatch = style.match(/stroke:\s*([^;]+)/i);
      if (strokeMatch) addColor(strokeMatch[1]);
    });

    return Array.from(colorMap.entries()).map(([color, count]) => ({ color, count }));
  }

  function recolorSvgGroup(svgEl, oldColor, newColor) {
    if (!svgEl || !oldColor || !newColor) return;
    const target = oldColor.toLowerCase().trim();
    svgEl.querySelectorAll("*").forEach(el => {
      if ((el.getAttribute("fill") || "").toLowerCase().trim() === target) {
        el.setAttribute("fill", newColor);
      }
      if ((el.getAttribute("stroke") || "").toLowerCase().trim() === target) {
        el.setAttribute("stroke", newColor);
      }
      const style = el.getAttribute("style") || "";
      if (style.toLowerCase().includes(target)) {
        const newStyle = style.replace(new RegExp(target, "gi"), newColor);
        el.setAttribute("style", newStyle);
      }
    });
  }

  function adaptPlotlyIframe(iframeEl, customColors) {
    if (!iframeEl) return;
    const { primary, accent, bg, text } = customColors || {};
    try {
      const doc = iframeEl.contentDocument || iframeEl.contentWindow.document;
      if (!doc) return;
      let styleEl = doc.getElementById("bauhaus-plotly-override");
      if (!styleEl) {
        styleEl = doc.createElement("style");
        styleEl.id = "bauhaus-plotly-override";
        doc.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        body, .plotly, .main-svg { background-color: ${bg || '#FBF9F5'} !important; }
        .plotly text { fill: ${text || '#111111'} !important; font-family: Courier New, monospace !important; }
        .plotly .gridlayer path { stroke: ${bg ? '#d0ccc0' : '#e0e0e0'} !important; }
        .plotly .js-line { stroke: ${accent || '#E03C31'} !important; }
        .plotly .point path { fill: ${primary || '#2457A6'} !important; }
      `;
    } catch(e) {}
  }

  // --- SNAPSHOT & DATA EXPORT ENGINE ---
  function exportChartSnapshot(wrapperEl) {
    const svgEl = wrapperEl.querySelector("svg");
    if (!svgEl) return;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = (svgEl.viewBox.baseVal.width || 600) * 2;
      canvas.height = (svgEl.viewBox.baseVal.height || 350) * 2;
      const ctx = canvas.getContext("2d");
      
      ctx.fillStyle = "#FBF9F5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `bauhaus-chart-snapshot-${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  }

  function exportChartSvg(wrapperEl) {
    const svgEl = wrapperEl.querySelector("svg");
    if (!svgEl) return;
    const svgString = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bauhaus-chart-${Date.now()}.svg`;
    link.click();
  }

  function exportChartDataJson(data) {
    if (!data) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.href = dataStr;
    link.download = `bauhaus-chart-data-${Date.now()}.json`;
    link.click();
  }

  // --- RENDER BAR CHART ---
  function renderBarChart(container, title, items, colors) {
    const width = 600;
    const height = 320;
    const padding = { top: 40, right: 30, bottom: 50, left: 140 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...items.map(d => d.val || 0), 1);
    const barHeight = Math.min(32, (chartHeight / items.length) - 8);

    let svgHtml = `
      <div class="bauhaus-chart-header">
        <span class="chart-title-label">${title ? title.toUpperCase() : "BAR CHART ANALYSIS"}</span>
        <div class="chart-actions">
          <button type="button" class="chart-action-btn snap-png-btn" title="Snapshot PNG Image">📸 SNAP PNG</button>
          <button type="button" class="chart-action-btn snap-svg-btn" title="Export Vector SVG">💾 SVG</button>
          <button type="button" class="chart-action-btn snap-data-btn" title="Export Data Points (JSON)">📊 JSON</button>
        </div>
      </div>
      <div class="chart-svg-wrapper">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#FBF9F5" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />
          <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />
    `;

    items.forEach((item, idx) => {
      const y = padding.top + idx * (chartHeight / items.length) + 4;
      const w = (item.val / maxVal) * chartWidth;
      const color = colors[idx % colors.length] || "#111111";

      svgHtml += `
        <g class="chart-bar-group" data-label="${item.label}" data-val="${item.val}">
          <text x="${padding.left - 10}" y="${y + barHeight / 1.4}" text-anchor="end" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">${item.label}</text>
          <rect x="${padding.left}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" stroke="#111111" stroke-width="1" class="chart-interact-shape" />
          <text x="${padding.left + w + 8}" y="${y + barHeight / 1.4}" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">${item.val}</text>
        </g>
      `;
    });

    svgHtml += `
        </svg>
        <div class="chart-tooltip" style="display:none"></div>
      </div>
      <div class="chart-palette-bar">
        <span class="palette-label">BAUHAUS PALETTE:</span>
        <div class="palette-swatches">
          ${colors.map((c, i) => `
            <button type="button" class="swatch-btn" data-color-idx="${i}" style="background:${c}" title="Click to customize color (${c})"></button>
          `).join('')}
        </div>
        <select class="palette-preset-select">
          <option value="classic">BAUHAUS CLASSIC</option>
          <option value="swiss">SWISS BOTANICAL</option>
          <option value="obsidian">OBSIDIAN NIGHT</option>
        </select>
      </div>
    `;

    container.innerHTML = svgHtml;
    attachChartEvents(container, items);
  }

  // --- RENDER CONFUSION MATRIX CHART ---
  function renderConfusionMatrix(container, title, matrixData, colors) {
    const width = 500;
    const height = 360;
    const { tp = 0, fp = 0, fn = 0, tn = 0 } = matrixData || {};
    const total = tp + fp + fn + tn || 1;

    const primaryColor = colors[0] || '#111111';
    const redColor = colors[1] || '#E03C31';

    let svgHtml = `
      <div class="bauhaus-chart-header">
        <span class="chart-title-label">${title ? title.toUpperCase() : "CONFUSION MATRIX ANALYSIS"}</span>
        <div class="chart-actions">
          <button type="button" class="chart-action-btn snap-png-btn">📸 SNAP PNG</button>
          <button type="button" class="chart-action-btn snap-svg-btn">💾 SVG</button>
          <button type="button" class="chart-action-btn snap-data-btn">📊 JSON</button>
        </div>
      </div>
      <div class="chart-svg-wrapper">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#FBF9F5" />
          
          <text x="250" y="30" text-anchor="middle" font-family="Courier New, monospace" font-size="12" font-weight="800" fill="#111111">PREDICTED CLASS</text>
          <text x="170" y="55" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">POSITIVE (1)</text>
          <text x="330" y="55" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">NEGATIVE (0)</text>

          <text x="25" y="190" text-anchor="middle" font-family="Courier New, monospace" font-size="12" font-weight="800" fill="#111111" transform="rotate(-90 25 190)">ACTUAL CLASS</text>
          <text x="65" y="135" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">POS (1)</text>
          <text x="65" y="255" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#111111">NEG (0)</text>

          <rect x="100" y="70" width="140" height="120" fill="${primaryColor}" opacity="${Math.max(0.25, tp / total)}" stroke="#111111" stroke-width="1.5" class="chart-interact-shape" data-label="True Positives (TP)" data-val="${tp}" />
          <text x="170" y="125" text-anchor="middle" font-family="Courier New, monospace" font-size="20" font-weight="800" fill="${tp / total > 0.4 ? '#FFFFFF' : '#111111'}">${tp}</text>
          <text x="170" y="150" text-anchor="middle" font-family="Courier New, monospace" font-size="10" font-weight="700" fill="${tp / total > 0.4 ? '#FFFFFF' : '#111111'}">TRUE POSITIVE</text>

          <rect x="260" y="70" width="140" height="120" fill="${redColor}" opacity="${Math.max(0.15, fp / total * 2)}" stroke="#111111" stroke-width="1.5" class="chart-interact-shape" data-label="False Positives (FP)" data-val="${fp}" />
          <text x="330" y="125" text-anchor="middle" font-family="Courier New, monospace" font-size="20" font-weight="800" fill="#111111">${fp}</text>
          <text x="330" y="150" text-anchor="middle" font-family="Courier New, monospace" font-size="10" font-weight="700" fill="#111111">FALSE POSITIVE</text>

          <rect x="100" y="200" width="140" height="120" fill="${redColor}" opacity="${Math.max(0.15, fn / total * 2)}" stroke="#111111" stroke-width="1.5" class="chart-interact-shape" data-label="False Negatives (FN)" data-val="${fn}" />
          <text x="170" y="255" text-anchor="middle" font-family="Courier New, monospace" font-size="20" font-weight="800" fill="#111111">${fn}</text>
          <text x="170" y="280" text-anchor="middle" font-family="Courier New, monospace" font-size="10" font-weight="700" fill="#111111">FALSE NEGATIVE</text>

          <rect x="260" y="200" width="140" height="120" fill="${primaryColor}" opacity="${Math.max(0.25, tn / total)}" stroke="#111111" stroke-width="1.5" class="chart-interact-shape" data-label="True Negatives (TN)" data-val="${tn}" />
          <text x="330" y="255" text-anchor="middle" font-family="Courier New, monospace" font-size="20" font-weight="800" fill="${tn / total > 0.4 ? '#FFFFFF' : '#111111'}">${tn}</text>
          <text x="330" y="280" text-anchor="middle" font-family="Courier New, monospace" font-size="10" font-weight="700" fill="${tn / total > 0.4 ? '#FFFFFF' : '#111111'}">TRUE NEGATIVE</text>
        </svg>
        <div class="chart-tooltip" style="display:none"></div>
      </div>
      <div class="chart-palette-bar">
        <span class="palette-label">BAUHAUS PALETTE:</span>
        <div class="palette-swatches">
          ${colors.map((c, i) => `
            <button type="button" class="swatch-btn" data-color-idx="${i}" style="background:${c}"></button>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = svgHtml;
    attachChartEvents(container, matrixData);
  }

  // --- RENDER LINE & TREND CHART ---
  function renderLineChart(container, title, items, colors) {
    const width = 600;
    const height = 340;
    const padding = { top: 40, right: 40, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const dataItems = Array.isArray(items) && items.length ? items : [
      { label: "Jan", val: 12 }, { label: "Feb", val: 19 }, { label: "Mar", val: 28 }, { label: "Apr", val: 35 }, { label: "May", val: 42 }
    ];

    const maxVal = Math.max(...dataItems.map(d => Number(d.val) || 0), 1);
    const minVal = Math.min(0, ...dataItems.map(d => Number(d.val) || 0));
    const valRange = (maxVal - minVal) || 1;

    const lineColor = colors[1] || "#E03C31";
    const pointColor = colors[0] || "#111111";

    const points = dataItems.map((item, idx) => {
      const x = padding.left + (idx / Math.max(1, dataItems.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - (((Number(item.val) || 0) - minVal) / valRange) * chartHeight;
      return { x, y, label: item.label, val: item.val };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    let svgHtml = `
      <div class="bauhaus-chart-header">
        <span class="chart-title-label">${title ? title.toUpperCase() : "LINE & TREND ANALYSIS"}</span>
        <div class="chart-actions">
          <button type="button" class="chart-action-btn snap-png-btn">📸 SNAP PNG</button>
          <button type="button" class="chart-action-btn snap-svg-btn">💾 SVG</button>
          <button type="button" class="chart-action-btn snap-data-btn">📊 JSON</button>
        </div>
      </div>
      <div class="chart-svg-wrapper">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#FBF9F5" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />
          <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />

          <!-- Grid Lines -->
          ${[0, 0.25, 0.5, 0.75, 1].map(r => {
            const gy = padding.top + chartHeight * (1 - r);
            const gVal = (minVal + valRange * r).toFixed(1);
            return `
              <line x1="${padding.left}" y1="${gy}" x2="${width - padding.right}" y2="${gy}" stroke="#e8e5dc" stroke-width="1" stroke-dasharray="3 3" />
              <text x="${padding.left - 8}" y="${gy + 4}" text-anchor="end" font-family="Courier New, monospace" font-size="9" fill="#5e5b55">${gVal}</text>
            `;
          }).join('')}

          <!-- Trend Line -->
          <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Data Points -->
          ${points.map(p => `
            <g class="chart-interact-shape" data-label="${p.label}" data-val="${p.val}">
              <circle cx="${p.x}" cy="${p.y}" r="6" fill="${pointColor}" stroke="#FBF9F5" stroke-width="2" style="cursor:pointer" />
              <text x="${p.x}" y="${height - padding.bottom + 18}" text-anchor="middle" font-family="Courier New, monospace" font-size="10" font-weight="700" fill="#111111">${p.label}</text>
            </g>
          `).join('')}
        </svg>
        <div class="chart-tooltip" style="display:none"></div>
      </div>
      <div class="chart-palette-bar">
        <span class="palette-label">BAUHAUS PALETTE:</span>
        <div class="palette-swatches">
          ${colors.map((c, i) => `<button type="button" class="swatch-btn" data-color-idx="${i}" style="background:${c}"></button>`).join('')}
        </div>
      </div>
    `;

    container.innerHTML = svgHtml;
    attachChartEvents(container, dataItems);
  }

  // --- RENDER SCATTER & BUBBLE PLOT ---
  function renderScatterChart(container, title, items, colors) {
    const width = 600;
    const height = 340;
    const padding = { top: 40, right: 40, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const dataItems = Array.isArray(items) && items.length ? items : [
      { label: "Cluster A", val: 12, size: 14, x: 20 },
      { label: "Cluster B", val: 45, size: 24, x: 50 },
      { label: "Cluster C", val: 78, size: 18, x: 80 }
    ];

    const maxX = Math.max(...dataItems.map(d => Number(d.x) || Number(d.val) || 1), 10);
    const maxY = Math.max(...dataItems.map(d => Number(d.val) || 1), 10);

    const primaryColor = colors[0] || "#111111";
    const accentColor = colors[1] || "#E03C31";

    let svgHtml = `
      <div class="bauhaus-chart-header">
        <span class="chart-title-label">${title ? title.toUpperCase() : "SCATTER & BUBBLE DISTRIBUTION"}</span>
        <div class="chart-actions">
          <button type="button" class="chart-action-btn snap-png-btn">📸 SNAP PNG</button>
          <button type="button" class="chart-action-btn snap-svg-btn">💾 SVG</button>
          <button type="button" class="chart-action-btn snap-data-btn">📊 JSON</button>
        </div>
      </div>
      <div class="chart-svg-wrapper">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#FBF9F5" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />
          <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#111111" stroke-width="1.5" />

          ${dataItems.map((item, idx) => {
            const xVal = Number(item.x) || (idx + 1) * (maxX / (dataItems.length + 1));
            const yVal = Number(item.val) || 0;
            const cx = padding.left + (xVal / maxX) * chartWidth;
            const cy = padding.top + chartHeight - (yVal / maxY) * chartHeight;
            const r = Math.min(30, Math.max(6, Number(item.size) || 10));
            const bubbleColor = idx % 2 === 0 ? accentColor : primaryColor;

            return `
              <g class="chart-interact-shape" data-label="${item.label}" data-val="X: ${xVal.toFixed(1)}, Y: ${yVal.toFixed(1)}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bubbleColor}" opacity="0.75" stroke="#111111" stroke-width="1.5" style="cursor:pointer" />
                <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Courier New, monospace" font-size="9" font-weight="700" fill="#ffffff">${item.label}</text>
              </g>
            `;
          }).join('')}
        </svg>
        <div class="chart-tooltip" style="display:none"></div>
      </div>
      <div class="chart-palette-bar">
        <span class="palette-label">BAUHAUS PALETTE:</span>
        <div class="palette-swatches">
          ${colors.map((c, i) => `<button type="button" class="swatch-btn" data-color-idx="${i}" style="background:${c}"></button>`).join('')}
        </div>
      </div>
    `;

    container.innerHTML = svgHtml;
    attachChartEvents(container, dataItems);
  }

  // --- ATTACH EVENT HANDLERS ---
  function attachChartEvents(container, chartData) {
    const tooltip = container.querySelector(".chart-tooltip");
    const wrapper = container.querySelector(".chart-svg-wrapper");

    container.querySelectorAll(".chart-interact-shape").forEach(shape => {
      shape.addEventListener("mousemove", (e) => {
        const label = shape.getAttribute("data-label") || "";
        const val = shape.getAttribute("data-val") || "";
        if (tooltip && wrapper) {
          tooltip.innerHTML = `<strong>${label}</strong>: <span>${val}</span>`;
          tooltip.style.display = "block";
          const rect = wrapper.getBoundingClientRect();
          tooltip.style.left = `${e.clientX - rect.left + 12}px`;
          tooltip.style.top = `${e.clientY - rect.top - 28}px`;
        }
      });
      shape.addEventListener("mouseleave", () => {
        if (tooltip) tooltip.style.display = "none";
      });
    });

    container.querySelector(".snap-png-btn")?.addEventListener("click", () => exportChartSnapshot(container));
    container.querySelector(".snap-svg-btn")?.addEventListener("click", () => exportChartSvg(container));
    container.querySelector(".snap-data-btn")?.addEventListener("click", () => exportChartDataJson(chartData));

    container.querySelector(".palette-preset-select")?.addEventListener("change", (e) => {
      const presetKey = e.target.value;
      const newColors = PRESET_PALETTES[presetKey] || PRESET_PALETTES.classic;
      const type = container.getAttribute("data-chart-type") || "bar";
      const title = container.getAttribute("data-chart-title") || "";
      
      if (type === "bar") {
        renderBarChart(container, title, chartData, newColors);
      } else if (type === "confusion-matrix") {
        renderConfusionMatrix(container, title, chartData, newColors);
      }
    });

    container.querySelectorAll(".swatch-btn").forEach(swatchBtn => {
      swatchBtn.addEventListener("click", () => {
        const cIdx = parseInt(swatchBtn.getAttribute("data-color-idx"), 10);
        showColorPickerModal((selectedHex) => {
          const type = container.getAttribute("data-chart-type") || "bar";
          const title = container.getAttribute("data-chart-title") || "";
          const activeColors = Array.from(container.querySelectorAll(".swatch-btn")).map(b => b.style.backgroundColor);
          activeColors[cIdx] = selectedHex;

          if (type === "bar") {
            renderBarChart(container, title, chartData, activeColors);
          } else if (type === "confusion-matrix") {
            renderConfusionMatrix(container, title, chartData, activeColors);
          }
        });
      });
    });
  }

  function showColorPickerModal(onSelectCallback) {
    document.querySelector(".bauhaus-color-picker-root")?.remove();

    const root = document.createElement("div");
    root.className = "bauhaus-color-picker-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal color-picker-dialog" role="dialog" style="width:min(420px, 94vw);padding:16px;background:#FBF9F5;border:1px solid #111111">
        <p class="admin-kicker">09 / PALETTE CUSTOMIZER</p>
        <h3 style="margin-bottom:10px;font-family:var(--mono, monospace);font-size:14px">SELECT BAUHAUS × SWISS COLOR</h3>
        
        <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;margin-bottom:14px">
          ${BAUHAUS_SWISS_PALETTE.map(p => `
            <button type="button" class="bauhaus-color-swatch-opt" data-hex="${p.hex}" title="${p.name} (${p.hex})" style="height:44px;background:${p.hex};border:1px solid #111;cursor:pointer"></button>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center">
          <button type="button" class="admin-btn secondary" data-dismiss="true">CANCEL</button>
          <span style="font-family:var(--mono);font-size:11px;color:#666">15 SWISS PALETTE SWATCHES</span>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) {
        root.remove();
        return;
      }
      const swatch = e.target.closest(".bauhaus-color-swatch-opt");
      if (swatch) {
        const hex = swatch.getAttribute("data-hex");
        if (onSelectCallback) onSelectCallback(hex);
        root.remove();
      }
    });
  }

  function initBauhausCharts() {
    document.querySelectorAll(".bauhaus-chart").forEach(async (container) => {
      if (container.getAttribute("data-chart-rendered") === "true") return;

      const type = container.getAttribute("data-chart-type") || "bar";
      const title = container.getAttribute("data-chart-title") || "";
      const rawData = container.getAttribute("data-chart-data");
      let data = null;

      try {
        if (rawData) data = JSON.parse(rawData);
      } catch (e) {}

      // 1. Check for SVG image tags to inline & convert
      const imgChild = container.querySelector("img[src*='.svg']");
      if (imgChild) {
        try {
          const src = imgChild.getAttribute("src");
          const res = await fetch(src);
          if (res.ok) {
            const svgText = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");
            const svgEl = doc.querySelector("svg");
            if (svgEl) {
              svgEl.setAttribute("width", "100%");
              svgEl.setAttribute("height", "100%");
              adaptSvgElement(svgEl, PRESET_PALETTES.classic);
              container.innerHTML = `
                <div class="bauhaus-chart-header">
                  <span class="chart-title-label">${title ? title.toUpperCase() : "PYTHON SVG GRAPH (ADAPTED)"}</span>
                  <div class="chart-actions">
                    <button type="button" class="chart-action-btn snap-png-btn">📸 SNAP PNG</button>
                    <button type="button" class="chart-action-btn snap-svg-btn">💾 SVG</button>
                  </div>
                </div>
                <div class="chart-svg-wrapper">${svgEl.outerHTML}</div>
              `;
              container.setAttribute("data-chart-rendered", "true");
              return;
            }
          }
        } catch (err) {}
      }

      // 2. Direct SVG child
      const svgChild = container.querySelector("svg");
      if (svgChild) {
        adaptSvgElement(svgChild, PRESET_PALETTES.classic);
        container.setAttribute("data-chart-rendered", "true");
        return;
      }

      // 3. Render Bar / Confusion Matrix
      if (!data) {
        if (type === "bar") {
          data = [
            { label: "Customer Tenure", val: 0.38 },
            { label: "Contract Type", val: 0.26 },
            { label: "Monthly Charges", val: 0.20 },
            { label: "Tech Support", val: 0.16 }
          ];
        } else if (type === "confusion-matrix") {
          data = { tp: 412, fp: 18, fn: 24, tn: 546 };
        }
      }

      if (type === "bar") {
        renderBarChart(container, title, data, PRESET_PALETTES.classic);
        container.setAttribute("data-chart-rendered", "true");
      } else if (type === "line") {
        renderLineChart(container, title, data, PRESET_PALETTES.classic);
        container.setAttribute("data-chart-rendered", "true");
      } else if (type === "scatter") {
        renderScatterChart(container, title, data, PRESET_PALETTES.classic);
        container.setAttribute("data-chart-rendered", "true");
      } else if (type === "confusion-matrix") {
        renderConfusionMatrix(container, title, data, PRESET_PALETTES.classic);
        container.setAttribute("data-chart-rendered", "true");
      }
    });
  }

  window.initBauhausCharts = initBauhausCharts;
  window.adaptSvgElement = adaptSvgElement;
  window.recolorSvgElement = recolorSvgElement;
  window.inspectSvgElements = inspectSvgElements;
  window.recolorSvgGroup = recolorSvgGroup;
  window.renderLineChart = renderLineChart;
  window.renderScatterChart = renderScatterChart;
  window.showColorPickerModal = showColorPickerModal;
  window.adaptPlotlyIframe = adaptPlotlyIframe;
  window.BAUHAUS_SWISS_PALETTE = BAUHAUS_SWISS_PALETTE;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBauhausCharts);
  } else {
    initBauhausCharts();
  }
})();
