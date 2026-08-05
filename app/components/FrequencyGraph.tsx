"use client";

import { useEffect, useRef } from "react";
import type { DetectedIssue, FrequencyPoint } from "../../lib/types";

interface GraphSeries {
  label: string;
  color: string;
  points: FrequencyPoint[];
  dashed?: boolean;
  width?: number;
}

interface FrequencyGraphProps {
  series: GraphSeries[];
  issues?: DetectedIssue[];
  yMin?: number;
  yMax?: number;
  height?: number;
  title: string;
  summary: string;
}

const frequencyX = (frequency: number, width: number) =>
  ((Math.log10(Math.max(20, frequency)) - Math.log10(20)) /
    (Math.log10(20000) - Math.log10(20))) *
  width;

const formatFrequency = (frequency: number) =>
  frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`;

export function FrequencyGraph({
  series,
  issues = [],
  yMin = -12,
  yMax = 12,
  height = 330,
  title,
  summary,
}: FrequencyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(280, rect.width);
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(pixelRatio, pixelRatio);

      const padding = { top: 20, right: 18, bottom: 38, left: 44 };
      const graphWidth = width - padding.left - padding.right;
      const graphHeight = height - padding.top - padding.bottom;
      const y = (db: number) =>
        padding.top + ((yMax - db) / (yMax - yMin)) * graphHeight;

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#101715";
      context.fillRect(0, 0, width, height);

      for (const issue of issues) {
        const start = padding.left + frequencyX(issue.startHz, graphWidth);
        const end = padding.left + frequencyX(issue.endHz, graphWidth);
        context.fillStyle =
          issue.type === "peak"
            ? "rgba(245, 125, 68, 0.13)"
            : "rgba(96, 173, 255, 0.1)";
        context.fillRect(start, padding.top, end - start, graphHeight);
      }

      const frequencyLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "center";
      context.textBaseline = "top";
      for (const frequency of frequencyLabels) {
        const x = padding.left + frequencyX(frequency, graphWidth);
        context.strokeStyle = "rgba(255,255,255,0.08)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, padding.top + graphHeight);
        context.stroke();
        context.fillStyle = "rgba(235,242,238,0.56)";
        context.fillText(
          formatFrequency(frequency),
          x,
          padding.top + graphHeight + 12,
        );
      }

      context.textAlign = "right";
      context.textBaseline = "middle";
      const step = yMax - yMin > 40 ? 20 : 6;
      for (let db = yMin; db <= yMax; db += step) {
        const yPosition = y(db);
        context.strokeStyle =
          db === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
        context.beginPath();
        context.moveTo(padding.left, yPosition);
        context.lineTo(padding.left + graphWidth, yPosition);
        context.stroke();
        context.fillStyle = "rgba(235,242,238,0.56)";
        context.fillText(`${db}`, padding.left - 9, yPosition);
      }

      context.save();
      context.beginPath();
      context.rect(padding.left, padding.top, graphWidth, graphHeight);
      context.clip();
      for (const item of series) {
        if (!item.points.length) continue;
        context.beginPath();
        context.strokeStyle = item.color;
        context.lineWidth = item.width ?? 2;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.setLineDash(item.dashed ? [7, 6] : []);
        item.points.forEach((point, index) => {
          const x =
            padding.left + frequencyX(point.frequency, graphWidth);
          const yPosition = y(Math.max(yMin, Math.min(yMax, point.db)));
          if (index === 0) context.moveTo(x, yPosition);
          else context.lineTo(x, yPosition);
        });
        context.stroke();
      }
      context.restore();
      context.setLineDash([]);

      context.fillStyle = "rgba(235,242,238,0.42)";
      context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "left";
      context.fillText("dB", 8, 10);
      context.textAlign = "right";
      context.fillText("Hz", width - 5, height - 7);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [height, issues, series, yMax, yMin]);

  return (
    <figure className="frequency-figure" aria-label={title}>
      <div className="graph-legend" aria-hidden="true">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="frequency-canvas" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
