import { DATASETS } from "./data.js";
import { getOlsValue, lagrangeInterpolation, leastSquaresMethod } from "./math.js";
import { autoScale, createChartRenderer } from "./chart.js";

const canvas = document.getElementById("chart");
const datasetSelect = document.getElementById("dataset");
const degreeSelect = document.getElementById("degree");
const statusElement = document.getElementById("status");
const subtitleElement = document.getElementById("chart-subtitle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const chart = createChartRenderer(canvas);

let points = DATASETS[5];
let coefficients = [];
let curveSamples = [];
let plotBounds = null;
let animationStart = 0;
let animationFrame = 0;
let animationProgress = 1;
let currentView = "all";

function drawFrame(progress) {
  chart.drawFrame({ points, coefficients, curveSamples, plotBounds, currentView, progress });
}

function renderAt(timestamp) {
  animationProgress = Math.min(1, (timestamp - animationStart) / (reducedMotion.matches ? 1 : 1900));
  drawFrame(animationProgress);
  if (animationProgress < 1) {
    animationFrame = requestAnimationFrame(renderAt);
  } else {
    animationFrame = 0;
  }
}

function updateStatus() {
  const squaredError = points.reduce((sum, point) => {
    const residual = point.y - getOlsValue(point.x, coefficients);
    return sum + residual * residual;
  }, 0);
  const rmse = Math.sqrt(squaredError / points.length);
  statusElement.classList.remove("error");
  statusElement.textContent = `${points.length} точок · степінь МНК: ${coefficients.length - 1} · середньоквадратична похибка: ${rmse.toFixed(4)}`;
  subtitleElement.textContent = `Експоненційне спадання · діапазон x: ${points[0].x.toFixed(2)} … ${points[points.length - 1].x.toFixed(2)}`;
}

function updateChart(animate) {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  points = DATASETS[Number(datasetSelect.value)];
  currentView = document.querySelector('input[name="view"]:checked').value;
  try {
    coefficients = leastSquaresMethod(points, Number(degreeSelect.value));
    curveSamples = Array.from({ length: 501 }, (_, index) => {
      const x = points[0].x + (points[points.length - 1].x - points[0].x) * index / 500;
      return { x, y: lagrangeInterpolation(x, points) };
    });
    const olsAt = (x) => getOlsValue(x, coefficients);
    plotBounds = autoScale(points, [(x) => lagrangeInterpolation(x, points), olsAt]);
    updateStatus();
  } catch (error) {
    statusElement.classList.add("error");
    statusElement.textContent = `Помилка обчислення: ${error instanceof Error ? error.message : String(error)}`;
    chart.clear();
    return;
  }

  animationStart = performance.now();
  animationProgress = animate && !reducedMotion.matches ? 0 : 1;
  if (animationProgress === 1) {
    drawFrame(1);
  } else {
    animationFrame = requestAnimationFrame(renderAt);
  }
}

datasetSelect.addEventListener("change", () => updateChart(true));
degreeSelect.addEventListener("change", () => updateChart(true));
document.querySelectorAll('input[name="view"]').forEach((input) => {
  input.addEventListener("change", () => updateChart(true));
});

const resizeObserver = new ResizeObserver(() => drawFrame(animationProgress));
resizeObserver.observe(canvas.parentElement);
updateChart(true);
