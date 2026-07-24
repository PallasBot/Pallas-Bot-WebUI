import { useMemo, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import TruncatedText from "@/components/TruncatedText";
import type { MemoryGraphLink, MemoryGraphNode } from "@/api/memoryGraphApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };

function seedRing(nodes: MemoryGraphNode[], width: number, height: number): Record<string, Pos> {
  const cx = width / 2;
  const cy = height / 2;
  const n = Math.max(nodes.length, 1);
  const radius = Math.min(width, height) * 0.36;
  const out: Record<string, Pos> = {};
  nodes.forEach((node, i) => {
    if (n === 1) {
      out[node.id] = { x: cx, y: cy };
      return;
    }
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    out[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
  return out;
}

function layoutForce(nodes: MemoryGraphNode[], edges: MemoryGraphLink[], width: number, height: number): Record<string, Pos> {
  if (!nodes.length) return {};
  if (nodes.length === 1) {
    return { [nodes[0].id]: { x: width / 2, y: height / 2 } };
  }

  const seed = seedRing(nodes, width, height);
  const graph = new Graph({ multi: false, type: "undirected" });
  for (const node of nodes) {
    const p = seed[node.id] ?? { x: width / 2, y: height / 2 };
    graph.addNode(node.id, { x: p.x, y: p.y });
  }
  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    if (edge.source === edge.target) continue;
    const key = `${edge.source}::${edge.target}`;
    if (graph.hasEdge(key) || graph.hasEdge(`${edge.target}::${edge.source}`)) continue;
    try {
      graph.addEdgeWithKey(key, edge.source, edge.target);
    } catch {
      // ignore duplicate
    }
  }

  const iterations = Math.min(200, Math.max(40, nodes.length * 8));
  forceAtlas2.assign(graph, {
    iterations,
    settings: {
      ...forceAtlas2.inferSettings(graph),
      gravity: 1,
      scalingRatio: 8,
      barnesHutOptimize: nodes.length > 80,
    },
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const raw: Record<string, Pos> = {};
  graph.forEachNode((id, attrs) => {
    const x = Number(attrs.x) || 0;
    const y = Number(attrs.y) || 0;
    raw[id] = { x, y };
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  const pad = 36;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const out: Record<string, Pos> = {};
  for (const [id, p] of Object.entries(raw)) {
    out[id] = {
      x: pad + (p.x - minX) * scale,
      y: pad + (p.y - minY) * scale,
    };
  }
  return out;
}

function kindColor(kind: string): string {
  if (kind === "person") return "var(--chart-2, #3b82f6)";
  if (kind === "bot") return "var(--chart-1, #8b5cf6)";
  if (kind === "category") return "var(--chart-4, #f59e0b)";
  return "var(--chart-3, #10b981)";
}

/**
 * ForceAtlas2 布局 + 缩放 / 节点搜索高亮（SVG，无 sigma）。
 */
export default function MemoryForceGraph({
  nodes,
  edges,
  className,
}: {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphLink[];
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [nodeQuery, setNodeQuery] = useState("");
  const width = 640;
  const height = 360;

  const pos = useMemo(() => layoutForce(nodes, edges, width, height), [nodes, edges]);

  const matchIds = useMemo(() => {
    const needle = nodeQuery.trim().toLowerCase();
    if (!needle) return null;
    return new Set(
      nodes
        .filter((n) => {
          const label = (n.label || "").toLowerCase();
          const id = n.id.toLowerCase();
          const summary = (n.summary || "").toLowerCase();
          return label.includes(needle) || id.includes(needle) || summary.includes(needle);
        })
        .map((n) => n.id),
    );
  }, [nodeQuery, nodes]);

  const activeEdgeIds = useMemo(() => {
    if (!active) return new Set<string>();
    return new Set(
      edges.filter((e) => e.source === active || e.target === active).map((e) => e.id),
    );
  }, [active, edges]);

  const activeNode = nodes.find((n) => n.id === active) ?? null;
  const activeFact = edges.find((e) => activeEdgeIds.has(e.id) && (e.source === active || e.target === active));

  const cx = width / 2;
  const cy = height / 2;
  const transform = `translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`;

  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">暂无实体。可先写关系备注或新建实体。</p>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-7 text-xs"
            placeholder="搜索节点…"
            value={nodeQuery}
            onChange={(e) => {
              const v = e.target.value;
              setNodeQuery(v);
              const needle = v.trim().toLowerCase();
              if (!needle) return;
              const hit = nodes.find((n) => {
                const label = (n.label || "").toLowerCase();
                return label.includes(needle) || n.id.toLowerCase().includes(needle);
              });
              if (hit) setActive(hit.id);
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            aria-label="缩小"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            aria-label="放大"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            aria-label="重置缩放"
            onClick={() => setZoom(1)}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg border bg-muted/20">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[min(22rem,55vh)] w-full"
          role="img"
          aria-label="记忆关系图"
        >
          <g transform={transform}>
            {edges.map((edge) => {
              const a = pos[edge.source];
              const b = pos[edge.target];
              if (!a || !b) return null;
              const lit = !active || activeEdgeIds.has(edge.id);
              return (
                <line
                  key={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="currentColor"
                  className={cn("text-border", lit ? "opacity-80" : "opacity-20")}
                  strokeWidth={lit ? 1.6 : 1}
                />
              );
            })}
            {nodes.map((node) => {
              const p = pos[node.id];
              if (!p) return null;
              const matched = matchIds == null || matchIds.has(node.id);
              const lit =
                matched &&
                (!active ||
                  active === node.id ||
                  (activeEdgeIds.size > 0 &&
                    edges.some(
                      (e) => activeEdgeIds.has(e.id) && (e.source === node.id || e.target === node.id),
                    )));
              const focused = active === node.id;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => setActive((cur) => (cur === node.id ? null : node.id))}
                  onMouseEnter={() => setActive(node.id)}
                  onMouseLeave={() => setActive(null)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={focused ? 14 : matchIds?.has(node.id) ? 13 : 11}
                    fill={kindColor(node.kind)}
                    opacity={lit ? 1 : 0.18}
                    stroke={matchIds?.has(node.id) ? "var(--foreground)" : "none"}
                    strokeWidth={matchIds?.has(node.id) ? 2 : 0}
                  />
                  <text
                    x={p.x}
                    y={p.y + 24}
                    textAnchor="middle"
                    className="fill-foreground text-[10px]"
                    opacity={lit ? 1 : 0.25}
                  >
                    {(node.label || node.id).slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      {activeNode ? (
        <div className="rounded-md border px-3 py-2 text-sm">
          <div className="font-medium">{activeNode.label}</div>
          <div className="text-xs text-muted-foreground">
            {activeNode.kind}
            {activeNode.is_speaker ? " · speaker" : ""}
          </div>
          {activeNode.summary ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <TruncatedText text={activeNode.summary} lines={2} />
            </div>
          ) : null}
          {activeFact?.fact ? (
            <div className="mt-1 text-xs">
              关系：<TruncatedText text={activeFact.fact} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">悬停或点击节点查看详情。</p>
      )}
    </div>
  );
}
