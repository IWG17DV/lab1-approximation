import { getOlsValue } from "./math.js";

export function autoScale(inputPoints, functions) {
      let minX = Math.min(...inputPoints.map((point) => point.x));
      let maxX = Math.max(...inputPoints.map((point) => point.x));
      let minY = Math.min(...inputPoints.map((point) => point.y));
      let maxY = Math.max(...inputPoints.map((point) => point.y));
      const sampleCount = 500;

      for (const fn of functions) {
        for (let index = 0; index <= sampleCount; index += 1) {
          const x = minX + (maxX - minX) * index / sampleCount;
          const y = fn(x);
          if (!Number.isFinite(y)) continue;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      const xPadding = (maxX - minX || 1) * 0.1;
      const yPadding = (maxY - minY || Math.max(1, Math.abs(maxY) * 0.1)) * 0.1;
      return {
        minX: minX - xPadding,
        maxX: maxX + xPadding,
        minY: minY - yPadding,
        maxY: maxY + yPadding
      };
    }


    export function createChartRenderer(canvas) {
      const context = canvas.getContext("2d");
    function niceStep(range, targetTickCount) {
      const roughStep = range / targetTickCount;
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const residual = roughStep / magnitude;
      const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
      return niceResidual * magnitude;
    }

    function formatTick(value, step) {
      const decimals = Math.min(6, Math.max(0, -Math.floor(Math.log10(step)) + (step / Math.pow(10, Math.floor(Math.log10(step))) < 1 ? 1 : 0)));
      return Number(value.toFixed(decimals)).toString();
    }

    function drawGrid(bounds, width, height) {
      const margin = { left: 62, right: 20, top: 20, bottom: 42 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const toCanvasX = (x) => margin.left + (x - bounds.minX) / (bounds.maxX - bounds.minX) * plotWidth;
      const toCanvasY = (y) => margin.top + (bounds.maxY - y) / (bounds.maxY - bounds.minY) * plotHeight;
      const xStep = niceStep(bounds.maxX - bounds.minX, 7);
      const yStep = niceStep(bounds.maxY - bounds.minY, 6);

      context.save();
      context.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
      context.textBaseline = "middle";
      context.lineWidth = 1;

      const firstXTick = Math.ceil(bounds.minX / xStep) * xStep;
      for (let x = firstXTick; x <= bounds.maxX + xStep * 1e-8; x += xStep) {
        const pixelX = toCanvasX(x);
        context.beginPath();
        context.strokeStyle = "#edf0f5";
        context.moveTo(pixelX, margin.top);
        context.lineTo(pixelX, margin.top + plotHeight);
        context.stroke();
        context.fillStyle = "#7b8799";
        context.textAlign = "center";
        context.fillText(formatTick(x, xStep), pixelX, margin.top + plotHeight + 18);
      }

      const firstYTick = Math.ceil(bounds.minY / yStep) * yStep;
      for (let y = firstYTick; y <= bounds.maxY + yStep * 1e-8; y += yStep) {
        const pixelY = toCanvasY(y);
        context.beginPath();
        context.strokeStyle = "#edf0f5";
        context.moveTo(margin.left, pixelY);
        context.lineTo(margin.left + plotWidth, pixelY);
        context.stroke();
        context.fillStyle = "#7b8799";
        context.textAlign = "right";
        context.fillText(formatTick(y, yStep), margin.left - 10, pixelY);
      }

      context.strokeStyle = "#8b96a8";
      context.lineWidth = 1.25;
      if (bounds.minY <= 0 && bounds.maxY >= 0) {
        const zeroY = toCanvasY(0);
        context.beginPath();
        context.moveTo(margin.left, zeroY);
        context.lineTo(margin.left + plotWidth, zeroY);
        context.stroke();
      }
      if (bounds.minX <= 0 && bounds.maxX >= 0) {
        const zeroX = toCanvasX(0);
        context.beginPath();
        context.moveTo(zeroX, margin.top);
        context.lineTo(zeroX, margin.top + plotHeight);
        context.stroke();
      }

      context.fillStyle = "#64728a";
      context.font = "12px Inter, ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("x", margin.left + plotWidth, height - 8);
      context.save();
      context.translate(16, margin.top + plotHeight / 2);
      context.rotate(-Math.PI / 2);
      context.fillText("y", 0, 0);
      context.restore();
      context.restore();

      return { margin, plotWidth, plotHeight, toCanvasX, toCanvasY };
    }

    function drawCurve(samples, transform, color, lineWidth, visibleFraction, valueAccessor) {
      if (visibleFraction <= 0 || samples.length < 2) return;
      const lastIndex = Math.min(samples.length - 1, Math.max(1, Math.floor((samples.length - 1) * visibleFraction)));
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineJoin = "round";
      context.lineCap = "round";
      for (let index = 0; index <= lastIndex; index += 1) {
        const sample = samples[index];
        const y = valueAccessor ? valueAccessor(sample) : sample.y;
        if (index === 0) context.moveTo(transform.toCanvasX(sample.x), transform.toCanvasY(y));
        else context.lineTo(transform.toCanvasX(sample.x), transform.toCanvasY(y));
      }
      if (lastIndex < samples.length - 1 && visibleFraction > 0) {
        const fraction = (samples.length - 1) * visibleFraction - lastIndex;
        const first = samples[lastIndex];
        const next = samples[lastIndex + 1];
        const y1 = valueAccessor ? valueAccessor(first) : first.y;
        const y2 = valueAccessor ? valueAccessor(next) : next.y;
        context.lineTo(
          transform.toCanvasX(first.x + (next.x - first.x) * fraction),
          transform.toCanvasY(y1 + (y2 - y1) * fraction)
        );
      }
      context.stroke();
    }

    function drawPoints(transform, progress, points) {
      points.forEach((point, index) => {
        const pointProgress = Math.max(0, Math.min(1, progress * points.length - index));
        if (pointProgress <= 0) return;
        context.save();
        context.globalAlpha = pointProgress;
        context.beginPath();
        context.arc(transform.toCanvasX(point.x), transform.toCanvasY(point.y), 4.3, 0, Math.PI * 2);
        context.fillStyle = "#e18b38";
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = "#fff";
        context.stroke();
        context.restore();
      });
    }

    function drawResiduals(transform, progress, points, coefficients) {
      if (progress <= 0) return;
      context.save();
      context.globalAlpha = progress;
      context.setLineDash([4, 4]);
      context.lineWidth = 1.2;
      context.strokeStyle = "rgba(14, 159, 136, .58)";
      for (const point of points) {
        const predicted = getOlsValue(point.x, coefficients);
        context.beginPath();
        context.moveTo(transform.toCanvasX(point.x), transform.toCanvasY(point.y));
        context.lineTo(transform.toCanvasX(point.x), transform.toCanvasY(predicted));
        context.stroke();
      }
      context.restore();
    }

    function drawFrame({ points, coefficients, curveSamples, plotBounds, currentView, progress }) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * ratio);
      const height = Math.round(rect.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const transform = drawGrid(plotBounds, rect.width, rect.height);
      const showLagrange = currentView === "lagrange" || currentView === "all";
      const showOls = currentView === "ols" || currentView === "all";
      const eased = progress * progress * (3 - 2 * progress);

      if (showOls) {
        const first = points[0];
        const last = points[points.length - 1];
        const lineAt = (x) => first.y + (last.y - first.y) * (x - first.x) / (last.x - first.x);
        const olsAt = (x) => getOlsValue(x, coefficients);
        drawCurve(curveSamples, transform, "#0e9f88", 2.7, 1, (sample) => {
          return lineAt(sample.x) + (olsAt(sample.x) - lineAt(sample.x)) * eased;
        });
        drawResiduals(transform, eased, points, coefficients);
      }

      if (showLagrange) drawCurve(curveSamples, transform, "#4263eb", 2.5, eased);
      drawPoints(transform, eased, points);
    }


      return {
        drawFrame,
        clear() {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
    }
