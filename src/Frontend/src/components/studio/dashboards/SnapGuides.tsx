/**
 * SnapGuides Component
 * Displays visual alignment guides when dragging cards
 */

interface SnapLine {
  type: "vertical" | "horizontal";
  position: number;
}

interface SnapGuidesProps {
  snapLines: SnapLine[];
  canvasWidth: number;
  canvasHeight: number;
}

export function SnapGuides({ snapLines, canvasWidth, canvasHeight }: SnapGuidesProps) {
  if (snapLines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {snapLines.map((line, index) => {
        if (line.type === "vertical") {
          return (
            <line
              key={`v-${index}`}
              x1={line.position}
              y1={0}
              x2={line.position}
              y2={canvasHeight}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          );
        } else {
          return (
            <line
              key={`h-${index}`}
              x1={0}
              y1={line.position}
              x2={canvasWidth}
              y2={line.position}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          );
        }
      })}
    </svg>
  );
}
